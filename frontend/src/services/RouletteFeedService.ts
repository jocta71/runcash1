import config from '@/config/env';
import EventService from './EventService';
import { getLogger } from './utils/logger';
import { HistoryData } from './SocketService';

// Criar uma única instância do logger
const logger = getLogger('RouletteFeedService');

// Configurações globais para o serviço
const POLLING_INTERVAL = 8000; // Ajustado para 8 segundos baseado no código de referência
const MIN_REQUEST_INTERVAL = 8000; // Intervalo mínimo entre requisições em ms
const CACHE_TTL = 15000; // 15 segundos de TTL para o cache
const MAX_CONSECUTIVE_ERRORS = 50; // Máximo de erros consecutivos antes de pausar
const HEALTH_CHECK_INTERVAL = 30000; // Verificar a saúde do sistema a cada 30 segundos

// Adicionar constantes para o sistema de recuperação inteligente
const NORMAL_POLLING_INTERVAL = 1000; // 1 segundo em condições normais
const ERROR_POLLING_INTERVAL = 15000; // 15 segundos quando ocorrem erros
const MAX_ERROR_POLLING_INTERVAL = 8000; // 8 segundos no máximo após vários erros
const RECOVERY_CHECK_INTERVAL = 60000; // 1 minuto para verificação de recuperação completa
const MIN_SUCCESS_STREAK_FOR_NORMALIZATION = 3; // Sucessos consecutivos para normalizar

// Controle global para evitar requisições concorrentes de diferentes instâncias
let GLOBAL_IS_FETCHING = false; // Mantendo variável mas não usaremos para bloqueio
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
    // Bloqueio removido - sempre permitimos requisições
    return true;
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
    }
  }

  /**
   * Busca os dados mais recentes das roletas
   */
  public fetchLatestData(): Promise<any> {
    // Criar ID único para esta requisição
    const requestId = this.generateRequestId();
    
    logger.debug(`📡 Buscando dados mais recentes (ID: ${requestId})`);
    
    return this.fetchWithRecovery('/api/ROULETTES', requestId)
      .then(data => {
        // Atualizar estatísticas e estado
        this.requestStats.total++;
        this.requestStats.success++;
        this.lastSuccessfulResponse = Date.now();
        this.lastCacheUpdate = this.lastSuccessfulResponse;
        
        // Se era a primeira requisição, marcar como feita
        if (!this.hasFetchedInitialData) {
          this.hasFetchedInitialData = true;
        }
        
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
    // Removendo todos os bloqueios para permitir requisições simultâneas
    // Se estiver pausado, não fazer requisições
    if (this.isPaused) {
      logger.info('⏸️ Serviço pausado, ignorando solicitação');
      return false;
    }
    
    // Verificar se o documento está visível (apenas no navegador)
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      logger.info('👁️ Página não está visível, evitando requisição');
      return false;
    }
    
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
    
    logger.info(`📦 Atualizando cache interno com ${data.length} roletas`);
    
    // Atualizar o cache interno
    data.forEach(roulette => {
      this.rouletteDataCache.set(roulette.id, roulette);
    });
    
    // Atualizar o tempo de atualização do cache
    this.lastCacheUpdate = Date.now();
    
    // Notificar assinantes sobre a atualização
    this.notifySubscribers(data);
  }
}
