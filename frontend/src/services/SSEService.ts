import EventService from './EventService';
import { Logger } from './utils/logger';
import config from '@/config/env';

const logger = new Logger('SSEService');

export class SSEService {
  private static instance: SSEService;
  private eventSource: EventSource | null = null;
  private messageCallbacks: Map<string, ((data: any) => void)[]> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000; // 2 segundos inicial
  private isConnected: boolean = false;
  private apiUrl: string;

  private constructor() {
    this.apiUrl = this.determineApiUrl();
    logger.info(`Inicializando SSEService com URL: ${this.apiUrl}`);
    this.connect();
  }

  public static getInstance(): SSEService {
    if (!SSEService.instance) {
      SSEService.instance = new SSEService();
    }
    return SSEService.instance;
  }
  
  private determineApiUrl(): string {
    // Usar diretamente a URL do stream
    const streamUrl = config.sseUrl;
    logger.info(`URL do stream configurada: ${streamUrl}`);
    return streamUrl;
  }

  private async testEndpoints(): Promise<string | null> {
    const streamUrl = config.sseUrl;
    
    logger.info(`Testando conexão com stream em: ${streamUrl}`);
    
    try {
      const response = await fetch(streamUrl, { 
        method: 'HEAD',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'include',
      });
      
      if (response.status !== 404) {
        logger.info(`Stream disponível em: ${streamUrl}`);
        return streamUrl;
      }
    } catch (error) {
      // Se der erro CORS, pode ser um sinal de que o endpoint existe
      if (error instanceof TypeError && error.message.includes('CORS')) {
        logger.info(`Stream encontrado (CORS): ${streamUrl}`);
        return streamUrl;
      }
      logger.warn(`Falha ao testar stream:`, error);
    }
    
    return null;
  }

  private async connect(): Promise<void> {
    if (this.eventSource) {
      this.eventSource.close();
    }

    try {
      // Primeiro, testar endpoints disponíveis
      const workingEndpoint = await this.testEndpoints();
      
      if (workingEndpoint) {
        logger.info(`Endpoint funcionando encontrado: ${workingEndpoint}`);
        this.apiUrl = workingEndpoint;
      } else {
        logger.warn('Nenhum endpoint disponível encontrado. Usando padrão.');
      }
      
      logger.info(`Tentando conectar ao endpoint SSE: ${this.apiUrl}`);
      this.eventSource = new EventSource(this.apiUrl);
      this.setupEventListeners();
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

        logger.info('Evento SSE recebido:', data.type);
        
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
      
      // Verificar se é erro 404 (endpoint não encontrado)
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        logger.error('Endpoint SSE não encontrado (404). Tentando endpoints alternativos...');
        this.tryAlternativeEndpoints();
      } else {
        this.handleReconnect();
      }
    };

    this.eventSource.onopen = () => {
      logger.info('Conexão SSE aberta com sucesso');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    };
  }
  
  private tryAlternativeEndpoints(): void {
    // Não tentar endpoints alternativos, usar apenas o configurado
    logger.info(`Reconectando ao stream: ${this.apiUrl}`);
    this.handleReconnect();
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Número máximo de tentativas de reconexão atingido. Usando fallback para polling.');
      this.fallbackToPolling();
      return;
    }

    this.reconnectAttempts++;
    logger.info(`Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts} em ${this.reconnectDelay}ms`);

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
  }
  
  private fallbackToPolling(): void {
    logger.warn('Conexão SSE falhou. Utilizando pollingService como fallback.');
    // Aqui poderia iniciar um serviço de polling como fallback
    // Mas como estamos tentando eliminar o polling, apenas emitimos um evento de erro
    EventService.emit('sse:connection-failed', {
      message: 'Falha ao conectar ao serviço de eventos em tempo real.'
    });
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