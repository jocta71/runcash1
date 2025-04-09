import { io, Socket } from 'socket.io-client';
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

// Interface para o cliente MongoDB
interface MongoClient {
  topology?: {
    isConnected?: () => boolean;
  };
}

// Nova interface para eventos recebidos pelo socket
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
 * Serviço que gerencia a conexão WebSocket via Socket.IO
 * para receber dados em tempo real do MongoDB
 */
export class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private listeners: Map<string, Set<RouletteEventCallback>> = new Map();
  private connectionActive: boolean = false;
  private connectionAttempts: number = 0;
  private reconnectTimeout: number | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private eventHandlers: Record<string, (data: any) => void> = {};
  private autoReconnect: boolean = true;
  private lastReceivedData: Map<string, { timestamp: number, data: any }> = new Map();
  private pendingPromises: Map<string, { promise: Promise<any>, timeout: ReturnType<typeof setTimeout> }> = new Map();
  
  // Propriedade para o cliente MongoDB (pode ser undefined em alguns contextos)
  public client?: MongoClient;
  
  // Mapa para armazenar os intervalos de polling por roletaId
  private pollingIntervals: Map<string, any> = new Map();
  private pollingInterval: number = 15000; // Intervalo padrão de 15 segundos para polling
  private minPollingInterval: number = 10000; // 10 segundos mínimo
  private maxPollingInterval: number = 60000; // 1 minuto máximo
  private pollingBackoffFactor: number = 1.5; // Fator de aumento em caso de erro
  
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
    console.log('[SocketService] Inicializando serviço Socket.IO');
    
    // Adicionar listener global para logging de todos os eventos
    this.subscribe('*', (event: RouletteEvent) => {
      if (event.type === 'new_number' && 'numero' in event && 'roleta_nome' in event) {
        console.log(`[SocketService][GLOBAL] Evento recebido para roleta: ${event.roleta_nome}, número: ${event.numero}`);
      } else if (event.type === 'strategy_update' && 'estado' in event && 'roleta_nome' in event) {
        console.log(`[SocketService][GLOBAL] Atualização de estratégia para roleta: ${event.roleta_nome}, estado: ${event.estado}`);
      }
    });
    
    // Verificar se o socket já existe no localStorage para recuperar uma sessão anterior
    const savedSocket = this.trySavedSocket();
    if (!savedSocket) {
      // Conectar normalmente se não houver sessão salva
      this.connect();
    }

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
   * Verifica se o socket está conectado e operacional
   * @returns boolean
   */
  private checkSocketConnection(): boolean {
    return this.connectionActive && !!this.socket;
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

  // Resto do código mantido como está
  
  // Método para iniciar monitoramento de ping
  private setupPing(): void {
    // Enviar ping a cada 30 segundos para manter a conexão ativa
        if (this.timerId) {
          clearInterval(this.timerId);
    }
    
    this.timerId = setInterval(() => {
      if (this.socket && this.socket.connected) {
        this.socket.emit('ping', { timestamp: Date.now() });
      }
    }, 30000);
  }

  /**
   * Inscreve um callback para receber eventos de uma roleta específica
   * @param roletaId ID da roleta ou '*' para todos os eventos
   * @param callback Função a ser chamada quando um evento for recebido
   */
  public subscribe(roletaId: string, callback: RouletteEventCallback): void {
    if (!roletaId) {
      console.warn('[SocketService] Tentativa de inscrição com ID de roleta indefinido');
      roletaId = 'global';
    }
    
    const roletaLabel = roletaId === '*' ? 'todos os eventos' : `roleta: ${roletaId}`;
    console.log(`[SocketService] INSCREVENDO para ${roletaLabel}`);
    
    // Verificar se já temos listeners para esta roleta
    if (!this.listeners.has(roletaId)) {
      console.log(`[SocketService] Criando novo conjunto de listeners para roleta: ${roletaId}`);
      this.listeners.set(roletaId, new Set());
    }
    
    // Adicionar o callback ao conjunto de listeners
    const listeners = this.listeners.get(roletaId);
    if (listeners) {
      listeners.add(callback);
      console.log(`[SocketService] ✅ Callback adicionado aos listeners de ${roletaId}. Total: ${listeners.size}`);
    }
    
    // Registrar a roleta para receber updates em tempo real
    this.registerRouletteForRealTimeUpdates(roletaId).then(() => {
      console.log(`[SocketService] Roleta ${roletaId} registrada para updates em tempo real`);
    }).catch(error => {
      console.error(`[SocketService] Erro ao registrar roleta ${roletaId}:`, error);
    });
  }
  
  /**
   * Cancela a inscrição de um callback
   * @param roletaId ID da roleta
   * @param callback Função a remover
   */
  public unsubscribe(roletaId: string, callback: RouletteEventCallback): void {
    if (!roletaId) {
      console.warn('[SocketService] Tentativa de cancelar inscrição com ID de roleta indefinido');
      return;
    }
    
    const listeners = this.listeners.get(roletaId);
    if (listeners) {
      listeners.delete(callback);
      console.log(`[SocketService] Callback removido dos listeners de ${roletaId}. Restantes: ${listeners.size}`);
    }
  }

  /**
   * Registra uma roleta para receber atualizações em tempo real
   * @param roletaId ID ou nome da roleta
   */
  private async registerRouletteForRealTimeUpdates(roletaId: string): Promise<boolean> {
    if (!roletaId || roletaId.trim() === '') {
      console.warn('[SocketService] Tentativa de registrar roleta com ID/nome vazio');
      return false;
    }
    
    const roletaNome = roletaId === '*' ? 'Global (todas)' : roletaId;
    console.log(`[SocketService] Registrando roleta ${roletaNome} para updates em tempo real`);
    
    // Verificar conexão
    if (!this.checkSocketConnection() && roletaId !== '*') {
      if (ROLETAS_PERMITIDAS && !ROLETAS_PERMITIDAS.some(r => r === roletaId)) {
        console.log(`[SocketService] Roleta não encontrada pelo nome: ${roletaNome}`);
        return false;
      }
    }
    
    // Simulação - em produção, enviaríamos uma solicitação real para o servidor
    console.log(`[SocketService] ⛔ DESATIVADO: Busca de roletas reais bloqueada para diagnóstico`);
    return true;
  }
  
  /**
   * Tenta recuperar uma sessão de socket salva anteriormente
   */
  private trySavedSocket(): boolean {
    try {
      // Verificar tempo da última conexão
      const lastConnectionTime = localStorage.getItem('socket_last_connection');
      if (lastConnectionTime) {
        const lastTime = parseInt(lastConnectionTime, 10);
        const now = Date.now();
        const diff = now - lastTime;
        
        // Se a última conexão foi há menos de 2 minutos, pode ser recuperada
        if (diff < 120000) {
          console.log('[SocketService] Encontrada conexão recente. Tentando usar configurações salvas.');
          return true;
      } else {
          console.log('[SocketService] Conexão antiga encontrada, iniciando nova conexão');
          localStorage.removeItem('socket_last_connection');
        }
      }
    } catch (error) {
      console.warn('[SocketService] Erro ao verificar socket salvo:', error);
    }
    return false;
  }

  /**
   * Estabelece conexão com o servidor Socket.IO
   */
  private connect(): void {
    try {
      // Em produção, usar a URL real do servidor WebSocket
      const socketUrl = config.wsUrl || 'https://backend-production-2i96.up.railway.app';
      
      this.socket = io(socketUrl, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });
      
      this.setupSocketEvents();
      this.setupPing();
      
      // Salvar timestamp da conexão no localStorage
      localStorage.setItem('socket_last_connection', Date.now().toString());
      
    } catch (error) {
      console.error('[SocketService] Erro ao conectar com Socket.IO:', error);
      this.handleConnectionError(error);
    }
  }

  /**
   * Configura eventos do socket
   */
  private setupSocketEvents(): void {
    if (!this.socket) return;
    
    this.socket.on('connect', () => {
      console.log('[SocketService] Conectado ao socket.io');
      this.connectionActive = true;
      this.connectionAttempts = 0;
    });
    
    this.socket.on('disconnect', (reason) => {
      console.log(`[SocketService] Desconectado: ${reason}`);
      this.connectionActive = false;
      
      if (this.autoReconnect) {
        this.handleReconnect();
      }
    });

    // Adicionar listener para eventos global_update
    this.socket.on('global_update', (data: any) => {
      console.log('[SocketService] Evento global_update recebido:', data);
      
      // Verificar se os dados são válidos
      if (data && typeof data === 'object' && data.type) {
        try {
          // Notificar ouvintes através do método notifyListeners
          this.notifyListeners(data);
          
          // Notificar o EventService também
          if (typeof EventService.emit === 'function') {
            EventService.emit('roulette:global_update', data);
          }
        } catch (error) {
          console.error('[SocketService] Erro ao processar evento global_update:', error);
        }
          } else {
        console.warn('[SocketService] Dados inválidos recebidos em global_update:', data);
      }
    });
    
    // Adicionar mais eventos conforme necessário
  }

  /**
   * Manipula a reconexão em caso de falha
   */
  private handleReconnect(): void {
    this.connectionAttempts++;
    console.log(`[SocketService] Tentativa de reconexão ${this.connectionAttempts}`);
    
    // Implementar lógica de backoff exponencial
    const delay = Math.min(30000, 1000 * Math.pow(1.5, this.connectionAttempts));
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Manipula erros de conexão
   */
  private handleConnectionError(error: any): void {
    console.error('[SocketService] Erro de conexão:', error);
    this.connectionActive = false;
      
    if (this.autoReconnect) {
      this.handleReconnect();
    }
  }

  /**
   * Manipula mudanças de visibilidade da página
   */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      console.log('[SocketService] Página voltou a ficar visível, verificando conexão');
      if (!this.connectionActive || !this.socket || !this.socket.connected) {
        console.log('[SocketService] Reconectando após retornar à visibilidade');
        this.connect();
      }
    }
  }

  /**
   * Configura manipulador para rejeições de promise não tratadas
   */
  private setupUnhandledRejectionHandler(): void {
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason && typeof event.reason === 'object' && 'name' in event.reason) {
        const error = event.reason;
        if (error.name === 'NetworkError' || error.name === 'AbortError') {
          console.warn('[SocketService] Erro de rede detectado, verificando conexão', error);
          this.checkSocketHealth();
        }
      }
    });
  }

  /**
   * Verifica a saúde da conexão com o socket
   */
  private checkSocketHealth(): void {
    if (!this.socket) {
      console.log('[SocketService] Socket não existe, tentando reconectar');
      this.connect();
      return;
    }
    
    if (!this.socket.connected) {
      console.log('[SocketService] Socket não está conectado, forçando reconexão');
      this.socket.connect();
    }
  }

  /**
   * Notifica os callbacks inscritos sobre um evento
   * @param event Evento a ser notificado
   */
  private notifyListeners(event: RouletteEvent): void {
    if (!event || !event.type) return;
    
    // Notificar listeners globais primeiro
    const globalListeners = this.listeners.get('*');
    if (globalListeners) {
      globalListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('[SocketService] Erro ao notificar listener global:', error);
        }
      });
    }
    
    // Notificar listeners específicos da roleta
    if ('roleta_id' in event && event.roleta_id) {
      const roletaId = String(event.roleta_id);
      const roletaListeners = this.listeners.get(roletaId);
      if (roletaListeners && roletaListeners.size > 0) {
        roletaListeners.forEach(callback => {
          try {
            callback(event);
          } catch (error) {
            console.error(`[SocketService] Erro ao notificar listener da roleta ${roletaId}:`, error);
          }
        });
      } else {
        // Tentar buscar por nome de roleta se disponível
        if ('roleta_nome' in event && event.roleta_nome) {
          const roletaNome = String(event.roleta_nome);
          const nameListeners = this.listeners.get(roletaNome);
          if (nameListeners && nameListeners.size > 0) {
            nameListeners.forEach(callback => {
              try {
                callback(event);
              } catch (error) {
                console.error(`[SocketService] Erro ao notificar listener da roleta ${roletaNome}:`, error);
              }
            });
          }
        }
      }
    }
  }

  /**
   * Carrega dados históricos de todas as roletas disponíveis
   * @returns Promise que resolve quando todos os dados forem carregados
   */
  public async loadHistoricalRouletteNumbers(): Promise<boolean> {
    try {
      console.log('[SocketService] Iniciando carregamento de dados históricos');
      
      // Se já estamos carregando, retorna a promessa existente
      if (this._isLoadingHistoricalData) {
        console.log('[SocketService] Carregamento já em andamento, aguardando...');
      return true;
      }
      
      this._isLoadingHistoricalData = true;
      
      // Em um ambiente real, buscaríamos os dados do servidor
      // Simulação: usar dados locais ou mock
      console.log('[SocketService] Simulando carregamento de dados históricos...');
      
      // Para cada roleta permitida, carregar histórico
      if (ROLETAS_PERMITIDAS && ROLETAS_PERMITIDAS.length > 0) {
        for (const roleta of ROLETAS_PERMITIDAS) {
          // Simular delay para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Adicionar alguns números aleatórios ao histórico para simulação
          const historico = this.getRouletteHistory(roleta);
          if (historico.length === 0) {
            const numerosAleatorios = Array.from({ length: 20 }, () => Math.floor(Math.random() * 37));
            this.rouletteHistory.set(roleta, numerosAleatorios);
            console.log(`[SocketService] Histórico simulado para ${roleta}: ${numerosAleatorios.length} números`);
          }
        }
      }
      
      console.log('[SocketService] Carregamento de dados históricos concluído');
      this._isLoadingHistoricalData = false;
      return true;
    } catch (error) {
      console.error('[SocketService] Erro ao carregar dados históricos:', error);
      this._isLoadingHistoricalData = false;
      return false;
    }
  }

  /**
   * Processa os eventos recebidos via socket e emite para o EventService
   * @param event Evento recebido via socket
   */
  private handleRouletteEvent(event: any): void {
    try {
      // Verificar se o evento tem dados válidos
      if (!event || !event.type) {
        console.warn('[SocketService] Evento sem tipo recebido');
        return;
      }

      // Verificar se é um evento de roleta
      if (event.type === 'roulette') {
        const data = {
          ...event,
          timestamp: new Date().toISOString()
        };

        // Log detalhado para depuração
        console.log(`[SocketService] Processando evento roulette: ${JSON.stringify(event)}`);
        
        // Emitir evento para o EventService
        EventService.emit('roulette:global_update', data);
        
        // Notificar os callbacks específicos para esta roleta
        const roletaId = event.roleta_id || event.id;
        if (roletaId && this.listeners.has(roletaId)) {
          const callbacks = this.listeners.get(roletaId);
          callbacks?.forEach(callback => {
            try {
              callback(data);
            } catch (callbackError) {
              console.error(`[SocketService] Erro ao chamar callback para roleta ${roletaId}:`, callbackError);
            }
          });
        }

        // Notificar os callbacks globais
        if (this.listeners.has('*')) {
          const globalCallbacks = this.listeners.get('*');
          globalCallbacks?.forEach(callback => {
            try {
              callback(data);
            } catch (callbackError) {
              console.error('[SocketService] Erro ao chamar callback global:', callbackError);
            }
          });
        }
      } else if (event.type === 'new_number') {
        // Evento de novo número da roleta
        const data = {
          ...event,
          timestamp: new Date().toISOString()
        };
        
        // Log detalhado para depuração
        console.log(`[SocketService] Processando evento new_number: roleta=${event.roleta_id}, número=${event.numero}`);

        // Emitir evento para o EventService
        EventService.emit('roulette:new_number', data);

        // Notificar os callbacks específicos para esta roleta
        const roletaId = event.roleta_id || event.id;
        if (roletaId && this.listeners.has(roletaId)) {
          const callbacks = this.listeners.get(roletaId);
          callbacks?.forEach(callback => {
            try {
              callback(data);
            } catch (callbackError) {
              console.error(`[SocketService] Erro ao chamar callback para roleta ${roletaId}:`, callbackError);
            }
          });
        }

        // Notificar os callbacks globais
        if (this.listeners.has('*')) {
          const globalCallbacks = this.listeners.get('*');
          globalCallbacks?.forEach(callback => {
            try {
              callback(data);
            } catch (callbackError) {
              console.error('[SocketService] Erro ao chamar callback global:', callbackError);
            }
          });
        }
      }
    } catch (error) {
      console.error('[SocketService] Erro ao processar evento:', error);
    }
  }
}

// Exportando a classe para ser importada como default
export default SocketService; 