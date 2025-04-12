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
      this.logger.info(`Buscando histórico real da roleta ${rouletteName}`);
      
      // Fazer uma requisição real à API para obter os dados
      const apiUrl = `/api/ROULETTES?limit=1000`;
      this.logger.info(`Requisição para: ${apiUrl}`);
      
      const data = await fetchWithCorsSupport<any[]>(apiUrl);
      
      if (!Array.isArray(data)) {
        this.logger.error(`Resposta inválida da API: ${JSON.stringify(data)}`);
        return [];
      }
      
      this.logger.info(`Recebidos dados de ${data.length} roletas`);
      
      // Procurar a roleta específica nos dados recebidos
      const targetRoulette = data.find((roleta: any) => {
        const roletaName = roleta.nome || roleta.name || '';
        return roletaName.toLowerCase() === rouletteName.toLowerCase();
      });
      
      if (targetRoulette && targetRoulette.numero && Array.isArray(targetRoulette.numero)) {
        // Extrair apenas os números da roleta encontrada
        const processedNumbers = targetRoulette.numero
          .map((n: any) => {
            // Cada item deve ter uma propriedade 'numero'
            if (n && typeof n === 'object' && 'numero' in n) {
              return typeof n.numero === 'number' ? n.numero : parseInt(n.numero);
            }
            return null;
          })
          .filter((n: any) => n !== null && !isNaN(n) && n >= 0 && n <= 36);
        
        this.logger.info(`Processados ${processedNumbers.length} números históricos para ${rouletteName}`);
        
        // Atualizar o cache com os números reais
        this.cache[rouletteName] = {
          data: processedNumbers,
          timestamp: Date.now()
        };
        
        return processedNumbers;
      } else {
        this.logger.warn(`Roleta "${rouletteName}" não encontrada nos dados recebidos`);
        return [];
      }
    } catch (error) {
      this.logger.error(`Erro ao buscar histórico real da roleta ${rouletteName}:`, error);
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