import { RouletteApi, RouletteData as ApiRouletteData } from '../api/rouletteApi';
import { getLogger } from '../utils/logger';

// Logger para o repositório
const Logger = getLogger('Repository');

// Tipagem para os dados de roleta padronizados
export interface RouletteData {
  id: string;
  roleta_id: string;
  nome: string;
  numeros: Array<{
    numero: number | string;
    cor?: string;
    timestamp?: string;
  }>;
  vitorias: number;
  derrotas: number;
  estado_estrategia?: string;
  ativo?: boolean;
}

// Cache local para otimizar requisições
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 30000; // 30 segundos para atualizações mais frequentes

// Rastreamento de requisições pendentes para evitar chamadas duplicadas
const pendingRequests = new Map<string, Promise<any>>();

/**
 * Transforma os dados da API no formato padronizado
 * @param data Dados da API
 * @returns Dados normalizados
 */
function transformRouletteData(data: ApiRouletteData): RouletteData {
  if (!data) {
    Logger.error('Dados inválidos recebidos para transformação');
    return {
      id: '',
      roleta_id: '',
      nome: 'Roleta Inválida',
      numeros: [],
      vitorias: 0,
      derrotas: 0
    };
  }
  
  // Extrair ID da roleta
  const id = data.roleta_id || data.id || data._id || '';
  
  // Extrair nome
  const nome = data.nome || data.name || `Roleta ${id}`;
  
  // Extrair números
  let numeros: Array<{numero: number | string, cor?: string, timestamp?: string}> = [];
  
  if (data.numeros && Array.isArray(data.numeros)) {
    numeros = data.numeros.map(num => ({
      numero: num.numero,
      cor: typeof num.cor !== 'undefined' ? num.cor : undefined,
      timestamp: typeof num.timestamp !== 'undefined' ? String(num.timestamp) : undefined
    }));
  } else if (data.lastNumbers && Array.isArray(data.lastNumbers)) {
    numeros = data.lastNumbers.map(num => ({
      numero: num.numero,
      cor: typeof num.cor !== 'undefined' ? num.cor : undefined,
      timestamp: typeof num.timestamp !== 'undefined' ? String(num.timestamp) : undefined
    }));
  }
  
  // Extrair estatísticas
  const vitorias = typeof data.vitorias === 'number' ? data.vitorias : 0;
  const derrotas = typeof data.derrotas === 'number' ? data.derrotas : 0;
  
  return {
    id,
    roleta_id: id,
    nome,
    numeros,
    vitorias,
    derrotas,
    estado_estrategia: data.estado_estrategia,
    ativo: data.active
  };
}

/**
 * Repositório para gerenciar dados de roletas
 */
