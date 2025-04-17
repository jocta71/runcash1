import rouletteHistoryService from './RouletteHistoryService';
import { getLogger } from './utils/logger';

const logger = getLogger('RouletteHistoryStats');

// Cache para as estatísticas calculadas
interface StatsCache {
  [key: string]: {
    data: any;
    timestamp: number;
  }
}

class RouletteStatisticsService {
  private static instance: RouletteStatisticsService;
  private statsCache: StatsCache = {};
  private CACHE_TTL = 30000; // 30 segundos
  
  private constructor() {
    logger.info('Inicializando serviço de estatísticas de roletas');
  }
  
  public static getInstance(): RouletteStatisticsService {
    if (!RouletteStatisticsService.instance) {
      RouletteStatisticsService.instance = new RouletteStatisticsService();
    }
    return RouletteStatisticsService.instance;
  }
  
  /**
   * Gera dados de frequência para os números da roleta
   */
  public generateFrequencyData(numbers: number[]) {
    const cacheKey = `frequency-${numbers.length}-${numbers.slice(0, 5).join('')}`;
    
    // Verificar cache
    if (this.isCacheValid(cacheKey)) {
      logger.debug(`Usando cache para frequência`);
      return this.statsCache[cacheKey].data;
    }
    
    const frequency: Record<number, number> = {};
    
    // Initialize all roulette numbers (0-36)
    for (let i = 0; i <= 36; i++) {
      frequency[i] = 0;
    }
    
    // Count frequency of each number
    numbers.forEach(num => {
      if (frequency[num] !== undefined) {
        frequency[num]++;
      }
    });
    
    // Convert to array format needed for charts
    const result = Object.keys(frequency).map(key => ({
      number: parseInt(key),
      frequency: frequency[parseInt(key)]
    })).sort((a, b) => a.number - b.number);
    
    // Guardar em cache
    this.statsCache[cacheKey] = {
      data: result,
      timestamp: Date.now()
    };
    
    return result;
  }
  
  /**
   * Calcula números quentes e frios com base nos dados de frequência
   */
  public getHotColdNumbers(frequencyData: {number: number, frequency: number}[]) {
    const cacheKey = `hotcold-${frequencyData.length}-${frequencyData[0]?.frequency || 0}`;
    
    // Verificar cache
    if (this.isCacheValid(cacheKey)) {
      logger.debug(`Usando cache para hot/cold`);
      return this.statsCache[cacheKey].data;
    }
    
    const sorted = [...frequencyData].sort((a, b) => b.frequency - a.frequency);
    const result = {
      hot: sorted.slice(0, 5),  // 5 most frequent
      cold: sorted.slice(-5).reverse()  // 5 least frequent
    };
    
    // Guardar em cache
    this.statsCache[cacheKey] = {
      data: result,
      timestamp: Date.now()
    };
    
    return result;
  }
  
  /**
   * Gera dados de distribuição por grupos (cores)
   */
  public generateGroupDistribution(numbers: number[]) {
    const cacheKey = `distribution-${numbers.length}-${numbers.slice(0, 5).join('')}`;
    
    // Verificar cache
    if (this.isCacheValid(cacheKey)) {
      logger.debug(`Usando cache para distribuição`);
      return this.statsCache[cacheKey].data;
    }
    
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const groups = [
      { name: "Vermelhos", value: 0, color: "#ef4444" },
      { name: "Pretos", value: 0, color: "#111827" },
      { name: "Zero", value: 0, color: "#059669" },
    ];
    
    numbers.forEach(num => {
      if (num === 0) {
        groups[2].value += 1;
      } else if (redNumbers.includes(num)) {
        groups[0].value += 1;
      } else {
        groups[1].value += 1;
      }
    });
    
    // Guardar em cache
    this.statsCache[cacheKey] = {
      data: groups,
      timestamp: Date.now()
    };
    
    return groups;
  }
  
  /**
   * Gera estatísticas de cores por hora
   */
  public generateColorHourlyStats(numbers: number[]) {
    const cacheKey = `colorstats-${numbers.length}-${numbers.slice(0, 5).join('')}`;
    
    // Verificar cache
    if (this.isCacheValid(cacheKey)) {
      logger.debug(`Usando cache para stats de cores por hora`);
      return this.statsCache[cacheKey].data;
    }
    
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const total = numbers.length;
    
    // Contar números por cor
    const redCount = numbers.filter(num => redNumbers.includes(num)).length;
    const blackCount = numbers.filter(num => num !== 0 && !redNumbers.includes(num)).length;
    const zeroCount = numbers.filter(num => num === 0).length;
    
    // Calcular média por hora (assumindo que temos dados de uma hora)
    // Para um cenário real, usaríamos dados com timestamps
    const redAverage = parseFloat((redCount / (total / 60)).toFixed(2));
    const blackAverage = parseFloat((blackCount / (total / 60)).toFixed(2));
    const zeroAverage = parseFloat((zeroCount / (total / 60)).toFixed(2));
    
    const result = [
      {
        name: "Média de vermelhos por hora",
        value: redAverage,
        color: "#ef4444",
        total: redCount,
        percentage: parseFloat(((redCount / total) * 100).toFixed(2))
      },
      {
        name: "Média de pretos por hora",
        value: blackAverage,
        color: "#111827",
        total: blackCount,
        percentage: parseFloat(((blackCount / total) * 100).toFixed(2))
      },
      {
        name: "Média de brancos por hora",
        value: zeroAverage,
        color: "#059669",
        total: zeroCount,
        percentage: parseFloat(((zeroCount / total) * 100).toFixed(2))
      }
    ];
    
    // Guardar em cache
    this.statsCache[cacheKey] = {
      data: result,
      timestamp: Date.now()
    };
    
    return result;
  }
  
  /**
   * Retorna a cor CSS para um número da roleta
   */
  public getRouletteNumberColor(num: number) {
    if (num === 0) return "bg-green-600 text-white";
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return redNumbers.includes(num) ? "bg-red-600 text-white" : "bg-transparent text-white";
  }
  
  /**
   * Verifica se um cache específico ainda é válido
   */
  private isCacheValid(key: string): boolean {
    return (
      this.statsCache[key] &&
      Date.now() - this.statsCache[key].timestamp < this.CACHE_TTL
    );
  }
  
  /**
   * Limpa o cache de estatísticas
   */
  public clearCache(): void {
    this.statsCache = {};
    logger.info('Cache de estatísticas limpo');
  }
}

// Exportar a instância única do serviço
const rouletteStatisticsService = RouletteStatisticsService.getInstance();
export default rouletteStatisticsService; 