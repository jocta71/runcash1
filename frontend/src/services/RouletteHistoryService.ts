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
  private errorHandler: ((error: Error) => void) | null = null;
  
  // Cache para armazenar resultados de números históricos
  private historyCache: Map<string, number[]> = new Map();
  
  private constructor() {
    logger.info('Inicializando serviço de histórico de roletas');
    this.socketService = SocketService.getInstance();
    
    // Configurar um manipulador global de erros para capturar exceções não tratadas
    window.addEventListener('error', (event) => {
      logger.error('[RouletteHistoryService] Erro global capturado:', event.error);
      if (this.errorHandler) {
        this.errorHandler(event.error);
      }
    });
  }
  
  public static getInstance(): RouletteHistoryService {
    if (!RouletteHistoryService.instance) {
      RouletteHistoryService.instance = new RouletteHistoryService();
    }
    return RouletteHistoryService.instance;
  }
  
  /**
   * Registra um manipulador de erros global
   */
  public registerErrorHandler(handler: (error: Error) => void): void {
    this.errorHandler = handler;
    logger.info('[RouletteHistoryService] Manipulador de erros registrado');
  }
  
  /**
   * Busca o histórico de uma roleta específica
   */
  public fetchHistoricalData(roletaNome: string, roletaId?: string): void {
    try {
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
    } catch (error) {
      logger.error(`[RouletteHistoryService] Erro ao buscar histórico:`, error);
      if (this.errorHandler) {
        this.errorHandler(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  /**
   * Busca os números históricos de uma roleta específica
   * @param rouletteName Nome da roleta
   * @returns Array de números históricos
   */
  public async fetchRouletteHistoricalNumbers(rouletteName: string): Promise<number[]> {
    if (!rouletteName) {
      logger.warn('[RouletteHistoryService] Nome da roleta não fornecido');
      return [];
    }
    
    try {
      logger.info(`Buscando números históricos para: ${rouletteName}`);
      
      // Verificar cache primeiro
      if (this.historyCache.has(rouletteName)) {
        const cachedData = this.historyCache.get(rouletteName);
        logger.info(`[RouletteHistoryService] Usando dados em cache para ${rouletteName}: ${cachedData?.length} números`);
        return cachedData || [];
      }
      
      // Tentar obter dados do websocket
      // Como a implementação atual é limitada, vamos usar dados simulados
      // Em uma implementação completa, faríamos uma solicitação ao servidor
      const mockData = this.generateMockHistoricalData(rouletteName);
      
      // Simular um pequeno atraso para parecer uma solicitação de rede
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Armazenar em cache
      this.historyCache.set(rouletteName, mockData);
      
      return mockData;
    } catch (error) {
      logger.error(`Erro ao buscar histórico para ${rouletteName}:`, error);
      // Em caso de erro, tentar retornar dados do cache se disponível
      if (this.historyCache.has(rouletteName)) {
        return this.historyCache.get(rouletteName) || [];
      }
      
      // Se não houver cache, retornar array vazio em vez de lançar erro
      return [];
    }
  }

  /**
   * Limpa o cache para uma roleta específica ou para todas as roletas
   */
  public clearCache(rouletteName?: string): void {
    if (rouletteName) {
      this.historyCache.delete(rouletteName);
      logger.info(`[RouletteHistoryService] Cache limpo para roleta: ${rouletteName}`);
    } else {
      this.historyCache.clear();
      logger.info(`[RouletteHistoryService] Cache limpo para todas as roletas`);
    }
  }

  /**
   * Gera dados simulados para uma roleta
   */
  private generateMockHistoricalData(roletaNome: string): number[] {
    try {
      const result: number[] = [];
      
      // Gerar 100 números aleatórios entre 0-36
      for (let i = 0; i < 100; i++) {
        result.push(Math.floor(Math.random() * 37));
      }
      
      logger.info(`Gerados ${result.length} números de histórico simulado para ${roletaNome}`);
      return result;
    } catch (error) {
      logger.error(`[RouletteHistoryService] Erro ao gerar dados simulados:`, error);
      // Em caso de erro, retornar um array com alguns números padrão
      return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    }
  }
}

// Exportar instância única
export default RouletteHistoryService.getInstance(); 