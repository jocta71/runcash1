import axios from 'axios';
import { mapToCanonicalRouletteId } from './rouletteService';

// URL base do backend no Railway
const API_BASE_URL = 'https://backendapi-production-36b5.up.railway.app';

// Cache para otimizar as requisições
const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 60000; // 1 minuto em milissegundos

/**
 * Busca todas as roletas e inclui os números mais recentes para cada uma.
 * Esta API combina os dados que normalmente seriam buscados separadamente.
 */
export const fetchRoulettesWithNumbers = async (limit = 20): Promise<any[]> => {
  try {
    // Verificar cache
    const cacheKey = `roulettes_with_numbers_${limit}`;
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      console.log('[API] Usando dados em cache para roletas com números');
      return cache[cacheKey].data;
    }

    // Passo 1: Buscar todas as roletas disponíveis
    console.log('[API] Buscando roletas e seus números');
    const roulettesResponse = await axios.get(`${API_BASE_URL}/api/ROULETTES?limit=${limit}`);
    
    if (!roulettesResponse.data || !Array.isArray(roulettesResponse.data)) {
      console.error('[API] Resposta inválida da API de roletas');
      return [];
    }

    // Passo 2: Para cada roleta, buscar seus números mais recentes
    const roulettesWithNumbers = await Promise.all(
      roulettesResponse.data.map(async (roleta: any) => {
        try {
          // Obter o ID canônico da roleta para buscar os números
          const canonicalId = mapToCanonicalRouletteId(roleta.id);
          
          // Verificar se a roleta já tem números incluídos
          if (roleta.numero && Array.isArray(roleta.numero)) {
            console.log(`[API] ✅ Roleta: ${roleta.nome}, ID: ${canonicalId}, Números já incluídos: ${roleta.numero.length}`);
            
            // Limitar a quantidade de números retornados
            const limitedNumbers = roleta.numero.slice(0, limit);
            
            // Retornar a roleta com os números já incluídos
            return {
              ...roleta,
              canonicalId,
              numero: limitedNumbers
            };
          }
          
          console.log(`[API] ✅ Roleta: ${roleta.nome}, ID: ${canonicalId}, Sem números incluídos`);
          
          // A roleta não tem números, retornar com array vazio
          return {
            ...roleta,
            canonicalId,
            numero: []
          };
        } catch (error) {
          console.error(`[API] Erro ao processar números para roleta ${roleta.nome}:`, error);
          
          // Mesmo em caso de erro, retornar a roleta, mas com array de números vazio
          return {
            ...roleta,
            canonicalId: mapToCanonicalRouletteId(roleta.id),
            numero: []
          };
        }
      })
    );

    // Armazenar em cache para requisições futuras
    cache[cacheKey] = {
      data: roulettesWithNumbers,
      timestamp: Date.now()
    };
    
    console.log(`[API] ✅ Obtidas ${roulettesWithNumbers.length} roletas com seus números`);
    return roulettesWithNumbers;
  } catch (error) {
    console.error('[API] Erro ao buscar roletas com números:', error);
    return [];
  }
};

/**
 * Busca uma roleta específica por ID e inclui seus números mais recentes
 */
export const fetchRouletteWithNumbers = async (roletaId: string, limit = 20): Promise<any | null> => {
  try {
    // Verificar cache
    const cacheKey = `roulette_with_numbers_${roletaId}_${limit}`;
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      console.log(`[API] Usando dados em cache para roleta ${roletaId} com números`);
      return cache[cacheKey].data;
    }

    // Obter o ID canônico para garantir que buscamos os dados corretos
    const canonicalId = mapToCanonicalRouletteId(roletaId);
    
    // Buscar todas as roletas para encontrar a desejada
    const roulettesResponse = await axios.get(`${API_BASE_URL}/api/ROULETTES?limit=${limit}`);
    
    if (!roulettesResponse.data || !Array.isArray(roulettesResponse.data)) {
      console.error('[API] Resposta inválida da API de roletas');
      return null;
    }
    
    // Encontrar a roleta pelo ID
    const roleta = roulettesResponse.data.find((r: any) => 
      r.id === roletaId || 
      mapToCanonicalRouletteId(r.id) === canonicalId
    );
    
    if (!roleta) {
      console.error(`[API] Roleta com ID ${roletaId} não encontrada`);
      return null;
    }
    
    // Verificar se a roleta já tem números incluídos
    let numbers = [];
    if (roleta.numero && Array.isArray(roleta.numero)) {
      // Limitar a quantidade de números retornados
      numbers = roleta.numero.slice(0, limit);
    }
    
    // Montar o objeto final
    const roletaWithNumbers = {
      ...roleta,
      canonicalId,
      numero: numbers
    };
    
    // Armazenar em cache para requisições futuras
    cache[cacheKey] = {
      data: roletaWithNumbers,
      timestamp: Date.now()
    };
    
    console.log(`[API] ✅ Roleta: ${roleta.nome}, ID: ${canonicalId}, Números obtidos: ${numbers.length}`);
    return roletaWithNumbers;
  } catch (error) {
    console.error(`[API] Erro ao buscar roleta ${roletaId} com números:`, error);
    return null;
  }
}; 