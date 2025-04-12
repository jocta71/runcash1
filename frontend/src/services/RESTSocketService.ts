import { toast } from '@/components/ui/use-toast';
import config from '@/config/env';
import { getRequiredEnvVar, isProduction } from '../config/env';
import { mapToCanonicalRouletteId, ROLETAS_CANONICAS } from '../integrations/api/rouletteService';
import { ROLETAS_PERMITIDAS } from '@/config/allowedRoulettes';
import globalRouletteDataService from '@/services/GlobalRouletteDataService';

// Adicionar tipagem para NodeJS.Timeout para evitar erro de tipo
declare global {
  namespace NodeJS {
    interface Timeout {}
  }
}

// Exportar interfaces para histórico
export interface HistoryRequest {
  roletaId: string;
}

export interface HistoryData {
  roletaId: string;
  roletaNome?: string;
  numeros: {
    numero: number;
    timestamp: Date;
  }[];
  createdAt?: Date;
  updatedAt?: Date;
  totalRegistros?: number;
  message?: string;
  error?: string;
}

/**
 * Serviço que gerencia o acesso a dados de roletas via API REST
 * Substitui o antigo serviço de WebSocket, mantendo a mesma interface
 */
class RESTSocketService {
  private static instance: RESTSocketService;
  private listeners: Map<string, Set<any>> = new Map();
  private connectionActive: boolean = false;
  private timerId: number | null = null;
  private _lastCreatedTimerId: number | null = null; // Adicionar para controle interno
  private pollingInterval: number = 4000; // Intervalo de 4 segundos para polling
  private lastReceivedData: Map<string, { timestamp: number, data: any }> = new Map();
  
  // Propriedade para simular estado de conexão
  public client?: any;
  
  // Mapa para armazenar os intervalos de polling por roletaId
  private pollingIntervals: Map<string, number> = new Map();
  
  private _isLoadingHistoricalData: boolean = false;
  
  // Adicionar uma propriedade para armazenar o histórico completo por roleta  
  private rouletteHistory: Map<string, number[]> = new Map();
  private historyLimit: number = 1000;
  
  // Adicionar propriedade para armazenar cache de dados das roletas
  private rouletteDataCache: Map<string, {data: any, timestamp: number}> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutos em milissegundos
  
  private constructor() {
    console.log('[RESTSocketService] Inicializando serviço REST API com polling');
    
    // Adicionar listener global para logging de todos os eventos
    this.subscribe('*', (event: any) => {
      if (event.type === 'new_number') {
        console.log(`[RESTSocketService][GLOBAL] Evento recebido para roleta: ${event.roleta_nome}, número: ${event.numero}`);
      } else if (event.type === 'strategy_update') {
        console.log(`[RESTSocketService][GLOBAL] Atualização de estratégia para roleta: ${event.roleta_nome}, estado: ${event.estado}`);
      }
    });

    // Iniciar o polling da API REST
    this.startPolling();
    
    // Iniciar também o polling para o endpoint sem parâmetro
    this.startSecondEndpointPolling();
    
    // Adicionar event listener para quando a janela ficar visível novamente
    window.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Iniciar como conectado
    this.connectionActive = true;
    
    // Carregar dados iniciais do localStorage se existirem
    this.loadCachedData();
    
    // Adicionar verificação de saúde do timer a cada 30 segundos
    setInterval(() => {
      this.checkTimerHealth();
    }, 30000);
  }

