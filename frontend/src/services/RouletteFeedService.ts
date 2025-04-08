import axios from 'axios';
import config from '@/config/env';
import EventService from './EventService';
import { Logger } from './utils/logger';
import { HistoryData } from './SocketService';

const logger = new Logger('RouletteFeedService');

/**
 * Serviço de feed de dados de roletas
 * Adaptado com base na análise do sistema do 888casino
 */
class RouletteFeedService {
  private static instance: RouletteFeedService;
  private apiBaseUrl: string;
  private lastRouletteNumbers: Map<string, string[]> = new Map();
  private socketService: any;
  
  // Intervalo de polling de 11 segundos (exato como identificado no 888casino)
  private pollingInterval: number = 11000; 
  private pollingTimer: number | null = null;
  
  // Controle de atualizações
  private lastUpdateTimestamp: Map<string, number> = new Map();
  
  constructor() {
    this.apiBaseUrl = config.apiBaseUrl;
    logger.info(`Inicializado com URL base: ${this.apiBaseUrl}`);
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
    logger.info('Iniciando serviço de feed de roletas');
    
    // Buscar dados iniciais
    this.fetchInitialData();
    
    // Configurar polling com intervalo preciso como o 888casino
    this.startPolling();
  }
  
  /**
   * Para o serviço de feed
   */
  public stop(): void {
    logger.info('Parando serviço de feed de roletas');
    this.stopPolling();
  }
  
  /**
   * Inicia o polling para buscar atualizações periódicas
   */
  private startPolling(): void {
    // Limpar qualquer timer existente
    this.stopPolling();
    
    // Iniciar novo timer com intervalo exato do 888casino (11 segundos)
    this.pollingTimer = setInterval(() => {
      this.fetchLatestData();
    }, this.pollingInterval);
    
    logger.info(`Polling iniciado (intervalo: ${this.pollingInterval}ms)`);
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
      const response = await axios.get(`${this.apiBaseUrl}/api/roletas`);
      
      if (response.status === 200 && response.data) {
        response.data.forEach((roleta: any) => {
          if (roleta.id && roleta.numeros) {
            this.lastRouletteNumbers.set(roleta.id, roleta.numeros);
            // Inicializar timestamp
            this.lastUpdateTimestamp.set(roleta.id, Date.now());
          }
        });
        
        logger.info(`Dados iniciais carregados: ${response.data.length} roletas`);
      }
    } catch (error) {
      logger.error('Erro ao buscar dados iniciais:', error);
    }
  }
  
  /**
   * Busca as atualizações mais recentes
   * Implementa lógica refinada baseada no sistema do 888casino
   */
  private async fetchLatestData(): Promise<void> {
    try {
      const startTime = Date.now();
      const response = await axios.get(`${this.apiBaseUrl}/api/roletas`);
      
      if (response.status === 200 && response.data) {
        let hasUpdates = false;
        
        response.data.forEach((roleta: any) => {
          if (roleta.id && roleta.numeros) {
            // Comparar com os últimos números armazenados
            const currentNumbers = this.lastRouletteNumbers.get(roleta.id) || [];
            const newNumbers = roleta.numeros;
            
            // Verificar se houve atualização (número diferente na primeira posição)
            if (newNumbers.length > 0 && 
                (currentNumbers.length === 0 || newNumbers[0] !== currentNumbers[0])) {
              
              // Registrar quando ocorreu a atualização
              const lastUpdate = this.lastUpdateTimestamp.get(roleta.id) || 0;
              const now = Date.now();
              const timeSinceLastUpdate = now - lastUpdate;
              
              logger.info(`Nova atualização para roleta ${roleta.id} após ${timeSinceLastUpdate}ms`);
              
              // Atualizar números armazenados
              this.lastRouletteNumbers.set(roleta.id, newNumbers);
              this.lastUpdateTimestamp.set(roleta.id, now);
              
              // Emitir evento de atualização
              EventService.emit('roulette:numbers-updated', {
                tableId: roleta.id,
                numbers: newNumbers,
                isNewNumber: true
              });
              
              hasUpdates = true;
            }
          }
        });
        
        if (hasUpdates) {
          logger.info('Atualizações recebidas via polling');
        }
        
        // Log de tempo de resposta
        const responseTime = Date.now() - startTime;
        if (responseTime > 1000) {
          logger.warn(`Tempo de resposta elevado: ${responseTime}ms`);
        }
      }
    } catch (error) {
      logger.error('Erro ao buscar atualizações:', error);
      
      // Tentar novamente após um breve intervalo em caso de falha
      // (não usando o mesmo intervalo completo)
      setTimeout(() => {
        logger.info('Tentando novamente após falha anterior...');
        this.fetchLatestData();
      }, 3000); // 3 segundos para retry
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
  public getAllRouletteTables(): { tableId: string, numbers: string[], lastUpdate?: number }[] {
    const result: { tableId: string, numbers: string[], lastUpdate?: number }[] = [];
    
    this.lastRouletteNumbers.forEach((numbers, tableId) => {
      result.push({
        tableId,
        numbers,
        lastUpdate: this.lastUpdateTimestamp.get(tableId)
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
   * Configura o socketService
   */
  public setSocketService(service: any): void {
    this.socketService = service;
  }
}

export default RouletteFeedService; 