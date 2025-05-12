import axios from 'axios';
import { getRouletteTypeByName } from '../../utils/roulette-utils';
import * as RouletteApi from '../../services/api/rouletteApi';
import { processRouletteData } from '../../utils/rouletteUtils';

// Função auxiliar para determinar a cor de um número
function determinarCorNumero(numero: number): string {
  if (numero === 0) return 'verde';
  if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(numero)) {
    return 'vermelho';
  }
  return 'preto';
}

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
 * 
 * @deprecated Este método está depreciado. Use UnifiedRouletteClient.getInstance().getAllRoulettes() em vez disso.
 * @returns Promise com o array de todas as roletas
 */
export async function getAllRoulettes(): Promise<RouletteData[]> {
  try {
    console.warn('DEPRECIADO: O método getAllRoulettes() está depreciado. Use UnifiedRouletteClient.getInstance().getAllRoulettes() em vez disso.');
    
    // Importar UnifiedRouletteClient dinamicamente
    const { default: UnifiedRouletteClient } = await import('../../services/UnifiedRouletteClient');
    const client = UnifiedRouletteClient.getInstance();
    
    // Obter dados do cliente unificado
    return client.getAllRoulettes();
  } catch (error) {
    console.error('Erro ao buscar roletas:', error);
    // Fallback para dados vazios em caso de erro
    return [];
  }
}

/**
 * Função para processar dados brutos da roleta e adicionar informações úteis
 * @param roleta Dados brutos da roleta da API
 * @returns Roleta processada com dados adicionais
 */
export { processRouletteData };

/**
 * Busca todas as roletas através do endpoint /api/roulettes e adiciona números reais a cada uma
 * 
 * @deprecated Este método está depreciado. Use UnifiedRouletteClient.getInstance().getAllRoulettes() em vez disso.
 * @returns Promise com o array de todas as roletas com números
 */
export async function getAllRoulettesWithRealNumbers(): Promise<RouletteData[]> {
  try {
    console.warn('DEPRECIADO: O método getAllRoulettesWithRealNumbers() está depreciado. Use UnifiedRouletteClient.getInstance().getAllRoulettes() em vez disso.');
    
    // Importar UnifiedRouletteClient dinamicamente
    const { default: UnifiedRouletteClient } = await import('../../services/UnifiedRouletteClient');
    const client = UnifiedRouletteClient.getInstance();
    
    // Obter dados do cliente unificado
    return client.getAllRoulettes();
  } catch (error) {
    console.error('Erro ao buscar roletas com números reais:', error);
    // Fallback para dados vazios em caso de erro
    return [];
  }
}

/**
 * Busca uma roleta específica pelo ID
 * @deprecated Este método está depreciado. Use UnifiedRouletteClient.getInstance().getRouletteById(id) em vez disso.
 * @param id ID da roleta a ser buscada
 * @returns Dados da roleta ou null se não encontrada
 */
export const getRouletteById = async (id: string): Promise<RouletteData | null> => {
  try {
    console.warn('DEPRECIADO: O método getRouletteById() está depreciado. Use UnifiedRouletteClient.getInstance().getRouletteById(id) em vez disso.');
    
    // Buscar todas as roletas e filtrar pela ID desejada
    const roulettes = await getAllRoulettes();
    return roulettes.find(roulette => roulette.id === id) || null;
  } catch (error) {
    console.error(`Erro ao buscar roleta com ID ${id}:`, error);
    return null;
  }
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
    
    // Verificar se existe um token de autenticação
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn(`[API] Token de autenticação não encontrado. Usando dados mockados para roleta ${canonicalId}`);
      
      // Gerar dados mockados para este caso
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
      
      return mockNumbers;
    }
    
    console.log(`[API] Buscando números para roleta ${canonicalId} da API`);
    
    // Buscar os dados das roletas
    const response = await RouletteApi.RouletteApi.fetchAllRoulettes();
    
    // Verificar se houve erro na busca
    if (response.error || !('data' in response)) {
      console.error(`[API] Erro ao buscar roletas para obter números: ${response.message || 'Resposta inválida'}`);
      throw new Error(response.message || 'Resposta inválida');
    }
    
    // Encontrar a roleta específica
    const roleta = response.data.find((r: any) => 
      r._id === canonicalId || 
      r.id === canonicalId || 
      mapToCanonicalRouletteId(r.id || '') === canonicalId
    );
    
    if (!roleta) {
      console.warn(`[API] Roleta não encontrada para ID ${canonicalId}`);
      return [];
    }
    
    // Extrair números da roleta
    let numbers: any[] = [];
    
    if (roleta.numero && Array.isArray(roleta.numero)) {
      numbers = roleta.numero.map((n: any) => ({
        numero: n.numero || n.number || 0,
        cor: n.cor || determinarCorNumero(n.numero || n.number || 0),
        timestamp: n.timestamp || new Date().toISOString()
      }));
    }
    
    // Limitar ao número solicitado
    const limitedNumbers = numbers.slice(0, limit);
    
    // Armazenar em cache
    cache[cacheKey] = {
      data: limitedNumbers,
      timestamp: Date.now()
    };
    
    console.log(`[API] ✅ Obtidos ${limitedNumbers.length} números para roleta ${canonicalId}`);
    return limitedNumbers;
  } catch (error) {
    console.error(`[API] Erro ao buscar números para roleta ${canonicalId}:`, error);
    return [];
  }
}

/**
 * Busca a estratégia atual de uma roleta
 */
export const fetchRouletteStrategy = async (roletaId: string): Promise<RouletteStrategy | null> => {
  try {
    // Buscar a roleta para obter a estratégia
    const roleta = await getRouletteById(roletaId);
    
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
