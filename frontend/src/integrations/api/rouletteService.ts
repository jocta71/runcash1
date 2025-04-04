import axios from 'axios';
import { getRequiredEnvVar, getEnvVar } from '../../config/env';
import { filterAllowedRoulettes, isRouletteAllowed, ROLETAS_PERMITIDAS } from '@/config/allowedRoulettes';

// Tipos para a API
export interface RouletteData {
  _id?: string;
  id?: string;
  nome?: string;
  name?: string;
  numeros?: Array<any>;
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
export const ROLETAS_CANONICAS = [
  { id: "2010096", nome: "Speed Auto Roulette" },
  { id: "2010098", nome: "Auto-Roulette VIP" },
  { id: "2010017", nome: "Ruleta Automática", alternativeNames: ["Auto-Roulette"] },
  { id: "2380335", nome: "Brazilian Mega Roulette" },
  { id: "2010065", nome: "Bucharest Auto-Roulette" },
  { id: "2010016", nome: "Immersive Roulette" }
];

// Mapeamento de UUIDs específicos para IDs canônicos
const UUID_MAP: Record<string, string> = {
  // Speed Auto Roulette (2010096)
  "18bdc4ea-d884-c47a-d33f-27a268a4eead": "2010096",
  "18bdc4ead884c47ad33f27a268a4eead": "2010096",
  "e95fe030-c341-11e8-a12e-005056a03af2": "2010096",
  "e95fe030c34111e8a12e005056a03af2": "2010096",
  "419aa56c-bcff-67d2-f424-a6501bac4a36": "2010096",
  "419aa56cbcff67d2f424a6501bac4a36": "2010096",
  
  // Brazilian Mega Roulette (2380335)
  "7d3c2c9f-2850-f642-861f-5bb4daf1806a": "2380335",
  "7d3c2c9f2850f642861f5bb4daf1806a": "2380335",
  
  // Bucharest Auto-Roulette (2010065)
  "e345af9-e387-9412-289c-e793fe73e528": "2010065",
  "e345af9e3879412289ce793fe73e528": "2010065",
  "e345af9-e387-9412-289c-e793fe7ae520": "2010065",
  "e345af9e3879412289ce793fe7ae520": "2010065",
  "d7115270-fec9-11e8-81a4-0025907e870c": "2010065",
  "d7115270fec911e881a40025907e870c": "2010065",
  
  // Immersive Roulette (2010016)
  "4cf27e48-2b9d-b58e-7dcc-48264c51d639": "2010016",
  "4cf27e482b9db58e7dcc48264c51d639": "2010016",
  "1f156e80-ba21-11e5-b4c9-005056a03af2": "2010016",
  "1f156e80ba2111e5b4c9005056a03af2": "2010016",
  "f27dd03e-5282-fc78-961c-6375cef91565": "2010016",
  "f27dd03e5282fc78961c6375cef91565": "2010016",
  
  // Auto-Roulette (2010017)
  "127dd03e-5282-fc78-961c-6375cef91565": "2010017",
  "127dd03e5282fc78961c6375cef91565": "2010017",
  "12de4qt1-c791-11e8-a01c-005056a03af2": "2010017",
  "12de4qt1c79111e8a01c005056a03af2": "2010017",
  
  // Auto-Roulette VIP (2010098)
  "303f7ca0-c415-11e8-a12e-005056a03af2": "2010098",
  "303f7ca0c41511e8a12e005056a03af2": "2010098"
};

// Mapeamento simplificado - recebe o ID de roleta (pode ser UUID ou qualquer outro formato)
// e retorna o ID canônico correspondente ou um ID padrão caso não encontre
export function mapToCanonicalRouletteId(roletaId: string): string {
  // Se o ID for vazio, retornar ID padrão
  if (!roletaId || roletaId === 'undefined') {
    console.warn(`[API] ID inválido recebido: "${roletaId}", usando ID padrão 2010096`);
    return "2010096";
  }

  // Se o ID já for um dos IDs canônicos conhecidos, retorná-lo diretamente
  const isAlreadyCanonical = ROLETAS_CANONICAS.some(r => r.id === roletaId);
  if (isAlreadyCanonical) {
    return roletaId;
  }
  
  // Verificar no mapeamento de UUIDs específicos
  const normalizedUuid = roletaId.replace(/-/g, '').toLowerCase();
  
  // Verificar UUID direto
  if (UUID_MAP[roletaId]) {
    console.log(`[API] UUID "${roletaId}" mapeado para ID canônico ${UUID_MAP[roletaId]}`);
    return UUID_MAP[roletaId];
  }
  
  // Verificar UUID normalizado (sem hífens)
  for (const [uuid, canonicalId] of Object.entries(UUID_MAP)) {
    if (uuid.replace(/-/g, '').toLowerCase() === normalizedUuid) {
      console.log(`[API] UUID normalizado "${roletaId}" mapeado para ID canônico ${canonicalId}`);
      return canonicalId;
    }
  }
  
  // Verificar pelo nome da roleta
  for (const roleta of ROLETAS_CANONICAS) {
    // Verificar pelo nome exato
    if (
      roletaId === roleta.nome || 
      (roleta.alternativeNames && roleta.alternativeNames.includes(roletaId))
    ) {
      console.log(`[API] Nome "${roletaId}" mapeado para ID canônico ${roleta.id}`);
      return roleta.id;
    }
  }
  
  // Caso não encontre correspondência, usar ID padrão (Speed Auto Roulette)
  console.warn(`[API] ID não mapeado "${roletaId}", usando ID padrão 2010096 (Speed Auto Roulette)`);
  return "2010096";
}

// Configuração básica para todas as APIs
const apiBaseUrl = getEnvVar('VITE_API_URL') || 'http://localhost:3000';

// Cache para evitar múltiplas solicitações para os mesmos dados
const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 60000; // 1 minuto em milissegundos

/**
 * Busca todas as roletas através do endpoint /api/ROULETTES
 */
export const fetchRoulettes = async (): Promise<RouletteData[]> => {
  try {
    // Verificar se temos dados em cache
    if (cache['roulettes'] && Date.now() - cache['roulettes'].timestamp < CACHE_TTL) {
      console.log('[API] Usando dados de roletas em cache');
      return cache['roulettes'].data;
    }

    console.log(`[API] Buscando roletas em: ${apiBaseUrl}/api/ROULETTES`);
    const response = await axios.get(`${apiBaseUrl}/api/ROULETTES`);
    
    if (response.data && Array.isArray(response.data)) {
      // Mapear dados recebidos para o formato com IDs canônicos
      const roletas = response.data.map((roleta: any) => {
        const uuid = roleta.id;
        const canonicalId = mapToCanonicalRouletteId(uuid);
        
        return {
          ...roleta,
          _id: canonicalId, // Adicionar o ID canônico
          uuid: uuid        // Preservar o UUID original
        };
      });
      
      // Armazenar em cache
      cache['roulettes'] = {
        data: roletas,
        timestamp: Date.now()
      };
      
      console.log(`[API] ✅ Recebidas ${roletas.length} roletas da API`);
      return roletas;
    }
    
    console.warn('[API] Resposta inválida da API de roletas');
    return [];
  } catch (error) {
    console.error('[API] Erro ao buscar roletas:', error);
    return [];
  }
}

/**
 * Busca uma roleta específica pelo ID usando o resultado de fetchRoulettes
 */
export const fetchRouletteById = async (roletaId: string): Promise<RouletteData | null> => {
  try {
    // Buscar todas as roletas
    const roletas = await fetchRoulettes();
    
    // Encontrar a roleta específica
    const roleta = roletas.find(r => 
      r._id === roletaId || 
      r.id === roletaId || 
      mapToCanonicalRouletteId(r.id || '') === roletaId
    );
    
    if (roleta) {
      console.log(`[API] ✅ Roleta encontrada para ID: ${roletaId}`);
      return roleta;
    }
    
    console.warn(`[API] Roleta não encontrada para ID: ${roletaId}`);
    return null;
  } catch (error) {
    console.error(`[API] Erro ao buscar roleta por ID ${roletaId}:`, error);
    return null;
  }
}

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
 * Busca os números mais recentes de uma roleta pelo ID canônico
 */
export const fetchRouletteNumbersById = async (canonicalId: string, limit = 100): Promise<any[]> => {
  try {
    // Verificar se já temos dados em cache para este ID
    const cacheKey = `numbers_${canonicalId}_${limit}`;
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      console.log(`[API] Usando dados em cache para números da roleta ${canonicalId}`);
      return cache[cacheKey].data;
    }
    
    console.log(`[API] Buscando números da roleta ${canonicalId} em: ${apiBaseUrl}/api/roulette-numbers/${canonicalId}?limit=${limit}`);
    const response = await axios.get(`${apiBaseUrl}/api/roulette-numbers/${canonicalId}?limit=${limit}`);
    
    if (response.data && Array.isArray(response.data)) {
      // Armazenar em cache
      cache[cacheKey] = {
        data: response.data,
        timestamp: Date.now()
      };
      
      console.log(`[API] ✅ Recebidos ${response.data.length} números para roleta ${canonicalId}`);
      return response.data;
    }
    
    console.warn(`[API] Resposta inválida da API de números para roleta ${canonicalId}`);
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
