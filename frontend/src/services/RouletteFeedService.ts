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
  private pollingInterval: number = 11000; // 11 segundos, como observado no 888casino
  private pollingTimer: number | null = null;
  
  private rouletteInfo: Map<string, {
    nome: string,
    dealer?: string,
    status?: string,
    ultimaAtualizacao: number
  }> = new Map();
  
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
    
    // Configurar polling com intervalo exato do 888casino
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
    
    // Iniciar novo timer com intervalo do 888casino
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
        const agora = Date.now();
        
        response.data.forEach((roleta: any) => {
          if (roleta.id) {
            // Armazenar números
            if (roleta.numeros) {
              this.lastRouletteNumbers.set(roleta.id, roleta.numeros);
            }
            
            // Armazenar informações adicionais
            this.rouletteInfo.set(roleta.id, {
              nome: roleta.nome || `Roleta ${roleta.id}`,
              dealer: roleta.dealer,
              status: roleta.status || 'ativo',
              ultimaAtualizacao: agora
            });
          }
        });
        
        // Emitir evento de informações iniciais carregadas
        EventService.emit('roulette:initial-data-loaded', {
          tables: this.getAllRouletteTables()
        });
      }
    } catch (error) {
      console.error('[RouletteFeedService] Erro ao buscar dados iniciais:', error);
    }
  }
  
  /**
   * Busca as atualizações mais recentes usando polling
   * Lógica inspirada no 888casino
   */
  private async fetchLatestData(): Promise<void> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/api/roletas`);
      
      if (response.status === 200 && response.data) {
        let hasUpdates = false;
        const agora = Date.now();
        
        response.data.forEach((roleta: any) => {
          if (roleta.id && roleta.numeros) {
            // Comparar com os últimos números armazenados
            const previousNumbers = this.lastRouletteNumbers.get(roleta.id) || [];
            const currentNumbers = roleta.numeros;
            
            // Verificar se houve atualização
            // Usa a mesma lógica do 888casino: verificar se o primeiro número é diferente
            if (this.hasNewNumbers(previousNumbers, currentNumbers)) {
              logger.info(`Nova atualização para roleta ${roleta.id}: ${currentNumbers[0]}`);
              
              // Atualizar números armazenados
              this.lastRouletteNumbers.set(roleta.id, currentNumbers);
              
              // Atualizar informações da roleta
              this.rouletteInfo.set(roleta.id, {
                nome: roleta.nome || this.rouletteInfo.get(roleta.id)?.nome || `Roleta ${roleta.id}`,
                dealer: roleta.dealer || this.rouletteInfo.get(roleta.id)?.dealer,
                status: roleta.status || this.rouletteInfo.get(roleta.id)?.status || 'ativo',
                ultimaAtualizacao: agora
              });
              
              // Emitir evento de atualização
              EventService.emit('roulette:numbers-updated', {
                tableId: roleta.id,
                tableName: roleta.nome || this.rouletteInfo.get(roleta.id)?.nome,
                numbers: currentNumbers,
                previousNumbers: previousNumbers,
                isNewNumber: true,
                dealer: roleta.dealer,
                timestamp: agora
              });
              
              hasUpdates = true;
            } else {
              // Mesmo sem novos números, atualizar timestamp
              const info = this.rouletteInfo.get(roleta.id);
              if (info) {
                this.rouletteInfo.set(roleta.id, {
                  ...info,
                  ultimaAtualizacao: agora
                });
              }
            }
          }
        });
        
        if (hasUpdates) {
          // Notificar sobre todas as roletas atualizadas
          EventService.emit('roulette:all-tables-updated', {
            tables: this.getAllRouletteTables()
          });
        }
      }
    } catch (error) {
      console.error('[RouletteFeedService] Erro ao buscar atualizações:', error);
    }
  }
  
  /**
   * Verifica se há novos números, usando lógica semelhante ao 888casino
   */
  private hasNewNumbers(previousNumbers: string[], currentNumbers: string[]): boolean {
    // Se não temos números antigos ou atuais, não há nada a comparar
    if (!currentNumbers || currentNumbers.length === 0) {
      return false;
    }
    
    // Se não tínhamos números anteriores, tudo é novo
    if (!previousNumbers || previousNumbers.length === 0) {
      return true;
    }
    
    // Verificar se o primeiro número (mais recente) é diferente
    // Esta é a mesma lógica usada pelo 888casino
    return currentNumbers[0] !== previousNumbers[0];
  }
  
  /**
   * Retorna os últimos números conhecidos para uma mesa específica
   */
  public getLastNumbersForTable(tableId: string): string[] {
    return this.lastRouletteNumbers.get(tableId) || [];
  }
  
  /**
   * Retorna todas as mesas de roleta conhecidas
   * Versão melhorada que inclui mais informações
   */
  public getAllRouletteTables(): { tableId: string, name: string, numbers: string[], dealer?: string, status?: string, lastUpdate: number }[] {
    const result: { tableId: string, name: string, numbers: string[], dealer?: string, status?: string, lastUpdate: number }[] = [];
    
    this.lastRouletteNumbers.forEach((numbers, tableId) => {
      const info = this.rouletteInfo.get(tableId);
      
      result.push({
        tableId,
        name: info?.nome || `Roleta ${tableId}`,
        numbers,
        dealer: info?.dealer,
        status: info?.status || 'ativo',
        lastUpdate: info?.ultimaAtualizacao || Date.now()
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
  
  /**
   * Define o serviço de socket
   */
  public setSocketService(socketService: any): void {
    this.socketService = socketService;
  }
}

export default RouletteFeedService; 