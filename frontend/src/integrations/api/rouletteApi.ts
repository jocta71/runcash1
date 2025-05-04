// Removendo a importação do mapeamento canônico que pode estar filtrando roletas
// import { mapToCanonicalRouletteId } from './rouletteService';
import axios from 'axios';

// Cache para otimizar as requisições
const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 60000; // 1 minuto em milissegundos

// Endpoint fixo para roletas - sempre usar este endpoint específico sem parâmetros adicionais
const ROULETTES_ENDPOINT = '/api/roulettes';

/**
 * Busca todas as roletas e inclui os números mais recentes para cada uma.
 * Esta API combina os dados que normalmente seriam buscados separadamente.
 * IMPORTANTE: Utiliza apenas o endpoint "/api/roulettes" conforme especificado, sem parâmetros adicionais.
 */
export const fetchRoulettesWithNumbers = async (limit = 20): Promise<any[]> => {
  try {
    // Verificar cache
    const cacheKey = `roulettes_with_numbers_${limit}`;
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      console.log('[API] Usando dados em cache para roletas com números');
      return cache[cacheKey].data;
    }

    // Obter token de autenticação de várias fontes
    let authToken = '';
    
    // Verificar token nos cookies (prioridade 1)
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return undefined;
    };
    
    // Tentar obter dos cookies primeiro (mais confiável)
    const tokenCookie = getCookie('token') || getCookie('token_alt');
    if (tokenCookie) {
      authToken = tokenCookie;
      console.log('[API] Usando token de autenticação dos cookies');
    } else {
      // Se não encontrou nos cookies, verificar localStorage
      const possibleKeys = [
        'auth_token_backup',  // Usado pelo AuthContext
        'token',              // Nome do cookie usado na requisição bem-sucedida
        'auth_token',         // Usado em alguns componentes
        'authToken'           // Usado em alguns utilitários
      ];
      
      for (const key of possibleKeys) {
        const storedToken = localStorage.getItem(key);
        if (storedToken) {
          authToken = storedToken;
          console.log(`[API] Usando token de autenticação do localStorage (${key})`);
          
          // Restaurar para cookies se necessário
          try {
            document.cookie = `token=${authToken}; path=/; max-age=2592000`;
            document.cookie = `token_alt=${authToken}; path=/; max-age=2592000; SameSite=Lax`;
            console.log('[API] Token restaurado para cookies');
          } catch (cookieError) {
            console.warn('[API] Erro ao restaurar token para cookies:', cookieError);
          }
          
          break;
        }
      }
    }

    // Configurar headers exatamente como na requisição bem-sucedida
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'accept': 'application/json, text/plain, */*'
    };

    // Adicionar token de autenticação se disponível
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
      console.log('[API] Token de autenticação adicionado ao cabeçalho da requisição');
    } else {
      console.warn('[API] Nenhum token de autenticação encontrado, tentando acessar endpoint sem autenticação');
    }

    // Passo 1: Buscar todas as roletas disponíveis usando apenas o endpoint "/api/roulettes" sem parâmetros
    console.log(`[API] Buscando roletas e seus números do endpoint ${ROULETTES_ENDPOINT}`);
    const roulettesResponse = await axios.get(ROULETTES_ENDPOINT, {
      headers,
      withCredentials: true // Importante: Incluir cookies na requisição
    });
    
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

    // Obter token de autenticação de várias fontes
    let authToken = '';
    
    // Verificar token nos cookies (prioridade 1)
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return undefined;
    };
    
    // Tentar obter dos cookies primeiro (mais confiável)
    const tokenCookie = getCookie('token') || getCookie('token_alt');
    if (tokenCookie) {
      authToken = tokenCookie;
      console.log('[API] Usando token de autenticação dos cookies');
    } else {
      // Se não encontrou nos cookies, verificar localStorage
      const possibleKeys = [
        'auth_token_backup',  // Usado pelo AuthContext
        'token',              // Nome do cookie usado na requisição bem-sucedida
        'auth_token',         // Usado em alguns componentes
        'authToken'           // Usado em alguns utilitários
      ];
      
      for (const key of possibleKeys) {
        const storedToken = localStorage.getItem(key);
        if (storedToken) {
          authToken = storedToken;
          console.log(`[API] Usando token de autenticação do localStorage (${key})`);
          
          // Restaurar para cookies se necessário
          try {
            document.cookie = `token=${authToken}; path=/; max-age=2592000`;
            document.cookie = `token_alt=${authToken}; path=/; max-age=2592000; SameSite=Lax`;
            console.log('[API] Token restaurado para cookies');
          } catch (cookieError) {
            console.warn('[API] Erro ao restaurar token para cookies:', cookieError);
          }
          
          break;
        }
      }
    }

    // Configurar headers exatamente como na requisição bem-sucedida
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'accept': 'application/json, text/plain, */*'
    };

    // Adicionar token de autenticação se disponível
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
      console.log('[API] Token de autenticação adicionado ao cabeçalho da requisição');
    } else {
      console.warn('[API] Nenhum token de autenticação encontrado, tentando acessar endpoint sem autenticação');
    }

    // Buscar todas as roletas para encontrar a desejada
    console.log(`[API] Buscando roletas do endpoint ${ROULETTES_ENDPOINT} para encontrar ID ${roletaId}`);
    const roulettesResponse = await axios.get(ROULETTES_ENDPOINT, {
      headers,
      withCredentials: true // Importante: Incluir cookies na requisição
    });
    
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
}; 