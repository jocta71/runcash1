import config from '@/config/env';
import EventService from './EventService';
import { getLogger } from './utils/logger';
import { HistoryData } from './SocketService';
import globalRouletteDataService from './GlobalRouletteDataService';

// Criar uma única instância do logger
const logger = getLogger('RouletteFeedService');

// Configurações globais para o serviço
const POLLING_INTERVAL = 10000; // Intervalo fixo de 10 segundos
const MIN_REQUEST_INTERVAL = 3000; // Intervalo mínimo entre requisições em ms
const CACHE_TTL = 15000; // 15 segundos de TTL para o cache
const MAX_CONSECUTIVE_ERRORS = 5; // Máximo de erros consecutivos antes de pausar
const HEALTH_CHECK_INTERVAL = 30000; // Verificar a saúde do sistema a cada 30 segundos

// Adicionar constantes para o sistema de recuperação inteligente
const NORMAL_POLLING_INTERVAL = 10000; // 10 segundos em condições normais
const ERROR_POLLING_INTERVAL = 10000; // 10 segundos mesmo quando ocorrem erros
const MAX_ERROR_POLLING_INTERVAL = 10000; // 10 segundos no máximo após vários erros
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
  private roulettes: { [key: string]: any } = {}; // Alterado para um objeto em vez de array
  
  // Controle de estado global
  private IS_INITIALIZING: boolean = false;
  private IS_FETCHING_DATA: boolean = false;
  private GLOBAL_INITIALIZATION_PROMISE: Promise<any> | null = null;
  private lastRequestTime: number = 0;
  
  // Adicionar flag estático para controle de primeira inicialização
  private static INITIAL_DATA_FETCHED: boolean = false;
  
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
  private interval: number = 10000; // Usar o intervalo global
  private minInterval: number = 10000; // Mínimo 10 segundos
  private maxInterval: number = 10000; // Máximo 10 segundos
  private maxRequestsPerMinute: number = 120; // Aumentado para 120 requisições por minuto (2 por segundo)
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

  private updateInterval: number = 0;
  private requestCounter: number = 0;
  private requestTimestamp: number = 0;

  /**
   * O construtor configura os parâmetros iniciais e inicia o serviço
   * @param options Opções de configuração para o serviço
   */
  constructor(options: RouletteFeedServiceOptions = {}) {
    const {
      autoStart = true,
      initialInterval = 10000, // 10 segundos padrão
      minInterval = 10000,
      maxInterval = 10000,
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

    // Verificar se o intervalo especificado é válido
    if (options.initialInterval) {
      this.initialInterval = 10000; // Forçar a 10 segundos
      this.currentPollingInterval = 10000; // Forçar a 10 segundos
    }

    if (options.minInterval) {
      this.minInterval = 10000; // Forçar a 10 segundos
    }

    if (options.maxInterval) {
      this.maxInterval = 10000; // Forçar a 10 segundos
    }

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
    
    // Registrar ouvintes para eventos do serviço global
    const globalDataUpdateHandler = () => {
      logger.info('Recebida atualização do serviço global de roletas');
      this.fetchLatestData();
    };
    
    // Inscrever no serviço global
    globalRouletteDataService.subscribe('RouletteFeedService', globalDataUpdateHandler);
    
    // Se já foi inicializado globalmente, retornar os dados existentes
    if (RouletteFeedService.INITIAL_DATA_FETCHED && this.hasCachedData) {
      logger.info('Serviço já inicializado globalmente, retornando dados existentes');
      return Promise.resolve(this.roulettes);
    }
    
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
    
    // Criar e armazenar a promessa de inicialização
    this.GLOBAL_INITIALIZATION_PROMISE = new Promise((resolve, reject) => {
      logger.info('Iniciando inicialização');
      
      // Buscar dados iniciais apenas se não foram buscados anteriormente
      if (!RouletteFeedService.INITIAL_DATA_FETCHED) {
        this.fetchInitialData()
          .then(data => {
            logger.info('Dados iniciais obtidos com sucesso');
            this.initialRequestDone = true; // Marcar que a requisição inicial foi concluída
            RouletteFeedService.INITIAL_DATA_FETCHED = true; // Marcar globalmente que os dados iniciais foram buscados
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
      } else {
        // Se os dados já foram buscados antes, apenas iniciar o polling
        logger.info('Usando dados iniciais já buscados anteriormente');
        this.startPolling();
        this.initialized = true;
        this.IS_INITIALIZING = false;
        resolve(this.roulettes);
      }
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
    // Iniciar o polling se não estiver já ativo
    if (!this.pollingTimer && !this.isPaused) {
      logger.info('▶️ Iniciando polling de dados de roletas a cada 10 segundos');
      this.pollingTimer = window.setInterval(() => {
        this.fetchLatestData();
      }, 10000);
      
      // Atualizar flags
      this.isPollingActive = true;
      window._roulettePollingActive = true;
    } else {
      logger.info('ℹ️ Polling já está ativo ou sistema está em pausa');
    }
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
  public async fetchInitialData(): Promise<{ [key: string]: any }> {
    // Se já buscamos dados iniciais, retornar os dados em cache
    if (RouletteFeedService.INITIAL_DATA_FETCHED) {
      logger.info('📋 Dados iniciais já foram buscados anteriormente, usando cache');
      return this.roulettes;
    }
    
    logger.info('🔄 Buscando dados iniciais através do serviço global centralizado');
    
    try {
      // Usar exclusivamente o serviço global para buscar dados
      const globalRoulettes = await globalRouletteDataService.fetchRouletteData();
      
    if (globalRoulettes && globalRoulettes.length > 0) {
        logger.info(`📋 Recebidos ${globalRoulettes.length} roletas do serviço global centralizado`);
      
      // Transformar dados para o formato esperado
      const liveTables: { [key: string]: any } = {};
      globalRoulettes.forEach(roleta => {
        if (roleta && roleta.id) {
          // Certifique-se de que estamos lidando corretamente com o campo numero
          // Na API, o 'numero' é um array de objetos com propriedade 'numero'
          const numeroArray = Array.isArray(roleta.numero) ? roleta.numero : [];
          
          liveTables[roleta.id] = {
            GameID: roleta.id,
            Name: roleta.name || roleta.nome,
            ativa: roleta.ativa,
            // Manter a estrutura do campo numero exatamente como está na API
            numero: numeroArray,
            // Incluir outras propriedades da roleta
            ...roleta
          };
        }
      });
      
      // Armazenar os dados
      this.lastUpdateTime = Date.now();
      this.hasCachedData = true;
      this.roulettes = liveTables;
      
      // Sinalizar que dados iniciais foram carregados globalmente
      RouletteFeedService.INITIAL_DATA_FETCHED = true;
      
      // Notificar que temos novos dados
      this.notifySubscribers(liveTables);
      
        // Ajustar intervalo de polling baseado no sucesso
        this.adjustPollingInterval(false);
        
        return this.roulettes;
      }
      
      // Se não conseguiu dados do serviço global, tentar usar cache existente
      if (this.hasCachedData) {
        logger.info('⚠️ Não foi possível obter dados do serviço global, usando cache local');
        return this.roulettes;
      }
      
      logger.warn('⚠️ Não foi possível obter dados iniciais');
      return {};
    } catch (error) {
      logger.error(`❌ Erro ao buscar dados iniciais: ${error.message || 'Desconhecido'}`);
      
      // Ajustar intervalo em caso de erro
      this.adjustPollingInterval(true);
      
      // Retornar dados em cache se existirem, ou objeto vazio
      return this.roulettes || {};
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
    
    // Atualizar estado
    this.IS_FETCHING_DATA = true;
    window._requestInProgress = true;
    
    // Criar ID único para esta requisição
    const requestId = this.generateRequestId();
    
    // Registrar requisição pendente para monitoramento
    if (typeof window !== 'undefined') {
      if (!window._pendingRequests) {
        window._pendingRequests = {};
      }
      
      window._pendingRequests[requestId] = {
        timestamp: Date.now(),
        url: '/api/ROULETTES-via-centralService',
        service: 'RouletteFeed'
      };
    }
    
    logger.debug(`📡 Buscando dados mais recentes através do serviço centralizado (ID: ${requestId})`);
    
    // Usar o serviço global para obter os dados
    return globalRouletteDataService.fetchRouletteData()
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
        if (data && Array.isArray(data)) {
          // Transformar dados para o formato esperado
          const liveTables: { [key: string]: any } = {};
          data.forEach(roleta => {
            if (roleta && roleta.id) {
              // Certifique-se de que estamos lidando corretamente com o campo numero
              // Na API, o 'numero' é um array de objetos com propriedade 'numero'
              const numeroArray = Array.isArray(roleta.numero) ? roleta.numero : [];
              
              liveTables[roleta.id] = {
                GameID: roleta.id,
                Name: roleta.name || roleta.nome,
                ativa: roleta.ativa,
                // Manter a estrutura do campo numero exatamente como está na API
                numero: numeroArray,
                // Incluir outras propriedades da roleta
                ...roleta
              };
            }
          });
          
          // Atualizar cache
          this.lastUpdateTime = Date.now();
          this.hasCachedData = true;
          this.roulettes = liveTables;
          
          // Sinalizar melhora na saúde do sistema
          GLOBAL_SYSTEM_HEALTH = true;
          this.consecutiveSuccesses++;
          this.consecutiveErrors = 0;
          this.lastSuccessTimestamp = Date.now();
          
          // Notificar que temos novos dados
          this.notifySubscribers(liveTables);
          
          // Notificar outros serviços
        this.notifyDataUpdate();
        
          return liveTables;
        } else {
          logger.warn('⚠️ Resposta inválida do serviço global');
        return this.roulettes;
        }
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
        
        // Registrar erro
        logger.error(`❌ Erro ao buscar dados mais recentes: ${error.message || 'Desconhecido'}`);
        
        // Atualizar contadores de erro
        this.consecutiveErrors++;
        this.consecutiveSuccesses = 0;
        
        // Se houver um erro grave de conectividade, atualizar saúde do sistema
        if (this.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          GLOBAL_SYSTEM_HEALTH = false;
        }
        
        // Retornar dados em cache se existirem
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
    // Sempre manter o intervalo em 10 segundos exatos
    this.currentPollingInterval = 10000; // Forçar a 10 segundos
    
    if (hasError) {
      this.consecutiveErrors++;
      this.consecutiveSuccesses = 0;
      
      // Entrar em modo de recuperação após múltiplos erros
      if (!this.recoveryMode && this.consecutiveErrors >= 3) {
        logger.warn('🚑 Entrando em modo de recuperação após múltiplos erros');
        this.recoveryMode = true;
      }
    } else {
      // Se não houve erro, registrar sucesso consecutivo
      this.consecutiveSuccesses++;
      this.consecutiveErrors = 0;
      
      // Sair do modo de recuperação após sucessos consecutivos
      if (this.recoveryMode && this.consecutiveSuccesses >= MIN_SUCCESS_STREAK_FOR_NORMALIZATION) {
        logger.info('✅ Saindo do modo de recuperação após múltiplos sucessos');
        this.recoveryMode = false;
      }
    }
    
    // Garantir que o timer esteja utilizando o intervalo correto
    if (this.pollingTimer !== null) {
      this.restartPollingTimer();
    }
    
    logger.info(`⏱️ Intervalo de polling mantido em ${this.currentPollingInterval}ms (fixo em 10s)`);
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
   * Reinicia o timer de polling com o intervalo atual
   */
  private restartPollingTimer(): void {
    // Limpar qualquer timer existente
    if (this.pollingTimer) {
      window.clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    // Reiniciar o timer com o intervalo correto
    if (!this.isPaused) {
      logger.info('🔄 Reiniciando timer de polling a cada 10 segundos');
      this.pollingTimer = window.setInterval(() => {
        this.fetchLatestData();
      }, 10000);
    } else {
      logger.info('⏸️ Sistema em pausa, não reiniciando timer');
    }
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
   * Processa os dados das roletas recebidos da API
   */
  private handleRouletteData(data: any): void {
    if (!data || !Array.isArray(data)) {
      logger.error('⚠️ Dados inválidos recebidos:', data);
      return;
    }
    
    // Transformar a resposta da API (array) para o formato esperado pelo resto do código
    const liveTables: { [key: string]: any } = {};
    data.forEach(roleta => {
      if (roleta && roleta.id) {
        // Certifique-se de que estamos lidando corretamente com o campo numero
        // Na API, o 'numero' é um array de objetos com propriedade 'numero'
        const numeroArray = Array.isArray(roleta.numero) ? roleta.numero : [];
        
        liveTables[roleta.id] = {
          GameID: roleta.id,
          Name: roleta.name || roleta.nome,
          ativa: roleta.ativa,
          // Manter a estrutura do campo numero exatamente como está na API
          numero: numeroArray,
          // Incluir outras propriedades da roleta
          ...roleta
        };
      }
    });
    
    // Criar o formato esperado pelo sistema
    const formattedData = {
      LiveTables: liveTables
    };
    
    // Atualizar a lista de roletas
    this.roulettes = formattedData.LiveTables;
    
    // Atualizar o cache
    this.updateRouletteCache(Object.values(formattedData.LiveTables));
    
    // Registrar estatística de requisição bem-sucedida
    this.requestStats.totalRequests++;
    this.requestStats.successfulRequests++;
    this.requestStats.lastMinuteRequests.push(Date.now());
    
    // Ajustar o intervalo de polling com base no sucesso
    this.adjustPollingInterval(false);
    
    // Notificar que temos novos dados
    this.notifySubscribers(formattedData.LiveTables);
  }

  /**
   * Valida os dados de roleta recebidos
   * @param data Dados a serem validados
   */
  private validateRouletteData(data: any): boolean {
    try {
      // Verificar se temos um array (a resposta real da API é um array, não um objeto)
      if (!data || !Array.isArray(data)) {
        logger.warn('❌ Dados de roleta inválidos: não é um array');
        return false;
      }
      
      // Verificar se o array não está vazio
      if (data.length === 0) {
        logger.warn('⚠️ Dados de roleta vazios (array vazio)');
        return true; // Consideramos válido, pois pode ser um estado legítimo
      }
      
      // Verificar se o primeiro item tem a estrutura esperada
      const firstItem = data[0];
      if (!firstItem.id || !firstItem.name) {
        logger.warn('❌ Dados de roleta inválidos: estrutura incorreta');
        return false;
      }
      
      logger.debug(`✅ Dados de roleta validados: ${data.length} roletas`);
      return true;
    } catch (error) {
      logger.error('❌ Erro ao validar dados de roleta:', error);
      return false;
    }
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

  // Método para notificar assinantes
  private notifySubscribers(data: any): void {
    try {
      // Implementação do método para notificar assinantes sobre atualizações
      if (this.subscribers && this.subscribers.length > 0) {
        this.subscribers.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            logger.error('❌ Erro ao notificar assinante:', error);
          }
        });
        logger.debug(`🔔 Notificados ${this.subscribers.length} assinantes sobre atualização de dados`);
      }
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
} 