  // Manipular alterações de visibilidade da página
  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      console.log('[RESTSocketService] Página voltou a ficar visível, solicitando atualização via serviço global');
      globalRouletteDataService.forceUpdate();
    }
  }

  // Iniciar polling da API REST
  private startPolling() {
    // Limpar qualquer timer existente
    if (this.timerId) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }

    this.connectionActive = true;
    
    console.log('[RESTSocketService] Não criando timer próprio - usando serviço global centralizado');
    
    // Registrar para receber atualizações do serviço global
    globalRouletteDataService.subscribe('RESTSocketService-main', () => {
      console.log('[RESTSocketService] Recebendo atualização do serviço global centralizado');
      // Reprocessar dados do serviço global quando houver atualização
      const data = globalRouletteDataService.getAllRoulettes();
      if (data && Array.isArray(data)) {
        this.processDataAsEvents(data);
      }
    });
    
    // Processar dados iniciais se disponíveis
    const initialData = globalRouletteDataService.getAllRoulettes();
    if (initialData && initialData.length > 0) {
      console.log('[RESTSocketService] Processando dados iniciais do serviço global');
      this.processDataAsEvents(initialData);
    }
    
    // Criar um timer de verificação para garantir que o serviço global está funcionando
    this.timerId = window.setInterval(() => {
      // Verificação simples para manter o timer ativo
      this.lastReceivedData.set('heartbeat', { timestamp: Date.now(), data: null });
    }, this.pollingInterval);
  }
  
  // Buscar dados da API REST
  private async fetchDataFromREST() {
    try {
      const startTime = Date.now();
      console.log('[RESTSocketService] Obtendo dados através do serviço global centralizado');
      
      // Usar o serviço global centralizado em vez de fazer chamada direta à API
      const data = await globalRouletteDataService.fetchRouletteData();
      
      if (!data || !Array.isArray(data)) {
        throw new Error('Dados recebidos do serviço global não são válidos');
      }
      
      const endTime = Date.now();
      console.log(`[RESTSocketService] Dados obtidos do serviço global em ${endTime - startTime}ms`);
      
      // Processar os dados como eventos
      this.processDataAsEvents(data);
      
      return true;
    } catch (error) {
      console.error('[RESTSocketService] Erro ao obter dados do serviço global:', error);
      return false;
    }
  }
  
  // Carregar dados do cache
  private loadCachedData() {
    try {
      const cachedData = localStorage.getItem('roulettes_data_cache');
      
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        
        // Verificar se o cache não está muito antigo (máx 10 minutos)
        const now = Date.now();
        if (now - parsed.timestamp < 10 * 60 * 1000) {
          console.log('[RESTSocketService] Usando dados em cache para inicialização rápida');
          this.processDataAsEvents(parsed.data);
        }
      }
    } catch (error) {
      console.warn('[RESTSocketService] Erro ao carregar dados do cache:', error);
    }
  }
  
  // Processar dados da API como eventos de WebSocket
  private processDataAsEvents(data: any[]) {
    if (!Array.isArray(data)) {
      console.warn('[RESTSocketService] Dados recebidos não são um array:', data);
      return;
    }
    
    console.log(`[RESTSocketService] Processando ${data.length} roletas da API REST`);
    
    // Registrar esta chamada como bem-sucedida
    const now = Date.now();
    this.lastReceivedData.set('global', { timestamp: now, data: { count: data.length } });
    
    // Para cada roleta, emitir eventos
    data.forEach(roulette => {
      if (!roulette || !roulette.id) return;
      
      // Registrar timestamp para cada roleta
      this.lastReceivedData.set(roulette.id, { timestamp: now, data: roulette });
      
      // Atualizar o histórico da roleta se houver números
      if (roulette.numero && Array.isArray(roulette.numero) && roulette.numero.length > 0) {
        // Mapear apenas os números para um array simples
        const numbers = roulette.numero.map((n: any) => n.numero || n.number || 0);
        
        // Obter histórico existente e mesclar com os novos números
        const existingHistory = this.rouletteHistory.get(roulette.id) || [];
        
        // Verificar se já existe o primeiro número na lista para evitar duplicação
        const isNewData = existingHistory.length === 0 || 
                         existingHistory[0] !== numbers[0] ||
                         !existingHistory.includes(numbers[0]);
        
        if (isNewData) {
          console.log(`[RESTSocketService] Novos números detectados para roleta ${roulette.nome || roulette.id}`);
          
          // Mesclar, evitando duplicações e preservando ordem
          const mergedNumbers = this.mergeNumbersWithoutDuplicates(numbers, existingHistory);
          
          // Limitar ao tamanho máximo
          const limitedHistory = mergedNumbers.slice(0, this.historyLimit);
          
          // Atualizar o histórico
          this.setRouletteHistory(roulette.id, limitedHistory);
          
          // Emitir evento com o número mais recente
          const lastNumber = roulette.numero[0];
          
          const event: any = {
            type: 'new_number',
            roleta_id: roulette.id,
            roleta_nome: roulette.nome,
            numero: lastNumber.numero || lastNumber.number || 0,
            cor: lastNumber.cor || this.determinarCorNumero(lastNumber.numero),
            timestamp: lastNumber.timestamp || new Date().toISOString(),
            source: 'limit-endpoint' // Marcar a origem para depuração
          };
          
          // Notificar os listeners sobre o novo número
          this.notifyListeners(event);
        }
      }
      
      // Emitir evento de estratégia se houver
      if (roulette.estado_estrategia) {
        const strategyEvent: any = {
          type: 'strategy_update',
          roleta_id: roulette.id,
          roleta_nome: roulette.nome,
          estado: roulette.estado_estrategia,
          numero_gatilho: roulette.numero_gatilho || 0,
          vitorias: roulette.vitorias || 0,
          derrotas: roulette.derrotas || 0,
          terminais_gatilho: roulette.terminais_gatilho || [],
          source: 'limit-endpoint' // Marcar a origem para depuração
        };
        
        // Notificar os listeners sobre a atualização de estratégia
        this.notifyListeners(strategyEvent);
      }
    });
  }

  private determinarCorNumero(numero: number): string {
    if (numero === 0) return 'verde';
    if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(numero)) {
      return 'vermelho';
    }
    return 'preto';
  }

  // Singleton
  public static getInstance(): RESTSocketService {
    if (!RESTSocketService.instance) {
      RESTSocketService.instance = new RESTSocketService();
    }
    return RESTSocketService.instance;
  }

  private getApiBaseUrl(): string {
    // Em ambiente de produção, usar o proxy da Vercel para evitar problemas de CORS
    if (isProduction) {
      // Usar o endpoint relativo que será tratado pelo proxy da Vercel
      return '/api';
    }
    
    // Em desenvolvimento, usar a URL completa da API
    return getRequiredEnvVar('VITE_API_BASE_URL');
  }

  // Métodos públicos que mantém compatibilidade com a versão WebSocket

  public subscribe(roletaNome: string, callback: any): void {
    if (!this.listeners.has(roletaNome)) {
      this.listeners.set(roletaNome, new Set());
    }
    
    const listeners = this.listeners.get(roletaNome);
    if (listeners) {
      listeners.add(callback);
      console.log(`[RESTSocketService] Registrado listener para ${roletaNome}, total: ${listeners.size}`);
    }
  }

  public unsubscribe(roletaNome: string, callback: any): void {
    const listeners = this.listeners.get(roletaNome);
    if (listeners) {
      listeners.delete(callback);
      console.log(`[RESTSocketService] Listener removido para ${roletaNome}, restantes: ${listeners.size}`);
    }
  }

  private notifyListeners(event: any): void {
    // Notificar listeners específicos para esta roleta
    const listeners = this.listeners.get(event.roleta_nome);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error(`[RESTSocketService] Erro em listener para ${event.roleta_nome}:`, error);
        }
      });
    }
    
    // Notificar listeners globais (marcados com "*")
    const globalListeners = this.listeners.get('*');
    if (globalListeners) {
      globalListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('[RESTSocketService] Erro em listener global:', error);
        }
      });
    }
  }

  public disconnect(): void {
    console.log('[RESTSocketService] Desconectando serviço de polling');
    
    if (this.timerId) {
      console.log('[RESTSocketService] Limpando timer:', this.timerId);
      try {
        window.clearInterval(this.timerId);
      } catch (e) {
        console.error('[RESTSocketService] Erro ao limpar timer:', e);
      }
      this.timerId = null;
    }
    
    this.connectionActive = false;
    console.log('[RESTSocketService] Serviço de polling desconectado');
  }

  public reconnect(): void {
    console.log('[RESTSocketService] Reconectando serviço de polling');
    
    // Limpar intervalo existente para garantir
    if (this.timerId) {
      console.log('[RESTSocketService] Limpando timer existente antes de reconectar');
      try {
        window.clearInterval(this.timerId);
      } catch (e) {
        console.error('[RESTSocketService] Erro ao limpar timer existente:', e);
      }
      this.timerId = null;
    }
    
    // Reiniciar polling com certeza de intervalo fixo de 8s
    setTimeout(() => {
      this.startPolling();
      
      // Verificar se o timer foi realmente criado
      if (!this.timerId) {
        console.warn('[RESTSocketService] Timer não foi criado na reconexão. Criando manualmente...');
        this.timerId = window.setInterval(() => {
          this.lastReceivedData.set('heartbeat', { timestamp: Date.now(), data: null });
        }, this.pollingInterval);
      }
    }, 100); // Pequeno atraso para garantir que o timer anterior foi limpo
  }

  public isSocketConnected(): boolean {
    return this.connectionActive;
  }

  public getConnectionStatus(): boolean {
    return this.connectionActive;
  }

  public emit(eventName: string, data: any): void {
    console.log(`[RESTSocketService] Simulando emissão de evento ${eventName} (não implementado em modo REST)`);
  }

  public hasRealData(): boolean {
    return this.rouletteDataCache.size > 0 || this.lastReceivedData.size > 0;
  }

  public async requestRecentNumbers(): Promise<boolean> {
    try {
      console.log('[RESTSocketService] Forçando atualização de dados via serviço global');
      await globalRouletteDataService.forceUpdate();
      
      // Processar os dados atualizados
      const data = globalRouletteDataService.getAllRoulettes();
      if (data && Array.isArray(data)) {
        this.processDataAsEvents(data);
      }
      
      return true;
    } catch (error) {
      console.error('[RESTSocketService] Erro ao atualizar dados:', error);
      return false;
    }
  }

  public getRouletteHistory(roletaId: string): number[] {
    return this.rouletteHistory.get(roletaId) || [];
  }

  public setRouletteHistory(roletaId: string, numbers: number[]): void {
    this.rouletteHistory.set(roletaId, numbers.slice(0, this.historyLimit));
  }

  public async requestRouletteNumbers(roletaId: string): Promise<boolean> {
    try {
      console.log(`[RESTSocketService] Buscando números para roleta ${roletaId} via serviço global`);
      await globalRouletteDataService.forceUpdate();
      
      // Processar os dados atualizados
      const data = globalRouletteDataService.getAllRoulettes();
      if (data && Array.isArray(data)) {
        const roleta = data.find(r => r.id === roletaId);
        if (roleta && roleta.numero && Array.isArray(roleta.numero)) {
          // Extrair apenas os números
          const numeros = roleta.numero.map((n: any) => n.numero || n.number || 0);
          
          // Atualizar o histórico
          this.setRouletteHistory(roletaId, numeros);
          console.log(`[RESTSocketService] Atualizados ${numeros.length} números para roleta ${roletaId}`);
        }
      }
      
      return true;
    } catch (error) {
      console.error(`[RESTSocketService] Erro ao buscar números para roleta ${roletaId}:`, error);
      return false;
    }
  }

  public isConnected(): boolean {
    return this.connectionActive;
  }

  public async loadHistoricalRouletteNumbers(): Promise<void> {
    console.log('[RESTSocketService] Carregando dados históricos de todas as roletas');
    
    try {
      this._isLoadingHistoricalData = true;
      
      // Buscar dados detalhados pelo serviço global
      const data = await globalRouletteDataService.fetchDetailedRouletteData();
      
      if (Array.isArray(data)) {
        // Processar os dados recebidos
        data.forEach(roleta => {
          if (roleta.id && roleta.numero && Array.isArray(roleta.numero)) {
            // Extrair apenas os números
            const numeros = roleta.numero.map((n: any) => n.numero || n.number || 0);
            
            // Armazenar no histórico
            this.setRouletteHistory(roleta.id, numeros);
            
            console.log(`[RESTSocketService] Carregados ${numeros.length} números históricos para ${roleta.nome || 'roleta desconhecida'}`);
          }
        });
        
        console.log(`[RESTSocketService] Dados históricos carregados para ${data.length} roletas`);
      }
    } catch (error) {
      console.error('[RESTSocketService] Erro ao carregar dados históricos:', error);
    } finally {
      this._isLoadingHistoricalData = false;
    }
  }

  public destroy(): void {
    console.log('[RESTSocketService] Destruindo serviço');
    
    // Limpar intervalos
    if (this.timerId) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    
    // Remover event listeners
    window.removeEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Limpar todos os listeners
    this.listeners.clear();
    
    // Desativar conexão
    this.connectionActive = false;
  }

  // Verificar a saúde do timer de polling e corrigir se necessário
  private checkTimerHealth(): void {
    console.log('[RESTSocketService] Verificando saúde do timer de polling');
    
    if (this.connectionActive && !this.timerId) {
      console.warn('[RESTSocketService] Timer ativo mas variável timerId nula. Corrigindo...');
      
      // Primeiro limpar qualquer timer que possa existir mas não está referenciado
      try {
        if (this._lastCreatedTimerId) {
          window.clearInterval(this._lastCreatedTimerId);
        }
      } catch (e) {}
      
      // Criar um novo timer
      this.timerId = window.setInterval(() => {
        this.lastReceivedData.set('heartbeat', { timestamp: Date.now(), data: null });
      }, this.pollingInterval);
      
      // Não chamar reconnect() para evitar loop
      return;
    }
    
    // Verificar se faz muito tempo desde a última chamada bem-sucedida
    const now = Date.now();
    const lastReceivedData = Array.from(this.lastReceivedData.values());
    if (lastReceivedData.length > 0) {
      const mostRecent = Math.max(...lastReceivedData.map(data => data.timestamp));
      const timeSinceLastData = now - mostRecent;
      
      if (timeSinceLastData > 20000) { // Mais de 20 segundos sem dados
        console.warn(`[RESTSocketService] Possível timer travado. Último dado recebido há ${timeSinceLastData}ms. Reiniciando...`);
        this.reconnect();
      }
    }
  }

  // Método para iniciar o polling do segundo endpoint (/api/ROULETTES sem parâmetro)
  private startSecondEndpointPolling() {
    console.log('[RESTSocketService] Iniciando polling do segundo endpoint via serviço centralizado');
    
    // Usar o GlobalRouletteDataService para obter dados
    globalRouletteDataService.subscribe('RESTSocketService', () => {
      console.log('[RESTSocketService] Recebendo dados do serviço centralizado');
      this.processDataFromCentralService();
    });
    
    // Executar imediatamente a primeira vez
    this.processDataFromCentralService();
  }
  
  // Método para processar dados do serviço centralizado
  private async processDataFromCentralService() {
    try {
      const startTime = Date.now();
      console.log('[RESTSocketService] Processando dados do serviço centralizado: ' + startTime);
      
      // Obter dados do serviço global
      const data = globalRouletteDataService.getAllRoulettes();
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        console.log('[RESTSocketService] Sem dados disponíveis no serviço centralizado, aguardando...');
        return;
      }
      
      console.log(`[RESTSocketService] Processando ${data.length} roletas do serviço centralizado`);
      
      // Registrar esta chamada como bem-sucedida
      const now = Date.now();
      this.lastReceivedData.set('endpoint-base', { timestamp: now, data: { count: data.length } });
      
      // Salvar no cache com uma chave diferente para não conflitar
      localStorage.setItem('roulettes_data_cache_base', JSON.stringify({
        timestamp: Date.now(),
        data: data
      }));
      
      // Para cada roleta, processar os dados
      data.forEach(roulette => {
        if (!roulette || !roulette.id) return;
        
        // Registrar timestamp para cada roleta
        this.lastReceivedData.set(`base-${roulette.id}`, { timestamp: now, data: roulette });
        
        // Atualizar o histórico da roleta se houver números
        if (roulette.numero && Array.isArray(roulette.numero) && roulette.numero.length > 0) {
          // Mapear apenas os números para um array simples
          const numbers = roulette.numero.map((n: any) => n.numero || n.number || 0);
          
          // Obter histórico existente 
          const existingHistory = this.rouletteHistory.get(roulette.id) || [];
          
          // Verificar se já existe o primeiro número na lista para evitar duplicação
          const isNewData = existingHistory.length === 0 || 
                            existingHistory[0] !== numbers[0] ||
                            !existingHistory.includes(numbers[0]);
          
          if (isNewData) {
            console.log(`[RESTSocketService] Novos números detectados para roleta ${roulette.nome || roulette.id} (central-service)`);
            
            // Mesclar, evitando duplicações e preservando ordem
            const mergedNumbers = this.mergeNumbersWithoutDuplicates(numbers, existingHistory);
            
            // Atualizar o histórico com mesclagem para preservar números antigos
            this.setRouletteHistory(roulette.id, mergedNumbers);
            
            // Emitir evento com o número mais recente
            const lastNumber = roulette.numero[0];
            
            const event: any = {
              type: 'new_number',
              roleta_id: roulette.id,
              roleta_nome: roulette.nome,
              numero: lastNumber.numero || lastNumber.number || 0,
              cor: lastNumber.cor || this.determinarCorNumero(lastNumber.numero),
              timestamp: lastNumber.timestamp || new Date().toISOString(),
              source: 'central-service' // Marcar a origem para depuração
            };
            
            // Notificar os listeners sobre o novo número
            this.notifyListeners(event);
          }
        }
        
        // Emitir evento de estratégia se houver
        if (roulette.estado_estrategia) {
          const strategyEvent: any = {
            type: 'strategy_update',
            roleta_id: roulette.id,
            roleta_nome: roulette.nome,
            estado: roulette.estado_estrategia,
            numero_gatilho: roulette.numero_gatilho || 0,
            vitorias: roulette.vitorias || 0,
            derrotas: roulette.derrotas || 0,
            terminais_gatilho: roulette.terminais_gatilho || [],
            source: 'central-service' // Marcar a origem para depuração
          };
          
          // Notificar os listeners sobre a atualização de estratégia
          this.notifyListeners(strategyEvent);
        }
      });
      
      const endTime = Date.now();
      console.log(`[RESTSocketService] Processamento concluído em ${endTime - startTime}ms`);
      
      return true;
    } catch (error) {
      console.error('[RESTSocketService] Erro ao processar dados do serviço centralizado:', error);
      return false;
    }
  }

  // Função auxiliar para mesclar arrays de números sem duplicações
  private mergeNumbersWithoutDuplicates(newNumbers: number[], existingNumbers: number[]): number[] {
    // Criar um Set a partir dos números existentes para verificação rápida
    const existingSet = new Set(existingNumbers);
    
    // Array para armazenar os números mesclados
    const mergedNumbers = [...existingNumbers];
    
    // Adicionar apenas números novos
    for (const num of newNumbers) {
      if (!existingSet.has(num)) {
        mergedNumbers.unshift(num); // Adicionar no início para manter os mais recentes primeiro
        existingSet.add(num);
      }
    }
    
    return mergedNumbers;
  }
}

export default RESTSocketService; 