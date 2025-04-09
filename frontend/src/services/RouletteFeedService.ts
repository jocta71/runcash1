import config from '@/config/env';
import EventService from './EventService';
import { getLogger } from './utils/logger';
import { HistoryData } from './SocketService';

// Criar uma única instância do logger
const logger = getLogger('RouletteFeedService');

// Configurações globais para o serviço
const POLLING_INTERVAL = 8000; // Ajustado para 8 segundos baseado no código de referência
const MIN_REQUEST_INTERVAL = 3000; // Intervalo mínimo entre requisições em ms
const CACHE_TTL = 15000; // 15 segundos de TTL para o cache
const MAX_CONSECUTIVE_ERRORS = 5; // Máximo de erros consecutivos antes de pausar
const HEALTH_CHECK_INTERVAL = 30000; // Verificar a saúde do sistema a cada 30 segundos

// Adicionar constantes para o sistema de recuperação inteligente
const NORMAL_POLLING_INTERVAL = 8000; // 8 segundos em condições normais
const ERROR_POLLING_INTERVAL = 15000; // 15 segundos quando ocorrem erros
const MAX_ERROR_POLLING_INTERVAL = 8000; // 8 segundos no máximo após vários erros
const RECOVERY_CHECK_INTERVAL = 60000; // 1 minuto para verificação de recuperação completa
const MIN_SUCCESS_STREAK_FOR_NORMALIZATION = 3; // Sucessos consecutivos para normalizar

// Controle global para evitar requisições concorrentes de diferentes instâncias
let GLOBAL_IS_FETCHING = false;
let GLOBAL_LAST_REQUEST_TIME = 0;
const GLOBAL_PENDING_REQUESTS = new Set<string>();
const GLOBAL_REQUEST_LOCK_TIME = 10000; // Tempo máximo que uma requisição pode travar o sistema
let GLOBAL_SYSTEM_HEALTH = true; // Flag global para indicar saúde do sistema

