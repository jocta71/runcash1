import { toast } from '@/components/ui/use-toast';
import config from '@/config/env';
import EventService, { 
  RouletteEvent,
  RouletteNumberEvent,
  RouletteEventCallback,
  StrategyUpdateEvent,
  RouletteHistoryEvent
} from './EventService';
import { getRequiredEnvVar, isProduction } from '../config/env';
import { mapToCanonicalRouletteId, ROLETAS_CANONICAS } from '../integrations/api/rouletteService';

// Importando o serviço de estratégia para simular respostas
import StrategyService from './StrategyService';

// Interface para eventos
interface SocketEvent {
  type: string;
  roleta_id: string;
  roleta_nome: string;
  [key: string]: any;
}

// Tipo para definir uma roleta
interface Roulette {
  _id: string;
  id?: string;
  nome?: string;
  name?: string;
}

// Adicionar tipos para histórico
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

// Definir interfaces estendidas para os tipos de eventos
export interface ExtendedStrategyUpdateEvent extends StrategyUpdateEvent {
  vitorias?: number;
  derrotas?: number;
  terminais_gatilho?: number[];
  numero_gatilho?: number;
  sugestao_display?: string;
}

export interface ExtendedRouletteNumberEvent extends RouletteNumberEvent {
  preserve_existing?: boolean;
  realtime_update?: boolean;
}

// Importar a lista de roletas permitidas da configuração
import { ROLETAS_PERMITIDAS } from '@/config/allowedRoulettes';

/**
 * Serviço de API adaptado (anteriormente WebSocket) 
 * para obter dados das roletas via API REST
 */
export class SocketService {
  private static instance: SocketService;
  private listeners: Map<string, Set<RouletteEventCallback>> = new Map();
  private lastReceivedData: Map<string, { timestamp: number, data: any }> = new Map();
  private pendingPromises: Map<string, { promise: Promise<any>, timeout: ReturnType<typeof setTimeout> }> = new Map();

  // Mapa para armazenar os intervalos de polling por roletaId
  private pollingIntervals: Map<string, any> = new Map();
  private pollingInterval: number = 15000; // Intervalo padrão de 15 segundos para polling
  private minPollingInterval: number = 10000; // 10 segundos mínimo
  private maxPollingInterval: number = 60000; // 1 minuto máximo
  
  private _isLoadingHistoricalData: boolean = false;
  
  // Adicionar uma propriedade para armazenar o histórico completo por roleta  
  private rouletteHistory: Map<string, number[]> = new Map();
  private historyLimit: number = 1000;
  
  // Adicionar propriedade para armazenar cache de dados das roletas
  private rouletteDataCache: Map<string, {data: any, timestamp: number}> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutos em milissegundos
  
  // Propriedades para circuit breaker
  private circuitBreakerActive: boolean = false;
  private circuitBreakerResetTimeout: any = null;
  private consecutiveFailures: number = 0;
  private failureThreshold: number = 5; // Quantas falhas para ativar o circuit breaker
  private resetTime: number = 60000; // 1 minuto de espera antes de tentar novamente
  
  private constructor() {
    console.log('[SocketService] Inicializando serviço API REST');
    
    // Adicionar listener global para logging de todos os eventos
    this.subscribe('*', (event: RouletteEvent) => {
      if (event.type === 'new_number' && 'numero' in event && 'roleta_nome' in event) {
        console.log(`[SocketService][GLOBAL] Evento recebido para roleta: ${event.roleta_nome}, número: ${event.numero}`);
      } else if (event.type === 'strategy_update' && 'estado' in event && 'roleta_nome' in event) {
        console.log(`[SocketService][GLOBAL] Atualização de estratégia para roleta: ${event.roleta_nome}, estado: ${event.estado}`);
      }
    });
    
    // Adicionar event listener para quando a janela ficar visível novamente
    window.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Configurar handler para rejeições de promise não tratadas
    this.setupUnhandledRejectionHandler();
    
    console.log('[SocketService] Polling agressivo de roletas DESATIVADO - Centralizado no RouletteFeedService');
  }
  
  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * Obtém o histórico de números para uma roleta específica
   * @param roletaId ID da roleta
   * @returns Array com o histórico de números
   */
  public getRouletteHistory(roletaId: string): number[] {
    if (!this.rouletteHistory.has(roletaId)) {
      return [];
    }
    return this.rouletteHistory.get(roletaId) || [];
  }

