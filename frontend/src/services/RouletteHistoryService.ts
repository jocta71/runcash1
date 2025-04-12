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
      this.logger.info(`[HISTÓRICO-SERVICE] Buscando histórico para roleta ${rouletteName}`);
      
      // Primeira e principal estratégia: usar o serviço global detalhado
      this.logger.info(`[HISTÓRICO-SERVICE] Usando serviço global detalhado (até 1000 números)`);
      try {
        // Obter dados detalhados do serviço global (até 1000 números por roleta)
        const detailedData = await globalRouletteDataService.fetchDetailedRouletteData();
        this.logger.info(`[HISTÓRICO-SERVICE] Recebidas ${detailedData.length} roletas com dados detalhados`);
        
        // Encontrar a roleta específica por nome
        const targetRoulette = detailedData.find(r => 
          (r.nome && r.nome.toLowerCase() === rouletteName.toLowerCase()) || 
          (r.name && r.name.toLowerCase() === rouletteName.toLowerCase())
        );
        
        if (targetRoulette) {
          this.logger.info(`[HISTÓRICO-SERVICE] Roleta encontrada: ${targetRoulette.nome || targetRoulette.name}`);
          
          if (targetRoulette.numero && Array.isArray(targetRoulette.numero)) {
            // Extrair apenas os números
            const numbers = targetRoulette.numero
              .map((n: any) => Number(n.numero || n.number))
              .filter((n: number) => !isNaN(n) && n >= 0 && n <= 36);
            
            this.logger.info(`[HISTÓRICO-SERVICE] Processados ${numbers.length} números históricos válidos`);
            
            if (numbers.length > 0) {
              // Atualiza o cache
              this.cache[rouletteName] = {
                data: numbers,
                timestamp: Date.now()
              };
              
              return numbers;
            } else {
              this.logger.warn(`[HISTÓRICO-SERVICE] Array vazio após processamento`);
            }
          } else {
            this.logger.warn(`[HISTÓRICO-SERVICE] Roleta sem array de números válido`);
          }
        } else {
          this.logger.warn(`[HISTÓRICO-SERVICE] Roleta '${rouletteName}' não encontrada nos dados detalhados`);
        }
      } catch (error) {
        this.logger.warn(`[HISTÓRICO-SERVICE] Erro ao usar serviço global:`, error);
      }
      
      // Segunda estratégia (fallback): usar o endpoint específico de histórico
      // Mantido como plano B, mesmo sabendo que está falhando atualmente
      this.logger.info(`[HISTÓRICO-SERVICE] Tentando endpoint específico como fallback`);
      try {
        const historyEndpoint = `/api/roulettes/history/${encodeURIComponent(rouletteName)}`;
        const historyData = await fetchWithCorsSupport<any>(historyEndpoint);
        
        if (historyData && historyData.numeros && Array.isArray(historyData.numeros)) {
          const numbers = historyData.numeros
            .map((n: any) => (typeof n === 'object' ? n.numero : n))
            .filter((n: any) => !isNaN(Number(n)) && Number(n) >= 0 && Number(n) <= 36)
            .map((n: any) => Number(n));
          
          this.logger.info(`[HISTÓRICO-SERVICE] Obtidos ${numbers.length} números do endpoint específico`);
          
          // Atualiza o cache
          this.cache[rouletteName] = {
            data: numbers,
            timestamp: Date.now()
          };
          
          return numbers;
        }
      } catch (error) {
        this.logger.warn(`[HISTÓRICO-SERVICE] Endpoint específico falhou:`, error);
      }
      
      // Terceira estratégia: obter dados básicos
      this.logger.info(`[HISTÓRICO-SERVICE] Usando dados básicos como último recurso`);
      try {
        const basicData = globalRouletteDataService.getRouletteByName(rouletteName);
        
        if (basicData && basicData.numero && Array.isArray(basicData.numero)) {
          const basicNumbers = basicData.numero
            .map((n: any) => Number(n.numero || n.number))
            .filter((n: number) => !isNaN(n) && n >= 0 && n <= 36);
          
          this.logger.info(`[HISTÓRICO-SERVICE] Obtidos ${basicNumbers.length} números dos dados básicos`);
          
          // Atualiza o cache
          this.cache[rouletteName] = {
            data: basicNumbers,
            timestamp: Date.now()
          };
          
          return basicNumbers;
        }
      } catch (error) {
        this.logger.warn(`[HISTÓRICO-SERVICE] Erro ao usar dados básicos:`, error);
      }
      
      // Se todas as abordagens falharam, retornar array vazio
      this.logger.warn(`[HISTÓRICO-SERVICE] Todas as abordagens falharam para ${rouletteName}`);
      this.logger.warn(`[HISTÓRICO-SERVICE] Provável indisponibilidade do banco de dados`);
      
      const emptyNumbers: number[] = [];
      
      // Atualiza o cache com array vazio, mas com TTL reduzido para tentar novamente em breve
      this.cache[rouletteName] = {
        data: emptyNumbers,
        timestamp: Date.now() - (this.CACHE_TTL / 2) // Reduzir o tempo de vida do cache
      };
      
      return emptyNumbers;
    } catch (error) {
      this.logger.error(`[HISTÓRICO-SERVICE] Erro crítico ao buscar histórico:`, error);
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