import axios from 'axios';
import config from '@/config/env';
import EventService from './EventService';
import { ENDPOINTS } from '../config/constants';
import { Logger } from './utils/logger';

const logger = new Logger('RouletteFeedService');

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
            
            // DEBUG: Log para verificar diferenças
            console.log(`[RouletteFeedService] Comparando números para ${tableData.Name}:`, {
              novos: lastNumbers.slice(0, 5),
              anteriores: previousNumbers.slice(0, 5),
              saoIguais: JSON.stringify(lastNumbers) === JSON.stringify(previousNumbers)
            });
            
            // Verificar se há novos números - usando verificação mais rigorosa
            // Só considera igual se mesmo comprimento e mesmo conteúdo
            const hasNewNumbers = lastNumbers.length !== previousNumbers.length || 
                                 lastNumbers.some((num, idx) => num !== previousNumbers[idx]);
            
            // Se há diferença, atualizar os dados
            if (hasNewNumbers) {
              console.log(`[RouletteFeedService] NOVOS NÚMEROS detectados para ${tableData.Name}:`, {
                primeiro_novo: lastNumbers[0],
                primeiro_anterior: previousNumbers[0]
              });
              
              // Atualizar os números armazenados
              this.lastRouletteNumbers.set(tableId, [...lastNumbers]); // Clone do array para evitar referências
              
              // Emitir evento com novos dados - especificar explicitamente que há novos números
              EventService.emit('roulette:numbers-updated', {
                tableId,
                tableName: tableData.Name,
                numbers: lastNumbers,
                dealer: tableData.Dealer,
                players: tableData.Players,
                isNewNumber: true // Indicar explicitamente que há novos números
              });
              
              // Se o primeiro número é diferente, emitir evento específico de novo número
              if (lastNumbers.length > 0 && (previousNumbers.length === 0 || lastNumbers[0] !== previousNumbers[0])) {
                console.log(`[RouletteFeedService] NOVO NÚMERO PRINCIPAL detectado: ${lastNumbers[0]}`);
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
   * Atualiza manualmente os números de uma mesa específica
   */
  public updateTableNumbers(tableId: string, numbers: string[]): void {
    // Obtém os números anteriores
    const previousNumbers = this.lastRouletteNumbers.get(tableId) || [];
    
    // Verifica se há alteração real nos dados
    if (JSON.stringify(numbers) !== JSON.stringify(previousNumbers)) {
      console.log(`[RouletteFeedService] Atualizando manualmente números para mesa ${tableId}:`, {
        novos: numbers.slice(0, 5),
        anteriores: previousNumbers.slice(0, 5)
      });
      
      // Atualiza o mapa de números
      this.lastRouletteNumbers.set(tableId, numbers);
      
      // Emite evento de atualização
      const hasNewNumber = numbers.length > 0 && 
                          (previousNumbers.length === 0 || 
                           numbers[0] !== previousNumbers[0]);
      
      EventService.emit('roulette:numbers-updated', {
        tableId,
        numbers,
        isNewNumber: hasNewNumber
      });
      
      // Se temos um novo número, emite evento específico
      if (hasNewNumber) {
        EventService.emit('roulette:new-number', {
          tableId,
          number: numbers[0]
        });
      }
    }
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
   * Processa tabelas ao vivo para identificar números novos
   */
  private processLiveTables(tables: any[]): void {
    try {
      if (!tables || !Array.isArray(tables) || tables.length === 0) {
        return;
      }

      tables.forEach(table => {
        try {
          const tableName = table.Name ? String(table.Name) : '';
          // Verifica se é uma mesa de roleta
          if (!tableName.toLowerCase().includes('roulette') || !table.RouletteLastNumbers) {
            return;
          }

          const tableId = table.Id;
          const currentNumbers = table.RouletteLastNumbers;

          // Resto do processamento
          // ... existing code ...
        } catch (error) {
          logger.error(`Erro ao processar mesa ${table?.Id || 'desconhecida'}:`, error);
        }
      });
    } catch (error) {
      logger.error('Erro ao processar tabelas ao vivo:', error);
    }
  }
}

export default RouletteFeedService; 