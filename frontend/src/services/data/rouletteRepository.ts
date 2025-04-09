import { RouletteApi } from '../api/rouletteApi';
import { transformRouletteData, getNumericId } from './rouletteTransformer';
import { getLogger } from '../utils/logger';

// Logger para o repositório
const logger = getLogger('Repository');

// Tipagem para os dados de roleta padronizados
export interface RouletteData {
  id: string;
  uuid: string;
  name: string;
  numbers: Array<{
    number: number;
    color: string;
    timestamp: string;
  }>;
  numero?: number[]; // Adicionando campo opcional para compatibilidade com componentes antigos
  active: boolean;
  strategyState: string;
  wins: number;
  losses: number;
}

// Cache local para otimizar requisições
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 60000; // 1 minuto em milissegundos

// Rastreamento de requisições pendentes para evitar chamadas duplicadas
const pendingRequests = new Map<string, Promise<any>>();

// Lista de callbacks para atualizações
const updateCallbacks = new Map<string, Array<(data: RouletteData) => void>>();

// Intervalo de polling para buscar atualizações
const POLLING_INTERVAL = 10000; // 10 segundos
let pollingIntervalId: number | null = null;

/**
 * Repositório para gerenciar dados de roletas
 */
export const RouletteRepository = {
  /**
   * Limpa o cache de dados
   */
  clearCache() {
    cache.clear();
    logger.info('Cache limpo');
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
          logger.debug('Usando dados em cache para todas as roletas');
          return cacheEntry.data;
        }
      }
      
      // Verificar se já existe uma requisição pendente
      if (pendingRequests.has(cacheKey)) {
        logger.debug('Reaproveitando requisição pendente para todas as roletas');
        return pendingRequests.get(cacheKey)!;
      }
      
      logger.info('Buscando todas as roletas com seus números');
      
      // Criar nova requisição e armazenar a promessa
      const requestPromise = new Promise<RouletteData[]>(async (resolve) => {
        try {
          // Buscar dados da API
          const rawData = await RouletteApi.fetchAllRoulettes();
          
          if (!Array.isArray(rawData)) {
            logger.error('Resposta inválida da API:', rawData);
            resolve([]);
            return;
          }
          
          // Transformar dados para o formato padronizado
          const transformedData = rawData.map(roulette => {
            // Chamar o transformador para cada roleta
            const transformed = transformRouletteData(roulette);
            
            // IMPORTANTE: Garantir que a propriedade 'numero' também contenha os números
            // Isso é necessário porque alguns componentes buscam por 'numero' em vez de 'numbers'
            if (transformed.numbers && transformed.numbers.length > 0) {
              // Usar asserção de tipo para informar ao TypeScript que estamos modificando o objeto
              (transformed as RouletteData & { numero: number[] }).numero = transformed.numbers.map(n => n.number);
              logger.debug(`Roleta ${transformed.name}: números gerados pelo fallback copiados para 'numero'`);
            }
            
            return transformed;
          });
          
          // Salvar em cache
          cache.set(cacheKey, {
            data: transformedData,
            timestamp: Date.now()
          });
          
          logger.info(`✅ Obtidas ${transformedData.length} roletas processadas`);
          resolve(transformedData);
        } catch (error) {
          logger.error('Erro ao buscar roletas:', error);
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
      logger.error('Erro ao buscar roletas:', error);
      return [];
    }
  },
  
  /**
   * Inicia o polling para atualização periódica
   */
  startPolling() {
    if (pollingIntervalId !== null) {
      return; // Já está fazendo polling
    }
    
    logger.info('Iniciando polling de atualização de roletas');
    pollingIntervalId = window.setInterval(() => {
      // Atualizar apenas se tivermos callbacks registrados
      if (updateCallbacks.size > 0) {
        this.fetchAllRoulettesWithNumbers()
          .then(() => logger.debug('Roletas atualizadas via polling'))
          .catch(error => logger.error('Erro no polling de roletas:', error));
      }
    }, POLLING_INTERVAL) as unknown as number;
  },
  
  /**
   * Para o polling de atualização
   */
  stopPolling() {
    if (pollingIntervalId !== null) {
      window.clearInterval(pollingIntervalId);
      pollingIntervalId = null;
      logger.info('Polling de atualização de roletas interrompido');
    }
  },
  
  /**
   * Busca uma roleta específica pelo ID
   * @param id ID da roleta (qualquer formato)
   * @returns Objeto da roleta ou null se não encontrada
   */
  async fetchRouletteById(id: string): Promise<RouletteData | null> {
    try {
      if (!id) {
        logger.error('ID de roleta não fornecido');
        return null;
      }
      
      // Converter para ID numérico para normalização
      const numericId = getNumericId(id);
      const cacheKey = `roulette_${numericId}`;
      
      // Verificar cache
      if (cache.has(cacheKey)) {
        const cacheEntry = cache.get(cacheKey)!;
        if (Date.now() - cacheEntry.timestamp < CACHE_TTL) {
          logger.debug(`Usando dados em cache para roleta ${numericId}`);
          return cacheEntry.data;
        }
      }
      
      // Verificar se já existe uma requisição pendente
      if (pendingRequests.has(cacheKey)) {
        logger.debug(`Reaproveitando requisição pendente para roleta ${numericId}`);
        return pendingRequests.get(cacheKey)!;
      }
      
      logger.info(`Buscando roleta com ID: ${numericId}`);
      
      // Criar nova requisição e armazenar a promessa
      const requestPromise = new Promise<RouletteData | null>(async (resolve) => {
        try {
          // Buscar todas as roletas e filtrar
          const roulettes = await this.fetchAllRoulettesWithNumbers();
          const roulette = roulettes.find(r => 
            r.id === numericId || r.uuid === id
          );
          
          if (roulette) {
            // Salvar em cache
            cache.set(cacheKey, {
              data: roulette,
              timestamp: Date.now()
            });
            
            logger.info(`✅ Roleta encontrada: ${roulette.name}`);
            
            // Iniciar polling para atualizações se tiver callbacks registrados
            if (updateCallbacks.has(numericId)) {
              this.startPolling();
            }
            
            resolve(roulette);
          } else {
            logger.warn(`❌ Roleta com ID ${numericId} não encontrada`);
            resolve(null);
          }
        } catch (error) {
          logger.error(`Erro ao buscar roleta ${id}:`, error);
          resolve(null);
        } finally {
          // Remover do mapa de requisições pendentes após conclusão
          pendingRequests.delete(cacheKey);
        }
      });
      
      // Salvar a promessa no mapa de requisições pendentes
      pendingRequests.set(cacheKey, requestPromise);
      
      return requestPromise;
    } catch (error) {
      logger.error(`Erro ao buscar roleta ${id}:`, error);
      return null;
    }
  },
  
  /**
   * Adiciona um novo número a uma roleta no cache
   * @param roletaId ID da roleta
   * @param number Número a ser adicionado
   */
  addNewNumberToRoulette(roletaId: string, number: any): void {
    try {
      const numericId = getNumericId(roletaId);
      
      logger.debug(`Adicionando número para roleta ${numericId}`);
      
      const cacheKey = `roulette_${numericId}`;
      
      // Verificar se temos essa roleta em cache
      if (!cache.has(cacheKey)) {
        logger.debug(`Roleta ${numericId} não está em cache, carregando`);
        // Tentar buscar a roleta pelo ID numérico
        this.fetchRouletteById(numericId).then(roulette => {
          if (roulette) {
            logger.debug(`Roleta ${numericId} carregada após recebimento de número`);
            // Adicionar o número após carregamento da roleta
            setTimeout(() => {
              this.addNewNumberToRoulette(numericId, number);
            }, 500);
          }
        });
        return;
      }
      
      const cachedRoulette = cache.get(cacheKey)!.data;
      
      // Transformar o número para o formato padronizado
      const transformedNumber = {
        number: typeof number === 'object' ? number.numero || number.number : number,
        color: typeof number === 'object' ? number.cor || number.color : null,
        timestamp: typeof number === 'object' ? number.timestamp : new Date().toISOString()
      };
      
      // Determinar cor se não foi fornecida
      if (!transformedNumber.color) {
        if (transformedNumber.number === 0) {
          transformedNumber.color = 'green';
        } else {
          const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
          transformedNumber.color = redNumbers.includes(transformedNumber.number) ? 'red' : 'black';
        }
      }
      
      // Adicionar número ao array de numbers
      cachedRoulette.numbers.unshift(transformedNumber);
      
      // Atualizar também o array numero para compatibilidade
      if (!cachedRoulette.numero) {
        cachedRoulette.numero = [];
      }
      cachedRoulette.numero.unshift(transformedNumber.number);
      
      // Atualizar timestamp do cache
      cache.set(cacheKey, {
        data: cachedRoulette,
        timestamp: Date.now()
      });
      
      // Notificar callbacks registrados
      if (updateCallbacks.has(numericId)) {
        const callbacks = updateCallbacks.get(numericId)!;
        callbacks.forEach(callback => {
          try {
            callback(cachedRoulette);
          } catch (err) {
            logger.error(`Erro ao notificar callback para roleta ${numericId}:`, err);
          }
        });
      }
      
      logger.debug(`Número ${transformedNumber.number} adicionado à roleta ${numericId}`);
    } catch (error) {
      logger.error(`Erro ao adicionar número para roleta ${roletaId}:`, error);
    }
  },
  
  /**
   * Atualiza a estratégia de uma roleta no cache
   * @param roletaId ID da roleta
   * @param strategy Dados da estratégia
   */
  updateRouletteStrategy(roletaId: string, strategy: any): void {
    try {
      const numericId = getNumericId(roletaId);
      
      logger.debug(`Atualizando estratégia para roleta ${numericId}`);
      
      const cacheKey = `roulette_${numericId}`;
      
      // Verificar se temos essa roleta em cache
      if (!cache.has(cacheKey)) {
        logger.debug(`Roleta ${numericId} não está em cache, carregando`);
        // Tentar buscar a roleta pelo ID numérico
        this.fetchRouletteById(numericId).then(roulette => {
          if (roulette) {
            logger.debug(`Roleta ${numericId} carregada após recebimento de estratégia`);
            // Atualizar a estratégia após carregamento da roleta
            setTimeout(() => {
              this.updateRouletteStrategy(numericId, strategy);
            }, 500);
          }
        });
        return;
      }
      
      const cachedRoulette = cache.get(cacheKey)!.data;
      
      // Atualizar campos da estratégia
      cachedRoulette.strategyState = strategy.estado || strategy.state || 'UNKNOWN';
      cachedRoulette.wins = strategy.vitorias || strategy.wins || 0;
      cachedRoulette.losses = strategy.derrotas || strategy.losses || 0;
      
      // Atualizar timestamp do cache
      cache.set(cacheKey, {
        data: cachedRoulette,
        timestamp: Date.now()
      });
      
      // Notificar callbacks registrados
      if (updateCallbacks.has(numericId)) {
        const callbacks = updateCallbacks.get(numericId)!;
        callbacks.forEach(callback => {
          try {
            callback(cachedRoulette);
          } catch (err) {
            logger.error(`Erro ao notificar callback para roleta ${numericId}:`, err);
          }
        });
      }
      
      logger.debug(`Estratégia atualizada para roleta ${numericId}: ${cachedRoulette.strategyState}`);
    } catch (error) {
      logger.error(`Erro ao atualizar estratégia para roleta ${roletaId}:`, error);
    }
  },
  
  /**
   * Inscreve um callback para receber atualizações de uma roleta
   * @param id ID da roleta
   * @param callback Função a ser chamada quando a roleta for atualizada
   * @returns Função para cancelar a inscrição
   */
  subscribeToRouletteUpdates(id: string, callback: (data: RouletteData) => void): () => void {
    const numericId = getNumericId(id);
    
    logger.info(`Inscrevendo para atualizações da roleta ${numericId}`);
    
    // Inicializar array de callbacks se não existir
    if (!updateCallbacks.has(numericId)) {
      updateCallbacks.set(numericId, []);
    }
    
    // Adicionar callback à lista
    updateCallbacks.get(numericId)!.push(callback);
    
    // Iniciar polling para atualização periódica
    this.startPolling();
    
    // Buscar dados atuais da roleta
    this.fetchRouletteById(numericId);
    
    // Retornar função para cancelar a inscrição
    return () => {
      logger.info(`Cancelando inscrição para roleta ${numericId}`);
      
      const callbacks = updateCallbacks.get(numericId);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
          callbacks.splice(index, 1);
        }
        
        // Se não há mais callbacks, remover o ID da roleta da lista
        if (callbacks.length === 0) {
          updateCallbacks.delete(numericId);
          
          // Se não há mais roletas sendo observadas, parar o polling
          if (updateCallbacks.size === 0) {
            this.stopPolling();
          }
        }
      }
    };
  }
}; 