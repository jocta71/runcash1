import io from 'socket.io-client';
import { getNumericId } from '../data/rouletteTransformer';

/**
 * Implementação simplificada de EventEmitter para browser
 */
class BrowserEventEmitter {
  private events: Record<string, Array<(...args: any[]) => void>> = {};

  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  emit(event: string, ...args: any[]): void {
    const callbacks = this.events[event];
    if (callbacks) {
      callbacks.forEach(callback => callback(...args));
    }
  }

  removeListener(event: string, callback: (...args: any[]) => void): void {
    const callbacks = this.events[event];
    if (callbacks) {
      this.events[event] = callbacks.filter(cb => cb !== callback);
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }
}

/**
 * Cliente WebSocket para comunicação em tempo real
 * Implementa padrão Singleton para garantir uma única conexão
 */
class SocketClient {
  private static instance: SocketClient;
  private socket: any = null;
  private eventEmitter = new BrowserEventEmitter();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 segundos
  private connectedRoulettes = new Set<string>();
  
  /**
   * Obtém a instância única do SocketClient
   */
  public static getInstance(): SocketClient {
    if (!SocketClient.instance) {
      SocketClient.instance = new SocketClient();
    }
    return SocketClient.instance;
  }
  
  /**
   * Conecta ao servidor WebSocket
   */
  public connect(): void {
    if (this.socket && this.socket.connected) {
      console.log('[Socket] Já conectado');
      return;
    }
    
    try {
      // Obter URL do servidor WebSocket das variáveis de ambiente
      const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3000';
      
      console.log(`[Socket] Conectando a ${wsUrl}...`);
      
      this.socket = io(wsUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10
      });
      
      // Configurar handlers para eventos do socket
      this.setupSocketEvents();
    } catch (error) {
      console.error('[Socket] Erro ao conectar:', error);
      this.eventEmitter.emit('connect_error', error);
    }
  }
  
  /**
   * Configura handlers para eventos do socket
   */
  private setupSocketEvents(): void {
    if (!this.socket) return;
    
    this.socket.on('connect', () => {
      console.log('[Socket] ✅ Conectado com sucesso');
      this.reconnectAttempts = 0;
      this.eventEmitter.emit('connect');
      
      // Reconectar às roletas anteriores
      this.connectedRoulettes.forEach(id => {
        this.subscribeToRoulette(id);
      });
    });
    
    this.socket.on('disconnect', (reason: string) => {
      console.log(`[Socket] Desconectado: ${reason}`);
      this.eventEmitter.emit('disconnect', reason);
    });
    
    this.socket.on('connect_error', (error: any) => {
      console.error('[Socket] Erro de conexão:', error);
      this.eventEmitter.emit('connect_error', error);
      
      // Implementar reconexão manual se necessário
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`[Socket] Tentando reconectar (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        
        setTimeout(() => {
          this.connect();
        }, this.reconnectDelay);
      }
    });
    
    // Eventos específicos de roleta
    this.socket.on('new_number', (data: any) => {
      try {
        console.log('[Socket] Novo número recebido:', data);
        
        // Extrair roleta_id ou outro identificador
        const roletaId = data.roleta_id || data.roulette_id || data.id;
        if (!roletaId) {
          console.warn('[Socket] ❌ Evento sem ID de roleta:', data);
          return;
        }
        
        // Mapear para ID numérico
        const numericId = getNumericId(roletaId);
        console.log(`[Socket] Mapeado ID de roleta: ${roletaId} -> ${numericId}`);
        
        // Emitir evento
        this.eventEmitter.emit(`new_number_${numericId}`, data);
      } catch (error) {
        console.error('[Socket] Erro ao processar novo número:', error);
      }
    });
    
    this.socket.on('strategy_update', (data: any) => {
      try {
        console.log('[Socket] Atualização de estratégia recebida:', data);
        
        // Extrair roleta_id ou outro identificador
        const roletaId = data.roleta_id || data.roulette_id || data.id;
        if (!roletaId) {
          console.warn('[Socket] ❌ Evento sem ID de roleta:', data);
          return;
        }
        
        // Mapear para ID numérico
        const numericId = getNumericId(roletaId);
        console.log(`[Socket] Mapeado ID de roleta: ${roletaId} -> ${numericId}`);
        
        // Emitir evento
        this.eventEmitter.emit(`strategy_update_${numericId}`, data);
      } catch (error) {
        console.error('[Socket] Erro ao processar atualização de estratégia:', error);
      }
    });
  }
  
  /**
   * Desconecta do servidor WebSocket
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connectedRoulettes.clear();
      console.log('[Socket] Desconectado manualmente');
    }
  }
  
  /**
   * Assina eventos para uma roleta específica
   * @param id ID da roleta
   * @param name Nome da roleta (opcional)
   */
  public subscribeToRoulette(id: string, name?: string): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('[Socket] Tentativa de assinar roleta sem conexão estabelecida');
      this.connect();
      
      // Adicionar à lista para reconexão futura
      this.connectedRoulettes.add(id);
      return;
    }
    
    // Usar ID numérico para consistência
    const numericId = getNumericId(id);
    
    // Adicionar à lista de roletas conectadas
    this.connectedRoulettes.add(numericId);
    
    console.log(`[Socket] Assinando roleta: ${name || numericId} (ID: ${numericId})`);
    this.socket.emit('subscribe_roulette', { id: numericId });
  }
  
  /**
   * Cancela assinatura de uma roleta específica
   * @param id ID da roleta
   */
  public unsubscribeFromRoulette(id: string): void {
    if (!this.socket || !this.socket.connected) {
      return;
    }
    
    // Usar ID numérico para consistência
    const numericId = getNumericId(id);
    
    // Remover da lista de roletas conectadas
    this.connectedRoulettes.delete(numericId);
    
    console.log(`[Socket] Cancelando assinatura de roleta: ${numericId}`);
    this.socket.emit('unsubscribe_roulette', { id: numericId });
  }
  
  /**
   * Solicita os números de uma roleta específica
   * @param id ID da roleta
   */
  public requestRouletteNumbers(id: string): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('[Socket] Tentativa de solicitar números sem conexão estabelecida');
      return;
    }
    
    // Usar ID numérico para consistência
    const numericId = getNumericId(id);
    
    console.log(`[Socket] Solicitando números para roleta: ${numericId}`);
    this.socket.emit('get_roulette_numbers', { id: numericId });
  }
  
  /**
   * Registra um listener para eventos
   * @param event Nome do evento
   * @param callback Função a ser chamada quando o evento ocorrer
   */
  public on(event: string, callback: (...args: any[]) => void): void {
    this.eventEmitter.on(event, callback);
  }
  
  /**
   * Remove um listener específico
   * @param event Nome do evento
   * @param callback Função a ser removida
   */
  public removeListener(event: string, callback: (...args: any[]) => void): void {
    this.eventEmitter.removeListener(event, callback);
  }
  
  /**
   * Remove todos os listeners de um evento
   * @param event Nome do evento
   */
  public removeAllListeners(event?: string): void {
    this.eventEmitter.removeAllListeners(event);
  }
}

// Exportar instância única
export const socketClient = SocketClient.getInstance(); 