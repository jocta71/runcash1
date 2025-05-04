import axios from 'axios';
import { getRouletteTypeByName } from '../../utils/roulette-utils';

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
 * Mapeamento de IDs de roletas para o formato canônico
 * Cada roleta deve ter um ID único e consistente
 */
const rouletteIdMappings: Record<string, string> = {
  // Mapeamentos conhecidos
  'immersive_roulette': 'immersive',
  'roulette_lobby': 'lobby',
  'auto_roulette': 'auto',
  'lightning_roulette': 'lightning',
  'speed_roulette': 'speed',
  'vivo_roleta_zeus': 'zeus_vivo',
  'vivo_roleta_brasileira': 'brasileira_vivo',
  'roleta_brasileira': 'brasileira'
};

/**
 * Mapeia o ID da roleta para o formato canônico
 * @param originalId ID original ou nome da roleta
 * @returns ID canônico normalizado
 */
export function mapToCanonicalRouletteId(originalId: string): string {
  // Se o ID já estiver no mapeamento, retornar o valor mapeado
  if (rouletteIdMappings[originalId.toLowerCase()]) {
    return rouletteIdMappings[originalId.toLowerCase()];
  }
  
  // Para IDs não mapeados, normalizar para lowercase e remover espaços/caracteres especiais
  return originalId
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

// Configuração básica para todas as APIs
const apiBaseUrl = '/api'; // Usar o endpoint relativo para aproveitar o proxy

// Cache para evitar múltiplas solicitações para os mesmos dados
const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 60000; // 1 minuto em milissegundos

/**
 * Busca todas as roletas através do endpoint /api/roulettes
 * @returns Array com todas as roletas disponíveis
 */
export const fetchAllRoulettes = async (): Promise<any[]> => {
  try {
    // Aqui usaremos a API rouletteApi para buscar as roletas
    const { fetchRoulettesWithNumbers } = await import('./rouletteApi');
    const roulettes = await fetchRoulettesWithNumbers();
    
    return roulettes.map(processRouletteData);
  } catch (error) {
    console.error('Error fetching roulettes:', error);
    return [];
  }
};

/**
 * Função para processar dados brutos da roleta e adicionar informações úteis
 * @param roleta Dados brutos da roleta da API
 * @returns Roleta processada com dados adicionais
 */
export const processRouletteData = (roleta: any): any => {
  if (!roleta) return null;
  
  // Normalizar propriedades
  const nome = roleta.nome || roleta.name || 'Sem nome';
  const id = roleta.id || roleta._id || mapToCanonicalRouletteId(nome);
  
  // Adicionar tipo da roleta
  const rouletteType = getRouletteTypeByName(nome);
  
  return {
    ...roleta,
    id: id,
    nome: nome,
    nome_canonico: nome.toLowerCase().trim(),
    id_canonico: mapToCanonicalRouletteId(id),
    tipo: rouletteType,
    imagem: roleta.imagem || `/images/roulettes/${mapToCanonicalRouletteId(id)}.png`,
    // Certificar-se de que números seja um array
    numeros: Array.isArray(roleta.numeros) ? roleta.numeros : 
             Array.isArray(roleta.numero) ? roleta.numero : []
  };
};

/**
 * Busca todas as roletas através do endpoint /api/roulettes e adiciona números reais a cada uma
 * @returns Array com todas as roletas disponíveis, incluindo números
 */
export const fetchAllRoulettesWithNumbers = async (): Promise<any[]> => {
  try {
    // Aqui usaremos a API rouletteApi para buscar as roletas com números
    const { fetchRoulettesWithNumbers } = await import('./rouletteApi');
    const roulettes = await fetchRoulettesWithNumbers();
    
    return roulettes.map(processRouletteData);
  } catch (error) {
    console.error('Error fetching roulettes with numbers:', error);
    return [];
  }
};

/**
 * Busca uma roleta específica pelo ID usando o resultado de fetchRoulettes
 */
export const fetchRouletteById = async (roletaId: string): Promise<RouletteData | null> => {
  try {
    // Buscar todas as roletas
    const roletas = await fetchAllRoulettes();
    
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
    
    console.log(`[API] Requisições para /api/roulettes desativadas, usando dados mockados para roleta ${canonicalId}`);
    
    // Gerar números mockados
    const mockNumbers = Array.from({length: limit}, (_, i) => ({
      numero: Math.floor(Math.random() * 37),
      cor: ['vermelho', 'preto', 'verde'][Math.floor(Math.random() * 3)],
      timestamp: new Date(Date.now() - i * 60000).toISOString()
    }));
    
    // Armazenar em cache
    cache[cacheKey] = {
      data: mockNumbers,
      timestamp: Date.now()
    };
    
    console.log(`[API] ✅ Mockados ${mockNumbers.length} números para roleta ${canonicalId}`);
    return mockNumbers;
  } catch (error) {
    console.error(`[API] Erro ao gerar números mockados para roleta ${canonicalId}:`, error);
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
