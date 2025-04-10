import { getLogger } from './utils/logger';
import { fetchWithCorsSupport } from '../utils/api-helpers';
import globalRouletteDataService from './GlobalRouletteDataService';

export interface RouletteHistoricalNumber {
  rouletteName: string;
  numbers: number[];
}

type RouletteHistoryCache = {
  [key: string]: {
    data: number[];
    timestamp: number;
  }
};

/**
 * Serviço centralizado para buscas de histórico de roletas
 * Implementa padrão Singleton, cache e controle de requisições duplicadas
 */
export class RouletteHistoryService {
  private static instance: RouletteHistoryService;
  private cache: RouletteHistoryCache = {};
  private pendingRequests: Map<string, Promise<number[]>> = new Map();
  private CACHE_TTL = 60000; // 1 minuto
  private logger = getLogger('RouletteHistoryService');

  private constructor() {
    this.logger.info('Inicializando serviço de histórico de roletas');
  }

  public static getInstance(): RouletteHistoryService {
    if (!RouletteHistoryService.instance) {
      RouletteHistoryService.instance = new RouletteHistoryService();
    }
    return RouletteHistoryService.instance;
  }

  /**
   * Busca os números históricos de uma roleta específica
   * Centraliza as requisições e implementa cache para evitar chamadas duplicadas
   */
  public async fetchRouletteHistoricalNumbers(rouletteName: string): Promise<number[]> {
    this.logger.info(`Solicitação de histórico para: ${rouletteName}`);
    
    // Verifica se há dados em cache válidos
    if (this.cache[rouletteName] && 
        Date.now() - this.cache[rouletteName].timestamp < this.CACHE_TTL) {
      this.logger.debug(`Usando cache para ${rouletteName}`);
      return this.cache[rouletteName].data;
    }

    // Verifica se já existe uma requisição pendente para esta roleta
    if (this.pendingRequests.has(rouletteName)) {
      this.logger.debug(`Reutilizando requisição pendente para ${rouletteName}`);
      return this.pendingRequests.get(rouletteName)!;
    }

    // Cria uma nova requisição
    const fetchPromise = this.doFetchHistoricalNumbers(rouletteName);
    this.pendingRequests.set(rouletteName, fetchPromise);
    
    try {
      const result = await fetchPromise;
      return result;
    } finally {
      // Remove a requisição da lista de pendentes após concluída
      this.pendingRequests.delete(rouletteName);
    }
  }

  private async doFetchHistoricalNumbers(rouletteName: string): Promise<number[]> {
    console.log(`[RouletteHistoryService] Requisição desativada para histórico da roleta ${rouletteName}`);
    
    // Retornar um array vazio em vez de gerar números aleatórios
    const emptyNumbers: number[] = [];
    
    // Simulando um atraso para evitar loop infinito
    await new Promise(resolve => setTimeout(resolve, 200));
  
    // Atualiza o cache com array vazio
    this.cache[rouletteName] = {
      data: emptyNumbers,
      timestamp: Date.now()
    };
    
    return emptyNumbers;
  }

  /**
   * Limpa o cache para uma roleta específica ou para todas
   */
  public clearCache(rouletteName?: string): void {
    if (rouletteName) {
      delete this.cache[rouletteName];
      this.logger.info(`Cache limpo para ${rouletteName}`);
    } else {
      this.cache = {};
      this.logger.info('Cache completamente limpo');
    }
  }
}

// Exportar a instância única
const rouletteHistoryService = RouletteHistoryService.getInstance();
export default rouletteHistoryService; 