import { io, Socket } from 'socket.io-client';
import config from '@/config/env';

// Tipos de eventos
export interface RouletteEvent {
  type: string;
  roleta_id: string;
  roleta_nome: string;
  [key: string]: any;
}

export type RouletteEventCallback = (event: RouletteEvent) => void;

/**
 * Serviço que gerencia a conexão WebSocket com suporte a modo de simulação
 * para funcionar mesmo quando o servidor WebSocket não está disponível
 */
class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private connected: boolean = false;
  private simulationMode: boolean = false;
  private socketUrl: string;
  private eventListeners: Record<string, RouletteEventCallback[]> = {
    'connect': [],
    'disconnect': [],
    'message': []
  };
  private routeSubscriptions: Map<string, Set<RouletteEventCallback>> = new Map();

  private constructor() {
    this.socketUrl = config.wsUrl || '';
    console.log(`[Socket] Inicializando serviço. URL: ${this.socketUrl}`);
    
    // Verificar se devemos iniciar em modo de simulação
    this.simulationMode = !this.socketUrl || this.socketUrl.includes('localhost');
    this.connect();
  }

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * Conecta ao servidor de WebSocket ou ativa modo de simulação caso não seja possível
   */
  public connect(): void {
    if (!this.socket) {
      try {
        console.log(`[Socket] Tentando conectar ao websocket: ${this.socketUrl}`);
        
        // Determinar se devemos usar a URL do servidor ou um fallback de simulação
        if (!this.socketUrl || this.socketUrl.includes('localhost') || this.simulationMode) {
          console.log('[Socket] Usando modo de simulação para WebSocket');
          this.simulationMode = true;
          this.connected = true;
          
          // Emitir evento de conexão para os listeners
          this.eventListeners['connect']?.forEach(listener => listener({
            type: 'connect',
            roleta_id: '',
            roleta_nome: '',
            message: 'Conectado em modo de simulação'
          }));
          
          return;
        }
        
        // Iniciar socket real com reconexão limitada
        this.socket = io(this.socketUrl, {
          reconnectionAttempts: 3,           // Limitar o número de tentativas
          reconnectionDelay: 1000,           // Iniciar com 1s de delay
          reconnectionDelayMax: 5000,        // Máximo de 5s de delay
          timeout: 5000,                     // Timeout da conexão
          autoConnect: true,
          transports: ['websocket']
        });
        
        // Tratamento de eventos
        this.socket.on('connect', () => {
          console.log('[Socket] Conectado ao servidor');
          this.connected = true;
          this.eventListeners['connect']?.forEach(listener => listener({
            type: 'connect',
            roleta_id: '',
            roleta_nome: '',
            message: 'Conectado ao servidor'
          }));
        });
        
        this.socket.on('disconnect', (reason) => {
          console.log(`[Socket] Desconectado do servidor. Motivo: ${reason}`);
          this.connected = false;
          this.eventListeners['disconnect']?.forEach(listener => listener({
            type: 'disconnect',
            roleta_id: '',
            roleta_nome: '',
            reason
          }));
        });
        
        this.socket.on('connect_error', (error) => {
          console.error(`[Socket] Erro de conexão: ${error.message}`);
          this.connected = false;
          
          // Após várias tentativas, ativar modo de simulação
          if (this.socket?.io?.reconnectionAttempts === 0) {
            console.log('[Socket] Número máximo de tentativas excedido. Ativando modo de simulação.');
            this.socket.disconnect();
            this.socket = null;
            this.simulationMode = true;
            this.connected = true;
            
            // Emitir evento de conexão para os listeners
            this.eventListeners['connect']?.forEach(listener => listener({
              type: 'connect',
              roleta_id: '',
              roleta_nome: '',
              message: 'Conectado em modo de simulação após falhas'
            }));
          }
        });
        
        // Configurar handlers para mensagens recebidas
        this.setupMessageListeners();
        
      } catch (error) {
        console.error(`[Socket] Erro ao conectar ao websocket: ${error}`);
        this.simulationMode = true;
        this.connected = true;
        
        // Emitir evento de conexão para os listeners
        this.eventListeners['connect']?.forEach(listener => listener({
          type: 'connect',
          roleta_id: '',
          roleta_nome: '',
          message: 'Conectado em modo de simulação após erro'
        }));
      }
    }
  }
  
  /**
   * Configura listeners para mensagens do servidor
   */
  private setupMessageListeners(): void {
    if (!this.socket || this.simulationMode) return;
    
    // Listeners para eventos do servidor
    this.socket.on('new_number', (data: any) => {
      console.log(`[Socket] Novo número recebido: ${data.roleta_nome} - ${data.numero}`);
      
      const event: RouletteEvent = {
        type: 'new_number',
        roleta_id: data.roleta_id,
        roleta_nome: data.roleta_nome,
        numero: data.numero,
        timestamp: data.timestamp || new Date().toISOString()
      };
      
      this.notifySubscribers(event);
    });
    
    this.socket.on('strategy_update', (data: any) => {
      console.log(`[Socket] Atualização de estratégia: ${data.roleta_nome}`);
      
      const event: RouletteEvent = {
        type: 'strategy_update',
        roleta_id: data.roleta_id,
        roleta_nome: data.roleta_nome,
        estado: data.estado,
        numero_gatilho: data.numero_gatilho,
        terminais_gatilho: data.terminais_gatilho,
        vitorias: data.vitorias,
        derrotas: data.derrotas,
        sugestao_display: data.sugestao_display,
        timestamp: data.timestamp || new Date().toISOString()
      };
      
      this.notifySubscribers(event);
    });
  }
  
  /**
   * Assina para receber eventos de uma roleta específica
   */
  public subscribe(roletaNome: string, callback: RouletteEventCallback): void {
    console.log(`[Socket] Inscrevendo para eventos da roleta: ${roletaNome}`);
    
    if (!this.routeSubscriptions.has(roletaNome)) {
      this.routeSubscriptions.set(roletaNome, new Set());
      
      // Enviar subscrição ao servidor, se estiver conectado
      if (this.socket && !this.simulationMode) {
        this.socket.emit('subscribe_to_roleta', { roleta_nome: roletaNome });
      }
    }
    
    // Adicionar o callback ao set
    this.routeSubscriptions.get(roletaNome)?.add(callback);
  }
  
  /**
   * Cancela assinatura de eventos de uma roleta
   */
  public unsubscribe(roletaNome: string, callback: RouletteEventCallback): void {
    console.log(`[Socket] Removendo inscrição para eventos da roleta: ${roletaNome}`);
    
    const callbacks = this.routeSubscriptions.get(roletaNome);
    if (callbacks) {
      callbacks.delete(callback);
      
      // Se não há mais callbacks, remove a entrada
      if (callbacks.size === 0) {
        this.routeSubscriptions.delete(roletaNome);
        
        // Informar ao servidor, se conectado
        if (this.socket && !this.simulationMode) {
          this.socket.emit('unsubscribe_from_roleta', { roleta_nome: roletaNome });
        }
      }
    }
  }
  
  /**
   * Notifica assinantes sobre eventos
   */
  private notifySubscribers(event: RouletteEvent): void {
    const { roleta_nome } = event;
    
    // Notificar assinantes desta roleta específica
    const callbacks = this.routeSubscriptions.get(roleta_nome);
    if (callbacks) {
      console.log(`[Socket] Notificando ${callbacks.size} assinantes para roleta: ${roleta_nome}`);
      callbacks.forEach(callback => callback(event));
    }
    
    // Notificar assinantes globais (*)
    const globalCallbacks = this.routeSubscriptions.get('*');
    if (globalCallbacks) {
      console.log(`[Socket] Notificando ${globalCallbacks.size} assinantes globais`);
      globalCallbacks.forEach(callback => callback(event));
    }
  }
  
  /**
   * Verifica se o socket está conectado
   */
  public isSocketConnected(): boolean {
    // No modo de simulação, sempre retornar conectado
    if (this.simulationMode) return true;
    
    return this.connected;
  }
  
  /**
   * Desconecta o socket
   */
  public disconnect(): void {
    if (this.socket && !this.simulationMode) {
      console.log('[Socket] Desconectando do WebSocket');
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.connected = false;
    
    // Notificar listeners de desconexão
    this.eventListeners['disconnect']?.forEach(listener => listener({
      type: 'disconnect',
      roleta_id: '',
      roleta_nome: '',
      reason: 'manual_disconnect'
    }));
  }
}

export default SocketService; 