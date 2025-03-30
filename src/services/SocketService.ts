import { io, Socket } from 'socket.io-client';
import { toast } from '@/components/ui/use-toast';
import config from '@/config/env';
import { 
  RouletteNumberEvent,
  RouletteEventCallback,
  StrategyUpdateEvent
} from './EventService';
import { v4 as uuidv4 } from 'uuid';

// Nova interface para eventos recebidos pelo socket
interface SocketEvent {
  type: string;
  roleta_id: string;
  roleta_nome: string;
  [key: string]: any;
}

// Define event types
type EventCallback = (data: any) => void;

interface SocketEventHandler {
  id: string;
  event: string;
  callback: EventCallback;
}

/**
 * Serviço que gerencia a conexão WebSocket via Socket.IO
 * para receber dados em tempo real do MongoDB
 */
class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private socketUrl: string;
  private eventHandlers: SocketEventHandler[] = [];
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000; // Ms entre tentativas
  private isConnecting: boolean = false;
  private isManuallyDisconnected: boolean = false;
  private connectionCheckTimer: number | null = null;
  private listeners: Map<string, Set<RouletteEventCallback>> = new Map();
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;
  private reconnectTimeout: number | null = null;
  
  private constructor() {
    console.log('[SocketService] Inicializando serviço Socket.IO');
    
    // Adicionar listener global para logging de todos os eventos
    this.subscribe('*', (event: RouletteNumberEvent | StrategyUpdateEvent) => {
      if (event.type === 'new_number') {
        console.log(`[SocketService][GLOBAL] Evento recebido para roleta: ${event.roleta_nome}, número: ${event.numero}`);
      } else if (event.type === 'strategy_update') {
        console.log(`[SocketService][GLOBAL] Atualização de estratégia para roleta: ${event.roleta_nome}, estado: ${event.estado}`);
      }
    });
    
    // Determinar URL do Socket.IO baseado no ambiente
    this.socketUrl = import.meta.env.VITE_SOCKET_URL || 
                     window.location.protocol + '//' + window.location.hostname + ':3002';
    
    console.log('[SocketService] Initialized with URL:', this.socketUrl);
    this.connect();
    
    // Verificar conexão periodicamente
    this.connectionCheckTimer = window.setInterval(() => {
      this.checkConnection();
    }, 30000); // Verificar a cada 30 segundos
  }
  
  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }
  
  private getSocketUrl(): string {
    // URL do servidor WebSocket a partir da configuração centralizada
    return config.wsServerUrl;
  }
  
  private connect(): void {
    if (this.socket && this.socket.connected) {
      console.log('[SocketService] Already connected.');
      return;
    }
    
    if (this.isConnecting) {
      console.log('[SocketService] Connection attempt already in progress.');
      return;
    }
    
    this.isConnecting = true;
    
    try {
      // Criar nova conexão socket
      this.socket = io(this.socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        timeout: 10000,
      });
      
      // Configurar event listeners para a conexão
      this.socket.on('connect', this.handleConnect.bind(this));
      this.socket.on('disconnect', this.handleDisconnect.bind(this));
      this.socket.on('connect_error', this.handleError.bind(this));
      this.socket.on('reconnect_attempt', this.handleReconnectAttempt.bind(this));
      this.socket.on('reconnect_failed', this.handleReconnectFailed.bind(this));
      
      console.log('[SocketService] Connection attempt started.');
    } catch (error) {
      console.error('[SocketService] Error creating socket connection:', error);
      this.isConnecting = false;
    }
  }
  
  /**
   * Manipulador de evento de conexão
   */
  private handleConnect(): void {
    console.log('[SocketService] Connected successfully');
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.resubscribeToEvents();
  }
  
  /**
   * Manipulador de evento de desconexão
   */
  private handleDisconnect(reason: string): void {
    console.log(`[SocketService] Disconnected: ${reason}`);
    this.isConnecting = false;
    
    // Não tentar reconectar se a desconexão foi manual
    if (this.isManuallyDisconnected) {
      console.log('[SocketService] Not attempting reconnection due to manual disconnect');
      return;
    }
    
    // Tentar reconectar se desconexão foi por outros motivos
    this.reconnect();
  }
  
  /**
   * Manipulador de erro de conexão
   */
  private handleError(error: Error): void {
    console.error(`[SocketService] Connection error: ${error.message}`);
    this.isConnecting = false;
    
    // Não tentar reconectar se a desconexão foi manual
    if (this.isManuallyDisconnected) {
      return;
    }
    
    this.reconnect();
  }
  
  /**
   * Manipulador de tentativa de reconexão
   */
  private handleReconnectAttempt(attemptNumber: number): void {
    console.log(`[SocketService] Reconnection attempt ${attemptNumber}`);
    this.reconnectAttempts = attemptNumber;
  }
  
  /**
   * Manipulador de falha na reconexão
   */
  private handleReconnectFailed(): void {
    console.error('[SocketService] Failed to reconnect after maximum attempts');
    this.isConnecting = false;
  }
  
  /**
   * Tenta reconectar ao servidor
   */
  private reconnect(): void {
    if (this.isConnecting || this.isManuallyDisconnected) {
      return;
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SocketService] Maximum reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    
    console.log(`[SocketService] Attempting reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    // Tentar reconectar após o delay
    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
  }
  
  /**
   * Reinscrever em eventos após reconexão
   */
  private resubscribeToEvents(): void {
    console.log(`[SocketService] Resubscribing to ${this.eventHandlers.length} events`);
    
    // Para cada handler, reinscrever no socket
    this.eventHandlers.forEach(handler => {
      if (this.socket) {
        console.log(`[SocketService] Resubscribing to event ${handler.event}`);
        this.socket.on(handler.event, handler.callback);
      }
    });
  }
  
  /**
   * Verifica estado da conexão
   */
  private checkConnection(): void {
    const isConnected = this.isSocketConnected();
    
    if (!isConnected && !this.isManuallyDisconnected && !this.isConnecting) {
      console.log('[SocketService] Connection check failed, attempting reconnect');
      this.connect();
    }
  }
  
  /**
   * Verifica se o socket está conectado
   */
  public isSocketConnected(): boolean {
    return !!(this.socket && this.socket.connected);
  }
  
  /**
   * Inscreve em um evento específico
   */
  public on(event: string, callback: EventCallback): string {
    console.log(`[SocketService] Subscribing to event: ${event}`);
    
    // Gerar ID para o handler
    const handlerId = uuidv4();
    
    // Registrar o handler
    this.eventHandlers.push({
      id: handlerId,
      event,
      callback
    });
    
    // Inscrever no socket se estiver conectado
    if (this.socket) {
      this.socket.on(event, callback);
    }
    
    return handlerId;
  }
  
  /**
   * Remove inscrição de um evento
   */
  public off(handlerId: string): void {
    // Encontrar o handler pelo ID
    const handler = this.eventHandlers.find(h => h.id === handlerId);
    
    if (handler) {
      console.log(`[SocketService] Unsubscribing from event: ${handler.event}`);
      
      // Remover do socket se estiver conectado
      if (this.socket) {
        this.socket.off(handler.event, handler.callback);
      }
      
      // Remover do array de handlers
      this.eventHandlers = this.eventHandlers.filter(h => h.id !== handlerId);
    }
  }
  
  /**
   * Emite um evento para o servidor
   */
  public emit(event: string, data: any): void {
    if (this.socket && this.socket.connected) {
      console.log(`[SocketService] Emitting event ${event}`);
      this.socket.emit(event, data);
    } else {
      console.warn(`[SocketService] Cannot emit ${event}, socket not connected`);
    }
  }
  
  /**
   * Desconecta o socket manualmente
   */
  public disconnect(): void {
    console.log('[SocketService] Manual disconnect requested');
    
    this.isManuallyDisconnected = true;
    
    if (this.socket) {
      this.socket.disconnect();
    }
    
    if (this.connectionCheckTimer !== null) {
      window.clearInterval(this.connectionCheckTimer);
      this.connectionCheckTimer = null;
    }
  }
  
  /**
   * Reconecta o socket após desconexão manual
   */
  public reconnectManually(): void {
    console.log('[SocketService] Manual reconnect requested');
    
    this.isManuallyDisconnected = false;
    this.connect();
    
    // Reiniciar timer de verificação se necessário
    if (this.connectionCheckTimer === null) {
      this.connectionCheckTimer = window.setInterval(() => {
        this.checkConnection();
      }, 30000);
    }
  }
  
  // Adiciona um listener para eventos de uma roleta específica
  public subscribe(roletaNome: string, callback: RouletteEventCallback): void {
    console.log(`[SocketService] Inscrevendo para eventos da roleta: ${roletaNome}`);
    
    if (!this.listeners.has(roletaNome)) {
      this.listeners.set(roletaNome, new Set());
      
      // Se for uma roleta específica (não o global '*')
      if (roletaNome !== '*' && this.socket && this.isConnected) {
        console.log(`[SocketService] Enviando subscrição para roleta: ${roletaNome}`);
        this.socket.emit('subscribe_to_roleta', roletaNome);
      }
    }
    
    const listeners = this.listeners.get(roletaNome);
    listeners?.add(callback);
    
    const count = listeners?.size || 0;
    console.log(`[SocketService] Total de listeners para ${roletaNome}: ${count}`);
    
    // Verificar conexão ao inscrever um novo listener
    if (!this.isConnected || !this.socket) {
      console.log('[SocketService] Conexão Socket.IO não ativa, reconectando...');
      this.connect();
    }
  }
  
  // Remove um listener
  public unsubscribe(roletaNome: string, callback: RouletteEventCallback): void {
    const callbacks = this.listeners.get(roletaNome);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(roletaNome);
      }
    }
  }
  
  // Notifica os listeners sobre um novo evento
  private notifyListeners(event: RouletteNumberEvent | StrategyUpdateEvent): void {
    // Verificar o tipo de evento para log
    if (event.type === 'new_number') {
      const numEvent = event as RouletteNumberEvent;
      console.log(`[SocketService] Notificando sobre novo número: ${numEvent.roleta_nome} - ${numEvent.numero}`);
    } else if (event.type === 'strategy_update') {
      const stratEvent = event as StrategyUpdateEvent;
      console.log(`[SocketService] Notificando sobre estratégia: ${stratEvent.roleta_nome} - ${stratEvent.estado}`);
    }
    
    // Notificar listeners da roleta específica
    const roletaListeners = this.listeners.get(event.roleta_nome);
    if (roletaListeners && roletaListeners.size > 0) {
      roletaListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error(`[SocketService] Erro ao notificar listener para ${event.roleta_nome}:`, error);
        }
      });
    }
    
    // Notificar listeners globais (*)
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
  }
  
  // Fecha a conexão - chamar quando o aplicativo for encerrado
  public disconnect(): void {
    console.log('[SocketService] Desconectando Socket.IO');
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.isConnected = false;
  }
  
  // Verifica se a conexão está ativa
  public getConnectionStatus(): boolean {
    return this.isSocketConnected();
  }
  
  // Método para verificar se há dados reais disponíveis
  public hasRealData(): boolean {
    // Se não há conexão, não pode haver dados reais
    if (!this.isConnected || !this.socket) {
      return false;
    }
    
    // A conexão existe, então pode haver dados reais
    return true;
  }
}

export default SocketService; 