  /**
   * Notifica sobre atualização do histórico de uma roleta
   * @param roletaId ID da roleta
   */
  private notifyHistoryUpdate(roletaId: string): void {
    const historico = this.getRouletteHistory(roletaId);
    
    const event: RouletteHistoryEvent = {
      type: 'history_update',
      roleta_id: roletaId,
      numeros: historico,
      timestamp: new Date().toISOString()
    };
    
    this.notifyListeners(event);
  }
  
  /**
   * Registra um callback para receber eventos em tempo real de uma roleta
   * @param roletaId ID ou nome da roleta, ou '*' para todos os eventos
   * @param callback Função a ser chamada quando ocorrer um evento
   */
  public subscribe(roletaId: string, callback: RouletteEventCallback): void {
    if (!roletaId) {
      console.warn('[SocketService] ID ou nome da roleta não fornecido para subscribe');
      return;
    }
    
    // Usar ID canônico se for um nome de roleta conhecido
    const canonicalId = this.getCanonicalRouletteId(roletaId);
    
    // Se não existir um conjunto de listeners para esta roleta, criar um
    if (!this.listeners.has(canonicalId)) {
      this.listeners.set(canonicalId, new Set());
    }
    
    // Adicionar o callback ao conjunto
    this.listeners.get(canonicalId)?.add(callback);
    
    console.log(`[SocketService] Assinatura registrada para roleta: ${canonicalId}`);
    
    // Se não for o listener global, registrar a roleta para atualizações em tempo real
    if (canonicalId !== '*') {
      this.registerRouletteForRealTimeUpdates(canonicalId);
    }
  }
  
  /**
   * Cancela o registro de um callback para uma roleta específica
   * @param roletaId ID da roleta
   * @param callback Função a ser removida
   */
  public unsubscribe(roletaId: string, callback: RouletteEventCallback): void {
    if (!roletaId) {
      console.warn('[SocketService] ID da roleta não fornecido para unsubscribe');
      return;
    }
    
    // Se existir um conjunto de listeners para esta roleta, remover o callback
    if (this.listeners.has(roletaId)) {
      this.listeners.get(roletaId)?.delete(callback);
      console.log(`[SocketService] Assinatura cancelada para roleta: ${roletaId}`);
      
      // Se não houver mais listeners, remover a entrada
      if (this.listeners.get(roletaId)?.size === 0) {
        this.listeners.delete(roletaId);
        
        // Cancelar o polling para esta roleta
        if (this.pollingIntervals.has(roletaId)) {
          clearInterval(this.pollingIntervals.get(roletaId));
          this.pollingIntervals.delete(roletaId);
        }
      }
    }
  }
  
  /**
   * Registra uma roleta para receber atualizações em tempo real
   * @param roletaId ID da roleta
   * @returns Promise<boolean> indicando se o registro foi bem-sucedido
   */
  private async registerRouletteForRealTimeUpdates(roletaId: string): Promise<boolean> {
    if (!roletaId) {
      console.warn('[SocketService] ID da roleta não fornecido para registerRouletteForRealTimeUpdates');
      return false;
    }
    
    try {
      // Verificar se esta roleta já tem um intervalo de polling
      if (this.pollingIntervals.has(roletaId)) {
        console.log(`[SocketService] Roleta ${roletaId} já registrada para atualizações em tempo real`);
        return true;
      }
      
      // Iniciar polling para esta roleta
      const intervalId = setInterval(() => {
        this.fetchRouletteData(roletaId);
      }, this.pollingInterval);
      
      this.pollingIntervals.set(roletaId, intervalId);
      
      console.log(`[SocketService] Roleta ${roletaId} registrada para atualizações em tempo real`);
      
      // Fazer a primeira busca imediatamente
      this.fetchRouletteData(roletaId);
      
      return true;
    } catch (error) {
      console.error(`[SocketService] Erro ao registrar roleta ${roletaId} para atualizações:`, error);
      return false;
    }
  }

