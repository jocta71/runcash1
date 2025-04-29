import axios from 'axios';

// Tipos para a API
export interface RouletteData {
  _id?: string;
  id?: string;
  nome?: string;
  name?: string;
  numero?: Array<any>;   // Mantendo apenas o campo singular
  estado_estrategia?: string;
  ativa?: boolean;
  vitorias?: number;
  derrotas?: number;
}

export interface LatestRouletteNumber {
  numero: number;
  cor: string;
  timestamp: string;
  roleta_id?: string;
  roleta_nome?: string;
}

export interface RouletteStrategy {
  estado: string;
  numero_gatilho: number | null;
  terminais_gatilho: number[];
  vitorias: number;
  derrotas: number;
  sugestao_display?: string;
}

// Lista das roletas disponíveis com seus IDs canônicos
// Removendo a lista fixa para não limitar quais roletas são exibidas
export const ROLETAS_CANONICAS: any[] = [];

/**
 * Mapeia um UUID de roleta para seu ID canônico (ID numérico usado no banco)
 * Esta função é crucial para garantir que as solicitações à API usem sempre o ID correto
 */
export function mapToCanonicalRouletteId(uuid: string): string {
  // Simplesmente retorna o ID original sem mapeamento
  // Isso garante que todas as roletas sejam exibidas sem filtragem
  return uuid;
}

// Configuração básica para todas as APIs
const apiBaseUrl = '/api'; // Usar o endpoint relativo para aproveitar o proxy

// Cache para evitar múltiplas solicitações para os mesmos dados
const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 60000; // 1 minuto em milissegundos

/**
 * Busca todas as roletas - função desativada conforme solicitado
 */
export const fetchRoulettes = async (): Promise<RouletteData[]> => {
  console.log('[API] ⛔ DESATIVADO: Requisições para /api/roulettes foram removidas');
  return [];
};

/**
 * Busca todas as roletas com números - função desativada conforme solicitado
 */
export const fetchRoulettesWithRealNumbers = async (): Promise<RouletteData[]> => {
  console.log('[API] ⛔ DESATIVADO: Requisições para /api/roulettes foram removidas');
  return [];
};

/**
 * Busca números reais de uma roleta específica - função desativada conforme solicitado
 */
async function fetchNumbersFromMongoDB(mongoId: string, roletaNome: string): Promise<any[]> {
  console.log(`[API] ⛔ DESATIVADO: Requisições para /api/roulettes foram removidas`);
  return [];
}

/**
 * Busca uma roleta específica pelo ID - função desativada conforme solicitado
 */
export const fetchRouletteById = async (roletaId: string): Promise<RouletteData | null> => {
  console.log(`[API] ⛔ DESATIVADO: Requisições para /api/roulettes foram removidas`);
  return null;
};

/**
 * Busca os números mais recentes de uma roleta pelo ID canônico
 */
export const fetchRouletteLatestNumbersByName = async (roletaNome: string, limit = 100): Promise<any[]> => {
  try {
    // Encontrar o ID canônico baseado no nome
    const roleta = ROLETAS_CANONICAS.find(r => r.nome === roletaNome);
    
    if (!roleta) {
      console.warn(`[API] Roleta não encontrada para nome: ${roletaNome}`);
      return [];
    }
    
    // Buscar números usando o ID canônico
    return await fetchRouletteNumbersById(roleta.id, limit);
  } catch (error) {
    console.error(`[API] Erro ao buscar números da roleta ${roletaNome}:`, error);
    return [];
  }
}

/**
 * Busca números de uma roleta específica pelo ID
 */
export const fetchRouletteNumbersById = async (canonicalId: string, limit = 100): Promise<any[]> => {
  try {
    // Verificar se já temos dados em cache para este ID
    const cacheKey = `numbers_${canonicalId}_${limit}`;
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      console.log(`[API] Usando dados em cache para números da roleta ${canonicalId}`);
      return cache[cacheKey].data;
    }
    
    console.log(`[API] Buscando roletas para extrair números da roleta ${canonicalId}`);
    
    // Agora buscamos todas as roletas e filtramos a que precisamos
    const response = await axios.get(`${apiBaseUrl}/ROULETTES`);
    
    if (response.data && Array.isArray(response.data)) {
      // Encontrar a roleta específica pelo ID canônico
      const targetRoulette = response.data.find((roleta: any) => {
        const roletaCanonicalId = roleta.canonical_id || mapToCanonicalRouletteId(roleta.id || '');
        return roletaCanonicalId === canonicalId || roleta.id === canonicalId;
      });
      
      if (targetRoulette && targetRoulette.numero && Array.isArray(targetRoulette.numero)) {
        const numbers = targetRoulette.numero.slice(0, limit);
        
        // Armazenar em cache
        cache[cacheKey] = {
          data: numbers,
          timestamp: Date.now()
        };
        
        console.log(`[API] ✅ Extraídos ${numbers.length} números para roleta ${canonicalId}`);
        return numbers;
      }
      
      console.warn(`[API] Roleta ${canonicalId} não encontrada nos dados retornados`);
      return [];
    }
    
    console.warn(`[API] Resposta inválida da API de roletas`);
    return [];
  } catch (error) {
    console.error(`[API] Erro ao buscar números da roleta ${canonicalId}:`, error);
    return [];
  }
}

/**
 * Busca a estratégia atual de uma roleta
 */
export const fetchRouletteStrategy = async (roletaId: string): Promise<RouletteStrategy | null> => {
  try {
    // Buscar a roleta para obter a estratégia
    const roleta = await fetchRouletteById(roletaId);
    
    if (roleta) {
      // Construir objeto de estratégia a partir dos dados da roleta
      const strategy: RouletteStrategy = {
        estado: roleta.estado_estrategia || 'NEUTRAL',
        numero_gatilho: null,
        terminais_gatilho: [],
        vitorias: roleta.vitorias || 0,
        derrotas: roleta.derrotas || 0,
        sugestao_display: ''
      };
      
      console.log(`[API] ✅ Estratégia extraída para roleta ${roletaId}:`, strategy);
      return strategy;
    }
    
    console.warn(`[API] Não foi possível obter estratégia para roleta ${roletaId}`);
    return null;
  } catch (error) {
    console.error(`[API] Erro ao buscar estratégia da roleta ${roletaId}:`, error);
    return null;
  }
}
