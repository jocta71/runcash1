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
   * Força uma atualização do cache, ignorando o TTL
   */
  public async refreshCache(): Promise<any> {
    logger.info('🔄 Forçando atualização do cache');
    return this.forceUpdate();
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
   * Processa os dados de roleta recebidos
   */
  private handleRouletteData(data: any): void {
    try {
      // Verificar se temos dados válidos
      if (!data) {
        logger.warn('❌ Nenhum dado de roleta recebido');
        return;
      }

      // Processar evento global_update do socket
      if (data && data.type === 'global_update' || data.type === 'new_number') {
        logger.debug(`📊 Processando evento ${data.type} para roleta: ${data.roleta_nome} (${data.roleta_id})`);
        
        // Processar evento individual
        this.processRouletteData(data);
        this.updateSuccessStats();
        return;
      }

      // Processar array de dados da API
      if (Array.isArray(data)) {
        this.processRouletteDataArray(data);
        return;
      }

      logger.warn('❌ Formato de dados de roleta desconhecido:', JSON.stringify(data).substring(0, 200));
    } catch (error) {
      logger.error('❌ Erro ao processar dados de roleta:', error);
      this.adjustPollingInterval(false);
    }
  }

  /**
   * Processa um array de dados de roletas
   */
  private processRouletteDataArray(data: any[]): void {
    try {
      // Validar dados
      if (!this.validateRouletteData(data)) {
        this.adjustPollingInterval(false);
        return;
      }

      logger.debug(`📊 Processando ${data.length} roletas da API`);

      // Processar cada roleta no array
      data.forEach(item => {
        // Normalizar os dados para o formato padrão usado internamente
        const normalizedData = {
          roleta_id: item.id || item._id || item.roleta_id,
          roleta_nome: item.name || item.nome || item.roleta_nome,
          numero: item.numero || item.number || null,
          cor: item.cor || item.color || null,
          timestamp: item.timestamp || Date.now(),
          // Copiar outras propriedades relevantes
          ...Object.keys(item)
            .filter(key => !['id', '_id', 'roleta_id', 'name', 'nome', 'roleta_nome', 'numero', 'number', 'cor', 'color'].includes(key))
            .reduce((obj, key) => {
              obj[key] = item[key];
              return obj;
            }, {} as Record<string, any>)
        };

        // Atualizar o cache com os dados normalizados
        this.processRouletteData(normalizedData);
      });

      this.updateSuccessStats();
    } catch (error) {
      logger.error('❌ Erro ao processar array de dados de roleta:', error);
      this.adjustPollingInterval(false);
    }
  }

  /**
   * Atualiza as estatísticas de sucesso
   */
  private updateSuccessStats(): void {
    this.lastSuccessfulResponse = Date.now();
    this.successCounter++;
    this.adjustPollingInterval(true);
  }

  /**
   * Valida os dados de roleta recebidos
   * @param data Dados a serem validados
   */
  private validateRouletteData(data: any[] | any): boolean {
    // Se não for um array, verificar se é um objeto único
    if (!Array.isArray(data)) {
      // Verificar se é um objeto com dados de evento único
      if (typeof data === 'object' && data !== null) {
        // Verificar se tem pelo menos id e nome (em qualquer formato)
        return (!!data.roleta_id || !!data.id || !!data._id) && 
               (!!data.roleta_nome || !!data.nome || !!data.name);
      }
      logger.warn('❌ Dados de roleta inválidos: não é um array nem um objeto válido');
      return false;
    }
    
    // Se for um array vazio
    if (data.length === 0) {
      logger.warn('❌ Dados de roleta inválidos: array vazio');
      return false;
    }

    // Verificar o primeiro item para determinar o formato dos dados
    const firstItem = data[0];
    
    // Verificar se tem informações básicas (aceitando diferentes propriedades possíveis)
    if ((!firstItem.id && !firstItem._id && !firstItem.roleta_id) || 
        (!firstItem.name && !firstItem.nome && !firstItem.roleta_nome)) {
      logger.warn('❌ Dados de roleta inválidos: estrutura incorreta. Faltam identificadores necessários.');
      return false;
    }

    // Verificar se todos os itens do array têm a estrutura mínima necessária
    const invalidItems = data.filter(item => 
      (!item.id && !item._id && !item.roleta_id) || 
      (!item.name && !item.nome && !item.roleta_nome)
    );

    if (invalidItems.length > 0) {
      logger.warn(`❌ Dados de roleta contêm ${invalidItems.length} itens com estrutura inválida`);
      return false;
    }

    return true;
  }
  
  /**
   * Limpa todas as requisições pendentes e libera as travas
   */
  private cleanupAllPendingRequests(): void {
    // Limpar todas as requisições pendentes globais
    GLOBAL_PENDING_REQUESTS.clear();
    GLOBAL_IS_FETCHING = false;
    window._requestInProgress = false;
    
    // Limpar registro global de requisições pendentes
    if (window._pendingRequests) {
      window._pendingRequests = {};
    }
    
    // Resetar estado local
    this.IS_FETCHING_DATA = false;
    this.isFetching = false;
    this.hasPendingRequest = false;
    
    logger.info('🧹 Limpeza de todas as requisições pendentes realizada');
  }

  /**
   * Verifica e limpa requisições pendentes que podem estar travadas
   */
  private verifyAndCleanupStaleRequests(): void {
    const now = Date.now();
    let staleRequestsFound = false;
    
    // Verificar requisições pendentes globais
    if (GLOBAL_PENDING_REQUESTS.size > 0) {
      logger.info(`🔍 Verificando ${GLOBAL_PENDING_REQUESTS.size} requisições pendentes`);
      
      const pendingRequestsArray = Array.from(GLOBAL_PENDING_REQUESTS);
      for (const requestId of pendingRequestsArray) {
        const timestampMatch = requestId.match(/_(\d+)(_|$)/);
        if (timestampMatch && timestampMatch[1]) {
          const requestTimestamp = parseInt(timestampMatch[1], 10);
          const requestAge = now - requestTimestamp;
          
          if (requestAge > 30000) { // 30 segundos é muito tempo para uma requisição
            logger.warn(`🧹 Limpando requisição pendente antiga travada: ${requestId}`);
            GLOBAL_PENDING_REQUESTS.delete(requestId);
            staleRequestsFound = true;
          }
        }
      }
      
      // Se estiver vazio após limpeza, resetar flag global
      if (GLOBAL_PENDING_REQUESTS.size === 0 && GLOBAL_IS_FETCHING) {
        logger.info('🔄 Resetando trava global após limpeza');
        GLOBAL_IS_FETCHING = false;
      }
    }
    
    // Verificar requisições pendentes no registro detalhado
    if (window._pendingRequests) {
      const pendingIds = Object.keys(window._pendingRequests);
      if (pendingIds.length > 0) {
        for (const requestId of pendingIds) {
          const request = window._pendingRequests[requestId];
          const requestAge = now - request.timestamp;
          
          if (requestAge > 30000) { // 30 segundos
            logger.warn(`🧹 Limpando registro de requisição antiga: ${requestId} (${requestAge}ms)`);
            delete window._pendingRequests[requestId];
            staleRequestsFound = true;
          }
        }
      }
    }
    
    // Se encontramos requisições travadas, verificar se precisamos resetar o estado do sistema
    if (staleRequestsFound) {
      // Notificar sobre a limpeza
      EventService.emit('roulette:stale-requests-cleanup', {
        timestamp: new Date().toISOString(),
        count: GLOBAL_PENDING_REQUESTS.size
      });
      
      // Verificar se precisamos tentar reiniciar o polling
      if (!this.isPollingActive && !this.isPaused) {
        logger.info('🔄 Reiniciando polling após limpeza de requisições travadas');
        this.startPolling();
      }
    }
  }

  /**
   * Sistema de monitoramento de saúde para verificar e recuperar o serviço
   */
  private startHealthMonitoring(): void {
    // Verificar saúde do sistema a cada minuto
    this.healthCheckTimer = window.setInterval(() => {
      this.checkServiceHealth();
    }, RECOVERY_CHECK_INTERVAL);
  }

  /**
   * Verifica a saúde do serviço e tenta recuperar se necessário
   */
  private checkServiceHealth(): void {
    try {
      logger.debug('🏥 Verificando saúde do serviço de feed de roleta...');
      
      const now = Date.now();
      const timeSinceLastSuccess = now - (this.lastSuccessfulResponse || 0);
      
      // Verificar se o serviço está em um estado saudável
      if (!this.isPollingActive || this.isPaused) {
        logger.debug('⏸️ Serviço não está ativo ou está pausado durante verificação de saúde');
      return;
    }
    
      // Verificar se temos um período muito longo sem atualizações bem-sucedidas
      if (this.lastSuccessfulResponse && timeSinceLastSuccess > (this.currentPollingInterval * 3)) {
        logger.warn(`⚠️ Sem atualizações bem-sucedidas por ${Math.round(timeSinceLastSuccess / 1000)}s`);
        
        // Verificar se o serviço está realmente tentando fazer polling
        if (this.pollingTimer === null) {
          logger.warn('🔄 Timer de polling não está ativo. Reiniciando...');
          this.restartPollingTimer();
        }
        
        // Verificar se temos requisições pendentes há muito tempo
        this.cleanupStalePendingRequests();
        
        // Se estiver em modo de recuperação, mas sem sucesso, forçar uma requisição
        if (this.recoveryMode && this.consecutiveErrors > MAX_CONSECUTIVE_ERRORS) {
          logger.warn('🚨 Modo de recuperação não está funcionando, forçando atualização');
          this.forceUpdate();
        }
      }
      
      // Se estiver em modo de recuperação há muito tempo, tentar voltar ao normal
      if (this.recoveryMode && this.consecutiveSuccesses >= MIN_SUCCESS_STREAK_FOR_NORMALIZATION) {
        logger.info('✅ Suficientes sucessos consecutivos. Normalizando serviço...');
        this.normalizeService();
      }
      
      // Verificação global de saúde do sistema
      if (!GLOBAL_SYSTEM_HEALTH) {
        logger.warn('🌐 Sistema global em estado não saudável. Tentando recuperar...');
        GLOBAL_SYSTEM_HEALTH = true; // Resetar para tentar novamente
        this.adjustPollingInterval(true); // Ajustar intervalo de polling
      }
    } catch (error) {
      logger.error('❌ Erro ao verificar saúde do serviço:', error);
    }
  }

  /**
   * Limpa requisições pendentes que estão paradas por muito tempo
   */
  private cleanupStalePendingRequests(): void {
    try {
      if (typeof window !== 'undefined' && window._pendingRequests) {
        const now = Date.now();
        let cleanedCount = 0;
        
        // Verificar todas as requisições pendentes
        Object.entries(window._pendingRequests).forEach(([requestId, requestInfo]) => {
          const requestAge = now - requestInfo.timestamp;
          
          // Se a requisição estiver pendente há mais de 15 segundos, considerá-la perdida
          if (requestAge > 15000) {
            logger.warn(`🗑️ Limpando requisição pendente ${requestId} (idade: ${Math.round(requestAge / 1000)}s)`);
            delete window._pendingRequests[requestId];
            cleanedCount++;
          }
        });
        
        if (cleanedCount > 0) {
          logger.info(`🧹 Limpas ${cleanedCount} requisições pendentes antigas`);
          
          // Se estávamos travados por causa dessas requisições, liberar o estado global
          if (window._requestInProgress) {
            logger.info('🔓 Liberando trava global de requisições após limpeza');
            window._requestInProgress = false;
          }
        }
      }
    } catch (error) {
      logger.error('❌ Erro ao limpar requisições pendentes:', error);
    }
  }

  /**
   * Normaliza o serviço após recuperação
   */
  private normalizeService(): void {
    // Reduzir gradualmente o intervalo de polling de volta ao normal
    if (this.currentPollingInterval > NORMAL_POLLING_INTERVAL) {
      this.currentPollingInterval = Math.max(
        NORMAL_POLLING_INTERVAL,
        this.currentPollingInterval * 0.7
      );
      logger.info(`⏱️ Normalizando intervalo de polling para ${this.currentPollingInterval}ms`);
    } else if (this.currentPollingInterval < NORMAL_POLLING_INTERVAL) {
      // Se por algum motivo o intervalo estiver abaixo do normal, ajuste para o normal
      this.currentPollingInterval = NORMAL_POLLING_INTERVAL;
      logger.info(`⏱️ Restaurando intervalo normal de polling para ${this.currentPollingInterval}ms`);
    }
    
    // Sempre reiniciar o timer de polling com o intervalo atualizado
    this.restartPollingTimer();
    
    // Se estiver totalmente recuperado, sair do modo de recuperação
    if (this.currentPollingInterval === NORMAL_POLLING_INTERVAL && this.recoveryMode) {
      logger.info('✅ Saindo do modo de recuperação, serviço normalizado');
      this.recoveryMode = false;
    }
  }

  /**
   * Realiza requisição com mecanismo de recuperação inteligente
   */
  private fetchWithRecovery(url: string, requestId: string, retryCount: number = 0): Promise<any> {
    // Registrar a tentativa de requisição
    this.requestStats.lastMinuteRequests.push(Date.now());
    this.lastFetchTime = Date.now();
    this.isFetching = true;
    
    // Usar o sistema de controller para poder cancelar a requisição se necessário
    const controller = new AbortController();
    const signal = controller.signal;
    
    // Definir timeout para abortar requisições que demoram muito
    const timeoutId = setTimeout(() => {
      logger.warn(`⏱️ Abortando requisição ${requestId} após 30s de timeout`);
      controller.abort();
    }, 30000);
    
    // Realizar a requisição
    return fetch(url, { signal })
      .then(response => {
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          // Registrar erro consecutivo
          this.consecutiveErrors++;
          this.consecutiveSuccesses = 0;
          
          // Se for erro de rate limit, ajustar o intervalo de polling
          if (response.status === 429) {
            this.adjustPollingInterval(true);
            throw { status: 429, message: 'Rate limit exceeded' };
          }
          
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Processar resposta com sucesso
        this.consecutiveSuccesses++;
        this.consecutiveErrors = 0;
        
        return response.json();
      })
      .then(data => {
        this.isFetching = false;
        
        // Notificar sucesso
        this.notifyRequestComplete(requestId, 'success');
        
        return data;
      })
      .catch(error => {
        this.isFetching = false;
        clearTimeout(timeoutId);
        
        // Notificar erro
        this.notifyRequestComplete(requestId, 'error');
        
        // Se for erro de rede, tentar novamente até 3 vezes
        if ((error.message && error.message.includes('network')) || 
            error.name === 'TypeError' || 
            error.name === 'AbortError') {
          
          if (retryCount < 2) {
            logger.warn(`🔄 Tentativa ${retryCount + 1} falhou, tentando novamente em 2s...`);
            
            // Esperar 2 segundos antes de tentar novamente
            return new Promise(resolve => {
              setTimeout(() => {
                resolve(this.fetchWithRecovery(url, `${requestId}_retry${retryCount + 1}`, retryCount + 1));
              }, 2000);
            });
          }
        }
        
        // Se chegou aqui, não conseguiu recuperar
        throw error;
      });
  }

  /**
   * Inicializa o sistema de sincronização entre múltiplas instâncias
   */
  private initializeInstanceSync(): void {
    try {
      // Verificar se já existem dados de sincronização
      const syncData = this.getSyncData();
      
      // Registrar esta instância
      this.registerInstance();
      
      // Adicionar listener para eventos de storage
      window.addEventListener('storage', this.handleStorageEvent.bind(this));
      
      // Iniciar atualizações periódicas
      this.startSyncUpdates();
      
      logger.info(`🔄 Sincronização entre instâncias inicializada. ID: ${INSTANCE_ID}`);
    } catch (error) {
      logger.error('❌ Erro ao inicializar sincronização entre instâncias:', error);
    }
  }

  /**
   * Obtém dados de sincronização do localStorage
   */
  private getSyncData(): any {
    try {
      const rawData = localStorage.getItem(INSTANCE_SYNC_KEY);
      return rawData ? JSON.parse(rawData) : { instances: {} };
    } catch (error) {
      logger.error('❌ Erro ao obter dados de sincronização:', error);
      return { instances: {} };
    }
  }

  /**
   * Registra esta instância no sistema de sincronização
   */
  private registerInstance(): void {
    try {
      const syncData = this.getSyncData();
      
      // Atualizar informações desta instância
      syncData.instances[INSTANCE_ID] = {
        lastPing: Date.now(),
        pollingActive: this.isPollingActive,
        isPaused: this.isPaused
      };
      
      // Limpar instâncias antigas (mais de 5 minutos sem ping)
      const now = Date.now();
      Object.keys(syncData.instances).forEach(id => {
        if (now - syncData.instances[id].lastPing > 300000) {
          delete syncData.instances[id];
        }
      });
      
      // Salvar dados atualizados
      localStorage.setItem(INSTANCE_SYNC_KEY, JSON.stringify(syncData));
    } catch (error) {
      logger.error('❌ Erro ao registrar instância:', error);
    }
  }

  /**
   * Manipula eventos de storage de outras instâncias
   */
  private handleStorageEvent(event: StorageEvent): void {
    try {
      // Verificar se é um evento relevante
      if (event.key === INSTANCE_SYNC_KEY) {
        logger.debug('🔄 Recebida atualização de sincronização de outra instância');
        
        // Podemos verificar aqui se outra instância está fazendo polling
        // e ajustar nosso comportamento conforme necessário
      } else if (event.key === DATA_UPDATE_KEY) {
        // Outra instância atualizou dados
        const updateData = event.newValue ? JSON.parse(event.newValue) : null;
        
        if (updateData && updateData.timestamp > this.lastCacheUpdate) {
          logger.info('📡 Outra instância atualizou dados. Forçando atualização...');
          
          // Forçar atualização da cache após um pequeno delay
          // para evitar que todas as instâncias atualizem simultaneamente
          setTimeout(() => {
            this.forceUpdate();
          }, Math.random() * 1000); // Delay aleatório de até 1 segundo
        }
      }
    } catch (error) {
      logger.error('❌ Erro ao processar evento de storage:', error);
    }
  }

  /**
   * Inicia atualizações periódicas de sincronização
   */
  private startSyncUpdates(): void {
    // Atualizar registro a cada 30 segundos
    this.syncUpdateTimer = window.setInterval(() => {
      this.registerInstance();
    }, 30000);
  }

  /**
   * Notifica outras instâncias sobre atualização de dados
   */
  private notifyDataUpdate(): void {
    try {
      // Salvar informação de atualização no localStorage
      localStorage.setItem(DATA_UPDATE_KEY, JSON.stringify({
        timestamp: Date.now(),
        instanceId: INSTANCE_ID
      }));
    } catch (error) {
      logger.error('❌ Erro ao notificar outras instâncias:', error);
    }
  }

  /**
   * Notifica todos os assinantes sobre novos dados
   * @param data Dados a serem enviados aos assinantes
   */
  private notifySubscribers(data: any): void {
    try {
      // Verificar se temos assinantes
      if (this.subscribers.length === 0) {
        return;
      }
      
      // Se for um evento global_update, enviá-lo diretamente para os assinantes
      if (data && data.type === 'new_number' && data.roleta_id && data.roleta_nome) {
        logger.debug(`🔔 Notificando ${this.subscribers.length} assinantes sobre evento da roleta ${data.roleta_nome}`);
        
        // Notificar cada assinante sobre o evento
        this.subscribers.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            logger.error('❌ Erro ao notificar assinante sobre evento global_update:', error);
          }
        });
        
        return;
      }
      
      // Para outros tipos de dados (como array de roletas), processar normalmente
      logger.debug(`🔔 Notificando ${this.subscribers.length} assinantes sobre atualização de dados`);
      
      this.subscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error('❌ Erro ao notificar assinante:', error);
        }
      });
    } catch (error) {
      logger.error('❌ Erro ao notificar assinantes:', error);
    }
  }

  // Método para adicionar assinante
  public subscribe(callback: (data: any) => void): void {
    this.subscribers.push(callback);
    logger.debug('➕ Novo assinante adicionado ao serviço RouletteFeedService');
  }

  // Método para remover assinante
  public unsubscribe(callback: (data: any) => void): void {
    this.subscribers = this.subscribers.filter(cb => cb !== callback);
    logger.debug('➖ Assinante removido do serviço RouletteFeedService');
  }

  // Função auxiliar para gerar IDs de requisição únicos
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Método para notificar sobre o término de uma requisição
  private notifyRequestComplete(requestId: string, status: string): void {
    // Implemente a lógica para notificar sobre o término de uma requisição
    // Esta é uma implementação básica e pode ser expandida conforme necessário
    logger.info(`🔄 Requisição ${requestId} concluída com sucesso: ${status}`);
  }

  /**
   * Registra o serviço para escutar eventos do EventService
   */
  public connectToEventService(): void {
    try {
      logger.info('Conectando RouletteFeedService ao EventService para eventos em tempo real');
      
      // Registrar para receber eventos de roulette:global_update
      EventService.on('roulette:global_update', (data: any) => {
        logger.info(`📩 Evento global_update recebido do EventService: ${data.roleta_nome} (${data.roleta_id})`);
        
        // Processar o evento como dados da roleta
        if (data && this.validateRouletteData(data)) {
          this.handleRouletteData(data);
        } else {
          logger.warn('❌ Dados de roleta inválidos recebidos do EventService');
        }
      });
      
      logger.success('✅ RouletteFeedService conectado ao EventService com sucesso');
    } catch (error) {
      logger.error('❌ Erro ao conectar ao EventService:', error);
    }
  }

  /**
   * Processa um único item de dados de roleta e atualiza o cache
   */
  private processRouletteData(data: any): void {
    if (!data) {
      logger.warn('❌ Dados de roleta individual vazios ou nulos');
      return;
    }

    try {
      // Normalizar o ID e nome da roleta
      const roletaId = String(data.roleta_id || data.id || data._id || '').trim();
      const roletaNome = String(data.roleta_nome || data.nome || data.name || '').trim();

      if (!roletaId) {
        logger.warn(`❌ Dados de roleta sem ID válido: ${JSON.stringify(data).substring(0, 100)}...`);
        return;
      }

      if (!roletaNome) {
        logger.warn(`⚠️ Dados de roleta com nome ausente para ID ${roletaId}`);
        // Continuar processamento mesmo sem nome, mas logar aviso
      }

      // Criar objeto normalizado com propriedades padronizadas
      const normalizedData = {
        ...data,
        roleta_id: roletaId,
        roleta_nome: roletaNome,
        lastUpdate: Date.now()
      };

      // Atualizar cache com os dados recebidos
      if (this.rouletteDataCache.has(roletaId)) {
        // Atualizar cache existente
        const cachedData = this.rouletteDataCache.get(roletaId);
        this.rouletteDataCache.set(roletaId, {
          ...cachedData,
          ...normalizedData
        });
        logger.debug(`🔄 Dados de roleta atualizados: ${roletaNome} (${roletaId})`);
      } else {
        // Adicionar nova entrada ao cache
        this.rouletteDataCache.set(roletaId, normalizedData);
        logger.info(`✅ Nova roleta adicionada ao cache: ${roletaNome} (${roletaId})`);
      }

      // Se for um evento de novo número, notificar os assinantes
      if (data.type === 'new_number') {
        this.notifySubscribers(normalizedData);
      }
    } catch (error) {
      logger.error(`❌ Erro ao processar item de roleta: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }
} 