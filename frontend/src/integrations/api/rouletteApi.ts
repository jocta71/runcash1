// Removendo a importação do mapeamento canônico que pode estar filtrando roletas
// import { mapToCanonicalRouletteId } from './rouletteService';

// Cache para otimizar as requisições
const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 60000; // 1 minuto em milissegundos

/**
 * Busca todas as roletas e inclui os números mais recentes para cada uma.
 * Esta API foi desativada conforme solicitado.
 */
export const fetchRoulettesWithNumbers = async (limit = 20): Promise<any[]> => {
  console.log('[API] ⛔ DESATIVADO: Requisições para /api/roulettes foram removidas');
  return [];
};

/**
 * Busca uma roleta específica por ID e inclui seus números mais recentes.
 * Esta API foi desativada conforme solicitado.
 */
export const fetchRouletteWithNumbers = async (roletaId: string, limit = 20): Promise<any | null> => {
  console.log(`[API] ⛔ DESATIVADO: Requisições para /api/roulettes foram removidas`);
  return null;
}; 