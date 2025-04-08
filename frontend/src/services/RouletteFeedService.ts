import axios from 'axios';
import config from '@/config/env';
import EventService from './EventService';
import { Logger } from './utils/logger';
import { HistoryData } from './SocketService';

const logger = new Logger('RouletteFeedService');

/**
 * Serviço para obter atualizações das roletas usando polling
 * Implementação baseada no modelo do 888casino
 */
class RouletteFeedService {
  private static instance: RouletteFeedService;
  private apiBaseUrl: string;
  private lastRouletteNumbers: Map<string, string[]> = new Map();
  private socketService: any;
  
  // Intervalo de polling otimizado baseado no 888casino (11 segundos exatos)
  private pollingInterval: number = 11000;
  private pollingTimer: number | null = null;
  
  // Controle de erros e tentativas
  private consecutiveErrors: number = 0;
  private maxConsecutiveErrors: number = 5;
  private backoffFactor: number = 1.5;
  private maxInterval: number = 30000; // 30 segundos máximo
  private currentInterval: number = 11000; // começa com 11 segundos
  
  // Timestamps para monitoramento de desempenho
  private lastFetchTime: number = 0;
  private pollingMetrics: {
    totalRequests: number;
    successfulRequests: number;
    totalUpdates: number;
    averageResponseTime: number;
    totalResponseTime: number;
  } = {
    totalRequests: 0,
    successfulRequests: 0,
    totalUpdates: 0,
    averageResponseTime: 0,
    totalResponseTime: 0
  };
  
  constructor() {
    this.apiBaseUrl = config.apiBaseUrl;
    logger.info('Inicializado com URL base:', this.apiBaseUrl);
    logger.info(`Configurado com intervalo de polling de ${this.pollingInterval}ms (baseado no 888casino)`);
  }
  
  public static getInstance(): RouletteFeedService {
    if (!RouletteFeedService.instance) {
      RouletteFeedService.instance = new RouletteFeedService();
    }
    return RouletteFeedService.instance;
  }
  
  /**
   * Inicia o serviço de feed de roletas
   */
  public start(): void {
    logger.info('Iniciando serviço de feed de roletas com polling otimizado');
    
    // Buscar dados iniciais
    this.fetchInitialData();
    
    // Iniciar polling
    this.startPolling();
    
    // Monitorar visibilidade da página para otimizar o polling
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }
  
  /**
   * Para o serviço de feed
   */
  public stop(): void {
    logger.info('Parando serviço de feed de roletas');
    
    // Remover listener de visibilidade
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Parar o polling
    this.stopPolling();
  }
  
  /**
   * Handler para mudanças de visibilidade da página
   */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      logger.info('Página voltou a ficar visível, reativando polling');
      // Forçar uma atualização imediata
      this.fetchLatestData();
      