const rouletteRepository = {
  /**
   * Limpa o cache de dados
   */
  clearCache() {
    cache.clear();
    Logger.info('Cache limpo');
  },
  
  /**
   * Busca todas as roletas disponíveis com seus números
   * @returns Array de objetos de roleta padronizados
   */
  async fetchAllRoulettesWithNumbers(): Promise<RouletteData[]> {
    try {
      const cacheKey = 'all_roulettes_with_numbers';
      
      // Verificar cache
      if (cache.has(cacheKey)) {
        const cacheEntry = cache.get(cacheKey)!;
        if (Date.now() - cacheEntry.timestamp < CACHE_TTL) {
          Logger.debug('Usando dados em cache para todas as roletas');
          return cacheEntry.data;
        }
      }
      
      // Verificar se já existe uma requisição pendente
      if (pendingRequests.has(cacheKey)) {
        Logger.debug('Reaproveitando requisição pendente para todas as roletas');
        return pendingRequests.get(cacheKey)!;
      }
      
      Logger.info('Buscando todas as roletas com seus números');
      
      // Criar nova requisição e armazenar a promessa
      const requestPromise = new Promise<RouletteData[]>(async (resolve) => {
        try {
          // Buscar dados da API
          const rawData = await RouletteApi.fetchAllRoulettes();
          
          if (!Array.isArray(rawData)) {
            Logger.error('Resposta inválida da API:', rawData);
            resolve([]);
            return;
          }
          
          // Transformar dados para o formato padronizado
          const transformedData = rawData.map(roulette => transformRouletteData(roulette));
          
          // Salvar em cache
          cache.set(cacheKey, {
            data: transformedData,
            timestamp: Date.now()
          });
          
          Logger.info(`✅ Obtidas ${transformedData.length} roletas processadas`);
          resolve(transformedData);
        } catch (error) {
          Logger.error('Erro ao buscar roletas:', error);
          resolve([]);
        } finally {
          // Remover do mapa de requisições pendentes após conclusão
          pendingRequests.delete(cacheKey);
        }
      });
      
      // Salvar a promessa no mapa de requisições pendentes
      pendingRequests.set(cacheKey, requestPromise);
      
      return requestPromise;
    } catch (error) {
      Logger.error('Erro ao buscar roletas:', error);
      return [];
    }
  },
  
  /**
   * Busca uma roleta específica pelo ID
   * @param id ID da roleta
   * @returns Objeto da roleta ou null se não encontrada
   */
  async fetchRouletteById(id: string): Promise<RouletteData | null> {
    try {
      if (!id) {
        Logger.error('ID de roleta não fornecido');
        return null;
      }
      
      const cacheKey = `roulette_${id}`;
      
      // Verificar cache
      if (cache.has(cacheKey)) {
        const cacheEntry = cache.get(cacheKey)!;
        if (Date.now() - cacheEntry.timestamp < CACHE_TTL) {
          Logger.debug(`Usando dados em cache para roleta ${id}`);
          return cacheEntry.data;
        }
      }
      
      Logger.info(`Buscando roleta com ID: ${id}`);
      
      // Tentar buscar a roleta específica
      const rawData = await RouletteApi.fetchRouletteById(id);
      
      if (rawData) {
        // Transformar para o formato padronizado
        const transformedData = transformRouletteData(rawData);
        
        // Salvar em cache
        cache.set(cacheKey, {
          data: transformedData,
          timestamp: Date.now()
        });
        
        return transformedData;
      }
      
      // Caso não encontre, tentar buscar em todas as roletas
      const allRoulettes = await this.fetchAllRoulettesWithNumbers();
      const foundRoulette = allRoulettes.find(r => r.roleta_id === id || r.id === id);
      
      if (foundRoulette) {
        // Salvar em cache
        cache.set(cacheKey, {
          data: foundRoulette,
          timestamp: Date.now()
        });
        
        return foundRoulette;
      }
      
      Logger.warn(`Roleta com ID ${id} não encontrada`);
      return null;
    } catch (error) {
      Logger.error(`Erro ao buscar roleta ${id}:`, error);
      return null;
    }
  },
  
  /**
   * Adiciona um novo número a uma roleta no cache
   * @param roletaId ID da roleta
   * @param number Número a ser adicionado
   */
  addNewNumberToRoulette(roletaId: string, numero: any): void {
    try {
      Logger.debug(`Adicionando número para roleta ${roletaId}`);
      
      const cacheKey = `roulette_${roletaId}`;
      
      // Verificar se temos essa roleta em cache
      if (!cache.has(cacheKey)) {
        Logger.debug(`Roleta ${roletaId} não está em cache, carregando`);
        // Tentar buscar a roleta
        this.fetchRouletteById(roletaId).then(roulette => {
          if (roulette) {
            Logger.debug(`Roleta ${roletaId} carregada após recebimento de número`);
            // Adicionar o número após carregamento da roleta
            setTimeout(() => {
              this.addNewNumberToRoulette(roletaId, numero);
            }, 500);
          }
        });
        return;
      }
      
      const cachedRoulette = cache.get(cacheKey)!.data;
      
      // Transformar o número para o formato padronizado
      const transformedNumber = {
        numero: typeof numero === 'object' ? numero.numero : numero,
        cor: typeof numero === 'object' ? numero.cor : undefined,
        timestamp: typeof numero === 'object' ? numero.timestamp : new Date().toISOString()
      };
      
      // Adicionar o número ao array no início (mais recente primeiro)
      const updatedRoulette = {
        ...cachedRoulette,
        numeros: [transformedNumber, ...(cachedRoulette.numeros || [])]
      };
      
      // Atualizar o cache
      cache.set(cacheKey, {
        data: updatedRoulette,
        timestamp: Date.now()
      });
      
      Logger.debug(`Número ${transformedNumber.numero} adicionado à roleta ${roletaId}`);
    } catch (error) {
      Logger.error(`Erro ao adicionar número à roleta ${roletaId}:`, error);
    }
  },
  
  /**
   * Atualiza o estado da estratégia de uma roleta
   * @param roletaId ID da roleta
   * @param strategy Nova estratégia
   */
  updateRouletteStrategy(roletaId: string, strategy: any): void {
    try {
      Logger.debug(`Atualizando estratégia para roleta ${roletaId}`);
      
      const cacheKey = `roulette_${roletaId}`;
      
      // Verificar se temos essa roleta em cache
      if (!cache.has(cacheKey)) {
        Logger.debug(`Roleta ${roletaId} não está em cache, carregando`);
        // Tentar buscar a roleta
        this.fetchRouletteById(roletaId).then(roulette => {
          if (roulette) {
            // Atualizar após carregamento
            this.updateRouletteStrategy(roletaId, strategy);
          }
        });
        return;
      }
      
      const cachedRoulette = cache.get(cacheKey)!.data;
      
      // Extrair estado da estratégia
      const estado = typeof strategy === 'object' ? strategy.estado || 'Ativa' : strategy;
      
      // Atualizar o objeto da roleta
      const updatedRoulette = {
        ...cachedRoulette,
        estado_estrategia: estado
      };
      
      // Atualizar o cache
      cache.set(cacheKey, {
        data: updatedRoulette,
        timestamp: Date.now()
      });
      
      Logger.debug(`Estratégia atualizada para roleta ${roletaId}: ${estado}`);
    } catch (error) {
      Logger.error(`Erro ao atualizar estratégia da roleta ${roletaId}:`, error);
    }
  }
};

// Exportar todas as funções individualmente para facilitar o acesso
export const clearCache = rouletteRepository.clearCache;
export const fetchAllRoulettesWithNumbers = rouletteRepository.fetchAllRoulettesWithNumbers;
export const fetchRouletteById = rouletteRepository.fetchRouletteById;
export const addNewNumberToRoulette = rouletteRepository.addNewNumberToRoulette;
export const updateRouletteStrategy = rouletteRepository.updateRouletteStrategy;

// Exportar o repositório como default
export default rouletteRepository; 