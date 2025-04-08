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
  private isConnecting: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  private constructor() {
    // Não conectar automaticamente no construtor
  }

  public static getInstance(): SSEService {
    if (!SSEService.instance) {
      SSEService.instance = new SSEService();
    }
    return SSEService.instance;
  }

  public async connect(): Promise<void> {
    // Se já está conectado, retornar
    if (this.isConnected && this.eventSource) {
      return;
    }

    // Se está em processo de conexão, retornar a Promise existente
    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    // Iniciar nova conexão
    this.isConnecting = true;
    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        // Fechar conexão existente se houver
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }

        // Criar nova conexão
        this.eventSource = new EventSource(`${config.apiBaseUrl}/api/events`);
        
        // Configurar listeners
        this.eventSource.onopen = () => {
          logger.info('Conexão SSE aberta');
          this.isConnected = true;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.eventSource.onerror = (error) => {
          logger.error('Erro na conexão SSE:', error);
          this.isConnected = false;
          this.isConnecting = false;
          this.handleReconnect();
          reject(error);
        };

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

      } catch (error) {
        logger.error('Erro ao estabelecer conexão SSE:', error);
        this.isConnecting = false;
        this.handleReconnect();
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Número máximo de tentativas de reconexão atingido');
      return;
    }

    this.reconnectAttempts++;
    logger.info(`Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    // Usar exponential backoff para o delay
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    setTimeout(() => {
      this.connect().catch(() => {
        // Erro já foi logado em connect()
      });
    }, delay);
  }

  public disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
    this.connectionPromise = null;
    logger.info('Conexão SSE fechada');
  }

  public isConnectedToSSE(): boolean {
    return this.isConnected;
  }
}

export default SSEService; 