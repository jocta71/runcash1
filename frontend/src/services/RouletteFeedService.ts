import axios from 'axios';
import config from '@/config/env';
import EventService from './EventService';
import { Logger } from './utils/logger';
import { HistoryData } from './SocketService';

const logger = new Logger('RouletteFeedService');

/**
 * Serviço para obter atualizações das roletas usando polling único
 * Intervalo ajustado para 8 segundos conforme especificação
 */
export default class RouletteFeedService {
  private static instance: RouletteFeedService | null = null;
  
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
  private interval: number = 8000; // 8 segundos padrão para polling
  private minInterval: number = 5000; // Mínimo 5 segundos
  private maxInterval: number = 20000; // Máximo 20 segundos
  private maxRequestsPerMinute: number = 30; // Limite de 30 requisições por minuto
  private backoffMultiplier: number = 1.5; // Multiplicador para backoff em caso de falhas
  
  // Flags e temporizadores
  private isInitialized: boolean = false;
  private isPollingActive: boolean = false;
  private pollingTimer: any = null;
  private isPaused: boolean = false;
  private hasPendingRequest: boolean = false;
  private backoffTimeout: any = null;
  private hasFetchedInitialData: boolean = false;

  private constructor() {
    console.log('[RouletteFeedService] 🚀 Inicializando serviço de feeds de roleta');
    
    // Limpar as requisições antigas do último minuto a cada 10 segundos
    setInterval(() => this.cleanupOldRequests(), 10000);
    
    // Verificar se devemos aguardar a visibilidade da página para iniciar
    if (typeof document !== 'undefined') {
      const isVisible = document.visibilityState === 'visible';
      console.log(`[RouletteFeedService] 👁️ Visibilidade inicial: ${isVisible ? 'visível' : 'oculta'}`);
      
      // Adicionar listener para mudanças de visibilidade
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      
      // Se a página já estiver visível, inicializar normalmente
      if (isVisible) {
        this.initialize();
      } else {
        console.log('[RouletteFeedService] ⏸️ Aguardando página ficar visível para iniciar o polling');
      }
    } else {
      // Em ambiente sem document, inicializar imediatamente
      this.initialize();
    }
  }

  private initialize(): void {
    if (this.isInitialized) {
      console.log('[RouletteFeedService] ⚠️ Serviço já inicializado, ignorando chamada dupla');
      return;
    }
    
    this.isInitialized = true;
    console.log('[RouletteFeedService] 🔄 Inicializando serviço com intervalo de polling de', this.interval, 'ms');
  }
  
