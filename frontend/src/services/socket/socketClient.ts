import { io, Socket } from 'socket.io-client';
import { mapToCanonicalId } from '../data/rouletteTransformer';

/**
 * Implementação simples de EventEmitter compatível com navegadores
 */
class BrowserEventEmitter {
  private events: { [key: string]: Array<(...args: any[]) => void> } = {};

  on(event: string, listener: (...args: any[]) => void): this {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  off(event: string, listener?: (...args: any[]) => void): this {
    if (!this.events[event]) return this;
    
    if (!listener) {
      delete this.events[event];
    } else {
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    if (!this.events[event]) return false;
    
    this.events[event].forEach(listener => {
      listener(...args);
    });
    return true;
  }

  once(event: string, listener: (...args: any[]) => void): this {
    const onceWrapper = (...args: any[]) => {
      listener(...args);
      this.off(event, onceWrapper);
    };
    return this.on(event, onceWrapper);
  }

  removeAllListeners(event?: string): this {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
    return this;
  }
}

/**
 * Cliente WebSocket para comunicação em tempo real
 */
class SocketClient extends BrowserEventEmitter {
  private socket: Socket | null = null;
  private url: string;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private autoReconnect: boolean = true;

  constructor(url: string) {
    super();
    this.url = url;
  }

  /**
   * Conecta ao servidor WebSocket
   */
  connect() {
    if (this.socket) {
      console.log('[Socket] Já existe uma conexão ativa');
      return;
    }

    try {
      console.log(`[Socket] Conectando a ${this.url}`);
      
      this.socket = io(this.url, {
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        timeout: 5000,
        transports: ['websocket']
      });

      this.setupEventHandlers();
    } catch (error) {
      console.error('[Socket] Erro ao conectar:', error);
      this.emit('error', error);
    }
  }

  /**
   * Configura os handlers de eventos do socket
   */
  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[Socket] ✅ Conectado com sucesso');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[Socket] Desconectado: ${reason}`);
      this.isConnected = false;
      this.emit('disconnected', reason);
      
      // Tentar reconectar automaticamente se necessário
      if (this.autoReconnect) {
        setTimeout(() => this.reconnect(), 2000);
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Erro de conexão:', error);
      this.emit('error', error);
      
      if (++this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.log('[Socket] Máximo de tentativas excedido');
        this.emit('max_reconnect_attempts');
      }
    });

    // Eventos específicos de roleta
    this.socket.on('new_number', (data) => {
      console.log('[Socket] Novo número recebido:', data);
      this.emit('new_number', data);
    });

    this.socket.on('strategy_update', (data) => {
      console.log('[Socket] Atualização de estratégia recebida:', data);
      this.emit('strategy_update', data);
    });
  }

  /**
   * Tenta reconectar ao servidor
   */
  reconnect() {
    if (this.isConnected) return;
    
    console.log('[Socket] Tentando reconectar...');
    if (this.socket) {
      this.socket.connect();
    } else {
      this.connect();
    }
  }

  /**
   * Verifica se o socket está conectado
   */
  isSocketConnected(): boolean {
    return this.isConnected && !!this.socket && this.socket.connected;
  }

  /**
   * Emite um evento para o servidor
   * Sobrescreve o método da classe BrowserEventEmitter
   */
  emit(event: string, ...args: any[]): boolean {
    // Eventos específicos do socket que devem ser enviados ao servidor
    if (event === 'new_number' || event === 'strategy_update' || 
        event === 'get_roulette_numbers' || event === 'subscribe_roulette') {
      if (this.socket && this.isConnected) {
        console.log(`[Socket] Emitindo evento '${event}' para o servidor:`, args);
        this.socket.emit(event, ...args);
        return true;
      }
      console.warn(`[Socket] Tentativa de emitir evento '${event}' falhou: socket não conectado`);
      return false;
    } 
    
    // Outros eventos são tratados localmente pela classe BrowserEventEmitter
    return super.emit(event, ...args);
  }

  /**
   * Assina um canal específico de roleta
   * @param roletaId ID da roleta
   * @param roletaNome Nome da roleta
   */
  subscribeToRoulette(roletaId: string, roletaNome: string) {
    if (!this.isSocketConnected()) {
      console.warn(`[Socket] Não é possível assinar roleta ${roletaNome}: socket não conectado`);
      
      // Tentar reconectar e programar nova tentativa
      this.reconnect();
      setTimeout(() => {
        if (this.isSocketConnected()) {
          this.subscribeToRoulette(roletaId, roletaNome);
        }
      }, 2000);
      
      return;
    }
    
    // Garantir que estamos usando o ID canônico
    const canonicalId = mapToCanonicalId(roletaId);
    
    console.log(`[Socket] Assinando canal da roleta ${roletaNome} (${canonicalId})`);
    this.socket!.emit('subscribe_roulette', {
      roletaId: canonicalId,
      originalId: roletaId,
      roletaNome,
      channel: `roulette:${canonicalId}`
    });
    
    // Configurar listener para este canal específico
    const channelName = `roulette:${canonicalId}`;
    
    // Remover listener existente para evitar duplicação
    this.socket!.off(channelName);
    
    // Adicionar novo listener
    this.socket!.on(channelName, (data: any) => {
      console.log(`[Socket] Dados recebidos no canal ${channelName}:`, data);
      this.emit(`roulette_update:${canonicalId}`, data);
    });
    
    // Solicitar dados iniciais para esta roleta
    this.requestRouletteNumbers(canonicalId);
  }

  /**
   * Solicita números para uma roleta específica
   * @param roletaId ID da roleta
   */
  requestRouletteNumbers(roletaId: string) {
    if (!this.isSocketConnected()) {
      console.warn(`[Socket] Não é possível solicitar números: socket não conectado`);
      return;
    }
    
    // Garantir que estamos usando o ID canônico
    const canonicalId = mapToCanonicalId(roletaId);
    
    console.log(`[Socket] Solicitando números para roleta ${canonicalId}`);
    this.socket!.emit('get_roulette_numbers', {
      roletaId: canonicalId,
      endpoint: `/api/ROULETTES`,
      count: 50 // Solicitar até 50 números para garantir boa amostra
    });
  }

  /**
   * Desconecta o socket
   */
  disconnect() {
    if (this.socket) {
      console.log('[Socket] Desconectando...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }
}

// Cria uma instância singleton para uso em toda a aplicação
export const socketClient = new SocketClient(import.meta.env.VITE_WS_URL || 'wss://backend-production-2f96.up.railway.app'); 