import EventService from './EventService';
import RouletteFeedService from './RouletteFeedService';
import { getLogger } from './utils/logger';

// Logger para este serviço
const logger = getLogger('RouletteStreamService');

// Configurações para o streaming
const BASE_API_URL = 'https://backendapi-production-36b5.up.railway.app';
const POLL_INTERVAL = 8000; // 8 segundos para polling - podemos ajustar conforme necessidade
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 2000; // 2 segundos entre tentativas

/**
 * Serviço para streaming de dados de roletas em tempo real
 * Usa a API REST: https://backendapi-production-36b5.up.railway.app/api/ROULETTES
 */
export default class RouletteStreamService {
  private static instance: RouletteStreamService;
  private isConnected = false;
  private apiEndpoint = 'https://backendapi-production-36b5.up.railway.app/api/ROULETTES';
  private pollingInterval: any = null;
  private pollingRetryCount = 0;
  private readonly MAX_RETRY_COUNT = 5;
  private initialBackoffDelay = 2000; // 2 segundos
  private maxBackoffDelay = 30000; // 30 segundos
  
  private constructor() {
    logger.info('Inicializando serviço de streaming de dados de roletas');
    
    // Registrar para eventos de visibilidade
    this.setupVisibilityHandling();
    
    // Registrar para eventos de atualização manual
    document.addEventListener('roulette:manual-refresh', this.handleManualRefresh);
  }
  
  /**
   * Obter a instância única do serviço
   */
  public static getInstance(): RouletteStreamService {
    if (!RouletteStreamService.instance) {
      RouletteStreamService.instance = new RouletteStreamService();
    }
    return RouletteStreamService.instance;
  }
  
  /**
   * Conectar ao serviço de streaming e iniciar polling
   */
  public connect(): void {
    if (this.isConnected) {
      logger.info('Já está conectado ao streaming de dados');
      return;
    }
    
    this.isConnected = true;
    this.notifyConnectionStateChange(true);
    this.startPolling();
    logger.info('Conectado ao streaming de dados de roletas');
  }

  /**
   * Desconectar do serviço de streaming e parar polling
   */
  public disconnect(): void {
    if (!this.isConnected) {
      return;
    }
    
    this.stopPolling();
    this.isConnected = false;
    this.notifyConnectionStateChange(false);
    logger.info('Desconectado do streaming de dados de roletas');
  }
  
  /**
   * Verificar se o serviço está conectado
   */
  public isStreamConnected(): boolean {
    return this.isConnected;
  }
  
  /**
   * Manipular requisição manual de atualização
   */
  private handleManualRefresh = (event: Event): void => {
    logger.info('Recebida solicitação manual de atualização de dados');
    // Forçar busca imediata
    this.fetchRouletteData(true);
  };
  
