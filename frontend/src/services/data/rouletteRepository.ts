import { RouletteApi } from '../api/rouletteApi';
import { socketClient } from '../socket/socketClient';
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
            
            // Também assinar em tempo real via socket
            socketClient.subscribeToRoulette(numericId, roulette.name);
            
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
      
      // Adicionar no início do array de números
      cachedRoulette.numbers.unshift(transformedNumber);
      
      // Atualizar cache
      cache.set(cacheKey, {
        data: cachedRoulette,
        timestamp: Date.now()
      });
      
      logger.debug(`✅ Número ${transformedNumber.number} adicionado à roleta ${numericId}`);
    } catch (error) {
      logger.error(`Erro ao adicionar número à roleta ${roletaId}:`, error);
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
      const cacheKey = `roulette_${numericId}`;
      
      // Verificar se temos essa roleta em cache
      if (!cache.has(cacheKey)) {
        logger.debug(`Roleta ${numericId} não está em cache, ignorando atualização de estratégia`);
        return;
      }
      
      const cachedRoulette = cache.get(cacheKey)!.data;
      
      // Atualizar dados de estratégia
      cachedRoulette.strategyState = strategy.estado || strategy.state || cachedRoulette.strategyState;
      cachedRoulette.wins = strategy.vitorias || strategy.wins || cachedRoulette.wins;
      cachedRoulette.losses = strategy.derrotas || strategy.losses || cachedRoulette.losses;
      
      // Atualizar cache
      cache.set(cacheKey, {
        data: cachedRoulette,
        timestamp: Date.now()
      });
      
      logger.debug(`✅ Estratégia atualizada para roleta ${numericId}: ${cachedRoulette.strategyState}`);
    } catch (error) {
      logger.error(`Erro ao atualizar estratégia da roleta ${roletaId}:`, error);
    }
  },
  
  /**
   * Assina atualizações em tempo real para uma roleta específica
   * @param id ID da roleta
   * @param callback Função a ser chamada quando houver atualizações
   * @returns Função para cancelar a assinatura
   */
  subscribeToRouletteUpdates(id: string, callback: (data: RouletteData) => void): () => void {
    const numericId = getNumericId(id);
    logger.debug(`Assinando atualizações para roleta ${numericId}`);
    
    // Buscar dados iniciais
    this.fetchRouletteById(numericId).then(roulette => {
      if (roulette) {
        callback(roulette);
      }
    });
    
    // Assinar eventos do socket para atualizações de números
    const numberEventCallback = (data: any) => {
      logger.verbose(`Evento de novo número recebido para roleta ${numericId}`);
      
      // Adicionar número ao cache
      if (data.numero !== undefined || data.number !== undefined) {
        this.addNewNumberToRoulette(numericId, data);
        
        // Extrair o ID da roleta do evento
        let eventRouletaId = data.roleta_id || data.roulette_id;
        if (eventRouletaId && eventRouletaId !== numericId) {
          logger.debug(`⚠️ ID da roleta no evento (${eventRouletaId}) é diferente do ID assinado (${numericId})`);
          
          // Verificar se podemos mapear o ID do evento para nosso ID numérico
          const mappedId = getNumericId(eventRouletaId);
          if (mappedId === numericId) {
            logger.debug(`✅ IDs mapeados corretamente: ${eventRouletaId} -> ${numericId}`);
          } else {
            logger.warn(`❌ IDs não correspondem após mapeamento: ${eventRouletaId} -> ${mappedId} != ${numericId}`);
          }
        }
      }
      
      // Buscar roleta atualizada do cache e notificar
      const cacheKey = `roulette_${numericId}`;
      if (cache.has(cacheKey)) {
        callback(cache.get(cacheKey)!.data);
      }
    };
    
    // Assinar eventos do socket para atualizações de estratégia
    const strategyEventCallback = (data: any) => {
      logger.verbose(`Evento de estratégia recebido para roleta ${numericId}`);
      this.updateRouletteStrategy(numericId, data);
      
      // Buscar roleta atualizada do cache e notificar
      const cacheKey = `roulette_${numericId}`;
      if (cache.has(cacheKey)) {
        callback(cache.get(cacheKey)!.data);
      }
    };
    
    // Assinar eventos específicos para esta roleta
    socketClient.on(`new_number_${numericId}`, numberEventCallback);
    socketClient.on(`strategy_update_${numericId}`, strategyEventCallback);
    
    // Retornar função para cancelar assinatura
    return () => {
      // Usar removeListener para especificidade
      socketClient.removeListener(`new_number_${numericId}`, numberEventCallback);
      socketClient.removeListener(`strategy_update_${numericId}`, strategyEventCallback);
    };
  }
}; 