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
    // URL base da API
    const baseUrl = config.apiBaseUrl || '';
    
    // Possíveis endpoints para eventos
    const possibleEndpoints = [
      'events',           // Endpoint simples
      'api/events',       // Endpoint com prefixo api
      'sse',             // Endpoint alternativo
      'api/sse'          // Endpoint alternativo com prefixo api
    ];
    
    // Usar a URL do config ou fallback para a URL atual
    const baseApiUrl = baseUrl || window.location.origin;
    
    // Remover possível barra no final da URL base
    const normalizedBaseUrl = baseApiUrl.endsWith('/') 
      ? baseApiUrl.slice(0, -1) 
      : baseApiUrl;
    
    // Log para depuração
    logger.info(`URL base da API normalizada: ${normalizedBaseUrl}`);
    
    // Testar os endpoints de forma assíncrona e atualizar a URL depois
    this.testEndpoints().then(workingEndpoint => {
      if (workingEndpoint) {
        logger.info(`Endpoint funcionando encontrado após inicialização: ${workingEndpoint}`);
        this.apiUrl = workingEndpoint;
      }
    });
    
    // Por padrão, usar o primeiro endpoint até que o teste seja concluído
    return `${normalizedBaseUrl}/${possibleEndpoints[0]}`;
  }

  private async testEndpoints(): Promise<string | null> {
    // Tenta verificar qual endpoint está funcionando
    const baseUrl = config.apiBaseUrl || window.location.origin;
    
    // Remover possível barra no final da URL base
    const normalizedBaseUrl = baseUrl.endsWith('/') 
      ? baseUrl.slice(0, -1) 
      : baseUrl;
    
    // Lista de possíveis endpoints
    const endpoints = [
      'events',
      'api/events',
      'sse',
      'api/sse',
      'api/sse-status'  // Endpoint de diagnóstico
    ];
    
    logger.info('Testando endpoints disponíveis...');
    
    // Testar o endpoint de status primeiro
    try {
      const statusResponse = await fetch(`${normalizedBaseUrl}/api/sse-status`);
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        logger.info('Endpoint de status disponível:', statusData);
        // Usar o primeiro endpoint suportado da lista
        if (statusData.supported_endpoints && statusData.supported_endpoints.length > 0) {
          const endpoint = statusData.supported_endpoints[0].replace(/^\//, '');
          logger.info(`Usando endpoint recomendado: ${endpoint}`);
          return `${normalizedBaseUrl}/${endpoint}`;
        }
      }
    } catch (error) {
      logger.warn('Endpoint de status não disponível:', error);
    }
    
    // Se não conseguir obter do status, testar cada endpoint
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${normalizedBaseUrl}/${endpoint}`, { 
          method: 'HEAD',
          mode: 'cors',
          cache: 'no-cache',
          credentials: 'include',
        });
        
        // Se retornar qualquer resposta (mesmo que não seja 200)
        // É melhor que 404
        if (response.status !== 404) {
          logger.info(`Endpoint encontrado: ${endpoint} (status: ${response.status})`);
          return `${normalizedBaseUrl}/${endpoint}`;
        }
      } catch (error) {
        logger.warn(`Falha ao testar endpoint ${endpoint}:`, error);
      }
    }
    
    // Se nenhum endpoint funcionar, retorne null
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
    const possibleEndpoints = [
      '/api/events',
      '/events',
      '/api/sse',
      '/sse',
      '/api/stream',
      '/stream'
    ];
    
    // URL base da API
    const baseUrl = config.apiBaseUrl || window.location.origin;
    
    // Tentar próximo endpoint
    const nextEndpointIndex = (this.reconnectAttempts % possibleEndpoints.length);
    const nextEndpoint = possibleEndpoints[nextEndpointIndex];
    this.apiUrl = `${baseUrl}${nextEndpoint}`;
    
    logger.info(`Tentando endpoint alternativo: ${this.apiUrl}`);
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