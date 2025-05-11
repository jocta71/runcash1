/**
 * Cliente para streaming de dados de roletas via SSE (Server-Sent Events)
 * Implementação similar ao concorrente (tipminer)
 */

import { cryptoService } from './crypto-utils';
import EventBus from '../services/EventBus';

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
  
  // Configurações padrão
  private url: string = '/api/stream/roulettes';
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
   * Conecta ao stream SSE
   */
  public connect(): void {
    if (this.isConnected || this.isConnecting) {
      console.log('[RouletteStream] Já conectado ou conectando');
      return;
    }
    
    this.isConnecting = true;
    console.log(`[RouletteStream] Conectando ao stream SSE: ${this.url}`);
    
    try {
      // Construir URL com query params para autenticação, se necessário
      let streamUrl = this.url;
      if (cryptoService.hasAccessKey()) {
        const accessKey = localStorage.getItem('roulette_access_key');
        if (accessKey) {
          streamUrl += `?key=${encodeURIComponent(accessKey)}`;
        }
      }
      
      // Criar conexão SSE
      this.eventSource = new EventSource(streamUrl);
      
      // Configurar handlers de eventos
      this.eventSource.onopen = this.handleOpen.bind(this);
      this.eventSource.onerror = this.handleError.bind(this);
      
      // Evento de atualização
      this.eventSource.addEventListener('update', this.handleUpdateEvent.bind(this));
      
      // Evento de conexão inicial
      this.eventSource.addEventListener('connected', this.handleConnectedEvent.bind(this));
    } catch (error) {
      console.error('[RouletteStream] Erro ao conectar:', error);
      this.isConnecting = false;
      this.reconnect();
    }
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
    
    // Notificar sobre a desconexão
    this.notifyEvent('disconnect', { timestamp: Date.now() });
    
    // Emitir evento global
    EventBus.emit('roulette:stream-disconnected', { 
      timestamp: new Date().toISOString() 
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
    
    // Notificar sobre a conexão
    this.notifyEvent('connect', { timestamp: Date.now() });
    
    // Emitir evento global
    EventBus.emit('roulette:stream-connected', { 
      timestamp: new Date().toISOString() 
    });
  }

  /**
   * Handler para erros na conexão SSE
   */
  private handleError(event: Event): void {
    console.error('[RouletteStream] Erro na conexão SSE:', event);
    
    this.isConnected = false;
    this.isConnecting = false;
    
    // Notificar sobre o erro
    this.notifyEvent('error', { 
      event,
      timestamp: Date.now()
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
   * Processa os dados do evento de forma assíncrona, separado do handler de evento
   * Este método pode usar async/await com segurança
   */
  private async processUpdateEvent(rawData: string): Promise<void> {
    try {
      let parsedData;
      
      // Verificar se os dados estão criptografados
      if (rawData.startsWith('Fe26.2*')) {
        console.log('[RouletteStream] Dados criptografados recebidos');
        
        // Tentar descriptografar se tivermos a chave
        if (cryptoService.hasAccessKey()) {
          try {
            parsedData = await this.decryptEventData(rawData);
          } catch (error) {
            console.error('[RouletteStream] Erro ao descriptografar dados:', error);
            // Notificar sobre o erro de descriptografia
            EventBus.emit('roulette:decryption-error', {
              timestamp: new Date().toISOString(),
              error: error.message
            });
            return;
          }
        } else {
          // Se não temos a chave, notificar que os dados estão criptografados
          EventBus.emit('roulette:encrypted-data', {
            timestamp: new Date().toISOString(),
            hasAccessKey: false
          });
          
          // Mesmo assim, envia os dados criptografados para quem quiser tentar processar
          this.notifyEvent('update', { encrypted: true, raw: rawData });
          return;
        }
      } else {
        // Dados não estão criptografados
        try {
          parsedData = JSON.parse(rawData);
        } catch (error) {
          console.error('[RouletteStream] Erro ao fazer parse dos dados:', error);
          return;
        }
      }
      
      // Atualizar cache de dados
      if (parsedData && parsedData.id) {
        this.rouletteData.set(parsedData.id, parsedData);
      }
      
      // Notificar callbacks registrados
      this.notifyEvent('update', parsedData);
      
      // Emitir evento global
      EventBus.emit('roulette:data-updated', {
        timestamp: new Date().toISOString(),
        data: parsedData
      });
    } catch (error) {
      console.error('[RouletteStream] Erro ao processar dados de evento update:', error);
    }
  }

  /**
   * Descriptografa dados de evento criptografados
   */
  private async decryptEventData(encryptedData: string): Promise<any> {
    try {
      // Usar o serviço de criptografia para descriptografar
      return await cryptoService.processEncryptedData(encryptedData);
    } catch (error) {
      console.error('[RouletteStream] Erro na descriptografia:', error);
      throw error;
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