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
class RouletteFeedService {
  private static instance: RouletteFeedService;
  private apiBaseUrl: string;
  private lastRouletteNumbers: Map<string, string[]> = new Map();
  private socketService: any;
  
  // Intervalo otimizado para 8 segundos exatos conforme solicitado
  private pollingInterval: number = 8000;
  private pollingTimer: number | null = null;
  private currentInterval: number = 8000;
  
  // Flag para controlar se uma requisição já está em andamento
  private isRequestInProgress: boolean = false;
  
  // Flag de inicialização global para garantir apenas uma instância de polling
  private static isInitialized: boolean = false;
  
  // Timestamps para monitoramento
  private lastFetchTime: number = 0;
  
  constructor() {
    this.apiBaseUrl = config.apiBaseUrl;
    logger.info('Inicializado com URL base:', this.apiBaseUrl);
    logger.info(`Configurado com intervalo de polling de ${this.pollingInterval}ms (exatamente 8 segundos)`);
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
    // Verificar se o sistema já foi inicializado para prevenir múltiplas instâncias
    if (RouletteFeedService.isInitialized) {
      logger.info('Serviço já está inicializado, ignorando chamada duplicada');
      return;
    }
    
    RouletteFeedService.isInitialized = true;
    logger.info('Iniciando serviço de feed de roletas com polling otimizado (única fonte)');
    
    // Buscar dados iniciais imediatamente
    this.fetchInitialData();
    
    // Iniciar polling com intervalo exato de 8 segundos
    this.startPolling();
    
    // Monitorar visibilidade da página
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Adicionar listener para limpeza quando a página fechar
    window.addEventListener('beforeunload', this.cleanupService);
  }
  
  /**
   * Limpeza do serviço ao fechar página
   */
  private cleanupService = (): void => {
    this.stop();
  }
  
  /**
   * Para o serviço de feed
   */
  public stop(): void {
    logger.info('Parando serviço de feed de roletas');
    
    // Limpar listeners
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('beforeunload', this.cleanupService);
    
    // Parar o polling
    this.stopPolling();
    
    // Resetar flag de inicialização
    RouletteFeedService.isInitialized = false;
  }
  
  /**
   * Handler para mudanças de visibilidade da página
   */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      logger.info('Página voltou a ficar visível, reativando polling');
      
      // Verificar se o polling está ativo
      if (!this.pollingTimer) {
        this.startPolling();
      }
    }
  }
  
  /**
   * Inicia o polling para buscar atualizações periódicas
   * Garante apenas uma fonte de requisições
   */
  private startPolling(): void {
    // Limpar qualquer timer existente
    this.stopPolling();
    
    // Iniciar novo timer com o intervalo exato de 8 segundos
    this.pollingTimer = setInterval(() => {
      this.fetchLatestData();
    }, this.currentInterval);
    
    logger.info(`Polling único iniciado (intervalo: ${this.currentInterval}ms)`);
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
   * Busca dados iniciais das roletas
   */
  private async fetchInitialData(): Promise<void> {
    try {
      // Prevenir múltiplas requisições simultâneas
      if (this.isRequestInProgress) {
        logger.debug('Requisição já em andamento, ignorando chamada duplicada');
        return;
      }
      
      this.isRequestInProgress = true;
      
      const startTime = Date.now();
      const response = await axios.get(`${this.apiBaseUrl}/api/roletas`);
      
      if (response.status === 200 && response.data) {
        response.data.forEach((roleta: any) => {
          if (roleta.id && roleta.numeros) {
            this.lastRouletteNumbers.set(roleta.id, roleta.numeros);
          }
        });
        
        logger.info(`Dados iniciais carregados: ${response.data.length} roletas em ${Date.now() - startTime}ms`);
      }
    } catch (error) {
      logger.error('Erro ao buscar dados iniciais:', error);
    } finally {
      this.isRequestInProgress = false;
    }
  }
  
  /**
   * Busca as atualizações mais recentes via polling
   * Implementa controle para garantir apenas uma requisição de cada vez
   */
  private async fetchLatestData(): Promise<void> {
    // Evitar requisições sobrepostas
    if (this.isRequestInProgress) {
      logger.debug('Ignorando requisição (já existe uma em andamento)');
      return;
    }
    
    // Registrar timestamp para garantir intervalo mínimo entre chamadas
    const now = Date.now();
    if (now - this.lastFetchTime < 7000) { // Garantir pelo menos 7s entre requisições como segurança
      logger.debug('Ignorando requisição redundante (muito próxima da anterior)');
      return;
    }
    
    this.lastFetchTime = now;
    this.isRequestInProgress = true;
    
    try {
      const startTime = Date.now();
      logger.debug(`Iniciando requisição de dados em ${new Date().toISOString()}`);
      
      const response = await axios.get(`${this.apiBaseUrl}/api/roletas`);
      
      if (response.status === 200 && response.data) {
        // Contar atualizações
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
        if (updatesCount > 0) {
          logger.info(`Atualizações recebidas via polling único: ${updatesCount} roletas atualizadas em ${processingTime}ms`);
        } else {
          logger.debug(`Polling concluído sem atualizações (${processingTime}ms)`);
        }
      }
    } catch (error) {
      logger.error('Erro ao buscar atualizações:', error);
    } finally {
      this.isRequestInProgress = false;
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
  
  /**
   * Retorna o status do serviço
   */
  public getStatus(): { 
    initialized: boolean; 
    isPolling: boolean; 
    interval: number;
    lastFetchTime: number;
    cachedTables: number;
  } {
    return {
      initialized: RouletteFeedService.isInitialized,
      isPolling: this.pollingTimer !== null,
      interval: this.currentInterval,
      lastFetchTime: this.lastFetchTime,
      cachedTables: this.lastRouletteNumbers.size
    };
  }
}

export default RouletteFeedService; 