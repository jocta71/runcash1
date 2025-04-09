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
    try {
      this.logger.info(`⛔ DESATIVADO: Busca de histórico para ${rouletteName} bloqueada para diagnóstico`);
      
      // Gerar números de fallback em vez de fazer requisição
      const fallbackNumbers = this.generateFallbackNumbers();
      
      // Atualiza o cache com os números de fallback
      this.cache[rouletteName] = {
        data: fallbackNumbers,
        timestamp: Date.now()
      };
      
      return fallbackNumbers;
      
      /* CÓDIGO ORIGINAL DESATIVADO
      this.logger.info(`Buscando histórico para ${rouletteName} da API`);
      const startTime = Date.now();
      
      // Primeiro, tenta obter do serviço global que já busca os dados
      const targetRoulette = globalRouletteDataService.getRouletteByName(rouletteName);
      
      if (targetRoulette && targetRoulette.numero && Array.isArray(targetRoulette.numero)) {
        // Extrair apenas os números da roleta encontrada
        const processedNumbers = targetRoulette.numero
          .map((n: any) => Number(n.numero))
          .filter((n: number) => !isNaN(n) && n >= 0 && n <= 36);
        
        if (processedNumbers.length > 0) {
          this.logger.info(`Obtidos ${processedNumbers.length} números do serviço global`);
          
          // Atualiza o cache
          this.cache[rouletteName] = {
            data: processedNumbers,
            timestamp: Date.now()
          };
          
          const duration = Date.now() - startTime;
          this.logger.info(`Histórico obtido para ${rouletteName} em ${duration}ms`);
          
          return processedNumbers;
        }
      }
      
      // Se não tiver no serviço global, tenta buscar diretamente
      this.logger.info(`Não encontrado no serviço global, buscando diretamente da API`);
      
      // Usar a função fetchWithCorsSupport em vez de axios
      const data = await fetchWithCorsSupport<any>(`/api/ROULETTE_HISTORY/${rouletteName}`);
      const numbers = data?.data || this.generateFallbackNumbers();
      
      // Atualiza o cache
      this.cache[rouletteName] = {
        data: numbers,
        timestamp: Date.now()
      };

      const duration = Date.now() - startTime;
      this.logger.info(`Histórico obtido para ${rouletteName} em ${duration}ms`);
      
      return numbers;
      */
    } catch (error) {
      this.logger.error(`Erro ao buscar histórico para ${rouletteName}:`, error);
      // Verificar se temos no cache mesmo expirado antes de gerar fallback
      if (this.cache[rouletteName]) {
        this.logger.info(`Usando cache expirado para ${rouletteName}`);
        return this.cache[rouletteName].data;
      }
      return this.generateFallbackNumbers();
    }
  }

  private generateFallbackNumbers(): number[] {
    return Array(300).fill(0).map(() => Math.floor(Math.random() * 37));
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