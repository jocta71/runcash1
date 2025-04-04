import io from 'socket.io-client';
import { getNumericId } from '../data/rouletteTransformer';
import { getLogger } from '../utils/logger';

// Logger para o cliente de socket
const logger = getLogger('Socket');

// Cache de conexões para evitar reconexões desnecessárias
const rouletteSubscriptionCache = new Set<string>();

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
  private isConnecting = false;
  
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
      logger.debug('Já conectado');
      return;
    }
    
    // Evitar conexões simultâneas
    if (this.isConnecting) {
      logger.debug('Já existe uma tentativa de conexão em andamento');
      return;
    }
    
    this.isConnecting = true;
    
    try {
      // Obter URL do servidor WebSocket das variáveis de ambiente
      const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3000';
      
      logger.info(`Conectando a ${wsUrl}...`);
      
      this.socket = io(wsUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10
      });
      
      // Configurar handlers para eventos do socket
      this.setupSocketEvents();
    } catch (error) {
      logger.error('Erro ao conectar:', error);
      this.eventEmitter.emit('connect_error', error);
      this.isConnecting = false;
    }
  }
  
  /**
   * Configura handlers para eventos do socket
   */
  private setupSocketEvents(): void {
    if (!this.socket) return;
    
    this.socket.on('connect', () => {
      logger.info('✅ Conectado com sucesso');
      this.reconnectAttempts = 0;
      this.isConnecting = false;
      this.eventEmitter.emit('connect');
      
      // Reconectar às roletas anteriores (apenas uma vez)
      this.reconnectToSavedRoulettes();
    });
    
    this.socket.on('disconnect', (reason: string) => {
      logger.info(`Desconectado: ${reason}`);
      this.isConnecting = false;
      this.eventEmitter.emit('disconnect', reason);
    });
    
    this.socket.on('connect_error', (error: any) => {
      logger.error('Erro de conexão:', error);
      this.isConnecting = false;
      this.eventEmitter.emit('connect_error', error);
      
      // Implementar reconexão manual se necessário
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        logger.info(`Tentando reconectar (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        
        setTimeout(() => {
          this.connect();
        }, this.reconnectDelay);
      }
    });
    
    // Eventos específicos de roleta
    this.socket.on('new_number', (data: any) => {
      try {
        // Extrair roleta_id ou outro identificador
        const roletaId = data.roleta_id || data.roulette_id || data.id;
        if (!roletaId) {
          logger.warn('❌ Evento sem ID de roleta:', data);
          return;
        }
        
        // Mapear para ID numérico
        const numericId = getNumericId(roletaId);
        logger.debug(`Mapeado ID de roleta: ${roletaId} -> ${numericId}`);
        
        // Emitir evento
        this.eventEmitter.emit(`new_number_${numericId}`, data);
      } catch (error) {
        logger.error('Erro ao processar novo número:', error);
      }
    });
    
    this.socket.on('strategy_update', (data: any) => {
      try {
        // Extrair roleta_id ou outro identificador
        const roletaId = data.roleta_id || data.roulette_id || data.id;
        if (!roletaId) {
          logger.warn('❌ Evento sem ID de roleta:', data);
          return;
        }
        
        // Mapear para ID numérico
        const numericId = getNumericId(roletaId);
        logger.debug(`Mapeado ID de roleta: ${roletaId} -> ${numericId}`);
        
        // Emitir evento
        this.eventEmitter.emit(`strategy_update_${numericId}`, data);
      } catch (error) {
        logger.error('Erro ao processar atualização de estratégia:', error);
      }
    });
  }
  
  /**
   * Reconecta a todas as roletas salvas
   */
  private reconnectToSavedRoulettes(): void {
    // Executar apenas uma vez por conexão
    if (this.connectedRoulettes.size === 0) {
      logger.debug('Sem roletas salvas para reconexão');
      return;
    }
    
    logger.info(`Reconectando a ${this.connectedRoulettes.size} roletas salvas`);
    
    // Criar cópia para iterar
    const savedRoulettes = [...this.connectedRoulettes];
    
    // Limpar para evitar duplicações
    this.connectedRoulettes.clear();
    
    // Reconectar a cada roleta
    savedRoulettes.forEach(id => {
      this.subscribeToRoulette(id);
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
      logger.info('Desconectado manualmente');
    }
  }
  
  /**
   * Assina eventos para uma roleta específica
   * @param id ID da roleta
   * @param name Nome da roleta (opcional)
   */
  public subscribeToRoulette(id: string, name?: string): void {
    if (!id) {
      logger.warn('Tentativa de assinar roleta com ID vazio');
      return;
    }
    
    // Usar ID numérico para consistência
    const numericId = getNumericId(id);
    
    // Verificar se já está inscrito
    if (rouletteSubscriptionCache.has(numericId)) {
      logger.debug(`Roleta ${name || numericId} já está inscrita`);
      return;
    }
    
    // Marcar como inscrito para evitar duplicações
    rouletteSubscriptionCache.add(numericId);
    
    // Conectar se necessário
    if (!this.socket || !this.socket.connected) {
      logger.debug('Conectando antes de assinar roleta');
      this.connectedRoulettes.add(numericId);
      this.connect();
      return;
    }
    
    // Adicionar à lista de roletas conectadas
    this.connectedRoulettes.add(numericId);
    
    logger.info(`Assinando roleta: ${name || numericId} (ID: ${numericId})`);
    this.socket.emit('subscribe_roulette', { id: numericId });
    
    // Solicitar números iniciais
    this.requestRouletteNumbers(numericId);
  }
  
  /**
   * Cancela assinatura de uma roleta específica
   * @param id ID da roleta
   */
  public unsubscribeFromRoulette(id: string): void {
    if (!id) return;
    
    // Usar ID numérico para consistência
    const numericId = getNumericId(id);
    
    // Remover do cache de inscrições
    rouletteSubscriptionCache.delete(numericId);
    
    if (!this.socket || !this.socket.connected) {
      return;
    }
    
    // Remover da lista de roletas conectadas
    this.connectedRoulettes.delete(numericId);
    
    logger.debug(`Cancelando assinatura de roleta: ${numericId}`);
    this.socket.emit('unsubscribe_roulette', { id: numericId });
  }
  
  /**
   * Solicita os números de uma roleta específica
   * @param id ID da roleta
   */
  public requestRouletteNumbers(id: string): void {
    if (!id) return;
    
    // Usar ID numérico para consistência
    const numericId = getNumericId(id);
    
    if (!this.socket || !this.socket.connected) {
      logger.debug('Tentativa de solicitar números sem conexão estabelecida');
      return;
    }
    
    logger.debug(`Solicitando números para roleta: ${numericId}`);
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