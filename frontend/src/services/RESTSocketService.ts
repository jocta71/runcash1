import { toast } from '@/components/ui/use-toast';
import config from '@/config/env';
import { getRequiredEnvVar, isProduction } from '../config/env';
import { mapToCanonicalRouletteId, ROLETAS_CANONICAS } from '../integrations/api/rouletteService';
import { ROLETAS_PERMITIDAS } from '@/config/allowedRoulettes';

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
  private pollingInterval: number = 5000;
  private updateInterval: number = 30000;
  private baseEndpoint: string = '/api/ROULETTES';
  private endpoint: string = `${this.baseEndpoint}?limit=100`;
  private eventListeners: Map<string, Function[]> = new Map();
  private cache: Map<string, any> = new Map();
  private lastUpdateTime: number = 0;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private updateTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
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
    
    // Adicionar event listener para quando a janela ficar visível novamente
    window.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Iniciar como conectado
    this.connectionActive = true;
    
    // Carregar dados iniciais do localStorage se existirem
    this.loadCachedData();
    
    // Adicionar verificação de saúde do timer a cada 10 segundos
    setInterval(() => {
      this.checkTimerHealth();
    }, 10000);
    
    // Iniciar um timer mais frequente para forçar a exibição dos novos números
    setInterval(() => {
      this.forceUpdateAllListeners();
    }, 5000);
  }

  // Manipular alterações de visibilidade da página
  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      console.log('[RESTSocketService] Página voltou a ficar visível, atualizando dados');
      this.fetchDataFromREST();
    }
  }

  // Iniciar polling da API REST
  private startPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    this.pollingTimer = setInterval(() => {
      this.fetchDataFromREST();
    }, this.pollingInterval);

    // Iniciar imediatamente
    this.fetchDataFromREST();
  }
  
  // Buscar dados da API REST
  private async fetchDataFromREST() {
    try {
      const startTime = Date.now();
      console.log('[RESTSocketService] Iniciando chamada à API REST: ' + startTime);
      
      const apiBaseUrl = this.getApiBaseUrl();
      
      // IMPORTANTE: Esta é a ÚNICA chamada para a API em todo o sistema!
      // Usar sempre o mesmo endpoint com mesmos parâmetros para consistência
      const url = `${apiBaseUrl}/ROULETTES?limit=100`;
      
      console.log(`[RESTSocketService] Chamando: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar dados: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const endTime = Date.now();
      console.log(`[RESTSocketService] Chamada concluída em ${endTime - startTime}ms`);
      
      // Salvar no cache
      localStorage.setItem('roulettes_data_cache', JSON.stringify({
        timestamp: Date.now(),
        data: data
      }));
      
      // Processar os dados como eventos
      this.processDataAsEvents(data);
      
      return true;
    } catch (error) {
      console.error('[RESTSocketService] Erro ao buscar dados da API REST:', error);
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
      
      // Sempre emitir um evento para manter o componente atualizado
      this.emitRouletteUpdateEvent(roulette, 'limit-endpoint-update');
      
      // Atualizar o histórico da roleta se houver números
      if (roulette.numero && Array.isArray(roulette.numero) && roulette.numero.length > 0) {
        // Mapear apenas os números para um array simples
        const numbers = roulette.numero.map((n: any) => n.numero || n.number || 0);
        
        // Obter histórico existente e mesclar com os novos números
        const existingHistory = this.rouletteHistory.get(roulette.id) || [];
        
        // IMPORTANTE: Vamos forçar considerar como novos dados para garantir que os eventos sejam emitidos
        const isNewData = true; // Forçar processamento mesmo sem números novos
        
        if (isNewData) {
          console.log(`[RESTSocketService] Processando números para roleta ${roulette.nome || roulette.id}`);
          
          // Mesclar, evitando duplicações e preservando ordem
          const mergedNumbers = this.mergeNumbersWithoutDuplicates(numbers, existingHistory);
          
          // Limitar ao tamanho máximo
          const limitedHistory = mergedNumbers.slice(0, this.historyLimit);
          
          // Atualizar o histórico
          this.setRouletteHistory(roulette.id, limitedHistory);
          
          // Emitir evento com o número mais recente (versão compatível)
          this.emitRouletteNumberEvent(roulette, 'limit-endpoint');
          
          // Também emitir em formatos alternativos que podem ser esperados pelo RouletteCard
          this.emitCompatibilityEvents(roulette, isNewData);
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
    // Registrar o callback para o nome da roleta
    if (!this.listeners.has(roletaNome)) {
      this.listeners.set(roletaNome, new Set());
    }
    
    const listeners = this.listeners.get(roletaNome);
    if (listeners) {
      listeners.add(callback);
      console.log(`[RESTSocketService] Registrado listener para ${roletaNome}, total: ${listeners.size}`);
    }
    
    // Se for uma roleta específica (que não seja um wildcard), registrar também 
    // para o identificador "any-update" para garantir que receba todas as atualizações
    if (roletaNome !== '*' && roletaNome !== 'any-update') {
      if (!this.listeners.has('any-update')) {
        this.listeners.set('any-update', new Set());
      }
      
      const anyUpdateListeners = this.listeners.get('any-update');
      if (anyUpdateListeners) {
        anyUpdateListeners.add(callback);
        console.log(`[RESTSocketService] Registrado listener em any-update para ${roletaNome}`);
      }
    }
    
    // Disparar imediatamente evento com dados em cache, se existirem
    if (roletaNome !== '*' && roletaNome !== 'any-update') {
      // Tentar encontrar dados existentes para esta roleta
      const roletaData = this.lastReceivedData.get(roletaNome) || 
                        this.lastReceivedData.get(`base-${roletaNome}`);
      
      if (roletaData && roletaData.data) {
        console.log(`[RESTSocketService] Disparando dados em cache para novo listener de ${roletaNome}`);
        
        // Criar um evento simulado com os dados em cache
        const cachedEvent = {
          type: 'new_number',
          roleta_id: roletaNome,
          roleta_nome: roletaData.data.nome || roletaNome,
          numero: roletaData.data.numero ? roletaData.data.numero[0]?.numero : 0,
          cor: this.determinarCorNumero(roletaData.data.numero ? roletaData.data.numero[0]?.numero : 0),
          timestamp: new Date().toISOString(),
          source: 'cache'
        };
        
        // Chamar o callback com os dados em cache
        try {
          callback(cachedEvent);
        } catch (error) {
          console.error(`[RESTSocketService] Erro ao disparar dados em cache para ${roletaNome}:`, error);
        }
      }
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
    console.log(`[RESTSocketService] Emitindo evento: ${event.type} para roleta ${event.roleta_nome} (${event.source})`);
    
    // Forçar emissão para todos (tanto pelo nome da roleta quanto pelo wildcard)
    // Primeiro, listeners específicos para esta roleta
    const roletaListeners = this.listeners.get(event.roleta_nome);
    if (roletaListeners) {
      console.log(`[RESTSocketService] Enviando para ${roletaListeners.size} listeners de ${event.roleta_nome}`);
      roletaListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error(`[RESTSocketService] Erro em listener para ${event.roleta_nome}:`, error);
        }
      });
    } else {
      console.log(`[RESTSocketService] Nenhum listener encontrado especificamente para ${event.roleta_nome}`);
    }
    
    // Depois, listeners globais (marcados com "*")
    const globalListeners = this.listeners.get('*');
    if (globalListeners) {
      console.log(`[RESTSocketService] Enviando para ${globalListeners.size} listeners globais`);
      globalListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('[RESTSocketService] Erro em listener global:', error);
        }
      });
    }
    
    // Tentar também pelo ID da roleta (alguns componentes podem estar escutando pelo ID)
    if (event.roleta_id) {
      const idListeners = this.listeners.get(event.roleta_id);
      if (idListeners) {
        console.log(`[RESTSocketService] Enviando para ${idListeners.size} listeners do ID ${event.roleta_id}`);
        idListeners.forEach(callback => {
          try {
            callback(event);
          } catch (error) {
            console.error(`[RESTSocketService] Erro em listener para ID ${event.roleta_id}:`, error);
          }
        });
      }
    }
    
    // Emitir também um evento genérico para qualquer atualização
    const anyUpdateListeners = this.listeners.get('any-update');
    if (anyUpdateListeners) {
      console.log(`[RESTSocketService] Enviando para ${anyUpdateListeners.size} listeners de qualquer atualização`);
      anyUpdateListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('[RESTSocketService] Erro em listener de qualquer atualização:', error);
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
    return this.fetchDataFromREST();
  }

  public getRouletteHistory(roletaId: string): number[] {
    return this.rouletteHistory.get(roletaId) || [];
  }

  public setRouletteHistory(roletaId: string, numbers: number[]): void {
    this.rouletteHistory.set(roletaId, numbers.slice(0, this.historyLimit));
  }

  public async requestRouletteNumbers(roletaId: string): Promise<boolean> {
    return this.fetchDataFromREST();
  }

  public isConnected(): boolean {
    return this.connectionActive;
  }

  public async loadHistoricalRouletteNumbers(): Promise<void> {
    console.log('[RESTSocketService] Carregando dados históricos de todas as roletas');
    
    try {
      this._isLoadingHistoricalData = true;
      
      // Buscar todas as roletas com dados históricos
      const apiBaseUrl = this.getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/ROULETTES?limit=1000`);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar dados históricos: ${response.status}`);
      }
      
      const data = await response.json();
      
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
      this.reconnect();
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
    console.log('[RESTSocketService] Iniciando polling do segundo endpoint sem parâmetro');
    
    // Executar imediatamente a primeira vez
    this.fetchSecondEndpointData().catch(err => 
      console.error('[RESTSocketService] Erro na primeira chamada ao segundo endpoint:', err)
    );
    
    // Criar um timer com intervalo FIXO de 6 segundos para o segundo endpoint
    // (diferente do polling principal para evitar sobrecarga simultânea)
    setInterval(() => {
      console.log('[RESTSocketService] Executando polling do segundo endpoint em intervalo FIXO de 6 segundos');
      this.fetchSecondEndpointData().catch(err => 
        console.error('[RESTSocketService] Erro na chamada ao segundo endpoint:', err)
      );
    }, 6000);
  }
  
  // Método para buscar dados do segundo endpoint (/api/ROULETTES sem parâmetro)
  private async fetchSecondEndpointData() {
    try {
      const startTime = Date.now();
      console.log('[RESTSocketService] Iniciando chamada ao segundo endpoint: ' + startTime);
      
      const apiBaseUrl = this.getApiBaseUrl();
      
      // Endpoint sem parâmetro
      const url = `${apiBaseUrl}/ROULETTES`;
      
      console.log(`[RESTSocketService] Chamando segundo endpoint: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar dados do segundo endpoint: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const endTime = Date.now();
      console.log(`[RESTSocketService] Chamada ao segundo endpoint concluída em ${endTime - startTime}ms`);
      
      // Processar os dados recebidos
      if (Array.isArray(data)) {
        console.log(`[RESTSocketService] Processando ${data.length} roletas do endpoint sem parâmetro`);
        
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
          
          // Sempre emitir um evento para manter o componente atualizado
          this.emitRouletteUpdateEvent(roulette, 'base-endpoint-update');
          
          // Atualizar o histórico da roleta se houver números
          if (roulette.numero && Array.isArray(roulette.numero) && roulette.numero.length > 0) {
            // Mapear apenas os números para um array simples
            const numbers = roulette.numero.map((n: any) => n.numero || n.number || 0);
            
            // Obter histórico existente 
            const existingHistory = this.rouletteHistory.get(roulette.id) || [];
            
            // IMPORTANTE: Vamos forçar considerar como novos dados para garantir que os eventos sejam emitidos
            const isNewData = true; // Forçar processamento mesmo sem números novos
            
            if (isNewData) {
              console.log(`[RESTSocketService] Processando números para roleta ${roulette.nome || roulette.id} (endpoint-base)`);
              
              // Mesclar, evitando duplicações e preservando ordem
              const mergedNumbers = this.mergeNumbersWithoutDuplicates(numbers, existingHistory);
              
              // Atualizar o histórico com mesclagem para preservar números antigos
              this.setRouletteHistory(roulette.id, mergedNumbers);
              
              // Emitir evento com o número mais recente (versão compatível)
              this.emitRouletteNumberEvent(roulette, 'base-endpoint');
              
              // Também emitir em formatos alternativos que podem ser esperados pelo RouletteCard
              this.emitCompatibilityEvents(roulette, isNewData);
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
              source: 'base-endpoint' // Marcar a origem para depuração
            };
            
            // Notificar os listeners sobre a atualização de estratégia
            this.notifyListeners(strategyEvent);
          }
        });
      }
      
      return true;
    } catch (error) {
      console.error('[RESTSocketService] Erro ao buscar dados do segundo endpoint:', error);
      return false;
    }
  }
  
  // Método auxiliar para emitir evento de número
  private emitRouletteNumberEvent(roulette: any, source: string): void {
    if (!roulette.numero || !Array.isArray(roulette.numero) || roulette.numero.length === 0) {
      return;
    }
    
    // Obter o número mais recente
    const lastNumber = roulette.numero[0];
    
    const event: any = {
      type: 'new_number',
      roleta_id: roulette.id,
      roleta_nome: roulette.nome,
      numero: lastNumber.numero || lastNumber.number || 0,
      cor: lastNumber.cor || this.determinarCorNumero(lastNumber.numero || lastNumber.number || 0),
      timestamp: lastNumber.timestamp || new Date().toISOString(),
      source: source
    };
    
    // Notificar os listeners
    this.notifyListeners(event);
  }
  
  // Método auxiliar para emitir evento de atualização da roleta
  private emitRouletteUpdateEvent(roulette: any, source: string): void {
    // Evento genérico de atualização
    const updateEvent: any = {
      type: 'roulette_update',
      roleta_id: roulette.id,
      roleta_nome: roulette.nome,
      data: roulette,
      timestamp: new Date().toISOString(),
      source: source
    };
    
    // Notificar os listeners 
    this.notifyListeners(updateEvent);
  }
  
  /**
   * Emite eventos em formatos compatíveis com versões anteriores da aplicação
   */
  private emitCompatibilityEvents(roulette: any, isNewNumber: boolean): void {
    if (!roulette || !roulette.numeros || roulette.numeros.length === 0) {
      return;
    }

    const latestNumber = roulette.numeros[0];

    // Evento de novo número no formato simplificado
    const simplifiedEvent = {
      type: 'new_number',
      numero: latestNumber.numero,
      roleta_id: roulette.roleta_id,
      roleta_nome: roulette.roleta_nome,
      cor: latestNumber.cor,
      data_hora: latestNumber.data_hora,
      paridade: latestNumber.paridade,
      duzias: latestNumber.duzias,
      colunas: latestNumber.colunas,
      numeros: roulette.numeros
    };

    // Evento no formato de compatibilidade legado
    const legacyCompatEvent = {
      ...simplifiedEvent,
      ultimo_numero: latestNumber,
      historico: roulette.numeros
    };

    // Emitir apenas o evento simplificado
    if (isNewNumber) {
      this.notifyListeners(simplifiedEvent);
    }

    // Emitir evento de compatibilidade para versões legadas apenas se for um novo número
    if (isNewNumber) {
      this.notifyListeners(legacyCompatEvent);
    }
  }
  
  // Notificar especificamente um listener pelo ID
  private notifySpecificListener(id: string, data: any): void {
    const listeners = this.listeners.get(id);
    if (listeners && listeners.size > 0) {
      console.log(`[RESTSocketService] Notificando ${listeners.size} listeners específicos para ID ${id}`);
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[RESTSocketService] Erro ao notificar listener específico para ${id}:`, error);
        }
      });
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

  // Forçar atualização em todos os listeners
  private forceUpdateAllListeners() {
    console.log('[RESTSocketService] Forçando atualização em todos os listeners');
    
    // Para cada roleta no nosso cache de dados
    this.lastReceivedData.forEach((data, id) => {
      // Ignorar entradas que não são roletas específicas
      if (id === 'global' || id === 'endpoint-base' || !data.data || !data.data.numero) {
        return;
      }
      
      try {
        // Criar um evento simulado
        const forceEvent = {
          type: 'force_update',
          roleta_id: id,
          roleta_nome: data.data.nome || id,
          timestamp: new Date().toISOString(),
          data: data.data,
          source: 'force-update'
        };
        
        // Emitir para os listeners específicos desta roleta
        this.notifySpecificListener(id, forceEvent);
        
        // Se tivermos números, emitir um evento de número também
        if (data.data.numero && Array.isArray(data.data.numero) && data.data.numero.length > 0) {
          const numero = data.data.numero[0].numero || data.data.numero[0].number || 0;
          
          // Evento de número simples
          const numeroEvent = {
            type: 'numero',
            roleta_id: id,
            numero: numero,
            timestamp: new Date().toISOString()
          };
          
          this.notifySpecificListener(id, numeroEvent);
          
          // Também notificar diretamente pelo tipo "new_number" que o RouletteCard pode estar ouvindo
          const newNumberEvent = {
            type: 'new_number',
            roleta_id: id,
            roleta_nome: data.data.nome || id,
            numero: numero,
            cor: this.determinarCorNumero(numero),
            timestamp: new Date().toISOString(),
            source: 'force-update'
          };
          
          this.notifySpecificListener(id, newNumberEvent);
          this.notifyListeners(newNumberEvent);
        }
      } catch (e) {
        console.error(`[RESTSocketService] Erro ao forçar atualização para roleta ${id}:`, e);
      }
    });
  }

  private startUpdateTimer(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    this.updateTimer = setInterval(() => {
      this.updateLocalStorage();
    }, this.updateInterval);
  }

  // Método para atualizar o localStorage com dados em cache
  private updateLocalStorage(): void {
    try {
      // Salvar dados das roletas em cache no localStorage
      const cacheData = Array.from(this.lastReceivedData.entries())
        .filter(([key, _]) => !key.includes('global') && !key.includes('endpoint'))
        .map(([_, value]) => value.data)
        .filter(data => data && data.id);
      
      if (cacheData.length > 0) {
        localStorage.setItem('roulettes_data_cache', JSON.stringify({
          timestamp: Date.now(),
          data: cacheData
        }));
        console.log(`[RESTSocketService] Salvos ${cacheData.length} itens no localStorage`);
      }
    } catch (error) {
      console.error('[RESTSocketService] Erro ao atualizar localStorage:', error);
    }
  }

  // Método de obtenção de dados
  private fetchData(): void {
    this.fetchDataFromREST().catch(err => {
      console.error('[RESTSocketService] Erro ao buscar dados:', err);
    });
  }
}

export default RESTSocketService; 