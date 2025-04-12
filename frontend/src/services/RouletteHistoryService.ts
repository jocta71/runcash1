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
      this.logger.info(`Buscando histórico para roleta ${rouletteName} da API`);
      
      // Tentar primeira abordagem: endpoint específico para histórico por nome
      try {
        const historyEndpoint = `/api/roulettes/history/${encodeURIComponent(rouletteName)}`;
        this.logger.debug(`Tentando endpoint ${historyEndpoint}`);
        
        const historyData = await fetchWithCorsSupport<any>(historyEndpoint);
        
        if (historyData && historyData.numeros && Array.isArray(historyData.numeros)) {
          // Processar os números retornados
          const numbers = historyData.numeros
            .map((n: any) => (typeof n === 'object' ? n.numero : n))
            .filter((n: any) => !isNaN(Number(n)) && Number(n) >= 0 && Number(n) <= 36)
            .map((n: any) => Number(n));
          
          this.logger.info(`Obtidos ${numbers.length} números históricos para ${rouletteName}`);
          
          // Atualiza o cache
          this.cache[rouletteName] = {
            data: numbers,
            timestamp: Date.now()
          };
          
          return numbers;
        }
      } catch (error) {
        this.logger.warn(`Primeira abordagem falhou para ${rouletteName}:`, error);
        // Continue para próxima abordagem...
      }
      
      // Segunda abordagem: buscar todos os dados e filtrar
      try {
        // Obter dados detalhados do serviço global (que já tem dados históricos)
        const detailedData = await globalRouletteDataService.fetchDetailedRouletteData();
        
        // Encontrar a roleta específica por nome
        const targetRoulette = detailedData.find(r => 
          (r.nome && r.nome.toLowerCase() === rouletteName.toLowerCase()) || 
          (r.name && r.name.toLowerCase() === rouletteName.toLowerCase())
        );
        
        if (targetRoulette && targetRoulette.numero && Array.isArray(targetRoulette.numero)) {
          // Extrair apenas os números
          const numbers = targetRoulette.numero
            .map((n: any) => Number(n.numero || n.number))
            .filter((n: number) => !isNaN(n) && n >= 0 && n <= 36);
          
          this.logger.info(`Obtidos ${numbers.length} números históricos para ${rouletteName} do serviço global`);
          
          // Atualiza o cache
          this.cache[rouletteName] = {
            data: numbers,
            timestamp: Date.now()
          };
          
          return numbers;
        }
      } catch (error) {
        this.logger.warn(`Segunda abordagem falhou para ${rouletteName}:`, error);
        // Continue para próxima abordagem...
      }
      
      // Se todas as abordagens falharam, retornar array vazio
      this.logger.warn(`Todas as abordagens falharam para obter histórico de ${rouletteName}`);
      
      const emptyNumbers: number[] = [];
      
      // Atualiza o cache com array vazio
      this.cache[rouletteName] = {
        data: emptyNumbers,
        timestamp: Date.now()
      };
      
      return emptyNumbers;
    } catch (error) {
      this.logger.error(`Erro ao buscar histórico para ${rouletteName}:`, error);
      return [];
    }
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