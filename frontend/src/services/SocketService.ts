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
   * @param roletaNome Nome da roleta ou '*' para todos os eventos
   * @param callback Função a ser chamada quando um evento for recebido
   */
  public subscribe(roletaNome: string, callback: RouletteEventCallback): void {
    console.log(`[SocketService] INSCREVENDO para eventos da roleta: ${roletaNome}`);
    
    // Verificar se já temos listeners para esta roleta
    if (!this.listeners.has(roletaNome)) {
      console.log(`[SocketService] Criando novo conjunto de listeners para roleta: ${roletaNome}`);
      this.listeners.set(roletaNome, new Set());
    }
    
    // Adicionar o callback ao conjunto de listeners
    const listeners = this.listeners.get(roletaNome);
    if (listeners) {
      listeners.add(callback);
      console.log(`[SocketService] ✅ Callback adicionado aos listeners de ${roletaNome}. Total: ${listeners.size}`);
    }
    
    // Registrar a roleta para receber updates em tempo real
    this.registerRouletteForRealTimeUpdates(roletaNome).then(() => {
      console.log(`[SocketService] Roleta ${roletaNome} registrada para updates em tempo real`);
    }).catch(error => {
      console.error(`[SocketService] Erro ao registrar roleta ${roletaNome}:`, error);
    });
  }

  /**
   * Cancela a inscrição de um callback
   * @param roletaNome Nome da roleta
   * @param callback Função a remover
   */
  public unsubscribe(roletaNome: string, callback: RouletteEventCallback): void {
    const listeners = this.listeners.get(roletaNome);
    if (listeners) {
      listeners.delete(callback);
      console.log(`[SocketService] Callback removido dos listeners de ${roletaNome}. Restantes: ${listeners.size}`);
    }
  }

  /**
   * Registra uma roleta para receber atualizações em tempo real
   * @param roletaNome Nome da roleta
   */
  private async registerRouletteForRealTimeUpdates(roletaNome: string): Promise<boolean> {
    if (!roletaNome || roletaNome.trim() === '') {
      return false;
    }
    
    console.log(`[SocketService] Registrando roleta ${roletaNome} para updates em tempo real`);
    
    // Verificar conexão
    if (!this.checkSocketConnection() && roletaNome !== '*') {
      if (ROLETAS_PERMITIDAS && !ROLETAS_PERMITIDAS.some(r => r === roletaNome)) {
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
    if ('roleta_id' in event) {
      const roletaListeners = this.listeners.get(event.roleta_id);
      if (roletaListeners) {
        roletaListeners.forEach(callback => {
          try {
            callback(event);
          } catch (error) {
            console.error(`[SocketService] Erro ao notificar listener da roleta ${event.roleta_id}:`, error);
          }
        });
      }
    }
  }
}

// Exportando a classe para ser importada como default
export default SocketService;