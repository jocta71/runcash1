import { RouletteApi } from '../api/rouletteApi';
import { socketClient } from '../socket/socketClient';
import { transformRouletteData, mapToCanonicalId } from './rouletteTransformer';

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
  active: boolean;
  strategyState: string;
  wins: number;
  losses: number;
}

// Cache local para otimizar requisições
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 60000; // 1 minuto em milissegundos

/**
 * Repositório para gerenciar dados de roletas
 */
export const RouletteRepository = {
  /**
   * Limpa o cache de dados
   */
  clearCache() {
    cache.clear();
    console.log('[Repository] Cache limpo');
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
          console.log('[Repository] Usando dados em cache para todas as roletas');
          return cacheEntry.data;
        }
      }
      
      console.log('[Repository] Buscando todas as roletas com seus números');
      
      // Buscar dados da API
      const rawData = await RouletteApi.fetchAllRoulettes();
      
      if (!Array.isArray(rawData)) {
        console.error('[Repository] Resposta inválida da API:', rawData);
        return [];
      }
      
      // Transformar dados para o formato padronizado
      const transformedData = rawData.map(transformRouletteData);
      
      // Salvar em cache
      cache.set(cacheKey, {
        data: transformedData,
        timestamp: Date.now()
      });
      
      console.log(`[Repository] ✅ Obtidas ${transformedData.length} roletas processadas`);
      return transformedData;
    } catch (error) {
      console.error('[Repository] Erro ao buscar roletas:', error);
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
        console.error('[Repository] ID de roleta não fornecido');
        return null;
      }
      
      // Converter para ID canônico para normalização
      const canonicalId = mapToCanonicalId(id);
      const cacheKey = `roulette_${canonicalId}`;
      
      // Verificar cache
      if (cache.has(cacheKey)) {
        const cacheEntry = cache.get(cacheKey)!;
        if (Date.now() - cacheEntry.timestamp < CACHE_TTL) {
          console.log(`[Repository] Usando dados em cache para roleta ${canonicalId}`);
          return cacheEntry.data;
        }
      }
      
      console.log(`[Repository] Buscando roleta com ID: ${canonicalId}`);
      
      // Buscar todas as roletas e filtrar
      const roulettes = await this.fetchAllRoulettesWithNumbers();
      const roulette = roulettes.find(r => 
        r.id === canonicalId || r.uuid === id
      );
      
      if (roulette) {
        // Salvar em cache
        cache.set(cacheKey, {
          data: roulette,
          timestamp: Date.now()
        });
        
        console.log(`[Repository] ✅ Roleta encontrada: ${roulette.name}`);
        
        // Também assinar em tempo real via socket
        socketClient.subscribeToRoulette(canonicalId, roulette.name);
        
        return roulette;
      }
      
      console.warn(`[Repository] ❌ Roleta com ID ${canonicalId} não encontrada`);
      return null;
    } catch (error) {
      console.error(`[Repository] Erro ao buscar roleta ${id}:`, error);
      return null;
    }
  },
  
  /**
   * Adiciona um novo número a uma roleta no cache
   * @param roletaId ID canônico da roleta
   * @param number Número a ser adicionado
   */
  addNewNumberToRoulette(roletaId: string, number: any): void {
    try {
      const canonicalId = mapToCanonicalId(roletaId);
      
      console.log(`[Repository] Adicionando número para roleta ${roletaId} -> canonical=${canonicalId}`);
      
      const cacheKey = `roulette_${canonicalId}`;
      
      // Verificar se temos essa roleta em cache
      if (!cache.has(cacheKey)) {
        console.warn(`[Repository] Tentativa de adicionar número, mas roleta ${canonicalId} não está em cache`);
        // Tentar buscar a roleta pelo ID canônico
        this.fetchRouletteById(canonicalId).then(roulette => {
          if (roulette) {
            console.log(`[Repository] Roleta ${canonicalId} carregada após recebimento de número`);
            // Adicionar o número após carregamento da roleta
            setTimeout(() => {
              this.addNewNumberToRoulette(canonicalId, number);
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
      
      console.log(`[Repository] ✅ Número ${transformedNumber.number} adicionado à roleta ${canonicalId}`);
    } catch (error) {
      console.error(`[Repository] Erro ao adicionar número à roleta ${roletaId}:`, error);
    }
  },
  
  /**
   * Atualiza a estratégia de uma roleta no cache
   * @param roletaId ID canônico da roleta
   * @param strategy Dados da estratégia
   */
  updateRouletteStrategy(roletaId: string, strategy: any): void {
    try {
      const canonicalId = mapToCanonicalId(roletaId);
      const cacheKey = `roulette_${canonicalId}`;
      
      // Verificar se temos essa roleta em cache
      if (!cache.has(cacheKey)) {
        console.warn(`[Repository] Tentativa de atualizar estratégia, mas roleta ${canonicalId} não está em cache`);
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
      
      console.log(`[Repository] ✅ Estratégia atualizada para roleta ${canonicalId}: ${cachedRoulette.strategyState}`);
    } catch (error) {
      console.error(`[Repository] Erro ao atualizar estratégia da roleta ${roletaId}:`, error);
    }
  },
  
  /**
   * Assina atualizações em tempo real para uma roleta específica
   * @param id ID da roleta
   * @param callback Função a ser chamada quando houver atualizações
   * @returns Função para cancelar a assinatura
   */
  subscribeToRouletteUpdates(id: string, callback: (data: RouletteData) => void): () => void {
    const canonicalId = mapToCanonicalId(id);
    console.log(`[Repository] Assinando atualizações para roleta ${id} -> canonical=${canonicalId}`);
    
    // Buscar dados iniciais
    this.fetchRouletteById(canonicalId).then(roulette => {
      if (roulette) {
        callback(roulette);
      }
    });
    
    // Assinar eventos do socket para atualizações de números
    const numberEventCallback = (data: any) => {
      console.log(`[Repository] Evento de novo número recebido para roleta ${canonicalId}:`, data);
      
      // Adicionar número ao cache
      if (data.numero !== undefined || data.number !== undefined) {
        this.addNewNumberToRoulette(canonicalId, data);
        
        // Extrair o ID da roleta do evento
        let eventRouletaId = data.roleta_id || data.roulette_id;
        if (eventRouletaId && eventRouletaId !== canonicalId) {
          console.log(`[Repository] ⚠️ ID da roleta no evento (${eventRouletaId}) é diferente do ID assinado (${canonicalId})`);
          
          // Verificar se podemos mapear o ID do evento para nosso ID canônico
          const mappedId = mapToCanonicalId(eventRouletaId);
          if (mappedId === canonicalId) {
            console.log(`[Repository] ✅ IDs mapeados corretamente: ${eventRouletaId} -> ${canonicalId}`);
          } else {
            console.warn(`[Repository] ❌ IDs não correspondem após mapeamento: ${eventRouletaId} -> ${mappedId} != ${canonicalId}`);
          }
        }
      }
      
      // Buscar roleta atualizada do cache e notificar
      const cacheKey = `roulette_${canonicalId}`;
      if (cache.has(cacheKey)) {
        callback(cache.get(cacheKey)!.data);
      }
    };
    
    // Assinar eventos do socket para atualizações de estratégia
    const strategyEventCallback = (data: any) => {
      console.log(`[Repository] Evento de estratégia recebido para roleta ${canonicalId}:`, data);
      this.updateRouletteStrategy(canonicalId, data);
      
      // Buscar roleta atualizada do cache e notificar
      const cacheKey = `roulette_${canonicalId}`;
      if (cache.has(cacheKey)) {
        callback(cache.get(cacheKey)!.data);
      }
    };
    
    // Assinar eventos específicos para esta roleta
    socketClient.on(`new_number_${canonicalId}`, numberEventCallback);
    socketClient.on(`strategy_update_${canonicalId}`, strategyEventCallback);
    
    // Retornar função para cancelar assinatura
    return () => {
      // Usar removeAllListeners para compatibilidade
      socketClient.removeAllListeners(`new_number_${canonicalId}`);
      socketClient.removeAllListeners(`strategy_update_${canonicalId}`);
    };
  }
}; 