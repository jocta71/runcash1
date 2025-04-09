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
  private pollingInterval: number = 8000; // Intervalo de 8 segundos para polling
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
      console.log('[RESTSocketService] Página voltou a ficar visível, atualizando dados');
      this.fetchDataFromREST();
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
    
    // Executar imediatamente a primeira vez
    this.fetchDataFromREST().catch(err => 
      console.error('[RESTSocketService] Erro na primeira chamada:', err)
    );
    
    // Criar um novo timer com intervalo FIXO de 8 segundos
    // Este será o ÚNICO timer no sistema que consulta a API
    this.timerId = window.setInterval(() => {
      console.log('[RESTSocketService] Executando polling em intervalo FIXO de 8 segundos');
      this.fetchDataFromREST().catch(err => 
        console.error('[RESTSocketService] Erro na chamada programada:', err)
      );
    }, 8000) as unknown as number;
    
    console.log(`[RESTSocketService] Polling com intervalo FIXO de 8000ms iniciado`);
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
      
      let data = await response.json();
      const endTime = Date.now();
      console.log(`[RESTSocketService] Chamada concluída em ${endTime - startTime}ms`);
      
      // Transformar a resposta para usar apenas os IDs simplificados
      data = this.transformApiResponse(data);
      
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
  
  // Transformar resposta da API para usar apenas IDs simplificados
  private transformApiResponse(roletas: any[]): any[] {
    if (!Array.isArray(roletas)) return roletas;
    
    return roletas.map(roleta => {
      // Se não tem números, não podemos transformar
      if (!roleta.numero || !Array.isArray(roleta.numero) || roleta.numero.length === 0) {
        return roleta;
      }
      
      // Pegar o ID simples do primeiro número
      const simpleId = roleta.numero[0].roleta_id;
      
      // Se não temos ID simples, manter o original
      if (!simpleId) return roleta;
      
      // Criar uma cópia da roleta com o ID substituído
      return {
        ...roleta,
        original_id: roleta.id, // Guardar o ID original como fallback
        id: simpleId // Substituir o ID complexo pelo ID simples
      };
    });
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
          
          // Transformar os dados do cache para garantir que usam IDs simplificados
          const transformedData = this.transformApiResponse(parsed.data);
          this.processDataAsEvents(transformedData);
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
      
      // Usar diretamente o ID que vem da API
      const uuid = roulette.id;
      
      // Registrar timestamp para cada roleta
      this.lastReceivedData.set(uuid, { timestamp: now, data: roulette });
      
      // Atualizar o histórico da roleta se houver números
      if (roulette.numero && Array.isArray(roulette.numero) && roulette.numero.length > 0) {
        // Mapear apenas os números para um array simples
        const numbers = roulette.numero.map((n: any) => n.numero || n.number || 0);
        
        // Pegar o ID simplificado diretamente do primeiro número
        const simpleId = roulette.numero[0].roleta_id || uuid;
        
        // Atualizar o histórico usando o ID simplificado
        this.setRouletteHistory(simpleId, numbers);
        
        // Emitir evento com o número mais recente
        const lastNumber = roulette.numero[0];
        
        const event: any = {
          type: 'new_number',
          roleta_id: lastNumber.roleta_id || uuid, // Usar o ID que já vem no objeto de número
          roleta_nome: roulette.nome,
          numero: lastNumber.numero || lastNumber.number || 0,
          cor: lastNumber.cor || this.determinarCorNumero(lastNumber.numero),
          timestamp: lastNumber.timestamp || new Date().toISOString()
        };
        
        // Notificar os listeners sobre o novo número
        this.notifyListeners(event);
      }
      
      // Emitir evento de estratégia se houver
      if (roulette.estado_estrategia) {
        // Tentar obter o ID simplificado do primeiro número, se existir
        const simpleId = (roulette.numero && roulette.numero.length > 0) 
          ? roulette.numero[0].roleta_id 
          : uuid;
          
        const strategyEvent: any = {
          type: 'strategy_update',
          roleta_id: simpleId, // Usar o ID simplificado se disponível
          roleta_nome: roulette.nome,
          estado: roulette.estado_estrategia,
          numero_gatilho: roulette.numero_gatilho || 0,
          vitorias: roulette.vitorias || 0,
          derrotas: roulette.derrotas || 0,
          terminais_gatilho: roulette.terminais_gatilho || []
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
      
      let data = await response.json();
      
      // Transformar a resposta para usar apenas IDs simplificados
      data = this.transformApiResponse(data);
      
      if (Array.isArray(data)) {
        // Processar os dados recebidos
        data.forEach(roleta => {
          if (roleta.id && roleta.numero && Array.isArray(roleta.numero)) {
            // Extrair apenas os números
            const numeros = roleta.numero.map((n: any) => n.numero || n.number || 0);
            
            // Pegar o ID simplificado
            const simpleId = roleta.id; // Agora já é o ID simplificado após a transformação
            
            // Armazenar no histórico
            this.setRouletteHistory(simpleId, numeros);
            
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
    
    // Criar um timer com intervalo FIXO de 8 segundos para o segundo endpoint
    setInterval(() => {
      console.log('[RESTSocketService] Executando polling do segundo endpoint em intervalo FIXO de 8 segundos');
      this.fetchSecondEndpointData().catch(err => 
        console.error('[RESTSocketService] Erro na chamada ao segundo endpoint:', err)
      );
    }, 8000);
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
      
      let data = await response.json();
      const endTime = Date.now();
      console.log(`[RESTSocketService] Chamada ao segundo endpoint concluída em ${endTime - startTime}ms`);
      
      // Transformar a resposta para usar apenas IDs simplificados
      // Não processamos estes dados, mas faremos a transformação de qualquer forma para consistência
      data = this.transformApiResponse(data);
      
      return true;
    } catch (error) {
      console.error('[RESTSocketService] Erro ao buscar dados do segundo endpoint:', error);
      return false;
    }
  }
}

export default RESTSocketService; 