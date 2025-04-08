import config from '@/config/env';
import EventService from './EventService';
import { getLogger } from './utils/logger';
import { HistoryData } from './SocketService';

// Criar uma única instância do logger
const logger = getLogger('RouletteFeedService');

// Configurações globais para o serviço
const POLLING_INTERVAL = 10000; // Intervalo padrão de polling (10 segundos)
const MIN_REQUEST_INTERVAL = 2000; // Mínimo de 2 segundos entre requisições
const CACHE_TTL = 15000; // 15 segundos de TTL para o cache

// Controle global para evitar requisições concorrentes de diferentes instâncias
let GLOBAL_IS_FETCHING = false;
let GLOBAL_LAST_REQUEST_TIME = 0;
const GLOBAL_PENDING_REQUESTS = new Set<string>();
const GLOBAL_REQUEST_LOCK_TIME = 10000; // 10 segundos máximo de lock global

// Declarações de tipos para o objeto window global
declare global {
  interface Window {
    _pollingActive?: boolean;
    _requestInProgress?: boolean;
    _rouletteTimers?: Array<{
      id: number;
      created: string;
      interval: number;
    }>;
  }
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
  private requestStats: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    lastMinuteRequests: number[];
    avgResponseTime: number;
    lastResponseTime: number;
  } = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    lastMinuteRequests: [],
    avgResponseTime: 0,
    lastResponseTime: 0
  };
  
  // Configurações de polling
  private interval: number = POLLING_INTERVAL; // Usar o intervalo global
  private minInterval: number = 5000; // Mínimo 5 segundos
  private maxInterval: number = 20000; // Máximo 20 segundos
  private maxRequestsPerMinute: number = 30; // Limite de 30 requisições por minuto
  private backoffMultiplier: number = 1.5; // Multiplicador para backoff em caso de falhas
  
  // Flags e temporizadores
  private isInitialized: boolean = false;
  private isPollingActive: boolean = false;
  private pollingTimer: number | null = null; // Usando number para compatibilidade com Node e Browser
  private isPaused: boolean = false;
  private hasPendingRequest: boolean = false;
  private backoffTimeout: number | null = null; // Usando number para compatibilidade com Node e Browser
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

  private constructor() {
    logger.info('🚀 Inicializando serviço de feeds de roleta');
    
    // Limpar as requisições antigas do último minuto a cada 10 segundos
    setInterval(() => this.cleanupOldRequests(), 10000);
    
    // Verificar se devemos aguardar a visibilidade da página para iniciar
    if (typeof document !== 'undefined') {
      const isVisible = document.visibilityState === 'visible';
      logger.info(`👁️ Visibilidade inicial: ${isVisible ? 'visível' : 'oculta'}`);
      
      // Adicionar listener para mudanças de visibilidade
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      
      // Se a página já estiver visível, inicializar normalmente
      if (isVisible) {
        this.initialize();
      } else {
        logger.info('⏸️ Aguardando página ficar visível para iniciar o polling');
      }
    } else {
      // Em ambiente sem document, inicializar imediatamente
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
    if (window._pollingActive === true) {
      logger.warn('⚠️ Já existe um polling ativo globalmente, não iniciando outro');
      // Mesmo assim, marcamos como ativo localmente para que não tentemos iniciar novamente
      this.isPollingActive = true;
      return;
    }

    logger.info(`Iniciando polling com intervalo de ${this.interval}ms`);
    this.isPollingActive = true;
    // Marcar globalmente que há polling ativo
    window._pollingActive = true;
    
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
   * Busca os dados iniciais das roletas
   */
  public fetchInitialData(): Promise<any> {
    logger.info('Solicitação para buscar dados iniciais');
    
    // Verificar se o cache está válido
    if (this.isCacheValid() && this.roulettes.length > 0) {
      logger.info('Cache válido encontrado, usando dados do cache');
      return Promise.resolve(this.roulettes);
    }
    
    // Verificar trava global
    if (!this.checkAndReleaseGlobalLock()) {
      logger.info('Trava global ativa, aguardando liberação');
      return Promise.resolve(this.roulettes);
    }
    
    // Verificar se já há uma solicitação em andamento
    if (this.IS_FETCHING_DATA) {
      logger.info('Já existe uma solicitação em andamento, aguardando...');
      return Promise.resolve(this.roulettes);
    }
    
    // Verificar o intervalo mínimo entre requisições
    const now = Date.now();
    if (now - this.lastRequestTime < MIN_REQUEST_INTERVAL) {
      logger.info(`Requisição muito próxima da anterior (${now - this.lastRequestTime}ms), usando dados em cache`);
      return Promise.resolve(this.roulettes);
    }
    
    // Marcar como buscando dados (local e global)
    this.IS_FETCHING_DATA = true;
    GLOBAL_IS_FETCHING = true;
    GLOBAL_LAST_REQUEST_TIME = now;
    this.lastRequestTime = now;
    
    const requestId = `initial_${now}`;
    GLOBAL_PENDING_REQUESTS.add(requestId);
    
    logger.info('Buscando dados iniciais');
    
    return fetch(`/api/ROULETTES`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        logger.info('Dados iniciais recebidos:', data.length);
        this.handleRouletteData(data);
        this.IS_FETCHING_DATA = false;
        GLOBAL_IS_FETCHING = false;
        GLOBAL_PENDING_REQUESTS.delete(requestId);
        return this.roulettes;
      })
      .catch(error => {
        logger.error('Erro ao buscar dados iniciais:', error);
        this.IS_FETCHING_DATA = false;
        GLOBAL_IS_FETCHING = false;
        GLOBAL_PENDING_REQUESTS.delete(requestId);
        throw error;
      });
  }

  /**
   * Busca os dados mais recentes das roletas
   */
  public fetchLatestData(): Promise<any> {
    // Se não pudermos fazer requisição, retornar dados em cache
    if (!this.canMakeRequest()) {
      return Promise.resolve(this.roulettes);
    }
    
    // Marcar como buscando dados (local)
    this.IS_FETCHING_DATA = true;
    this.isFetching = true;
    this.hasPendingRequest = true;
    this.lastFetchTime = Date.now();
    
    // Marcar como buscando dados (global)
    GLOBAL_IS_FETCHING = true;
    GLOBAL_LAST_REQUEST_TIME = this.lastFetchTime;
    
    // Registrar requisição para controle de taxa
    const requestId = `latest_${this.lastFetchTime}`;
    GLOBAL_PENDING_REQUESTS.add(requestId);
    this.requestStats.lastMinuteRequests.push(this.lastFetchTime);
    this.requestStats.totalRequests++;
    
    logger.info('📡 Buscando dados recentes');
    
    const startTime = performance.now();
    
    return fetch(`/api/ROULETTES`)
      .then(response => {
        if (response.status === 429) {
          // Erro 429 - Too Many Requests
          logger.warn('🚨 Recebido erro 429 (Too Many Requests). Implementando backoff exponencial.');
          
          // Aumentar o intervalo de polling mais agressivamente
          this.failedFetchesCount += 2;
          const backoffFactor = Math.min(this.backoffMultiplier * this.failedFetchesCount, 5);
          const backoffTime = Math.min(this.maxInterval, POLLING_INTERVAL * backoffFactor);
          
          logger.info(`⏱️ Backoff para erro 429: ${backoffTime}ms`);
          
          // Liberar travas
          this.IS_FETCHING_DATA = false;
          this.isFetching = false;
          this.hasPendingRequest = false;
          GLOBAL_IS_FETCHING = false;
          GLOBAL_PENDING_REQUESTS.delete(requestId);
          window._requestInProgress = false;
          
          // Realizar retry automático após backoff
          return new Promise(resolve => {
            setTimeout(() => {
              logger.info('�� Tentando novamente após backoff para erro 429');
              resolve(this.fetchLatestData());
            }, backoffTime);
          });
        }
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        const responseTime = performance.now() - startTime;
        logger.info(`✅ Dados recebidos: ${data.length} roletas (${responseTime.toFixed(0)}ms)`);
        
        // Processar dados recebidos
        this.handleRouletteData(data);
        
        // Atualizar estatísticas
        this.requestStats.successfulRequests++;
        this.requestStats.lastResponseTime = responseTime;
        this.adjustPollingInterval(true, responseTime);
        
        // Liberar travas
        this.IS_FETCHING_DATA = false;
        this.isFetching = false;
        this.hasPendingRequest = false;
        GLOBAL_IS_FETCHING = false;
        GLOBAL_PENDING_REQUESTS.delete(requestId);
        window._requestInProgress = false;
        
        return this.roulettes;
      })
      .catch(error => {
        logger.error('❌ Erro ao buscar dados recentes:', error);
        
        // Atualizar estatísticas de erro
        this.requestStats.failedRequests++;
        this.adjustPollingInterval(false);
        
        // Liberar travas mesmo em caso de erro
        this.IS_FETCHING_DATA = false;
        this.isFetching = false;
        this.hasPendingRequest = false;
        GLOBAL_IS_FETCHING = false;
        GLOBAL_PENDING_REQUESTS.delete(requestId);
        window._requestInProgress = false;
        
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
      this.resumePolling();
      // Realizar uma atualização imediata quando a página fica visível
      // apenas se o cache estiver inválido
      if (!this.isCacheValid()) {
        this.fetchLatestData();
      }
    } else {
      logger.info('🔒 Página em segundo plano, pausando polling');
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
  private adjustPollingInterval(success: boolean, responseTime?: number): void {
    // Com o intervalo fixo, não ajustamos mais dinamicamente
    // Mantemos apenas a lógica de backoff em caso de falhas

    if (success) {
      // Requisição bem-sucedida, resetar contador de falhas
      this.successfulFetchesCount++;
      this.failedFetchesCount = 0; // Resetar contador de falhas
      
      // Registrar estatísticas de resposta
      if (responseTime) {
        this.requestStats.lastResponseTime = responseTime;
        // Atualizar média de tempo de resposta (média móvel)
        const prevAvg = this.requestStats.avgResponseTime;
        this.requestStats.avgResponseTime = prevAvg === 0 
          ? responseTime 
          : prevAvg * 0.7 + responseTime * 0.3; // Peso maior para valores históricos
      }
    } else {
      // Requisição falhou, aumentar o intervalo com backoff exponencial
      this.failedFetchesCount++;
      this.successfulFetchesCount = 0; // Resetar contador de sucessos
      
      // Backoff exponencial até o máximo
      if (this.failedFetchesCount > 0) {
        const backoffFactor = Math.min(this.backoffMultiplier * this.failedFetchesCount, 3);
        const newInterval = Math.min(this.maxInterval, POLLING_INTERVAL * backoffFactor);
        
        logger.info(`🔄 Backoff: Aumentando intervalo para ${newInterval}ms após ${this.failedFetchesCount} falhas`);
        this.interval = newInterval;
        
        // Se tivermos muitas falhas consecutivas, pausar brevemente
        if (this.failedFetchesCount >= 5) {
          logger.info('⚠️ Muitas falhas consecutivas, pausando por 30 segundos');
          this.pausePolling();
          
          if (this.backoffTimeout) {
            clearTimeout(this.backoffTimeout);
          }
          
          this.backoffTimeout = setTimeout(() => {
            logger.info('🔄 Retomando após pausa de backoff');
            // Restabelecer o intervalo padrão ao retomar
            this.interval = POLLING_INTERVAL;
            this.resumePolling();
          }, 30000);
        }
      }
    }
    
    // Atualizar o timer de polling se estiver ativo
    if (this.isPollingActive && this.pollingTimer) {
      this.restartPollingTimer();
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
   * Inicia o timer de polling para buscar dados em intervalos regulares
   */
  private startPollingTimer(): void {
    // Se já existe um timer ativo, não criar outro
    if (this.pollingTimer !== null) {
      logger.warn(`⚠️ Tentativa de iniciar novo timer enquanto já existe um timer ativo (${this.interval}ms)`);
      return;
    }
    
    // Registrar o timer globalmente para debugging
    if (!window._rouletteTimers) {
      window._rouletteTimers = [];
    }
    
    // Criar um novo timer e guardar a referência
    const timerId = window.setInterval(() => {
      logger.info(`🔄 Timer de polling executando (${this.interval}ms)`);
      
      if (this.canMakeRequest()) {
        logger.info(`📡 Solicitando dados via polling timer`);
        this.fetchLatestData().catch(err => {
          logger.error('Erro durante o polling automático:', err);
        });
      } else {
        logger.info(`⏭️ Pulando requisição de polling - não é possível fazer requisição agora`);
      }
    }, this.interval) as unknown as number;
    
    // Guardar a referência do timer
    this.pollingTimer = timerId;
    
    // Adicionar à lista de timers ativos para debugging
    window._rouletteTimers.push({
      id: timerId,
      created: new Date().toISOString(),
      interval: this.interval
    });
    
    logger.info(`⏱️ Timer de polling iniciado com intervalo de ${this.interval}ms [ID: ${timerId}]`);
  }
  
  /**
   * Reinicia o timer de polling (usado quando o intervalo muda)
   */
  private restartPollingTimer(): void {
    // Se o polling não estiver ativo, não reiniciar
    if (!this.isPollingActive) {
      logger.info('Polling não está ativo, não reiniciando timer');
      return;
    }
    
    // Se estiver pausado, não reiniciar
    if (this.isPaused) {
      logger.info('Polling está pausado, não reiniciando timer');
      return;
    }

    // Limpar timer existente se houver
    if (this.pollingTimer) {
      logger.info(`Limpando timer de polling existente: ${this.pollingTimer}`);
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      
      // Atualizar lista de timers ativos
      if (window._rouletteTimers) {
        window._rouletteTimers = window._rouletteTimers.filter(t => t.id !== this.pollingTimer);
      }
    }
    
    // Iniciar novo timer
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
    if (!Array.isArray(data)) {
      logger.error('⚠️ Dados inválidos recebidos:', data);
      return;
    }
    
    // Atualizar a lista de roletas
    this.roulettes = data;
    
    // Atualizar o cache
    this.updateRouletteCache(data);
    
    // Registrar estatística de requisição bem-sucedida
    this.requestStats.totalRequests++;
    this.requestStats.successfulRequests++;
    this.requestStats.lastMinuteRequests.push(Date.now());
    
    // Ajustar o intervalo de polling com base no sucesso
    this.adjustPollingInterval(true);
  }
} 