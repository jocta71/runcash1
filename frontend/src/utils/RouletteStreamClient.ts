/**
 * Cliente para streaming de dados de roletas via SSE (Server-Sent Events)
 * Implementação unificada para streaming de dados de roletas
 */

// Importar módulos do projeto
import EventBus from '../services/EventBus';
import { SSE_STREAM_URL } from '../services/api/endpoints';

// Controle global para garantir uma única conexão SSE em toda a aplicação
const GLOBAL = {
  SSE_CONNECTION_ACTIVE: false,
  SSE_CONNECTION_ID: null as string | null,
  CONNECTION_PROMISE: null as Promise<boolean> | null,
  CONNECTION_ATTEMPTS: 0,
  CONNECTION_MAX_ATTEMPTS: 3,
  SSE_INITIALIZED: false
};

// Opções de configuração do cliente SSE
interface RouletteStreamOptions {
  autoConnect?: boolean;
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

// Interface para callbacks de eventos
type EventCallback = (data: any) => void;

class RouletteStreamClient {
  private static instance: RouletteStreamClient;
  private eventSource: EventSource | null = null;
  private isConnected: boolean = false;
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private callbacks: Map<string, EventCallback[]> = new Map();
  private reconnectTimer: number | null = null;
  private lastEventId: string | null = null;
  private lastReceivedAt: number = 0;
  private connectionId: string = `sse-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  
  // Configurações padrão
  private url: string = SSE_STREAM_URL;
  private reconnectInterval: number = 5000;
  private maxReconnectAttempts: number = 10;
  
  // Cache de dados
  private rouletteData: Map<string, any> = new Map();

  /**
   * Construtor privado para Singleton
   */
  private constructor(options: RouletteStreamOptions = {}) {
    // Aplicar opções
    this.url = options.url || this.url;
    this.reconnectInterval = options.reconnectInterval || this.reconnectInterval;
    this.maxReconnectAttempts = options.maxReconnectAttempts || this.maxReconnectAttempts;
    
    // Inicializar
    if (options.autoConnect) {
      this.connect();
    }

    // Registrar esta instância como a conexão global
    GLOBAL.SSE_CONNECTION_ID = this.connectionId;
    GLOBAL.SSE_INITIALIZED = true;
    
    console.log(`[RouletteStream] Instância inicializada com ID: ${this.connectionId}`);
  }

  /**
   * Obtém a instância singleton
   */
  public static getInstance(options: RouletteStreamOptions = {}): RouletteStreamClient {
    if (!RouletteStreamClient.instance) {
      RouletteStreamClient.instance = new RouletteStreamClient(options);
    }
    return RouletteStreamClient.instance;
  }

  /**
   * Verifica se já existe uma conexão SSE ativa em qualquer parte da aplicação
   */
  public static isConnectionActive(): boolean {
    return GLOBAL.SSE_CONNECTION_ACTIVE;
  }

  /**
   * Aguarda pela inicialização da conexão SSE
   * @returns Promise que resolve para true quando a conexão for estabelecida ou false em caso de falha
   */
  public static async waitForConnection(timeout: number = 10000): Promise<boolean> {
    if (GLOBAL.SSE_CONNECTION_ACTIVE) {
      return true;
    }

    if (GLOBAL.CONNECTION_PROMISE) {
      return GLOBAL.CONNECTION_PROMISE;
    }

    GLOBAL.CONNECTION_PROMISE = new Promise<boolean>((resolve) => {
      // Se a conexão já estiver ativa, resolver imediatamente
      if (GLOBAL.SSE_CONNECTION_ACTIVE) {
        resolve(true);
        return;
      }

      // Iniciar timer para timeout
      const timeoutId = setTimeout(() => {
        console.log('[RouletteStream] Timeout ao aguardar conexão SSE');
        resolve(false);
      }, timeout);

      // Ouvir evento de conexão
      const handler = () => {
        clearTimeout(timeoutId);
        resolve(true);
      };

      // Registrar listener para evento de conexão
      EventBus.on('roulette:stream-connected', handler);

      // Verificar novamente após um curto período (para caso o evento já tenha sido emitido)
      setTimeout(() => {
        if (GLOBAL.SSE_CONNECTION_ACTIVE) {
          clearTimeout(timeoutId);
          EventBus.off('roulette:stream-connected', handler);
          resolve(true);
        }
      }, 100);

      // Se não houver uma instância inicializada, tentar criar uma agora
      if (!GLOBAL.SSE_INITIALIZED) {
        console.log('[RouletteStream] Iniciando conexão SSE automaticamente');
        RouletteStreamClient.getInstance({ autoConnect: true });
      }
    });

    return GLOBAL.CONNECTION_PROMISE;
  }

  /**
   * Conecta ao stream SSE
   */
  public connect(): Promise<boolean> {
    // Se já existe uma conexão global ativa com outro ID, não iniciar nova conexão
    if (GLOBAL.SSE_CONNECTION_ACTIVE && GLOBAL.SSE_CONNECTION_ID !== this.connectionId) {
      console.log(`[RouletteStream] Já existe uma conexão SSE ativa com ID: ${GLOBAL.SSE_CONNECTION_ID}. Reutilizando.`);
      return Promise.resolve(true);
    }

    if (this.isConnected || this.isConnecting) {
      console.log('[RouletteStream] Já conectado ou conectando');
      return Promise.resolve(this.isConnected);
    }
    
    this.isConnecting = true;
    GLOBAL.CONNECTION_ATTEMPTS++;
    
    console.log(`[RouletteStream] Conectando ao stream SSE: ${this.url} (tentativa ${GLOBAL.CONNECTION_ATTEMPTS})`);
    
    return new Promise((resolve) => {
      try {
        // Usar a URL diretamente do atributo da classe, que já está sendo
        // inicializado com SSE_STREAM_URL no construtor
        let streamUrl = this.url;
        
        // Criar conexão SSE
        this.eventSource = new EventSource(streamUrl);
        
        // Configurar handlers de eventos
        this.eventSource.onopen = () => {
          this.handleOpen();
          resolve(true);
        };
        
        this.eventSource.onerror = (error) => {
          this.handleError(error);
          resolve(false);
        };
        
        // Evento de atualização
        this.eventSource.addEventListener('update', this.handleUpdateEvent.bind(this));
        
        // Evento de conexão inicial
        this.eventSource.addEventListener('connected', this.handleConnectedEvent.bind(this));
      } catch (error) {
        console.error('[RouletteStream] Erro ao conectar:', error);
        this.isConnecting = false;
        this.reconnect();
        resolve(false);
      }
    });
  }

  /**
   * Desconecta do stream SSE
   */
  public disconnect(): void {
    if (!this.isConnected && !this.isConnecting) {
      return;
    }
    
    console.log('[RouletteStream] Desconectando do stream SSE');
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    
    // Se esta era a conexão global ativa, atualizar estado global
    if (GLOBAL.SSE_CONNECTION_ID === this.connectionId) {
      GLOBAL.SSE_CONNECTION_ACTIVE = false;
      console.log(`[RouletteStream] Conexão global com ID ${this.connectionId} desativada`);
    }
    
    // Notificar sobre a desconexão
    this.notifyEvent('disconnect', { timestamp: Date.now() });
    
    // Emitir evento global
    EventBus.emit('roulette:stream-disconnected', { 
      timestamp: new Date().toISOString(),
      connectionId: this.connectionId
    });
  }

  /**
   * Reconecta ao stream após desconexão
   */
  private reconnect(): void {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
    }
    
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error(`[RouletteStream] Máximo de tentativas de reconexão (${this.maxReconnectAttempts}) atingido`);
      
      // Emitir evento global
      EventBus.emit('roulette:stream-max-reconnect', { 
        attempts: this.reconnectAttempts,
        timestamp: new Date().toISOString()
      });
      
      return;
    }
    
    const delay = this.reconnectInterval * Math.min(this.reconnectAttempts, 5);
    console.log(`[RouletteStream] Tentando reconectar em ${delay}ms (tentativa ${this.reconnectAttempts})`);
    
    // Notificar sobre a tentativa de reconexão
    this.notifyEvent('reconnecting', { 
      attempt: this.reconnectAttempts,
      delay,
      timestamp: Date.now()
    });
    
    this.reconnectTimer = window.setTimeout(() => {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      
      this.isConnected = false;
      this.isConnecting = false;
      this.connect();
    }, delay);
  }

  /**
   * Handler para o evento de abertura da conexão
   */
  private handleOpen(): void {
    console.log('[RouletteStream] Conexão SSE estabelecida');
    this.isConnected = true;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    
    // Atualizar estado global para indicar conexão ativa
    GLOBAL.SSE_CONNECTION_ACTIVE = true;
    GLOBAL.CONNECTION_ATTEMPTS = 0;
    
    // Notificar sobre a conexão
    this.notifyEvent('connect', { timestamp: Date.now() });
    
    // Emitir evento global
    EventBus.emit('roulette:stream-connected', { 
      timestamp: new Date().toISOString(),
      connectionId: this.connectionId
    });
  }

  /**
   * Handler para erros na conexão SSE
   */
  private handleError(event: Event): void {
    console.error('[RouletteStream] Erro na conexão SSE:', event);
    
    this.isConnected = false;
    this.isConnecting = false;
    
    // Se esta era a conexão global ativa, atualizar estado global
    if (GLOBAL.SSE_CONNECTION_ID === this.connectionId) {
      GLOBAL.SSE_CONNECTION_ACTIVE = false;
    }
    
    // Notificar sobre o erro
    this.notifyEvent('error', { 
      event,
      timestamp: Date.now()
    });
    
    // Emitir evento global
    EventBus.emit('roulette:stream-error', {
      timestamp: new Date().toISOString(),
      connectionId: this.connectionId,
      reconnectAttempts: this.reconnectAttempts
    });
    
    // Tentar reconectar
    this.reconnect();
  }

  /**
   * Handler para o evento inicial 'connected'
   */
  private handleConnectedEvent(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      console.log('[RouletteStream] Evento connected:', data);
      
      // Emitir evento global
      EventBus.emit('roulette:stream-ready', { 
        timestamp: new Date().toISOString(),
        data
      });
      
      // Notificar callbacks registrados
      this.notifyEvent('connected', data);
    } catch (error) {
      console.error('[RouletteStream] Erro ao processar evento connected:', error, event.data);
    }
  }

  /**
   * Handler para eventos de atualização
   * Usa um padrão que evita erros com canais de mensagem fechados
   */
  private handleUpdateEvent(event: MessageEvent): void {
    this.lastReceivedAt = Date.now();
    this.lastEventId = event.lastEventId;
    
    // Não usar async/await diretamente no handler para evitar retornar Promise
    // Usar setTimeout para processar em um microtick separado
    setTimeout(() => {
      this.processUpdateEvent(event.data).catch(error => {
        console.error('[RouletteStream] Erro ao processar evento update em background:', error);
      });
    }, 0);
  }
  
  /**
   * Processa dados de evento de atualização
   */
  private async processUpdateEvent(rawData: string): Promise<void> {
    try {
      // Tentar fazer parse dos dados como JSON
      let parsedData = null;
      
      try {
        parsedData = JSON.parse(rawData);
      } catch (error) {
        console.error('[RouletteStream] Erro ao fazer parse dos dados:', error);
        return;
      }
      
      // Verificar se os dados são válidos
      if (!parsedData) {
        console.error('[RouletteStream] Dados inválidos ou nulos');
        return;
      }
      
      // Atualizar cache de dados
      if (Array.isArray(parsedData)) {
        // Se for um array, presumir que são várias roletas
        for (const roulette of parsedData) {
          if (roulette && roulette.id) {
            this.rouletteData.set(roulette.id, roulette);
          }
        }
      } else if (parsedData.id) {
        // Se for um objeto com ID, presumir que é uma única roleta
        this.rouletteData.set(parsedData.id, parsedData);
      } else if (parsedData.data && Array.isArray(parsedData.data)) {
        // Formato alternativo com campo 'data'
        for (const roulette of parsedData.data) {
          if (roulette && roulette.id) {
            this.rouletteData.set(roulette.id, roulette);
          }
        }
      }
      
      // Notificar sobre a atualização
      this.notifyEvent('update', parsedData);
      this.lastReceivedAt = Date.now();
    } catch (error) {
      console.error('[RouletteStream] Erro ao processar evento de atualização:', error);
    }
  }

  /**
   * Adiciona um callback para um tipo de evento
   */
  public on(event: string, callback: EventCallback): void {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    
    this.callbacks.get(event)!.push(callback);
  }

  /**
   * Remove um callback para um tipo de evento
   */
  public off(event: string, callback: EventCallback): void {
    if (!this.callbacks.has(event)) {
      return;
    }
    
    const callbacks = this.callbacks.get(event)!;
    const index = callbacks.indexOf(callback);
    
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Notifica todos os callbacks registrados para um tipo de evento
   */
  private notifyEvent(event: string, data: any): void {
    if (!this.callbacks.has(event)) {
      return;
    }
    
    for (const callback of this.callbacks.get(event)!) {
      try {
        callback(data);
      } catch (error) {
        console.error(`[RouletteStream] Erro em callback para evento ${event}:`, error);
      }
    }
  }

  /**
   * Retorna os dados mais recentes de uma roleta específica
   */
  public getRouletteData(id: string): any {
    return this.rouletteData.get(id) || null;
  }

  /**
   * Retorna todos os dados de roletas no cache
   */
  public getAllRouletteData(): any[] {
    return Array.from(this.rouletteData.values());
  }

  /**
   * Retorna o status atual da conexão
   */
  public getStatus(): any {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      lastEventId: this.lastEventId,
      lastReceivedAt: this.lastReceivedAt,
      cacheSize: this.rouletteData.size
    };
  }
}

// Exportar instância singleton
export default RouletteStreamClient; 