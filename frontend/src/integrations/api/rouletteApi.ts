import axios from 'axios';
// Removendo a importação do mapeamento canônico que pode estar filtrando roletas
// import { mapToCanonicalRouletteId } from './rouletteService';

// Cache para otimizar as requisições
const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 60000; // 1 minuto em milissegundos

/**
 * Busca todas as roletas e inclui os números mais recentes para cada uma.
 * Esta API combina os dados que normalmente seriam buscados separadamente.
 */
export const fetchRoulettesWithNumbers = async (limit = 20): Promise<any[]> => {
  console.log('[API] ⛔ DESATIVADO: Requisição para buscar roletas com números bloqueada para diagnóstico');
  return [];
  
  /* CÓDIGO ORIGINAL DESATIVADO
  try {
    // Verificar cache
    const cacheKey = `roulettes_with_numbers_${limit}`;
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      console.log('[API] Usando dados em cache para roletas com números');
      return cache[cacheKey].data;
    }

    // Passo 1: Buscar todas as roletas disponíveis
    console.log('[API] Buscando roletas e seus números');
    const roulettesResponse = await axios.get('/api/ROULETTES');
    
    if (!roulettesResponse.data || !Array.isArray(roulettesResponse.data)) {
      console.error('[API] Resposta inválida da API de roletas');
      return [];
    }

    // Passo 2: Para cada roleta, usar os dados como estão - sem mapeamento para ID canônico
    const roulettesWithNumbers = roulettesResponse.data.map((roleta: any) => {
      try {
        const id = roleta.id;
        
        // Verificar se a roleta já tem números incluídos
        if (roleta.numero && Array.isArray(roleta.numero)) {
          console.log(`[API] ✅ Roleta: ${roleta.nome}, ID: ${id}, Números já incluídos: ${roleta.numero.length}`);
          
          // Limitar a quantidade de números retornados
          const limitedNumbers = roleta.numero.slice(0, limit);
          
          // Retornar a roleta com os números já incluídos
          return {
            ...roleta,
            id: id,  // Manter o ID original
            numero: limitedNumbers
          };
        }
        
        console.log(`[API] ✅ Roleta: ${roleta.nome}, ID: ${id}, Sem números incluídos`);
        
        // A roleta não tem números, retornar com array vazio
        return {
          ...roleta,
          id: id,  // Manter o ID original
          numero: []
        };
      } catch (error) {
        console.error(`[API] Erro ao processar números para roleta ${roleta.nome}:`, error);
        
        // Mesmo em caso de erro, retornar a roleta, mas com array de números vazio
        return {
          ...roleta,
          numero: []
        };
      }
    });

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
  */
};

/**
 * Busca uma roleta específica por ID e inclui seus números mais recentes
 */
export const fetchRouletteWithNumbers = async (roletaId: string, limit = 20): Promise<any | null> => {
  console.log(`[API] ⛔ DESATIVADO: Requisição para buscar roleta ${roletaId} com números bloqueada para diagnóstico`);
  return null;
  
  /* CÓDIGO ORIGINAL DESATIVADO
  try {
    // Verificar cache
    const cacheKey = `roulette_with_numbers_${roletaId}_${limit}`;
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      console.log(`[API] Usando dados em cache para roleta ${roletaId} com números`);
      return cache[cacheKey].data;
    }

    // Buscar todas as roletas para encontrar a desejada
    const roulettesResponse = await axios.get('/api/ROULETTES');
    
    if (!roulettesResponse.data || !Array.isArray(roulettesResponse.data)) {
      console.error('[API] Resposta inválida da API de roletas');
      return null;
    }
    
    // Encontrar a roleta pelo ID original
    const roleta = roulettesResponse.data.find((r: any) => r.id === roletaId);
    
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
      numero: numbers
    };
    
    // Armazenar em cache para requisições futuras
    cache[cacheKey] = {
      data: roletaWithNumbers,
      timestamp: Date.now()
    };
    
    console.log(`[API] ✅ Roleta: ${roleta.nome}, ID: ${roleta.id}, Números obtidos: ${numbers.length}`);
    return roletaWithNumbers;
  } catch (error) {
    console.error(`[API] Erro ao buscar roleta ${roletaId} com números:`, error);
    return null;
  }
  */
}; 