// Chave para sincronização entre diferentes instâncias da aplicação
const STORAGE_SYNC_KEY = 'roulette_feed_sync';
const LAST_SYNC_UPDATE_KEY = 'roulette_feed_last_update';
const INSTANCE_ID = `instance_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// Constantes para sincronização entre instâncias
const INSTANCE_SYNC_KEY = 'roulette_feed_instances';
const DATA_UPDATE_KEY = 'roulette_feed_data_update';

// Interface para estender o objeto Window
interface CustomWindow extends Window {
  _rouletteTimers?: Array<{id: number, created: number | Date, interval: number}>;
  _roulettePollingActive?: boolean;
  _requestInProgress?: boolean;
  _pendingRequests?: {
    [key: string]: {
      timestamp: number;
      url: string;
      service: string;
    };
  };
  _lastSuccessfulResponse?: number;
}

declare const window: CustomWindow;

// Atualizar interface RequestStats para incluir propriedades que faltam
interface RequestStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastMinuteRequests: number[];
  avgResponseTime: number;
  lastResponseTime: number;
  // Propriedades adicionais usadas no código
  total: number;
  success: number;
  failed: number;
}

// Atualizar interface RequestInfo para incluir propriedade service
interface RequestInfo {
  timestamp: number;
  url: string;
  service: string;
}

// Interface para as opções do construtor
interface RouletteFeedServiceOptions {
  autoStart?: boolean;
  initialInterval?: number;
  minInterval?: number;
  maxInterval?: number;
  historySize?: number;
}

/**
 * Serviço para obter atualizações das roletas usando polling único
 * Intervalo ajustado para 10 segundos conforme especificação
 */
export default class RouletteFeedService {
  private static instance: RouletteFeedService | null = null;
  private roulettes: any[] = [];
  
  // Controle de estado global
  private IS_INITIALIZING: boolean = false;
  private IS_FETCHING_DATA: boolean = false;
  private GLOBAL_INITIALIZATION_PROMISE: Promise<any> | null = null;
  private lastRequestTime: number = 0;
  
  // Estado de requisições
  private isFetching: boolean = false;
  private lastFetchTime: number = 0;
  private fetchPromise: Promise<any> | null = null;
  private successfulFetchesCount: number = 0;
  private failedFetchesCount: number = 0;
  private requestStats: RequestStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    lastMinuteRequests: [],
    avgResponseTime: 0,
    lastResponseTime: 0,
    total: 0,
    success: 0,
    failed: 0
  };
  
  // Configurações de polling
  private interval: number = POLLING_INTERVAL; // Usar o intervalo global
  private minInterval: number = 5000; // Mínimo 5 segundos
  private maxInterval: number = 20000; // Máximo 20 segundos
  private maxRequestsPerMinute: number = 30; // Limite de 30 requisições por minuto
  private backoffMultiplier: number = 1.5; // Multiplicador para backoff em caso de falhas
  
  // Propriedades adicionais usadas no construtor
  private initialInterval: number = NORMAL_POLLING_INTERVAL;
  private currentPollingInterval: number = NORMAL_POLLING_INTERVAL;
  private historySize: number = 20;
  private roulettesList: any[] = [];
  private lastSuccessTimestamp: number = 0;
  private rouletteHistory: Map<string, any> = new Map();
  private isInBackoff: boolean = false;
  private globalLock: boolean = false;
  
  // Propriedades adicionais necessárias para a operação do serviço
  private hasCachedData: boolean = false;
  private lastUpdateTime: number = 0;
  private baseUrl: string = '';
  
  // Flags e temporizadores
  private isInitialized: boolean = false;
  private isPollingActive: boolean = false;
  private pollingTimer: number | null = null;
  private isPaused: boolean = false;
  private hasPendingRequest: boolean = false;
  private backoffTimeout: number | null = null;
  private hasFetchedInitialData: boolean = false;
  private initialized: boolean = false; // Flag para controle de inicialização
  
  // Cache interno de todas as roletas
  private rouletteDataCache: Map<string, any> = new Map();
  private lastCacheUpdate: number = 0;
  private cacheTTL: number = CACHE_TTL;
  
  // Indicar que houve atualização de dados
  private hasNewData: boolean = false;
  
  // Controle de inicialização única
  private initialRequestDone: boolean = false;

  private socketService: any = null; // Referência ao SocketService

  // Adicione a propriedade para o timer de monitoramento de saúde
  private healthCheckTimer: number | null = null;

  // Adicionar a propriedade do timer de sincronização
  private syncUpdateTimer: number | null = null;

  // Adicionar propriedades para o sistema de recuperação
  private consecutiveErrors: number = 0;
  private consecutiveSuccesses: number = 0;
  private recoveryTimer: number | null = null;
  private lastErrorType: string | null = null;
  private recoveryMode: boolean = false;

  // Adicionar array de assinantes
  private subscribers: Array<(data: any) => void> = [];

  private lastSuccessfulResponse: number = 0;

  // Atualizar para usar a interface
  private pendingRequests: {
    [key: string]: RequestInfo
  } = {};

  // Contador de processos bem-sucedidos
  private successCounter = 0;

  /**
   * O construtor configura os parâmetros iniciais e inicia o serviço
   * @param options Opções de configuração para o serviço
   */
  constructor(options: RouletteFeedServiceOptions = {}) {
    const {
      autoStart = true,
      initialInterval = 8000, // 8 segundos padrão
      minInterval = 5000,
      maxInterval = 60000,
      historySize = 20
    } = options;

    // Inicializar parâmetros
    this.initialInterval = initialInterval;
    this.currentPollingInterval = initialInterval;
    this.minInterval = minInterval;
    this.maxInterval = maxInterval;
    this.historySize = historySize;
    this.subscribers = [];  // Inicializar como array vazio em vez de Map
    this.roulettesList = [];
    this.lastSuccessTimestamp = 0;
    this.rouletteHistory = new Map();
    this.isPaused = false;
    this.isPollingActive = false;
    this.pendingRequests = {}; // Inicializar como objeto vazio em vez de Map
    this.isInBackoff = false;
    this.isFetching = false;
    this.globalLock = false;

    // Iniciar o serviço automaticamente se configurado
    if (autoStart) {
      this.initialize();
    }
  }

  /**
   * Verifica se uma requisição global está em andamento e libera se estiver bloqueada por muito tempo
   */
  private checkAndReleaseGlobalLock(): boolean {
    const now = Date.now();
    
    // Se há uma trava global e já passou muito tempo, liberar a trava
    if (GLOBAL_IS_FETCHING && (now - GLOBAL_LAST_REQUEST_TIME > GLOBAL_REQUEST_LOCK_TIME)) {
      logger.warn('🔓 Trava global expirou, liberando para novas requisições');
      GLOBAL_IS_FETCHING = false;
      return true;
    }
    
    return !GLOBAL_IS_FETCHING;
  }

  /**
   * Inicializa o serviço
   */
  public initialize(): Promise<any> {
    logger.info('Solicitação de inicialização recebida');
    
    // Se já existir uma promessa de inicialização em andamento, retorne-a
    if (this.GLOBAL_INITIALIZATION_PROMISE) {
      logger.info('Reutilizando promessa de inicialização existente');
      return this.GLOBAL_INITIALIZATION_PROMISE;
    }
    
    // Se o serviço estiver inicializando, aguarde
    if (this.IS_INITIALIZING) {
      logger.info('Serviço já está inicializando, aguardando...');
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.IS_INITIALIZING) {
            clearInterval(checkInterval);
            logger.info('Inicialização concluída, continuando');
            resolve(this.roulettes);
          }
        }, 100);
      });
    }

    // Se já estiver inicializado, retorne os dados existentes
    if (this.initialized) {
      logger.info('Serviço já inicializado, retornando dados existentes');
      return Promise.resolve(this.roulettes);
    }

    // Marcar como inicializando
    this.IS_INITIALIZING = true;
    
    // Conectar ao EventService para receber eventos em tempo real
    this.connectToEventService();
    
    // Criar e armazenar a promessa de inicialização
    this.GLOBAL_INITIALIZATION_PROMISE = new Promise((resolve, reject) => {
      logger.info('Iniciando inicialização');
      
      // Buscar dados iniciais
      this.fetchInitialData()
        .then(data => {
          logger.info('Dados iniciais obtidos com sucesso');
          this.initialRequestDone = true; // Marcar que a requisição inicial foi concluída
          this.startPolling();
          this.initialized = true;
          this.IS_INITIALIZING = false;
          resolve(data);
        })
        .catch(error => {
          logger.error('Erro na inicialização:', error);
          this.IS_INITIALIZING = false;
          this.GLOBAL_INITIALIZATION_PROMISE = null;
          reject(error);
        });
    });
    
    return this.GLOBAL_INITIALIZATION_PROMISE;
  }

  /**
   * Registra o SocketService para uso no serviço de feed
   */
  public registerSocketService(socketService: any): void {
    if (!socketService) {
      logger.warn('Tentativa de registrar SocketService inválido');
      return;
    }
    
    logger.info('SocketService registrado no RouletteFeedService');
    this.socketService = socketService;
  }

  /**
   * Inicia o polling
   */
  public startPolling(): void {
    if (this.isPollingActive) {
      logger.info('Polling já está ativo, ignorando solicitação');
      return;
    }

    // Verificar se já existe outro polling em andamento globalmente
    if (window._roulettePollingActive === true) {
      logger.warn('⚠️ Já existe um polling ativo globalmente, não iniciando outro');
      // Mesmo assim, marcamos como ativo localmente para que não tentemos iniciar novamente
      this.isPollingActive = true;
      return;
    }

    logger.info(`Iniciando polling com intervalo de ${this.interval}ms`);
    this.isPollingActive = true;
    // Marcar globalmente que há polling ativo
    window._roulettePollingActive = true;
    
    // Iniciar o timer de polling
    this.startPollingTimer();
  }

  /**
   * Permite alterar o intervalo de polling em tempo de execução
   * @param newInterval Novo intervalo em milissegundos
   */
  public setPollingInterval(newInterval: number): void {
    if (newInterval < this.minInterval) {
      logger.warn(`Intervalo ${newInterval}ms é muito baixo, usando mínimo de ${this.minInterval}ms`);
      this.interval = this.minInterval;
    } else if (newInterval > this.maxInterval) {
      logger.warn(`Intervalo ${newInterval}ms é muito alto, usando máximo de ${this.maxInterval}ms`);
      this.interval = this.maxInterval;
    } else {
      logger.info(`Alterando intervalo de polling para ${newInterval}ms`);
      this.interval = newInterval;
    }
    
    // Reiniciar o timer se estiver ativo
    if (this.isPollingActive) {
      this.restartPollingTimer();
    }
  }

  /**
   * Busca os dados iniciais das roletas (se não estiverem em cache)
   */
  public async fetchInitialData(): Promise<any[]> {
    // Verificar se já temos dados em cache e se são válidos
    if (this.hasCachedData && this.lastUpdateTime > 0) {
      const cacheAge = Date.now() - this.lastUpdateTime;
      
      // Se o cache é recente (menos de 2 minutos), usar dados em cache
      if (cacheAge < 120000) {
        logger.info(`📦 Usando dados em cache (${Math.round(cacheAge / 1000)}s)`);
        return this.roulettes;
      }
    }
    
    // Se alguém já está buscando dados, não fazer outra requisição
    if (GLOBAL_IS_FETCHING) {
      logger.warn('🔒 Outra instância já está buscando dados, aguardando...');
      
      // Aguardar até que o bloqueio global seja liberado
      await new Promise<void>(resolve => {
        const checkInterval = setInterval(() => {
          if (!GLOBAL_IS_FETCHING) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
      
      // Se já temos dados após a espera, retornar
      if (this.hasCachedData) {
        return this.roulettes;
      }
    }
    
    // Se ainda estamos processando uma requisição, não iniciar outra
    if (this.isFetching) {
      logger.warn('⌛ Já existe uma requisição em andamento, usando cache temporário');
      return this.roulettes || [];
    }
    
    // Verificar o intervalo mínimo entre requisições
    const timeSinceLastFetch = Date.now() - this.lastFetchTime;
    if (timeSinceLastFetch < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastFetch;
      logger.warn(`⏱️ Respeitando intervalo mínimo, aguardando ${waitTime}ms`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // Definir bloqueio global para evitar requisições simultâneas
    GLOBAL_IS_FETCHING = true;
    
    // Gerar ID único para esta requisição
    const requestId = `initial_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    logger.info(`🚀 Buscando dados iniciais (ID: ${requestId})`);
    
    try {
      // Realizar a requisição HTTP com recuperação automática
      const result = await this.fetchWithRecovery(
        `${this.baseUrl}/api/ROULETTES`,
        requestId
      );
      
      // Processar os resultados
      if (result && Array.isArray(result)) {
        logger.success(`✅ Dados iniciais recebidos: ${result.length} roletas`);
        
        // Armazenar os dados
        this.lastUpdateTime = Date.now();
        this.hasCachedData = true;
        this.roulettes = result;
        
        // Ajustar intervalo de polling baseado no sucesso
        this.adjustPollingInterval(false);
        
        // Notificar que temos novos dados
        this.notifySubscribers(result);
      } else {
        logger.error('❌ Resposta inválida recebida');
      }
      
      return this.roulettes;
    } catch (error) {
      logger.error(`❌ Erro ao buscar dados iniciais: ${error.message || 'Desconhecido'}`);
      
      // Ajustar intervalo em caso de erro
      this.adjustPollingInterval(true);
      
      // Retornar dados em cache se existirem, ou array vazio
      return this.roulettes || [];
    } finally {
      // Liberar o bloqueio global
      GLOBAL_IS_FETCHING = false;
    }
  }

  /**
   * Busca os dados mais recentes das roletas
   */
  public fetchLatestData(): Promise<any> {
    // Verificar se podemos fazer a requisição
    if (!this.canMakeRequest()) {
      logger.debug('⏳ Não é possível fazer uma requisição agora, reutilizando cache');
      return Promise.resolve(this.roulettes);
    }
    
    // Criar ID único para esta requisição
    const requestId = this.generateRequestId();
    
    // Atualizar estado
    this.IS_FETCHING_DATA = true;
    window._requestInProgress = true;
    
    // Registrar requisição pendente para monitoramento
    if (typeof window !== 'undefined') {
      if (!window._pendingRequests) {
        window._pendingRequests = {};
      }
      
      window._pendingRequests[requestId] = {
        timestamp: Date.now(),
        url: '/api/ROULETTES',
        service: 'RouletteFeed'
      };
      
      // Definir timeout para liberar a trava global se a requisição não completar
      setTimeout(() => {
        if (window._requestInProgress) {
          logger.warn('⚠️ Liberando trava global de requisição após timeout');
          window._requestInProgress = false;
        }
      }, GLOBAL_REQUEST_LOCK_TIME);
    }
    
    logger.debug(`📡 Buscando dados mais recentes (ID: ${requestId})`);
    
    return this.fetchWithRecovery('/api/ROULETTES', requestId)
      .then(data => {
        // Atualizar estatísticas e estado
        this.requestStats.total++;
        this.requestStats.success++;
        this.lastSuccessfulResponse = Date.now();
        this.lastCacheUpdate = this.lastSuccessfulResponse;
        this.IS_FETCHING_DATA = false;
        
        // Se era a primeira requisição, marcar como feita
        if (!this.hasFetchedInitialData) {
          this.hasFetchedInitialData = true;
        }
        
        // Limpar a requisição pendente
        if (typeof window !== 'undefined' && window._pendingRequests) {
          delete window._pendingRequests[requestId];
        }
        
        // Liberar a trava global
        window._requestInProgress = false;
        
        // Processar os dados recebidos
        if (data && this.validateRouletteData(data)) {
          this.roulettes = data;
          this.notifySubscribers(data);
        }
        
        // Ajustar o intervalo de polling (sem erro)
        this.adjustPollingInterval(false);
        
        // Notificar outras instâncias
        this.notifyDataUpdate();
        
        return this.roulettes;
      })
      .catch(error => {
        // Atualizar estatísticas e estado
        this.requestStats.total++;
        this.requestStats.failed++;
        this.IS_FETCHING_DATA = false;
        
        // Limpar a requisição pendente
        if (typeof window !== 'undefined' && window._pendingRequests) {
          delete window._pendingRequests[requestId];
        }
        
        // Liberar a trava global
        window._requestInProgress = false;
        
        // Identificar o tipo de erro
        let errorType = 'unknown';
        if (error.status === 429) {
          errorType = 'rate_limit';
        } else if (error.message && error.message.includes('network')) {
          errorType = 'network';
        } else if (error.name === 'AbortError') {
          errorType = 'abort';
        }
        
        this.lastErrorType = errorType;
        logger.error(`❌ Erro ao buscar dados (${errorType}):`, error);
        
        // Ajustar o intervalo de polling (com erro)
        this.adjustPollingInterval(true);
        
        // Se for um erro de limite de taxa, tentar novamente com backoff exponencial
        if (errorType === 'rate_limit') {
          const backoffTime = Math.min(5000 * Math.pow(1.5, this.consecutiveErrors), 30000);
          logger.warn(`⏱️ Backoff de ${Math.round(backoffTime / 1000)}s após erro 429`);
        }
        
        return this.roulettes;
      });
  }

  /**
   * Controle de visibilidade do documento para otimizar recursos
   */
  private handleVisibilityChange = (): void => {
    const isVisible = document.visibilityState === 'visible';
    
    if (isVisible) {
      logger.info('👁️ Página visível, retomando polling');
      
      // Se estiver pausado há muito tempo, forçar refresh para obter dados atualizados
      const timeSinceLastUpdate = Date.now() - this.lastCacheUpdate;
      const needsFreshData = timeSinceLastUpdate > this.cacheTTL * 2;
      
      // Registrar evento de retorno à visibilidade
      EventService.emit('roulette:visibility-changed', {
        visible: true,
        timestamp: new Date().toISOString(),
        needsFreshData
      });
      
      this.resumePolling();
      
      // Se o cache estiver muito antigo, forçar atualização imediata
      if (needsFreshData) {
        logger.info(`💾 Cache muito antigo (${timeSinceLastUpdate}ms), forçando atualização`);
        this.forceUpdate();
      } else if (!this.isCacheValid()) {
        // Realizar uma atualização imediata quando a página fica visível
        // apenas se o cache estiver inválido
        this.fetchLatestData();
      }
      
      // Verificar travas pendentes que podem ter sido esquecidas
      this.verifyAndCleanupStaleRequests();
    } else {
      logger.info('🔒 Página em segundo plano, pausando polling');
      
      // Registrar evento de mudança para segundo plano
      EventService.emit('roulette:visibility-changed', {
        visible: false,
        timestamp: new Date().toISOString()
      });
      
      this.pausePolling();
    }
  }
  
  /**
   * Obtém a instância única do serviço (Singleton)
   */
  public static getInstance(): RouletteFeedService {
    if (!RouletteFeedService.instance) {
      RouletteFeedService.instance = new RouletteFeedService();
    }
    return RouletteFeedService.instance;
  }
  
  /**
   * Limpa requisições antigas (mais de 1 minuto) para controle de rate limit
   */
  private cleanupOldRequests(): void {
    const now = Date.now();
    // Manter apenas requisições do último minuto
    this.requestStats.lastMinuteRequests = this.requestStats.lastMinuteRequests
      .filter(timestamp => now - timestamp < 60000);
  }
  
  /**
   * Verifica se o serviço pode fazer uma nova requisição baseado em vários fatores:
   * - Limite de requisições por minuto
   * - Se já existe uma requisição em andamento
   * - Se houve falhas recentes que demandem backoff
   */
  private canMakeRequest(): boolean {
    // Verificar se já há uma requisição global em andamento
    if (window._requestInProgress === true) {
      logger.info('⛔ Outra requisição global em andamento, evitando concorrência');
      return false;
    }
    
    // Verificar trava global
    if (!this.checkAndReleaseGlobalLock()) {
      logger.info('⛔ Trava global ativa, não é possível fazer nova requisição');
      return false;
    }
    
    // Se estiver pausado, não fazer requisições
    if (this.isPaused) {
      logger.info('⏸️ Serviço pausado, ignorando solicitação');
      return false;
    }
    
    // Se já houver uma requisição em andamento, aguardar
    if (this.isFetching || this.hasPendingRequest || this.IS_FETCHING_DATA) {
      logger.info('⏳ Requisição já em andamento, aguardando');
      return false;
    }
    
    // Verificar se o cache está válido
    if (this.isCacheValid()) {
      logger.info('💾 Cache válido, evitando requisição desnecessária');
      return false;
    }
    
    // Verificar limite de requisições por minuto
    const requestsInLastMinute = this.requestStats.lastMinuteRequests.length;
    if (requestsInLastMinute >= this.maxRequestsPerMinute) {
      logger.info(`🚦 Limite de requisições atingido: ${requestsInLastMinute}/${this.maxRequestsPerMinute} por minuto`);
      return false;
    }
    
    // Verificar tempo mínimo entre requisições
    const now = Date.now();
    const timeSinceLastFetch = now - this.lastFetchTime;
    
    if (timeSinceLastFetch < this.minInterval) {
      logger.info(`⏱️ Requisição muito recente (${timeSinceLastFetch}ms), aguardando intervalo mínimo de ${this.minInterval}ms`);
      return false;
    }
    
    // Verificar se o documento está visível (apenas no navegador)
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      logger.info('👁️ Página não está visível, evitando requisição');
      return false;
    }
    
    // Adicionar verificação de limite de tempo de requisição global
    const pendingRequestsCount = GLOBAL_PENDING_REQUESTS.size;
    if (pendingRequestsCount > 0) {
      logger.info(`⚠️ Existem ${pendingRequestsCount} requisições pendentes globalmente, verificando tempos...`);
      
      // Verificar se alguma requisição está pendente há muito tempo (mais de 15 segundos)
      // e ainda não foi concluída, o que pode indicar um problema
      const pendingRequestsArray = Array.from(GLOBAL_PENDING_REQUESTS);
      for (const requestId of pendingRequestsArray) {
        const timestampMatch = requestId.match(/_(\d+)$/);
        if (timestampMatch && timestampMatch[1]) {
          const requestTimestamp = parseInt(timestampMatch[1], 10);
          const requestAge = now - requestTimestamp;
          
          if (requestAge > 15000) { // 15 segundos
            logger.warn(`🧹 Encontrada requisição pendente antiga (${requestAge}ms): ${requestId}`);
            // Limpar requisição antiga
            GLOBAL_PENDING_REQUESTS.delete(requestId);
          }
        }
      }
      
      // Verificar novamente após limpeza
      if (GLOBAL_PENDING_REQUESTS.size >= 3) {
        logger.warn(`🛑 Muitas requisições pendentes (${GLOBAL_PENDING_REQUESTS.size}), evitando sobrecarga`);
        return false;
      }
    }
    
    // Marcar que uma requisição global está em andamento
    window._requestInProgress = true;
    
    // Definir um timeout para liberar a flag caso a requisição não seja concluída
    setTimeout(() => {
      if (window._requestInProgress === true) {
        logger.warn('🔄 Liberando trava de requisição após timeout');
        window._requestInProgress = false;
      }
    }, 10000);
    
    return true;
  }
  
  /**
   * Ajusta dinamicamente o intervalo de polling com base no sucesso ou falha das requisições
   */
  private adjustPollingInterval(hasError: boolean): void {
    // Se houve erro, aumentar o intervalo para reduzir a carga
    if (hasError) {
      this.consecutiveErrors++;
      this.consecutiveSuccesses = 0;
      
      // Aumentar gradualmente o intervalo até o máximo
      if (this.currentPollingInterval < MAX_ERROR_POLLING_INTERVAL) {
        this.currentPollingInterval = Math.min(
          this.currentPollingInterval * 1.5,
          MAX_ERROR_POLLING_INTERVAL
        );
        logger.info(`⏱️ Ajustando intervalo de polling para ${this.currentPollingInterval}ms devido a erros`);
        
        // Entrar em modo de recuperação
        if (!this.recoveryMode && this.consecutiveErrors >= 3) {
          logger.warn('🚑 Entrando em modo de recuperação após múltiplos erros');
          this.recoveryMode = true;
        }
        
        // Reiniciar o timer de polling com o novo intervalo
        this.restartPollingTimer();
      }
    } else {
      // Se não houve erro, registrar sucesso consecutivo
      this.consecutiveSuccesses++;
      this.consecutiveErrors = 0;
      
      // Se estamos em um intervalo de erro, mas tivemos sucessos consecutivos,
      // podemos gradualmente reduzir o intervalo de volta ao normal
      if (this.currentPollingInterval > NORMAL_POLLING_INTERVAL && this.consecutiveSuccesses >= MIN_SUCCESS_STREAK_FOR_NORMALIZATION) {
        this.normalizeService();
      } else if (this.currentPollingInterval !== NORMAL_POLLING_INTERVAL) {
        // Se não estamos no intervalo normal, ajustar para o intervalo normal
        this.currentPollingInterval = NORMAL_POLLING_INTERVAL;
        logger.info(`⏱️ Ajustando intervalo de polling para ${this.currentPollingInterval}ms (normal)`);
        
        // Reiniciar o timer de polling com o intervalo normal
        this.restartPollingTimer();
      }
    }
  }
  
  private pausePolling(): void {
    if (this.isPaused) {
      return;
    }
    
    logger.info('⏸️ Pausando polling');
    this.isPaused = true;
    
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }
  
  private resumePolling(): void {
    if (this.isPollingActive && this.isPaused) {
      logger.info('▶️ Retomando polling');
      this.isPaused = false;
      
      // Reiniciar o timer
      this.restartPollingTimer();
    } else if (!this.isPollingActive) {
      // Se não estava ativo, iniciar
      this.startPolling();
    }
  }
  
  /**
   * Inicia o timer de polling
   */
  private startPollingTimer(): void {
    // Verificar se já existe um timer ativo
    if (this.pollingTimer !== null) {
      window.clearInterval(this.pollingTimer);
    }
    
    // Definir intervalo inicial
    const pollingInterval = this.currentPollingInterval;
    
    logger.info(`⏱️ Iniciando timer de polling com intervalo de ${pollingInterval}ms`);
    
    // Registrar o timer de polling
    if (typeof window !== 'undefined') {
      if (!window._rouletteTimers) {
        window._rouletteTimers = [];
      }
      
      // Criar um ID único para este timer
      const timerId = Math.floor(Math.random() * 1000000);
      
      window._rouletteTimers.push({
        id: timerId,
        created: new Date(),
        interval: pollingInterval
      });
      
      // Limitar a 10 registros
      if (window._rouletteTimers.length > 10) {
        window._rouletteTimers = window._rouletteTimers.slice(-10);
      }
    }
    
    // Criar o timer que fará as atualizações periódicas
    this.pollingTimer = window.setInterval(() => {
      // Verificar se há condições para fazer a requisição
      if (document.visibilityState === 'visible' && !this.isPaused) {
        this.fetchLatestData()
          .catch(error => {
            logger.error('❌ Erro no timer de polling:', error);
          });
      } else {
        logger.debug('⏸️ Polling pausado durante intervalo (página não visível ou serviço pausado)');
      }
    }, pollingInterval);
  }
  
  /**
   * Reinicia o timer de polling com o intervalo atual
   */
  private restartPollingTimer(): void {
    if (this.pollingTimer !== null) {
      window.clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    this.startPollingTimer();
  }
  
  /**
   * Atualiza o cache interno com os dados das roletas
   * e emite um evento de atualização
   */
  private updateRouletteCache(data: any[]): void {
    if (!Array.isArray(data)) {
      logger.error('⚠️ Dados inválidos recebidos para cache:', data);
      return;
    }
    
    logger.info(`💾 Atualizando cache com ${data.length} roletas`);
    
    // Flag para verificar se há dados novos
    this.hasNewData = false;
    
    // Para cada roleta, verificar se já existe no cache e se há atualizações
    data.forEach(roleta => {
      const roletaId = roleta.id || roleta._id;
      
      if (!roletaId) {
        logger.warn('⚠️ Roleta sem ID ignorada:', roleta);
        return;
      }
      
      const cachedRoulette = this.rouletteDataCache.get(roletaId);
      
      // Verificar se temos uma atualização para esta roleta
      if (!cachedRoulette || this.hasNewRouletteData(cachedRoulette, roleta)) {
        this.rouletteDataCache.set(roletaId, roleta);
        this.hasNewData = true;
      }
    });
    
    // Atualizar timestamp do cache
    this.lastCacheUpdate = Date.now();
    
    // Se há novos dados, notificar os componentes
    if (this.hasNewData) {
      logger.info('🔔 Novos dados detectados, notificando componentes');
      
      // Emitir evento global para notificar os componentes
      EventService.emit('roulette:data-updated', {
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Verifica se há dados novos comparando a roleta do cache com a roleta atualizada
   */
  private hasNewRouletteData(cachedRoulette: any, newRoulette: any): boolean {
    // Se não tiver números na roleta cacheada, considerar como dados novos
    if (!cachedRoulette.numero || !Array.isArray(cachedRoulette.numero)) {
      return true;
    }
    
    // Se a roleta nova não tiver números, não considerar como atualização
    if (!newRoulette.numero || !Array.isArray(newRoulette.numero)) {
      return false;
    }
    
    // Se o número de dados for diferente, há novos dados
    if (cachedRoulette.numero.length !== newRoulette.numero.length) {
      return true;
    }
    
    // Se o primeiro número (mais recente) for diferente, há novos dados
    if (cachedRoulette.numero[0]?.numero !== newRoulette.numero[0]?.numero) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Obtém dados de uma roleta específica do cache
   * Retorna null se não encontrada
   */
  public getRouletteData(roletaId: string): any {
    return this.rouletteDataCache.get(roletaId) || null;
  }
  
  /**
   * Obtém todas as roletas do cache
   */
  public getAllRoulettes(): any[] {
    return Array.from(this.rouletteDataCache.values());
  }
  
  /**
   * Verifica se o cache está válido
   */
  public isCacheValid(): boolean {
    const now = Date.now();
    return (now - this.lastCacheUpdate) <= this.cacheTTL;
  }
  
  /**
   * Força uma atualização do cache
   * @param force Flag para forçar atualização ignorando o tempo mínimo entre atualizações
   */
  public refreshCache(force: boolean = false): void {
    const now = Date.now();
    
    // Verificar intervalo mínimo entre atualizações se não for forçado
    if (!force && now - this.lastCacheUpdate < MIN_REQUEST_INTERVAL) {
      logger.debug(`⏱️ Aguardando intervalo mínimo para refresh (${MIN_REQUEST_INTERVAL}ms)`);
      return;
    }
    
    logger.info('🔄 Forçando atualização do cache');
    this.fetchLatestData();
  }
  
  /**
   * Retorna estatísticas sobre as requisições realizadas
   */
  public getRequestStats(): any {
    return {
      ...this.requestStats,
      currentInterval: this.interval,
      isPollingActive: this.isPollingActive,
      isPaused: this.isPaused,
      isFetching: this.isFetching,
      requestsInLastMinute: this.requestStats.lastMinuteRequests.length,
      maxRequestsPerMinute: this.maxRequestsPerMinute,
      successfulFetchesCount: this.successfulFetchesCount,
      failedFetchesCount: this.failedFetchesCount,
      timeSinceLastFetch: Date.now() - this.lastFetchTime,
      globalStatus: {
        isFetching: GLOBAL_IS_FETCHING,
        lastRequestTime: GLOBAL_LAST_REQUEST_TIME,
        pendingRequests: Array.from(GLOBAL_PENDING_REQUESTS)
      }
    };
  }
  
  /**
   * Método para fins de teste: forçar uma atualização imediata
   */
  public forceUpdate(): Promise<any> {
    logger.info('🔄 Forçando atualização imediata');
    
    // Limpar qualquer timer existente
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    // Verificar trava global
    if (!this.checkAndReleaseGlobalLock()) {
      logger.info('⛔ Trava global ativa, não é possível forçar atualização');
      return Promise.resolve(this.roulettes);
    }
    
    // Resetar flags para permitir a requisição
    this.isFetching = false;
    this.hasPendingRequest = false;
    GLOBAL_IS_FETCHING = false;
    
    // Buscar dados e reiniciar o timer
    const promise = this.fetchLatestData();
    
    // Reiniciar o timer se o polling estiver ativo
    if (this.isPollingActive && !this.isPaused) {
      this.restartPollingTimer();
    }
    
    return promise;
  }
  
  /**
   * Para completamente o serviço e libera recursos
   */
  public stop(): void {
    logger.info('Parando serviço RouletteFeedService');
    
    // Parar o polling
    if (this.pollingTimer !== null) {
      window.clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    // Limpar timeout de backoff se existir
    if (this.backoffTimeout !== null) {
      window.clearTimeout(this.backoffTimeout);
      this.backoffTimeout = null;
    }
    
    // Limpar timer de monitoramento de saúde
    if (this.healthCheckTimer !== null) {
      window.clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    // Limpar timer de sincronização
    if (this.syncUpdateTimer !== null) {
      window.clearInterval(this.syncUpdateTimer);
      this.syncUpdateTimer = null;
      
      // Remover listener de storage
      window.removeEventListener('storage', this.handleStorageEvent.bind(this));
    }
    
    // Remover listeners de visibilidade
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    
    // Limpar flags
    this.isPollingActive = false;
    this.isFetching = false;
    this.IS_FETCHING_DATA = false;
    this.hasFetchedInitialData = false;
    
    logger.info('Serviço RouletteFeedService parado e recursos liberados');
  }

  /**
   * Processa dados de roleta e atualiza o cache interno
   * @param data Dados de roleta a serem processados
   */
  private handleRouletteData(data: any): boolean {
    logger.debug(`🔄 Processando dados de roleta: ${typeof data}`);
    
    // Se for um array, processa cada item
    if (Array.isArray(data)) {
      logger.info(`📊 Processando array com ${data.length} roletas`);
      
      if (data.length === 0) {
        logger.warn('⚠️ Array de roletas vazio');
        return false;
      }
      
      // Processar cada item do array
      let validItems = 0;
      for (const item of data) {
        const normalizedItem = this.normalizeRouletteItem(item);
        
        if (normalizedItem) {
          // Atualiza o cache
          this.updateRouletteInCache(normalizedItem);
          validItems++;
        }
      }
      
      logger.info(`✅ Processados ${validItems} de ${data.length} itens`);
      
      // Notifica os assinantes apenas se tiver ao menos um item válido
      if (validItems > 0) {
        this.notifySubscribers([]); // Passa array vazio para notificar sobre todas as atualizações
        return true;
      }
      
      return false;
    }
    
    // Se for uma atualização global (formato: {type: 'global_update', data: {...}})
    if (data && data.type === 'global_update' && data.data) {
      logger.info(`🌐 Processando atualização global: ${JSON.stringify(data.type)}`);
      
      const globalItem = this.normalizeRouletteItem(data.data);
      if (globalItem) {
        logger.info(`✅ Atualização global válida para roleta: ${globalItem.roleta_id} (${globalItem.roleta_nome})`);
        this.updateRouletteInCache(globalItem);
        this.notifySubscribers([globalItem]);
        return true;
      } else {
        logger.warn(`⚠️ Dados de atualização global inválidos: ${JSON.stringify(data.data)}`);
        return false;
      }
    }
    
    // Se for um novo número (formato: {type: 'new_number', data: {...}})
    if (data && data.type === 'new_number' && data.data) {
      logger.info(`🎯 Processando novo número: ${JSON.stringify(data.type)}`);
      
      const newNumberItem = this.normalizeRouletteItem(data.data);
      if (newNumberItem) {
        logger.info(`✅ Novo número válido para roleta: ${newNumberItem.roleta_id} (${newNumberItem.roleta_nome}) - ${newNumberItem.ultimo_numero}`);
        this.updateRouletteInCache(newNumberItem);
        this.notifySubscribers([newNumberItem]);
        return true;
      } else {
        logger.warn(`⚠️ Dados de novo número inválidos: ${JSON.stringify(data.data)}`);
        return false;
      }
    }
    
    // Tenta processar como um objeto de roleta diretamente
    const normalizedItem = this.normalizeRouletteItem(data);
    if (normalizedItem) {
      logger.info(`✅ Roleta válida processada: ${normalizedItem.roleta_id} (${normalizedItem.roleta_nome})`);
      this.updateRouletteInCache(normalizedItem);
      this.notifySubscribers([normalizedItem]);
      return true;
    }
    
    logger.warn(`⚠️ Formato de dados não reconhecido: ${JSON.stringify(data)}`);
    return false;
  }

  /**
   * Conecta ao EventService para atualizações em tempo real
   */
  private connectToEventService(): void {
    try {
      logger.info('🔌 Conectando ao EventService para eventos em tempo real');
      
      // Registrar listener para atualizações globais
      EventService.on('roulette:global_update', (data: any) => {
        try {
          if (!data) {
            logger.warn('⚠️ Evento global_update sem dados');
            return;
          }
          
          logger.info(`📊 Recebido evento global_update para roleta: ${data.roleta_id || 'desconhecida'}`);
          
          if (this.validateRouletteData(data)) {
            this.handleRouletteData(data);
          } else {
            logger.warn('⚠️ Dados inválidos no evento global_update');
          }
        } catch (error) {
          logger.error(`❌ Erro ao processar evento global_update: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
      
      // Registrar listener para novos números
      EventService.on('roulette:new_number', (data: any) => {
        try {
          if (!data) {
            logger.warn('⚠️ Evento new_number sem dados');
            return;
          }
          
          logger.info(`🎲 Recebido evento new_number para roleta: ${data.roleta_id || 'desconhecida'}, número: ${data.ultimo_numero || 'N/A'}`);
          
          if (this.validateRouletteData(data)) {
            this.handleRouletteData(data);
          } else {
            logger.warn('⚠️ Dados inválidos no evento new_number');
          }
        } catch (error) {
          logger.error(`❌ Erro ao processar evento new_number: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
      
      // Registrar listener para atualizações de dados
      EventService.on('roulette:data-updated', (data: any) => {
        try {
          logger.info('🔄 Recebido evento data-updated, atualizando cache');
          
          // Atualizar o cache após um pequeno delay aleatório para evitar múltiplas atualizações simultâneas
          setTimeout(() => {
            this.refreshCache();
          }, Math.random() * 500 + 100);
        } catch (error) {
          logger.error(`❌ Erro ao processar evento data-updated: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
      
      logger.info('✅ Eventos registrados com sucesso');
    } catch (error) {
      logger.error(`❌ Erro ao conectar ao EventService: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Valida se os dados da roleta estão no formato esperado
   * @param data Dados a serem validados
   * @returns Verdadeiro se os dados estiverem válidos
   */
  private validateRouletteData(data: any): boolean {
    try {
      // Verificação básica
      if (!data) {
        logger.error('❌ Dados de roleta inválidos: dados nulos');
        return false;
      }

      // Log detalhado dos dados recebidos para depuração
      logger.debug(`🔍 Validando dados de roleta: ${JSON.stringify(data)}`);
      
      // Se for um array, verificamos a estrutura de cada item
      if (Array.isArray(data)) {
        logger.info(`📊 Validando array com ${data.length} roletas`);
        
        // Verificar se array está vazio
        if (data.length === 0) {
          logger.warn('⚠️ Array de roletas vazio');
          return true; // Consideramos válido, só está vazio
        }
        
        // Validar cada item do array
        const isValid = data.every((item, index) => {
          const itemValid = item && 
                 typeof item === 'object' && 
                 (item.roleta_id !== undefined || item.id !== undefined);
          
          if (!itemValid) {
            logger.warn(`⚠️ Item ${index} inválido no array: ${JSON.stringify(item)}`);
          }
          
          return itemValid;
        });
        
        logger.info(`${isValid ? '✅' : '❌'} Validação do array ${isValid ? 'bem-sucedida' : 'falhou'}`);
        return isValid;
      }
      
      // Para eventos de atualização global, a estrutura é diferente
      if (data.type === 'global_update' || data.event_type === 'global_update') {
        const isValid = data && 
               typeof data === 'object' && 
               (data.roleta_id !== undefined || data.id !== undefined);
               
        logger.info(`${isValid ? '✅' : '❌'} Validação do global_update ${isValid ? 'bem-sucedida' : 'falhou'}: ${JSON.stringify(data)}`);
        return isValid;
      }
      
      // Para eventos de novo número
      if (data.type === 'new_number' || data.event_type === 'new_number') {
        const isValid = data && 
               typeof data === 'object' && 
               (data.roleta_id !== undefined || data.id !== undefined) &&
               data.ultimo_numero !== undefined;
               
        logger.info(`${isValid ? '✅' : '❌'} Validação do new_number ${isValid ? 'bem-sucedida' : 'falhou'}: ${JSON.stringify(data)}`);
        return isValid;
      }
      
      // Verificação padrão para objetos únicos
      const isValid = data && 
             typeof data === 'object' && 
             (data.roleta_id !== undefined || data.id !== undefined);
             
      logger.info(`${isValid ? '✅' : '❌'} Validação padrão ${isValid ? 'bem-sucedida' : 'falhou'}: ${JSON.stringify(data)}`);
      return isValid;
    } catch (error) {
      logger.error(`❌ Erro ao validar dados da roleta: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Busca dados com recuperação automática
   */
  private fetchWithRecovery(url: string, requestId: string): Promise<any> {
    const requestOptions: {
      method: string;
      headers: Record<string, string>;
    } = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    return fetch(url, requestOptions)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
        }
        return response.json();
      });
  }
  
  private notifySubscribers(data: any[]): void {
    // Implementação do método
    this.subscribers.forEach(subscriber => {
      try {
        subscriber(data);
      } catch (error) {
        logger.error(`❌ Erro ao notificar assinante: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    });
  }
  
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  }
  
  /**
   * Notifica sobre atualização de dados
   */
  private notifyDataUpdate(): void {
    try {
      // Notificar outras instâncias sobre a atualização de dados
      if (typeof window !== 'undefined' && window.localStorage) {
        const updateData = {
          timestamp: Date.now(),
          instanceId: INSTANCE_ID
        };
        
        // Salvar no localStorage para que outras instâncias possam detectar
        window.localStorage.setItem(DATA_UPDATE_KEY, JSON.stringify(updateData));
        
        // Também notificar via Event Service
        EventService.emit('roulette:data-updated', updateData);
      }
    } catch (error) {
      logger.error(`❌ Erro ao notificar sobre atualização de dados: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  private verifyAndCleanupStaleRequests(): void {
    // Implementação do método
    // Verifica e limpa requisições pendentes expiradas
  }
  
  /**
   * Normaliza o serviço após erros consecutivos
   * @param forcedReset Se verdadeiro, força um reset completo
   */
  private normalizeService(forcedReset: boolean = false): void {
    // Implementação do método
    // Normaliza o serviço após múltiplos erros
    
    // Reduzir o intervalo gradualmente de volta ao normal
    if (this.currentPollingInterval > NORMAL_POLLING_INTERVAL) {
      // Se estiver acima do normal, reduzir em 25% a cada vez
      this.currentPollingInterval = Math.max(
        NORMAL_POLLING_INTERVAL,
        this.currentPollingInterval * 0.75
      );
      
      logger.info(`⏱️ Reduzindo intervalo de polling para ${this.currentPollingInterval}ms em direção ao normal`);
    }
    
    // Se forçar reset, voltar imediatamente para o normal
    if (forcedReset) {
      this.currentPollingInterval = NORMAL_POLLING_INTERVAL;
      logger.info(`⏱️ Forçando reset do intervalo de polling para ${NORMAL_POLLING_INTERVAL}ms (normal)`);
    }
    
    // Reiniciar o timer com o novo intervalo
    this.restartPollingTimer();
    
    // Sair do modo de recuperação
    this.recoveryMode = false;
    this.consecutiveErrors = 0;
  }
  
  /**
   * Manipula eventos de armazenamento
   * @param event Evento de armazenamento
   */
  private handleStorageEvent(event: StorageEvent): void {
    // Implementação do método
    // Manipula eventos de armazenamento
    if (!event || !event.key) {
      return;
    }
    
    // Verificar se é uma atualização do nosso serviço
    if (event.key === DATA_UPDATE_KEY) {
      logger.info('🔄 Evento de armazenamento detectado, verificando atualizações');
      this.refreshCache();
    }
  }

  /**
   * Normaliza um item de roleta para o formato padrão da aplicação
   * @param item Item a ser normalizado
   * @returns Item normalizado ou null se inválido
   */
  private normalizeRouletteItem(item: any): any {
    try {
      if (!item || typeof item !== 'object') {
        logger.warn(`⚠️ Item inválido para normalização: ${JSON.stringify(item)}`);
        return null;
      }

      // Log para depuração
      logger.debug(`🔧 Normalizando item: ${JSON.stringify(item)}`);
      
      // Extrair IDs e nomes
      const roletaId = item.roleta_id || item.id;
      const roletaNome = item.roleta_nome || item.nome || 'Roleta sem nome';
      
      if (!roletaId) {
        logger.warn(`⚠️ Item sem ID válido: ${JSON.stringify(item)}`);
        return null;
      }
      
      // Normalizar números, se existirem
      let numeros: any[] = [];
      if (item.numeros && Array.isArray(item.numeros)) {
        numeros = [...item.numeros]; // clone array
      } else if (item.ultimo_numero || item.numero) {
        // Se temos apenas o último número, criar array com ele
        const numero = item.ultimo_numero || item.numero;
        numeros = [{
          numero,
          timestamp: new Date()
        }];
      }
      
      // Status da roleta
      const status = item.status || 'ativo';
      
      // Criar objeto normalizado
      const normalizedItem = {
        roleta_id: roletaId,
        roleta_nome: roletaNome,
        numeros: numeros,
        ultimo_numero: item.ultimo_numero || (numeros.length > 0 ? numeros[0].numero : null),
        status: status,
        ultima_atualizacao: new Date(),
        // Preservar outros campos importantes
        provider: item.provider || 'desconhecido',
        tipo: item.tipo || 'desconhecido',
        url: item.url || null,
        // Metadados
        _original: item
      };
      
      logger.debug(`✅ Item normalizado: ${JSON.stringify({
        roleta_id: normalizedItem.roleta_id,
        roleta_nome: normalizedItem.roleta_nome,
        ultimo_numero: normalizedItem.ultimo_numero,
        numeros_count: normalizedItem.numeros.length
      })}`);
      
      return normalizedItem;
    } catch (error) {
      logger.error(`❌ Erro ao normalizar item: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Atualiza uma roleta específica no cache
   * @param item Item normalizado de roleta a ser atualizado no cache
   */
  private updateRouletteInCache(item: any): void {
    if (!item || !item.roleta_id) {
      logger.warn('⚠️ Tentativa de atualizar cache com item inválido');
      return;
    }
    
    // Se já existe no cache, verifica se precisamos mesclar dados
    if (this.rouletteDataCache.has(item.roleta_id)) {
      const existingItem = this.rouletteDataCache.get(item.roleta_id);
      if (existingItem) {
        // Se o item tem um número novo, adiciona ao histórico
        if (item.ultimo_numero && item.ultimo_numero !== existingItem.ultimo_numero) {
          logger.debug(`📊 Atualizando histórico de números para ${item.roleta_nome} (${item.roleta_id})`);
          
          // Inicializa array de números se não existir
          if (!existingItem.numeros) {
            existingItem.numeros = [];
          }
          
          // Adiciona o novo número com timestamp
          const numeroObj = {
            numero: item.ultimo_numero,
            timestamp: new Date()
          };
          
          // Adiciona ao início e limita tamanho
          existingItem.numeros.unshift(numeroObj);
          if (existingItem.numeros.length > 50) {
            existingItem.numeros = existingItem.numeros.slice(0, 50);
          }
          
          // Atualiza o último número
          existingItem.ultimo_numero = item.ultimo_numero;
        }
        
        // Atualiza outros campos do item existente com os novos dados
        Object.assign(existingItem, {
          ...item,
          // Preserva o histórico de números que já temos
          numeros: existingItem.numeros || item.numeros,
          // Atualiza timestamp
          ultima_atualizacao: new Date()
        });
        
        // Atualiza o cache com o item mesclado
        this.rouletteDataCache.set(item.roleta_id, existingItem);
        logger.debug(`✅ Roleta ${existingItem.roleta_nome} (${existingItem.roleta_id}) atualizada no cache`);
      }
    } else {
      // Novo item, adiciona diretamente ao cache
      this.rouletteDataCache.set(item.roleta_id, {
        ...item,
        ultima_atualizacao: new Date()
      });
      logger.debug(`✅ Nova roleta adicionada ao cache: ${item.roleta_nome} (${item.roleta_id})`);
    }
  }
} 