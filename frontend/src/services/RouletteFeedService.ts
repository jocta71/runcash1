import axios from 'axios';
import config from '@/config/env';
import EventService from './EventService';
import { Logger } from './utils/logger';
import { HistoryData } from './SocketService';

const logger = new Logger('RouletteFeedService');

class RouletteFeedService {
  private static instance: RouletteFeedService;
  private apiBaseUrl: string;
  private lastRouletteNumbers: Map<string, string[]> = new Map();
  private socketService: any;
  private pollingInterval: number = 11000; // 11 segundos
  private pollingTimer: number | null = null;
  private lastUpdateTimestamp: Map<string, number> = new Map();
  
  constructor() {
    this.apiBaseUrl = config.apiBaseUrl;
    logger.info('Inicializado com URL base:', this.apiBaseUrl);
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
    
    // Configurar polling
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
    
    // Iniciar novo timer
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
        const currentTime = Date.now();
        
        response.data.forEach((roleta: any) => {
          if (roleta.id && roleta.numeros) {
            this.lastRouletteNumbers.set(roleta.id, roleta.numeros);
            this.lastUpdateTimestamp.set(roleta.id, currentTime);
            
            // Emitir evento inicial para configurar a UI
            EventService.emit('roulette:numbers-updated', {
              tableId: roleta.id,
              numbers: roleta.numeros,
              isNewNumber: false,
              tableName: roleta.nome || `Roleta ${roleta.id}`
            });
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
   */
  private async fetchLatestData(): Promise<void> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/api/roletas`);
      
      if (response.status === 200 && response.data) {
        let hasUpdates = false;
        const currentTime = Date.now();
        
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
              this.lastUpdateTimestamp.set(roleta.id, currentTime);
              
              // Emitir evento de atualização
              EventService.emit('roulette:numbers-updated', {
                tableId: roleta.id,
                numbers: newNumbers,
                isNewNumber: true,
                tableName: roleta.nome || `Roleta ${roleta.id}`,
                timestamp: currentTime
              });
              
              // Calcular estatísticas úteis
              const numeroAtual = parseInt(newNumbers[0]);
              const cor = this.getNumberColor(numeroAtual);
              
              // Também emitir evento para o novo número específico
              EventService.emit('roulette:new-number', {
                tableId: roleta.id,
                tableName: roleta.nome || `Roleta ${roleta.id}`,
                number: numeroAtual,
                cor: cor,
                timestamp: currentTime
              });
              
              hasUpdates = true;
              logger.info(`Novo número na roleta ${roleta.id}: ${newNumbers[0]} (${cor})`);
            }
          }
        });
        
        if (hasUpdates) {
          logger.info('Atualizações recebidas via polling');
        }
      }
    } catch (error) {
      logger.error('Erro ao buscar atualizações:', error);
    }
  }
  
  /**
   * Determina a cor de um número de roleta
   */
  private getNumberColor(numero: number): string {
    if (numero === 0) {
      return 'verde';
    } else if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(numero)) {
      return 'vermelho';
    } else {
      return 'preto';
    }
  }
  
  /**
   * Retorna os últimos números conhecidos para uma mesa específica
   */
  public getLastNumbersForTable(tableId: string): string[] {
    return this.lastRouletteNumbers.get(tableId) || [];
  }
  
  /**
   * Retorna o timestamp da última atualização para uma mesa específica
   */
  public getLastUpdateTimestamp(tableId: string): number {
    return this.lastUpdateTimestamp.get(tableId) || 0;
  }
  
  /**
   * Retorna todas as mesas de roleta conhecidas
   */
  public getAllRouletteTables(): { tableId: string, numbers: string[], lastUpdate: number }[] {
    const result: { tableId: string, numbers: string[], lastUpdate: number }[] = [];
    
    this.lastRouletteNumbers.forEach((numbers, tableId) => {
      result.push({
        tableId,
        numbers,
        lastUpdate: this.lastUpdateTimestamp.get(tableId) || 0
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
   * Define o serviço de socket para uso com histórico completo
   */
  public setSocketService(service: any): void {
    this.socketService = service;
  }
}

export default RouletteFeedService; 