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
  private static instance: RouletteStreamService | null = null;
  private pollingTimer: number | null = null;
  private isPolling: boolean = false;
  private isConnected: boolean = false;
  private lastFetchTime: number = 0;
  private retryAttempts: number = 0;
  private feedService: RouletteFeedService;

  /**
   * Construtor privado para implementação do Singleton
   */
  private constructor() {
    this.feedService = RouletteFeedService.getInstance();
    this.setupEventListeners();
  }

  /**
   * Obtém a instância única do serviço
   */
  public static getInstance(): RouletteStreamService {
    if (!RouletteStreamService.instance) {
      RouletteStreamService.instance = new RouletteStreamService();
    }
    return RouletteStreamService.instance;
  }

  /**
   * Configura listeners para eventos relacionados
   */
  private setupEventListeners(): void {
    // Monitorar mudanças de visibilidade do documento
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    // Escutar por solicitações de atualização manual
    EventService.on('roulette:manual-refresh', this.fetchDataImmediately);
  }

  /**
   * Inicia a conexão e o streaming de dados
   */
  public connect(): void {
    if (this.isConnected) {
      logger.info('Já está conectado ao streaming de dados');
      return;
    }

    logger.info('Iniciando conexão com o streaming de dados de roletas');
    this.isConnected = true;
    
    // Fazer uma busca inicial imediata
    this.fetchDataImmediately();
    
    // Iniciar o polling
    this.startPolling();
  }

  /**
   * Desconecta do streaming de dados
   */
  public disconnect(): void {
    logger.info('Desconectando do streaming de dados de roletas');
    this.isConnected = false;
    this.stopPolling();
    
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    
    EventService.off('roulette:manual-refresh', this.fetchDataImmediately);
  }

  /**
   * Inicia o polling para obter atualizações periódicas
   */
  private startPolling(): void {
    if (this.isPolling) return;
    
    this.isPolling = true;
    logger.info(`Iniciando polling de dados a cada ${POLL_INTERVAL/1000} segundos`);
    
    this.pollingTimer = window.setInterval(() => {
      this.fetchRouletteData();
    }, POLL_INTERVAL);
  }

  /**
   * Para o polling
   */
  private stopPolling(): void {
    if (!this.isPolling) return;
    
    logger.info('Parando polling de dados');
    if (this.pollingTimer !== null) {
      window.clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    this.isPolling = false;
  }

  /**
   * Busca dados imediatamente, ignorando o intervalo de polling
   */
  private fetchDataImmediately = (): void => {
    logger.info('Solicitação de dados imediata');
    this.fetchRouletteData(true);
  }

  /**
   * Verifica e manipula mudanças de visibilidade do documento
   */
  private handleVisibilityChange = (): void => {
    const isVisible = document.visibilityState === 'visible';
    
    if (isVisible) {
      logger.info('Documento visível, retomando streaming');
      if (this.isConnected && !this.isPolling) {
        this.startPolling();
        this.fetchDataImmediately(); // Atualizar imediatamente ao retornar à página
      }
    } else {
      logger.info('Documento em segundo plano, pausando streaming');
      this.stopPolling();
    }
  }

  /**
   * Busca os dados mais recentes da API de roletas
   */
  private fetchRouletteData = async (force = false): Promise<void> => {
    // Evitar solicitações muito frequentes
    const now = Date.now();
    const timeSinceLastFetch = now - this.lastFetchTime;
    
    if (!force && timeSinceLastFetch < 3000) {
      logger.debug('Ignorando solicitação muito frequente');
      return;
    }
    
    this.lastFetchTime = now;
    
    try {
      logger.debug('Obtendo dados atualizados de roletas');
      
      const response = await fetch(`${BASE_API_URL}/api/ROULETTES`);
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Processar os dados recebidos
      this.processRouletteData(data);
      
      // Resetar contador de tentativas após sucesso
      this.retryAttempts = 0;
    } catch (error) {
      logger.error(`Erro ao buscar dados: ${error.message}`);
      
      // Implementar lógica de retry
      if (this.retryAttempts < MAX_RETRY_ATTEMPTS) {
        this.retryAttempts++;
        
        logger.info(`Tentando novamente em ${RETRY_DELAY/1000} segundos (tentativa ${this.retryAttempts}/${MAX_RETRY_ATTEMPTS})`);
        
        setTimeout(() => {
          this.fetchRouletteData(true);
        }, RETRY_DELAY);
      } else {
        logger.error(`Falha após ${MAX_RETRY_ATTEMPTS} tentativas`);
        this.retryAttempts = 0;
      }
    }
  }

  /**
   * Processa os dados recebidos da API
   */
  private processRouletteData(data: any[]): void {
    if (!Array.isArray(data)) {
      logger.error('Dados inválidos recebidos da API (não é um array)');
      return;
    }
    
    logger.info(`Dados recebidos: ${data.length} roletas`);
    
    // Processar e normalizar os dados para o formato esperado pelo sistema
    const normalizedData = data.map(roulette => {
      // Verificar se temos a propriedade numero e converter para o formato esperado
      let numeros = [];
      
      if (roulette.numeros && Array.isArray(roulette.numeros)) {
        numeros = roulette.numeros;
      } else if (roulette.numero && Array.isArray(roulette.numero)) {
        numeros = roulette.numero;
      } else if (roulette.lastNumbers && Array.isArray(roulette.lastNumbers)) {
        numeros = roulette.lastNumbers;
      }
      
      // Garantir que todos os IDs estão em um formato consistente
      const id = roulette.id || roulette._id;
      
      return {
        id,
        _id: id,
        name: roulette.name || roulette.nome || `Roleta ${id}`,
        numero: numeros,
        lastNumbers: numeros,
        timestamp: roulette.timestamp || new Date().toISOString()
      };
    });
    
    // Atualizar cada roleta individualmente no cache do RouletteFeedService
    // em vez de tentar usar o método privado updateRouletteCache
    if (normalizedData.length > 0) {
      normalizedData.forEach(roulette => {
        // Em vez de tentar acessar métodos privados, vamos usar o sistema de eventos
        // O FeedService escuta estes eventos e atualiza seu cache interno
        EventService.emit('roulette:new-data', {
          roulette: roulette,
          timestamp: new Date().toISOString(),
          source: 'api-stream'
        });
      });
    }
    
    // Emitir evento com os novos dados para que os componentes possam reagir
    EventService.emit('roulette:data-updated', {
      data: normalizedData,
      timestamp: new Date().toISOString(),
      source: 'live-stream'
    });
  }
}
