import axios from 'axios';
import config from '@/config/env';
import EventService from './EventService';
import { Logger } from './utils/logger';
import { HistoryData } from './SocketService';
import SSEService from './SSEService';

const logger = new Logger('RouletteFeedService');

class RouletteFeedService {
  private static instance: RouletteFeedService;
  private apiBaseUrl: string;
  private lastRouletteNumbers: Map<string, string[]> = new Map();
  private socketService: any;
  private sseService: SSEService;
  
  constructor() {
    this.apiBaseUrl = config.apiBaseUrl;
    this.sseService = SSEService.getInstance();
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
    
    // Configurar listener para novos números via SSE
    EventService.on('roulette:new-number', (data) => {
      this.handleNewNumber(data);
    });
  }
  
  /**
   * Para o serviço de feed
   */
  public stop(): void {
    console.log('[RouletteFeedService] Parando serviço de feed de roletas');
    this.sseService.disconnect();
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
   * Processa um novo número recebido via SSE
   */
  private handleNewNumber(data: any): void {
    const { tableId, number } = data;
    
    if (!tableId || number === undefined) {
      console.error('[RouletteFeedService] Dados inválidos recebidos:', data);
      return;
    }
    
    // Obter números anteriores
    const previousNumbers = this.lastRouletteNumbers.get(tableId) || [];
    
    // Criar nova sequência de números
    const newNumbers = [number, ...previousNumbers].slice(0, 5);
    
    // Atualizar números armazenados
    this.lastRouletteNumbers.set(tableId, newNumbers);
    
    // Emitir evento de atualização
    EventService.emit('roulette:numbers-updated', {
      tableId,
      numbers: newNumbers,
      isNewNumber: true
    });
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