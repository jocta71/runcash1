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
  private pollingInterval: number = 10000; // 10 segundos
  private pollingTimer: number | null = null;
  
  constructor() {
    this.apiBaseUrl = config.apiBaseUrl;
    console.log('[RouletteFeedService] Inicializado com URL base:', this.apiBaseUrl);
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
    console.log('[RouletteFeedService] Iniciando serviço de feed de roletas');
    
    // Buscar dados iniciais
    this.fetchInitialData();
    
    // Configurar polling em vez de SSE
    this.startPolling();
  }
  
  /**
   * Para o serviço de feed
   */
  public stop(): void {
    console.log('[RouletteFeedService] Parando serviço de feed de roletas');
    // Parar o polling
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
    
    console.log(`[RouletteFeedService] Polling iniciado (intervalo: ${this.pollingInterval}ms)`);
  }
  
  /**
   * Para o polling
   */
  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      console.log('[RouletteFeedService] Polling interrompido');
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
          }
        });
      }
    } catch (error) {
      console.error('[RouletteFeedService] Erro ao buscar dados iniciais:', error);
    }
  }
  
  /**
   * Busca as atualizações mais recentes (substitui o SSE)
   */
  private async fetchLatestData(): Promise<void> {
    try {
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
              
              // Atualizar números armazenados
              this.lastRouletteNumbers.set(roleta.id, newNumbers);
              
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
          console.log('[RouletteFeedService] Atualizações recebidas via polling');
        }
      }
    } catch (error) {
      console.error('[RouletteFeedService] Erro ao buscar atualizações:', error);
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
      console.log(`[RouletteFeedService] Solicitando histórico completo para roleta ${roletaId}`);
      
      if (!this.socketService) {
        throw new Error('SocketService não está inicializado');
      }
      
      const historyData = await this.socketService.requestRouletteHistory(roletaId);
      
      console.log(`[RouletteFeedService] Histórico recebido: ${historyData.numeros?.length || 0} números`);
      
      // Notificar via EventService
      EventService.emit('roulette:complete-history', {
        roletaId,
        history: historyData
      });
      
      return historyData;
    } catch (error) {
      console.error('[RouletteFeedService] Erro ao obter histórico:', error);
      throw error;
    }
  }
}

export default RouletteFeedService; 