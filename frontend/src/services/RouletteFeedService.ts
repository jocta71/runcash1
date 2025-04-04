import axios from 'axios';
import config from '@/config/env';
import EventService from './EventService';

// Configurações
const POLLING_INTERVAL = 5000; // 5 segundos entre cada verificação

class RouletteFeedService {
  private static instance: RouletteFeedService;
  private pollingIntervalId: number | null = null;
  private isPolling: boolean = false;
  private apiBaseUrl: string;
  private lastRouletteNumbers: Map<string, string[]> = new Map();
  
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
   * Inicia polling regular para buscar dados de roletas
   */
  public startPolling(): void {
    if (this.isPolling) {
      console.log('[RouletteFeedService] Polling já está em execução');
      return;
    }
    
    console.log('[RouletteFeedService] Iniciando polling regular de dados');
    this.isPolling = true;
    
    // Executar imediatamente a primeira vez
    this.fetchLiveTableData();
    
    // Configurar intervalo para execuções periódicas
    this.pollingIntervalId = window.setInterval(() => {
      this.fetchLiveTableData();
    }, POLLING_INTERVAL);
  }
  
  /**
   * Para o polling de dados
   */
  public stopPolling(): void {
    if (this.pollingIntervalId !== null) {
      window.clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    this.isPolling = false;
    console.log('[RouletteFeedService] Polling parado');
  }
  
  /**
   * Busca dados de todas as mesas de roleta ativas
   */
  private async fetchLiveTableData(): Promise<void> {
    try {
      const response = await axios.post(`${this.apiBaseUrl}/live-tables`);
      
      if (response.status === 200 && response.data) {
        const liveTables = response.data.LiveTables || {};
        
        // Processar cada mesa de roleta
        Object.entries(liveTables).forEach(([tableId, tableData]: [string, any]) => {
          // Verificar se é uma mesa de roleta
          if (tableData.Name && tableData.Name.toLowerCase().includes('roulette') && 
              tableData.RouletteLastNumbers && Array.isArray(tableData.RouletteLastNumbers)) {
            
            const lastNumbers = tableData.RouletteLastNumbers;
            const previousNumbers = this.lastRouletteNumbers.get(tableId) || [];
            
            // Verificar se há novos números
            if (JSON.stringify(lastNumbers) !== JSON.stringify(previousNumbers)) {
              // Atualizar os números armazenados
              this.lastRouletteNumbers.set(tableId, lastNumbers);
              
              // Emitir evento com novos dados
              EventService.emit('roulette:numbers-updated', {
                tableId,
                tableName: tableData.Name,
                numbers: lastNumbers,
                dealer: tableData.Dealer,
                players: tableData.Players
              });
              
              // Se o primeiro número é diferente, emitir evento específico de novo número
              if (lastNumbers[0] !== previousNumbers[0]) {
                EventService.emit('roulette:new-number', {
                  tableId,
                  tableName: tableData.Name,
                  number: lastNumbers[0]
                });
              }
            }
          }
        });
      }
    } catch (error) {
      console.error('[RouletteFeedService] Erro ao buscar dados das mesas:', error);
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
}

export default RouletteFeedService; 