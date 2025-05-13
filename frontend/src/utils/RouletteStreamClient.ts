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
   * Handler para erros na conexão SSE
   */
  private lastErrorTime: number = 0;
  private errorCount: number = 0;
  private errorSilenced: boolean = false;
  private readonly ERROR_THRESHOLD: number = 3; // Número de erros antes de silenciar
  private readonly ERROR_COOLDOWN: number = 30000; // 30 segundos de cooldown entre logs completos

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

      // Iniciar timer para timeout - reduzido para falhar mais rápido
      const timeoutId = setTimeout(() => {
        console.log('[RouletteStream] Timeout ao aguardar conexão SSE');
        GLOBAL.CONNECTION_PROMISE = null; // Limpar a promessa para permitir novas tentativas
        resolve(false);
      }, timeout);

      // Ouvir evento de conexão
      const handler = () => {
        clearTimeout(timeoutId);
        resolve(true);
      };

      // Registrar listener para evento de conexão
      EventBus.on('roulette:stream-connected', handler);

      // Verificar novamente em intervalos mais frequentes
      const checkInterval = setInterval(() => {
        if (GLOBAL.SSE_CONNECTION_ACTIVE) {
          clearTimeout(timeoutId);
          clearInterval(checkInterval);
          EventBus.off('roulette:stream-connected', handler);
          resolve(true);
        }
      }, 50); // Verificar a cada 50ms em vez de esperar 100ms

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
      // Definir um timeout de conexão mais curto (3 segundos)
      const connectionTimeout = setTimeout(() => {
        console.log('[RouletteStream] Timeout na conexão SSE, resolvendo como não conectado');
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        this.isConnecting = false;
        resolve(false);
      }, 3000);
      
      try {
        // Usar a URL diretamente do atributo da classe, que já está sendo
        // inicializado com SSE_STREAM_URL no construtor
        let streamUrl = this.url;
        
        // Criar conexão SSE
        this.eventSource = new EventSource(streamUrl);
        
        // Configurar handlers de eventos
        this.eventSource.onopen = () => {
          clearTimeout(connectionTimeout);
          this.handleOpen();
          resolve(true);
        };
        
        this.eventSource.onerror = (error) => {
          clearTimeout(connectionTimeout);
          this.handleError(error);
          resolve(false);
        };
        
        // Evento de atualização
        this.eventSource.addEventListener('update', this.handleUpdateEvent.bind(this));
        
        // Evento de conexão inicial
        this.eventSource.addEventListener('connected', this.handleConnectedEvent.bind(this));
      } catch (error) {
        clearTimeout(connectionTimeout);
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
    const now = Date.now();
    const timeSinceLastError = now - this.lastErrorTime;
    
    // Atualizar estado da conexão
    this.isConnected = false;
    this.isConnecting = false;
    
    // Se esta era a conexão global ativa, atualizar estado global
    if (GLOBAL.SSE_CONNECTION_ID === this.connectionId) {
      GLOBAL.SSE_CONNECTION_ACTIVE = false;
    }
    
    // Detectar erros repetitivos
    if (timeSinceLastError < 5000) { // Erros em menos de 5 segundos são considerados repetitivos
      this.errorCount++;
      
      // Se atingimos o limite, silenciar logs detalhados
      if (this.errorCount >= this.ERROR_THRESHOLD && !this.errorSilenced) {
        console.warn('[RouletteStream] Múltiplos erros de conexão detectados. Logs detalhados serão reduzidos temporariamente.');
        this.errorSilenced = true;
      }
    } else {
      // Resetar contador se passou tempo suficiente
      if (timeSinceLastError > this.ERROR_COOLDOWN) {
        this.errorCount = 1;
        this.errorSilenced = false;
      }
    }
    
    this.lastErrorTime = now;
    
    // Decidir o nível de log com base no estado de silenciamento
    if (!this.errorSilenced) {
      console.error('[RouletteStream] Erro na conexão SSE:', event);
    } else if (timeSinceLastError > this.ERROR_COOLDOWN) {
      // Log resumido periódico mesmo no modo silenciado
      console.warn(`[RouletteStream] Conexão SSE continua instável. ${this.errorCount} erros desde a última notificação.`);
    }
    
    // Notificar sobre o erro (sem log)
    this.notifyEvent('error', { 
      event,
      timestamp: now,
      silenced: this.errorSilenced
    });
    
    // Emitir evento global (sempre, independente do silenciamento)
    EventBus.emit('roulette:stream-error', {
      timestamp: new Date().toISOString(),
      connectionId: this.connectionId,
      reconnectAttempts: this.reconnectAttempts,
      errorCount: this.errorCount
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
   * Processa um evento de atualização do stream
   */
  private async processUpdateEvent(rawData: string): Promise<void> {
    try {
      // Se os dados estiverem vazios, ignorar
      if (!rawData || rawData === 'vazio') {
        console.log('🔄 Evento SSE recebido: {type: \'heartbeat\', id: undefined, data: \'vazio\'}');
        return;
      }

      let jsonData: any;
      
      // Tentar analisar os dados como JSON
      try {
        jsonData = JSON.parse(rawData);
      } catch (e) {
        console.error('❌ Erro ao analisar dados JSON do SSE:', e);
        console.debug('Dados brutos recebidos:', rawData);
        return;
      }
      
      // Processar diferentes tipos de eventos
      if (jsonData.type === 'all_roulettes_update' && Array.isArray(jsonData.data)) {
        // Atualizar cache de dados
        jsonData.data.forEach((rouletteData: any) => {
          if (rouletteData && rouletteData.id) {
            this.rouletteData.set(rouletteData.id, rouletteData);
          }
        });
        
        // Para compatibilidade com UnifiedRouletteClient, converter para formato de string JSON
        const compatData = JSON.stringify(jsonData);
        
        // Notificar sobre a atualização
        this.notifyEvent('update', compatData);
      } else if (jsonData.type === 'single_roulette_update' && jsonData.data) {
        // Atualizar cache para uma roleta específica
        if (jsonData.data.id) {
          this.rouletteData.set(jsonData.data.id, jsonData.data);
        }
        
        // Para compatibilidade com UnifiedRouletteClient, converter para formato de string JSON
        const compatData = JSON.stringify(jsonData);
        
        // Notificar sobre a atualização
        this.notifyEvent('update', compatData);
      } else if (jsonData.type === 'heartbeat') {
        // Atualizar timestamp de última recepção
        this.lastReceivedAt = Date.now();
        
        // Para compatibilidade com manipuladores existentes
        const heartbeatEvent = JSON.stringify({ 
          type: 'heartbeat',
          timestamp: Date.now(),
          message: 'Heartbeat recebido'
        });
        
        // Notificar sobre o heartbeat (opcional)
        this.notifyEvent('heartbeat', heartbeatEvent);
      } else {
        // Para qualquer outro formato de dados, passar adiante como está (em formato string)
        const compatData = (typeof rawData === 'string') ? rawData : JSON.stringify(jsonData);
        this.notifyEvent('update', compatData);
      }
    } catch (error) {
      console.error('❌ Erro ao processar evento do stream:', error);
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