      // Restabelecer polling normal se estiver parado
      if (!this.pollingTimer) {
        this.startPolling();
      }
    } else {
      // Opcionalmente reduzir frequência ou parar polling quando página não estiver visível
      // para economizar recursos do servidor e do cliente
      if (config.optimizePollingForVisibility) {
        logger.info('Página não visível, reduzindo frequência de polling');
        this.stopPolling();
        
        // Opcionalmente manter um polling mais lento
        this.pollingTimer = setInterval(() => {
          this.fetchLatestData();
        }, this.maxInterval); // polling mais lento quando não visível
      }
    }
  }
  
  /**
   * Inicia o polling para buscar atualizações periódicas
   */
  private startPolling(): void {
    // Limpar qualquer timer existente
    this.stopPolling();
    
    // Iniciar novo timer com o intervalo atual
    this.pollingTimer = setInterval(() => {
      this.fetchLatestData();
    }, this.currentInterval);
    
    logger.info(`Polling iniciado (intervalo: ${this.currentInterval}ms)`);
  }
  
  /**
   * Para o polling
   */
  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      logger.info('Polling interrompido');
    }
  }
  
  /**
   * Restabelece o polling após backoff por erros
   */
  private resetPollingInterval(): void {
    this.consecutiveErrors = 0;
    this.currentInterval = this.pollingInterval; // voltar para 11 segundos
    
    // Reiniciar polling com intervalo normal
    if (this.pollingTimer) {
      this.stopPolling();
      this.startPolling();
    }
    
    logger.info(`Intervalo de polling resetado para ${this.currentInterval}ms`);
  }
  
  /**
   * Implementa backoff exponencial para polling em caso de erros
   */
  private implementBackoff(): void {
    this.consecutiveErrors++;
    
    if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
      // Aumentar o intervalo até o máximo permitido
      this.currentInterval = Math.min(
        this.currentInterval * this.backoffFactor,
        this.maxInterval
      );
      
      // Reiniciar polling com novo intervalo
      if (this.pollingTimer) {
        this.stopPolling();
        this.startPolling();
      }
      
      logger.warn(`Backoff aplicado: novo intervalo de polling é ${this.currentInterval}ms`);
    }
  }
  
  /**
   * Busca dados iniciais das roletas
   */
  private async fetchInitialData(): Promise<void> {
    try {
      const startTime = Date.now();
      const response = await axios.get(`${this.apiBaseUrl}/api/roletas`);
      
      this.pollingMetrics.totalRequests++;
      
      if (response.status === 200 && response.data) {
        this.pollingMetrics.successfulRequests++;
        const processingTime = Date.now() - startTime;
        this.updateMetrics(processingTime, 0);
        
        response.data.forEach((roleta: any) => {
          if (roleta.id && roleta.numeros) {
            this.lastRouletteNumbers.set(roleta.id, roleta.numeros);
          }
        });
        
        logger.info(`Dados iniciais carregados: ${response.data.length} roletas`);
      }
    } catch (error) {
      logger.error('Erro ao buscar dados iniciais:', error);
      this.implementBackoff();
    }
  }
  
  /**
   * Atualiza métricas de performance do polling
   */
  private updateMetrics(responseTime: number, updates: number): void {
    this.pollingMetrics.totalResponseTime += responseTime;
    this.pollingMetrics.totalUpdates += updates;
    this.pollingMetrics.averageResponseTime = 
      this.pollingMetrics.totalResponseTime / this.pollingMetrics.successfulRequests;
    
    // Log periódico de métricas (a cada 50 requisições)
    if (this.pollingMetrics.totalRequests % 50 === 0) {
      logger.info(`Métricas de polling: 
        - Requisições totais: ${this.pollingMetrics.totalRequests}
        - Taxa de sucesso: ${(this.pollingMetrics.successfulRequests / this.pollingMetrics.totalRequests * 100).toFixed(2)}%
        - Atualizações recebidas: ${this.pollingMetrics.totalUpdates}
        - Tempo médio de resposta: ${this.pollingMetrics.averageResponseTime.toFixed(2)}ms`);
    }
  }
  
  /**
   * Busca as atualizações mais recentes via polling
   */
  private async fetchLatestData(): Promise<void> {
    // Evitar sobreposição de requisições muito próximas
    const now = Date.now();
    if (now - this.lastFetchTime < 2000) {
      logger.debug('Ignorando requisição redundante (muito próxima da anterior)');
      return;
    }
    
    this.lastFetchTime = now;
    
    try {
      const startTime = Date.now();
      const response = await axios.get(`${this.apiBaseUrl}/api/roletas`);
      
      this.pollingMetrics.totalRequests++;
      
      if (response.status === 200 && response.data) {
        this.pollingMetrics.successfulRequests++;
        
        // Resetar contagem de erros quando requisição é bem-sucedida
        if (this.consecutiveErrors > 0) {
          this.resetPollingInterval();
        }
        
        // Contar atualizações para métricas
        let updatesCount = 0;
        
        response.data.forEach((roleta: any) => {
          if (roleta.id && roleta.numeros) {
            // Comparar com os últimos números armazenados
            const currentNumbers = this.lastRouletteNumbers.get(roleta.id) || [];
            const newNumbers = roleta.numeros;
            
            // Verificar se houve atualização (número diferente na primeira posição)
            if (newNumbers.length > 0 && 
                (currentNumbers.length === 0 || newNumbers[0] !== currentNumbers[0])) {
              
              // Atualizar números armazenados
              this.lastRouletteNumbers.set(roleta.id, newNumbers);
              
              // Emitir evento de atualização
              EventService.emit('roulette:numbers-updated', {
                tableId: roleta.id,
                tableName: roleta.nome || `Roleta ${roleta.id}`,
                numbers: newNumbers,
                isNewNumber: true,
                latestNumber: newNumbers[0]
              });
              
              updatesCount++;
              logger.info(`Nova atualização para roleta ${roleta.id}: ${newNumbers[0]}`);
            }
          }
        });
        
        const processingTime = Date.now() - startTime;
        this.updateMetrics(processingTime, updatesCount);
        
        if (updatesCount > 0) {
          logger.info(`Atualizações recebidas via polling: ${updatesCount} roletas atualizadas`);
        } else {
          logger.debug('Polling concluído, sem atualizações');
        }
      }
    } catch (error) {
      logger.error('Erro ao buscar atualizações:', error);
      this.implementBackoff();
    }
  }
  
  /**
   * Retorna os últimos números conhecidos para uma mesa específica
   */
  public getLastNumbersForTable(tableId: string): string[] {
    return this.lastRouletteNumbers.get(tableId) || [];
  }
  
  /**
   * Retorna todas as mesas de roleta conhecidas
   */
  public getAllRouletteTables(): { tableId: string, numbers: string[] }[] {
    const result: { tableId: string, numbers: string[] }[] = [];
    
    this.lastRouletteNumbers.forEach((numbers, tableId) => {
      result.push({
        tableId,
        numbers
      });
    });
    
    return result;
  }

  /**
   * Obtém o histórico completo de números para uma roleta específica
   */
  async getCompleteHistory(roletaId: string): Promise<HistoryData> {
    try {
      logger.info(`Solicitando histórico completo para roleta ${roletaId}`);
      
      if (!this.socketService) {
        throw new Error('SocketService não está inicializado');
      }
      
      const historyData = await this.socketService.requestRouletteHistory(roletaId);
      
      logger.info(`Histórico recebido: ${historyData.numeros?.length || 0} números`);
      
      // Notificar via EventService
      EventService.emit('roulette:complete-history', {
        roletaId,
        history: historyData
      });
      
      return historyData;
    } catch (error) {
      logger.error('Erro ao obter histórico:', error);
      throw error;
    }
  }
  
  /**
   * Obtém métricas de performance do sistema de polling
   */
  public getPollingMetrics() {
    return {
      ...this.pollingMetrics,
      currentInterval: this.currentInterval,
      consecutiveErrors: this.consecutiveErrors,
    };
  }
  
  /**
   * Força uma atualização imediata (útil para testes ou quando o usuário solicita manualmente)
   */
  public async forceUpdate(): Promise<void> {
    logger.info('Atualizando dados sob demanda');
    await this.fetchLatestData();
  }
  
  /**
   * Registra o SocketService para obter histórico completo
   */
  public registerSocketService(socketService: any): void {
    this.socketService = socketService;
    logger.info('SocketService registrado para histórico completo');
  }
}

export default RouletteFeedService; 