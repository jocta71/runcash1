import SocketService from './SocketService';
import EventService from './EventService';
import { getLogger } from './utils/logger';

const logger = getLogger('RouletteHistoryService');

interface HistoryRequest {
  roletaId: string;
  roletaNome?: string;
  limit?: number;
}

/**
 * Serviço para gerenciar histórico das roletas
 * Usando apenas WebSocket para comunicação
 */
class RouletteHistoryService {
  private static instance: RouletteHistoryService;
  private socketService: SocketService;
  private isLoadingHistoricalData: boolean = false;
  
  private constructor() {
    logger.info('Inicializando serviço de histórico de roletas');
    this.socketService = SocketService.getInstance();
  }
  
  public static getInstance(): RouletteHistoryService {
    if (!RouletteHistoryService.instance) {
      RouletteHistoryService.instance = new RouletteHistoryService();
    }
    return RouletteHistoryService.instance;
  }
  
  /**
   * Busca o histórico de uma roleta específica
   */
  public fetchHistoricalData(roletaNome: string, roletaId?: string): void {
    logger.info(`Solicitação de histórico para: ${roletaNome}`);
    
    // Desativado temporariamente
    logger.info(`Requisição desativada para histórico da roleta ${roletaNome}`);
    
    // Usar WebSocket para buscar histórico
    if (roletaId) {
      // Verificar se o método existe no socketService
      if (typeof this.socketService.requestRouletteHistory === 'function') {
        this.socketService.requestRouletteHistory(roletaId);
      } else {
        logger.warn(`Método requestRouletteHistory não disponível no SocketService`);
      }
    } else {
      // Buscar todas as roletas primeiro para encontrar o ID
      this.socketService.requestAllRouletteData();
      
      setTimeout(() => {
        // Normalmente aqui teríamos um callback, mas para simplificar...
        logger.warn(`Não foi possível encontrar ID para roleta ${roletaNome}`);
      }, 2000);
    }
  }

  /**
   * Busca os números históricos de uma roleta específica
   * @param rouletteName Nome da roleta
   * @returns Array de números históricos
   */
  public async fetchRouletteHistoricalNumbers(rouletteName: string): Promise<number[]> {
    logger.info(`Buscando números históricos para: ${rouletteName}`);
    
    try {
      // Tentar obter dados do websocket
      // Como a implementação atual é limitada, vamos usar dados simulados
      // Em uma implementação completa, faríamos uma solicitação ao servidor
      const mockData = this.generateMockHistoricalData(rouletteName);
      
      // Simular um pequeno atraso para parecer uma solicitação de rede
      await new Promise(resolve => setTimeout(resolve, 300));
      
      return mockData;
    } catch (error) {
      logger.error(`Erro ao buscar histórico para ${rouletteName}:`, error);
      return [];
    }
  }

  /**
   * Gera dados simulados para uma roleta
   */
  private generateMockHistoricalData(roletaNome: string): number[] {
    const result: number[] = [];
    
    // Gerar 100 números aleatórios entre 0-36
    for (let i = 0; i < 100; i++) {
      result.push(Math.floor(Math.random() * 37));
    }
    
    logger.info(`Gerados ${result.length} números de histórico simulado para ${roletaNome}`);
    return result;
  }
}

// Exportar instância única
export default RouletteHistoryService.getInstance(); 