  /**
   * Configurar manipulação de visibilidade da página
   */
  private setupVisibilityHandling(): void {
    // Quando a página ficar oculta, podemos pausar o polling
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // A página está oculta, pausar o polling mas manter conectado
        this.pausePolling();
        logger.info('Página oculta, polling pausado');
      } else {
        // A página está visível novamente, retomar o polling
        if (this.isConnected) {
          this.resumePolling();
          logger.info('Página visível, polling retomado');
        }
      }
    });
  }
  
  /**
   * Iniciar o polling de dados
   */
  private startPolling(): void {
    // Parar qualquer polling existente
    this.stopPolling();
    
    // Fazer a primeira requisição imediatamente
    this.fetchRouletteData();
    
    // Iniciar o intervalo para buscas regulares (10s)
    this.pollingInterval = setInterval(() => {
      this.fetchRouletteData();
    }, 10000);
    
    logger.info('Polling de dados de roletas iniciado');
  }
  
  /**
   * Pausar o polling temporariamente
   */
  private pausePolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      logger.info('Polling de dados pausado');
    }
  }
  
  /**
   * Retomar o polling
   */
  private resumePolling(): void {
    if (!this.pollingInterval) {
      // Fazer uma requisição imediata e então iniciar o intervalo
      this.fetchRouletteData();
      
      this.pollingInterval = setInterval(() => {
        this.fetchRouletteData();
      }, 10000);
      
      logger.info('Polling de dados retomado');
    }
  }
  
  /**
   * Parar o polling
   */
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      logger.info('Polling de dados parado');
    }
  }

  /**
   * Buscar dados de roletas da API
   */
  private fetchRouletteData(forceRefresh: boolean = false): void {
    // Adicionar parâmetro de cache busting para forçar refresh se necessário
    const cacheBustingParam = forceRefresh ? `?_=${new Date().getTime()}` : '';
    const url = `${this.apiEndpoint}${cacheBustingParam}`;
    
    // Usar AbortController para permitir cancelar a requisição se demorar muito
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
    
    // Tentar obter dados da API
    fetch(url, { 
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        // Adicionar headers para ajudar com CORS
        'Origin': window.location.origin
      },
      mode: 'cors', // Modo explícito CORS
      signal: controller.signal 
    })
      .then(response => {
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
      })
      .then(data => {
        // Processar dados recebidos
        this.processRouletteData(data);
        
        // Resetar contador de tentativas em caso de sucesso
        this.pollingRetryCount = 0;
      })
      .catch(error => {
        clearTimeout(timeoutId);
        
        // Verificar se é erro de abort/timeout
        if (error.name === 'AbortError') {
          logger.error('Timeout na requisição de dados de roletas');
        } else {
          logger.error('Erro ao buscar dados de roletas:', error);
        }
        
        // Implementar backoff exponencial para novas tentativas
        this.handleRequestFailure();
      });
  }
  
  /**
   * Processar os dados recebidos da API
   */
  private processRouletteData(data: any): void {
    try {
      // Verificar se os dados são válidos
      if (!data || !Array.isArray(data)) {
        logger.warn('Dados de roletas inválidos recebidos:', data);
        return;
      }
      
      // Emitir evento com os dados recebidos
      const event = new CustomEvent('roulette:stream-data', {
        detail: { 
          data,
          timestamp: new Date().toISOString()
        }
      });
      
      document.dispatchEvent(event);
      
      // Também notificar que houve atualização de dados
      const updateEvent = new CustomEvent('roulette:data-updated', {
        detail: { timestamp: new Date().toISOString() }
      });
      
      document.dispatchEvent(updateEvent);
      
      logger.info(`Processados dados de ${data.length} roletas do streaming`);
    } catch (error) {
      logger.error('Erro ao processar dados de roletas:', error);
    }
  }
  
  /**
   * Lidar com falhas na requisição usando backoff exponencial
   */
  private handleRequestFailure(): void {
    this.pollingRetryCount++;
    
    // Se exceder o número máximo de tentativas, diminuir a frequência das requisições
    if (this.pollingRetryCount > this.MAX_RETRY_COUNT) {
      // Pausar temporariamente e depois retomar com intervalo maior
      this.pausePolling();
      
      // Calcular o backoff usando exponencial com jitter
      const baseDelay = Math.min(
        this.initialBackoffDelay * Math.pow(2, this.pollingRetryCount - this.MAX_RETRY_COUNT), 
        this.maxBackoffDelay
      );
      
      // Adicionar jitter para evitar sincronização de clientes
      const jitter = Math.random() * 0.3 + 0.85; // 0.85-1.15
      const delayWithJitter = Math.floor(baseDelay * jitter);
      
      logger.warn(`Muitas falhas consecutivas, usando backoff: ${delayWithJitter}ms`);
      
      // Tentar novamente após o atraso
      setTimeout(() => {
        if (this.isConnected) {
          // Se ainda estivermos conectados, iniciar polling novamente
          this.startPolling();
        }
      }, delayWithJitter);
      
      // Notificar desconexão temporária
      this.notifyConnectionStateChange(false);
    }
  }
  
  /**
   * Notificar mudança no estado da conexão
   */
  private notifyConnectionStateChange(connected: boolean): void {
    const event = new CustomEvent('roulette:connection-changed', {
      detail: { connected }
    });
    
    document.dispatchEvent(event);
  }
  
  /**
   * Inicializar o serviço ao carregar a aplicação
   */
  public static initialize(): boolean {
    try {
      const instance = RouletteStreamService.getInstance();
      instance.connect();
      return true;
    } catch (error) {
      logger.error('Falha ao inicializar serviço de streaming:', error);
      return false;
    }
  }
  
  /**
   * Desligar o serviço ao desmontar a aplicação
   */
  public static shutdown(): void {
    if (RouletteStreamService.instance) {
      RouletteStreamService.instance.disconnect();
    }
  }
}
