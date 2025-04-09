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
      this.socketService.requestRouletteHistory(roletaId, roletaNome);
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
export default RouletteHistoryService; 