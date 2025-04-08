import EventService from './EventService';
import { Logger } from './utils/logger';
import config from '@/config/env';

const logger = new Logger('SSEService');

class SSEService {
  private static instance: SSEService;
  private eventSource: EventSource | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000; // 5 segundos
  private isConnected: boolean = false;

  private constructor() {
    this.connect();
  }

  public static getInstance(): SSEService {
    if (!SSEService.instance) {
      SSEService.instance = new SSEService();
    }
    return SSEService.instance;
  }

  private connect(): void {
    if (this.eventSource) {
      this.eventSource.close();
    }

    try {
      this.eventSource = new EventSource(`${config.apiBaseUrl}/api/events`);
      this.setupEventListeners();
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info('Conexão SSE estabelecida');
    } catch (error) {
      logger.error('Erro ao estabelecer conexão SSE:', error);
      this.handleReconnect();
    }
  }

  private setupEventListeners(): void {
    if (!this.eventSource) return;

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Ignorar pings
        if (data.type === 'ping') return;

        // Processar eventos de novos números
        if (data.type === 'new_number') {
          logger.info('Novo número recebido:', data);
          EventService.emit('roulette:new-number', {
            tableId: data.roleta_id,
            tableName: data.roleta_nome,
            number: data.numero,
            cor: data.cor,
            timestamp: data.timestamp
          });
        }
      } catch (error) {
        logger.error('Erro ao processar mensagem SSE:', error);
      }
    };

    this.eventSource.onerror = (error) => {
      logger.error('Erro na conexão SSE:', error);
      this.isConnected = false;
      this.handleReconnect();
    };

    this.eventSource.onopen = () => {
      logger.info('Conexão SSE aberta');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    };
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Número máximo de tentativas de reconexão atingido');
      return;
    }

    this.reconnectAttempts++;
    logger.info(`Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
  }

  public disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      logger.info('Conexão SSE fechada');
    }
  }

  public isConnectedToSSE(): boolean {
    return this.isConnected;
  }
}

export default SSEService; 