  /**
   * Controle de visibilidade do documento para otimizar recursos
   */
  private handleVisibilityChange = (): void => {
    const isVisible = document.visibilityState === 'visible';
    
    if (isVisible) {
      console.log('[RouletteFeedService] 👁️ Página visível, retomando polling');
      this.resumePolling();
      // Realizar uma atualização imediata quando a página fica visível
      this.fetchLatestData();
    } else {
      console.log('[RouletteFeedService] 🔒 Página em segundo plano, pausando polling');
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
    // Se estiver pausado, não fazer requisições
    if (this.isPaused) {
      console.log('[RouletteFeedService] ⏸️ Serviço pausado, ignorando solicitação');
      return false;
    }
    
    // Se já houver uma requisição em andamento, aguardar
    if (this.isFetching || this.hasPendingRequest) {
      console.log('[RouletteFeedService] ⏳ Requisição já em andamento, aguardando');
      return false;
    }
    
    // Verificar limite de requisições por minuto
    const requestsInLastMinute = this.requestStats.lastMinuteRequests.length;
    if (requestsInLastMinute >= this.maxRequestsPerMinute) {
      console.log(`[RouletteFeedService] 🚦 Limite de requisições atingido: ${requestsInLastMinute}/${this.maxRequestsPerMinute} por minuto`);
      return false;
    }
    
    // Verificar tempo mínimo entre requisições
    const now = Date.now();
    const timeSinceLastFetch = now - this.lastFetchTime;
    
    if (timeSinceLastFetch < this.minInterval) {
      console.log(`[RouletteFeedService] ⏱️ Requisição muito recente (${timeSinceLastFetch}ms), aguardando intervalo mínimo de ${this.minInterval}ms`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Ajusta dinamicamente o intervalo de polling com base no sucesso ou falha das requisições
   */
  private adjustPollingInterval(success: boolean, responseTime?: number): void {
    if (success) {
      // Requisição bem-sucedida, podemos diminuir o intervalo gradualmente
      this.successfulFetchesCount++;
      this.failedFetchesCount = 0; // Resetar contador de falhas
      
      // A cada 3 sucessos consecutivos, reduzir o intervalo em 10% até o mínimo
      if (this.successfulFetchesCount >= 3 && this.interval > this.minInterval) {
        const newInterval = Math.max(this.minInterval, this.interval * 0.9);
        if (newInterval !== this.interval) {
          console.log(`[RouletteFeedService] ⚡ Otimizando: Reduzindo intervalo para ${newInterval}ms`);
          this.interval = newInterval;
        }
      }
      
      // Registrar estatísticas
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
        const newInterval = Math.min(this.maxInterval, this.interval * backoffFactor);
        
        console.log(`[RouletteFeedService] 🔄 Backoff: Aumentando intervalo para ${newInterval}ms após ${this.failedFetchesCount} falhas`);
        this.interval = newInterval;
        
        // Se tivermos muitas falhas consecutivas, pausar brevemente
        if (this.failedFetchesCount >= 5) {
          console.log('[RouletteFeedService] ⚠️ Muitas falhas consecutivas, pausando por 30 segundos');
          this.pausePolling();
          
          if (this.backoffTimeout) {
            clearTimeout(this.backoffTimeout);
          }
          
          this.backoffTimeout = setTimeout(() => {
            console.log('[RouletteFeedService] 🔄 Retomando após pausa de backoff');
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
  
  /**
   * Controla o início e parada do polling
   */
  public startPolling(): void {
    if (this.isPollingActive) {
      console.log('[RouletteFeedService] ⚠️ Polling já ativo, ignorando solicitação');
      return;
    }
    
    console.log(`[RouletteFeedService] 🚀 Iniciando polling com intervalo de ${this.interval}ms`);
    this.isPollingActive = true;
    this.isPaused = false;
    
    // Fazer uma requisição imediata
    this.fetchLatestData();
    
    // Configurar o timer para próximas requisições
    this.pollingTimer = setInterval(() => {
      this.fetchLatestData();
    }, this.interval);
  }
  
  public stopPolling(): void {
    if (!this.isPollingActive) {
      return;
    }
    
    console.log('[RouletteFeedService] 🛑 Parando polling');
    this.isPollingActive = false;
    
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }
  
  private pausePolling(): void {
    if (this.isPaused) {
      return;
    }
    
    console.log('[RouletteFeedService] ⏸️ Pausando polling');
    this.isPaused = true;
    
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }
  
  private resumePolling(): void {
    if (this.isPollingActive && this.isPaused) {
      console.log('[RouletteFeedService] ▶️ Retomando polling');
      this.isPaused = false;
      
      // Reiniciar o timer
      this.restartPollingTimer();
    } else if (!this.isPollingActive) {
      // Se não estava ativo, iniciar
      this.startPolling();
    }
  }
  
  private restartPollingTimer(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }
    
    this.pollingTimer = setInterval(() => {
      this.fetchLatestData();
    }, this.interval);
    
    console.log(`[RouletteFeedService] 🔄 Timer de polling reiniciado com intervalo de ${this.interval}ms`);
  }
  
  /**
   * Busca os dados iniciais de todas as roletas permitidas
   */
  public async fetchInitialData(): Promise<any> {
    console.log('[RouletteFeedService] 🔍 Buscando dados iniciais de todas as roletas');
    
    if (this.hasFetchedInitialData) {
      console.log('[RouletteFeedService] ℹ️ Dados iniciais já carregados anteriormente');
    }
    
    // Marcar que já buscamos dados iniciais
    this.hasFetchedInitialData = true;
    
    try {
      // Esta é uma requisição especial - deve passar por qualquer limite de rate
      this.hasPendingRequest = true;
      this.isFetching = true;
      this.requestStats.totalRequests++;
      this.requestStats.lastMinuteRequests.push(Date.now());
      
      const startTime = Date.now();
      
      // Importar de forma dinâmica para evitar problemas de dependência circular
      const { fetchRoulettesWithRealNumbers } = await import('../integrations/api/rouletteService');
      const data = await fetchRoulettesWithRealNumbers();
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log(`[RouletteFeedService] ✅ Dados iniciais obtidos com sucesso em ${responseTime}ms`);
      
      // Atualizar estatísticas
      this.requestStats.successfulRequests++;
      this.requestStats.lastResponseTime = responseTime;
      
      // Marcar tempo da última requisição bem-sucedida
      this.lastFetchTime = endTime;
      
      // Ajustar intervalo com base no sucesso
      this.adjustPollingInterval(true, responseTime);
      
      return data;
    } catch (error) {
      console.error('[RouletteFeedService] ❌ Erro ao buscar dados iniciais:', error);
      
      // Atualizar estatísticas
      this.requestStats.failedRequests++;
      
      // Ajustar intervalo com base na falha
      this.adjustPollingInterval(false);
      
      throw error;
    } finally {
      this.isFetching = false;
      this.hasPendingRequest = false;
    }
  }
  
  /**
   * Busca os dados mais recentes de todas as roletas permitidas
   * usando o sistema de verificação de taxa e estado
   */
  public async fetchLatestData(): Promise<any> {
    // Verificar se podemos fazer uma nova requisição
    if (!this.canMakeRequest()) {
      if (this.hasPendingRequest || this.isFetching) {
        console.log('[RouletteFeedService] ⏳ Requisição em andamento, retornando a promise existente');
        return this.fetchPromise;
      }
      console.log('[RouletteFeedService] 🚫 Não é possível fazer uma nova requisição agora');
      return Promise.resolve(null);
    }
    
    // Marcar que estamos buscando dados
    this.hasPendingRequest = true;
    this.isFetching = true;
    
    // Criar a promise para esta requisição
    this.fetchPromise = (async () => {
      try {
        // Registrar a requisição nas estatísticas
        this.requestStats.totalRequests++;
        this.requestStats.lastMinuteRequests.push(Date.now());
        
        console.log('[RouletteFeedService] 🔄 Buscando dados atualizados de todas as roletas');
        const startTime = Date.now();
        
        // Importar de forma dinâmica para evitar problemas de dependência circular
        const { fetchRoulettesWithRealNumbers } = await import('../integrations/api/rouletteService');
        const data = await fetchRoulettesWithRealNumbers();
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        console.log(`[RouletteFeedService] ✅ Dados atualizados obtidos com sucesso em ${responseTime}ms`);
        
        // Atualizar estatísticas
        this.requestStats.successfulRequests++;
        this.lastFetchTime = endTime;
        
        // Ajustar intervalo com base no sucesso
        this.adjustPollingInterval(true, responseTime);
        
        return data;
      } catch (error) {
        console.error('[RouletteFeedService] ❌ Erro ao buscar dados atualizados:', error);
        
        // Atualizar estatísticas
        this.requestStats.failedRequests++;
        
        // Ajustar intervalo com base na falha
        this.adjustPollingInterval(false);
        
        throw error;
      } finally {
        this.isFetching = false;
        this.hasPendingRequest = false;
      }
    })();
    
    return this.fetchPromise;
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
      timeSinceLastFetch: Date.now() - this.lastFetchTime
    };
  }
  
  /**
   * Método para fins de teste: forçar uma atualização imediata
   */
  public forceUpdate(): Promise<any> {
    console.log('[RouletteFeedService] 🔄 Forçando atualização imediata');
    
    // Limpar qualquer timer existente
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    // Resetar flags para permitir a requisição
    this.isFetching = false;
    this.hasPendingRequest = false;
    
    // Buscar dados e reiniciar o timer
    const promise = this.fetchLatestData();
    
    // Reiniciar o timer se o polling estiver ativo
    if (this.isPollingActive && !this.isPaused) {
      this.restartPollingTimer();
    }
    
    return promise;
  }
  
  /**
   * Destruir o serviço e limpar recursos
   */
  public destroy(): void {
    console.log('[RouletteFeedService] 🧹 Destruindo serviço de feeds');
    
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    if (this.backoffTimeout) {
      clearTimeout(this.backoffTimeout);
      this.backoffTimeout = null;
    }
    
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    
    this.isPollingActive = false;
    this.isPaused = false;
    this.isFetching = false;
    this.hasPendingRequest = false;
    
    // Limpar a instância singleton para permitir nova inicialização
    RouletteFeedService.instance = null;
  }
} 