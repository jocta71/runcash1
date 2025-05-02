// Removendo a importação do mapeamento canônico que pode estar filtrando roletas
// import { mapToCanonicalRouletteId } from './rouletteService';
import axios from 'axios';

// Cache para otimizar as requisições
const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 60000; // 1 minuto em milissegundos

/**
 * Busca todas as roletas e inclui os números mais recentes para cada uma.
 * Esta API combina os dados que normalmente seriam buscados separadamente.
 * 
 * IMPORTANTE: Esta função está descontinuada e não deve mais ser usada.
 * O endpoint /api/ROULETTES foi desativado.
 */
export const fetchRoulettesWithNumbers = async (limit = 20): Promise<any[]> => {
  try {
    console.warn('[API] ATENÇÃO: O endpoint /api/ROULETTES está descontinuado e não deve mais ser usado.');
    console.log('[API] Retornando array vazio conforme política de descontinuação do endpoint.');
    return [];
  } catch (error) {
    console.error('[API] Erro ao buscar roletas com números:', error);
    return [];
  }
};

/**
 * Busca uma roleta específica por ID e inclui seus números mais recentes
 * 
 * IMPORTANTE: Esta função está descontinuada e não deve mais ser usada.
 * O endpoint /api/ROULETTES foi desativado.
 */
export const fetchRouletteWithNumbers = async (roletaId: string, limit = 20): Promise<any | null> => {
  try {
    console.warn('[API] ATENÇÃO: O endpoint /api/ROULETTES está descontinuado e não deve mais ser usado.');
    console.log('[API] Retornando null conforme política de descontinuação do endpoint.');
    return null;
  } catch (error) {
    console.error(`[API] Erro ao buscar roleta ${roletaId} com números:`, error);
    return null;
  }
}; 