  /**
   * Busca dados de uma roleta específica via API REST
   * @param roletaId ID da roleta
   */
  private async fetchRouletteData(roletaId: string): Promise<void> {
    if (!roletaId) {
      console.warn('[SocketService] ID da roleta não fornecido para fetchRouletteData');
      return;
    }
    
    // Verificar cache
    const cachedData = this.rouletteDataCache.get(roletaId);
    const now = Date.now();
    
    if (cachedData && now - cachedData.timestamp < this.cacheTTL) {
      // Usar dados do cache
      this.handleRouletteData(cachedData.data);
      return;
    }
    
    try {
      // Usar o proxy configurado no Vite para evitar problemas de CORS
      const apiUrl = `/api-remote/roulettes/${roletaId}`;
      
      console.log(`[SocketService] Buscando dados da roleta ${roletaId}: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar dados da roleta: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Atualizar cache
      this.rouletteDataCache.set(roletaId, {
        data,
        timestamp: now
      });
      
      // Processar os dados
      this.handleRouletteData(data);
      
      // Resetar contador de falhas
      this.consecutiveFailures = 0;
      
      // Desativar circuit breaker se estiver ativo
      if (this.circuitBreakerActive) {
        this.resetCircuitBreaker();
      }
    } catch (error) {
      console.error(`[SocketService] Erro ao buscar dados da roleta ${roletaId}:`, error);
      
      // Incrementar contador de falhas
      this.consecutiveFailures++;
      
      // Ativar circuit breaker se exceder o limite
      if (this.consecutiveFailures >= this.failureThreshold && !this.circuitBreakerActive) {
        this.activateCircuitBreaker();
      }
    }
  }
  
  /**
   * Ativa o circuit breaker para evitar sobrecarga do servidor
   */
  private activateCircuitBreaker(): void {
    if (this.circuitBreakerActive) {
      return;
    }
    
    console.warn('[SocketService] Ativando circuit breaker devido a falhas consecutivas');
    
    this.circuitBreakerActive = true;
    
    // Pausar todos os intervalos de polling
    this.pollingIntervals.forEach((intervalId, roletaId) => {
      clearInterval(intervalId);
    });
    
    // Agendar reset do circuit breaker
    this.circuitBreakerResetTimeout = setTimeout(() => {
      this.resetCircuitBreaker();
    }, this.resetTime);
  }
  
  /**
   * Reseta o circuit breaker e retoma as operações normais
   */
  private resetCircuitBreaker(): void {
    if (!this.circuitBreakerActive) {
      return;
    }
    
    console.log('[SocketService] Resetando circuit breaker');
    
    this.circuitBreakerActive = false;
    this.consecutiveFailures = 0;
    
    // Limpar timeout se existir
    if (this.circuitBreakerResetTimeout) {
      clearTimeout(this.circuitBreakerResetTimeout);
      this.circuitBreakerResetTimeout = null;
    }
    
    // Reativar polling para todas as roletas
    this.listeners.forEach((_, roletaId) => {
      if (roletaId !== '*') {
        this.registerRouletteForRealTimeUpdates(roletaId);
      }
    });
  }
  
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      // Página se tornou visível, verificar se precisamos reiniciar polling
      if (this.circuitBreakerActive) {
        // Resetar circuit breaker quando a página ficar visível
        this.resetCircuitBreaker();
      }
    }
  }
  
  private setupUnhandledRejectionHandler(): void {
    window.addEventListener('unhandledrejection', (event) => {
      console.warn('[SocketService] Unhandled Promise Rejection:', event.reason);
      
      // Verificar se a rejeição está relacionada à conexão
      const errorMessage = String(event.reason).toLowerCase();
      if (
        errorMessage.includes('network') || 
        errorMessage.includes('timeout') || 
        errorMessage.includes('abort') ||
        errorMessage.includes('connection')
      ) {
        // Incrementar contador de falhas
        this.consecutiveFailures++;
        
        // Ativar circuit breaker se exceder o limite
        if (this.consecutiveFailures >= this.failureThreshold && !this.circuitBreakerActive) {
          this.activateCircuitBreaker();
        }
      }
    });
  }
  
  /**
   * Processa os dados recebidos de uma roleta
   * @param data Dados da roleta
   */
  private handleRouletteData(data: any): void {
    try {
      if (!data) {
        console.warn('[SocketService] Dados inválidos recebidos para processamento');
        return;
      }
      
      // Verificar se é um array de roletas
      if (Array.isArray(data)) {
        // Processar cada roleta individualmente
        data.forEach(roulette => {
          this.processRouletteUpdate(roulette);
        });
      } else {
        // Processar uma única roleta
        this.processRouletteUpdate(data);
      }
    } catch (error) {
      console.error('[SocketService] Erro ao processar dados da roleta:', error);
    }
  }
  
  /**
   * Processa a atualização de uma roleta individual
   * @param roulette Dados da roleta
   */
  private processRouletteUpdate(roulette: any): void {
    if (!roulette || !roulette.roleta_id) {
      console.warn('[SocketService] Roleta inválida recebida para processamento');
      return;
    }
    
    const roletaId = roulette.roleta_id.toString();
    
    // Atualizar último dado recebido
    this.lastReceivedData.set(roletaId, {
      timestamp: Date.now(),
      data: roulette
    });
    
    // Atualizar histórico se houver número novo
    if (roulette.ultimo_numero !== undefined) {
      this.updateRouletteHistory(roletaId, roulette.ultimo_numero);
    }
    
    // Criar evento de atualização
    const updateEvent: RouletteNumberEvent = {
      type: 'new_number',
      roleta_id: roletaId,
      roleta_nome: roulette.roleta_nome || '',
      numero: roulette.ultimo_numero || 0,
      timestamp: new Date().toISOString()
    };
    
    // Notificar listeners
    this.notifyListeners(updateEvent);
  }
  
  /**
   * Atualiza o histórico de números de uma roleta
   * @param roletaId ID da roleta
   * @param numero Número a ser adicionado ao histórico
   */
  private updateRouletteHistory(roletaId: string, numero: number): void {
    if (!roletaId || numero === undefined) {
      return;
    }
    
    // Obter histórico atual ou criar novo
    const historico = this.rouletteHistory.get(roletaId) || [];
    
    // Adicionar novo número ao início
    historico.unshift(numero);
    
    // Limitar tamanho do histórico
    if (historico.length > this.historyLimit) {
      historico.length = this.historyLimit;
    }
    
    // Atualizar histórico
    this.rouletteHistory.set(roletaId, historico);
    
    // Notificar sobre atualização do histórico
    this.notifyHistoryUpdate(roletaId);
  }
  
  /**
   * Notifica os listeners sobre um evento
   * @param event Evento a ser notificado
   */
  private notifyListeners(event: RouletteEvent): void {
    try {
      if (!event || !event.type) {
        console.warn('[SocketService] Evento inválido para notificação');
        return;
      }
      
      // Notificar listeners globais
      const globalListeners = this.listeners.get('*');
      if (globalListeners && globalListeners.size > 0) {
        globalListeners.forEach(callback => {
          try {
            callback(event);
          } catch (error) {
            console.error('[SocketService] Erro ao notificar listener global:', error);
          }
        });
      }
      
      // Notificar listeners específicos para esta roleta
      if (event.roleta_id) {
        const roletaId = event.roleta_id.toString();
        const roletaListeners = this.listeners.get(roletaId);
        
        if (roletaListeners && roletaListeners.size > 0) {
          roletaListeners.forEach(callback => {
            try {
              callback(event);
            } catch (error) {
              console.error(`[SocketService] Erro ao notificar listener para roleta ${roletaId}:`, error);
            }
          });
        }
      }
    } catch (error) {
      console.error('[SocketService] Erro ao notificar listeners:', error);
    }
  }
  
  /**
   * Carrega o histórico de números de todas as roletas
   * @returns Promise<boolean> indicando se a operação foi bem-sucedida
   */
  public async loadHistoricalRouletteNumbers(): Promise<boolean> {
    if (this._isLoadingHistoricalData) {
      console.log('[SocketService] Carregamento de histórico já em andamento');
      return false;
    }
    
    this._isLoadingHistoricalData = true;
    
    try {
      console.log('[SocketService] Carregando histórico de números das roletas');
      
      // Usar o proxy configurado no Vite para evitar problemas de CORS
      const apiUrl = `/api-remote/roulettes`;
      
      console.log(`[SocketService] Buscando lista de roletas: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar lista de roletas: ${response.status} ${response.statusText}`);
      }
      
      const roletas = await response.json();
      
      // Para cada roleta, carregar histórico
      for (const roleta of roletas) {
        const roletaId = roleta.roleta_id?.toString();
        
        if (!roletaId) {
          continue;
        }
        
        // Buscar histórico para esta roleta
        await this.fetchRouletteHistory(roletaId);
      }
      
      console.log('[SocketService] Histórico de números carregado com sucesso');
      
      this._isLoadingHistoricalData = false;
      return true;
    } catch (error) {
      console.error('[SocketService] Erro ao carregar histórico de números:', error);
      this._isLoadingHistoricalData = false;
      return false;
    }
  }
  
  /**
   * Busca o histórico de números de uma roleta específica
   * @param roletaId ID da roleta
   */
  private async fetchRouletteHistory(roletaId: string): Promise<void> {
    try {
      // Usar o proxy configurado no Vite para evitar problemas de CORS
      const historyUrl = `/api-remote/roulettes/${roletaId}/history`;
      
      console.log(`[SocketService] Buscando histórico da roleta ${roletaId}: ${historyUrl}`);
      
      const response = await fetch(historyUrl);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar histórico da roleta ${roletaId}: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.numeros && Array.isArray(data.numeros)) {
        // Extrair apenas os números do histórico
        const numeros = data.numeros.map((entry: any) => entry.numero);
        
        // Atualizar histórico
        this.rouletteHistory.set(roletaId, numeros);
        
        // Notificar sobre atualização do histórico
        this.notifyHistoryUpdate(roletaId);
      }
    } catch (error) {
      console.error(`[SocketService] Erro ao buscar histórico da roleta ${roletaId}:`, error);
    }
  }
  
  /**
   * Obtém o ID canônico para uma roleta
   * @param roletaIdOrName ID ou nome da roleta
   * @returns ID canônico
   */
  private getCanonicalRouletteId(roletaIdOrName: string): string {
    if (roletaIdOrName === '*') {
      return '*';
    }
    
    // Tentar mapear para ID canônico
    const canonicalId = mapToCanonicalRouletteId(roletaIdOrName);
    
    return canonicalId || roletaIdOrName;
  }
}

// Criar um wrapper para expor como window.DH
export class SocketServiceWrapper {
  public static loadHistoricalRouletteNumbers() {
    return SocketService.getInstance().loadHistoricalRouletteNumbers();
  }
}

// Exportação padrão para permitir import simplificado
export default SocketService; 