import { ENDPOINTS } from './endpoints';
import { getNumericId } from '../data/rouletteTransformer';
import { fetchWithCorsSupport } from '../../utils/api-helpers';

export type RouletteData = {
  id: string;
  name: string;
  isOpen: boolean;
  lastNumbers: { value: number; color: string }[];
  provider: string;
};

/**
 * Cliente de API para comunicação com os endpoints de roleta
 */
export const RouletteApi = {
  /**
   * Busca todas as roletas disponíveis
   * @returns Array de objetos de roleta
   */
  async fetchAllRoulettes(): Promise<RouletteData[]> {
    try {
      console.log('[API] Buscando todas as roletas disponíveis');
      const data = await fetchWithCorsSupport<RouletteData[]>('/ROULETTES');
      
      if (!data || !Array.isArray(data)) {
        console.error('Resposta da API de roletas inválida:', data);
        return [];
      }
      
      console.log(`[API] ✅ Obtidas ${data.length} roletas`);
      
      // Processar cada roleta para extrair campos relevantes
      const processedRoulettes = data.map((roulette: any) => {
        // Garantir que temos o campo roleta_id em cada objeto
        if (!roulette.roleta_id && roulette._id) {
          const numericId = getNumericId(roulette._id);
          console.log(`[API] Adicionando roleta_id=${numericId} para roleta UUID=${roulette._id}`);
          roulette.roleta_id = numericId;
        }
        return roulette;
      });
      
      return processedRoulettes;
    } catch (error) {
      console.error('Erro ao buscar roletas:', error);
      return [];
    }
  },

  /**
   * Busca uma roleta específica pelo ID
   * @param id ID da roleta a ser buscada
   * @returns Objeto da roleta encontrada ou null
   */
  async fetchRouletteById(id: string): Promise<RouletteData | null> {
    try {
      console.log(`[API] Buscando roleta com ID: ${id}`);
      const data = await fetchWithCorsSupport<RouletteData>(`/ROULETTES/${id}`);
      return data || null;
    } catch (error) {
      console.error(`Erro ao buscar roleta por ID ${id}:`, error);
      return null;
    }
  },
  
  /**
   * Busca a estratégia atual para uma roleta
   * @param id ID da roleta
   * @returns Objeto de estratégia ou null
   */
  async fetchRouletteStrategy(id: string) {
    try {
      console.log(`[API] Buscando estratégia para roleta ID: ${id}`);
      
      // Converter para ID numérico para normalização
      const numericId = getNumericId(id);
      
      // Buscar dados da roleta que já incluem a estratégia
      const roulette = await this.fetchRouletteById(numericId);
      
      if (!roulette) {
        console.warn(`[API] Roleta ${numericId} não encontrada para estratégia`);
        return null;
      }
      
      // Extrair dados da estratégia do objeto da roleta
      const strategy = {
        estado: roulette.estado_estrategia || 'NEUTRAL',
        numero_gatilho: roulette.numero_gatilho || null,
        terminais_gatilho: roulette.terminais_gatilho || [],
        vitorias: roulette.vitorias || 0,
        derrotas: roulette.derrotas || 0,
        sugestao_display: roulette.sugestao_display || ''
      };
      
      console.log(`[API] ✅ Estratégia obtida para roleta ${numericId}`);
      return strategy;
    } catch (error) {
      console.error(`[API] Erro ao buscar estratégia para roleta ${id}:`, error);
      return null;
    }
  },
  
  /**
   * Busca o histórico de números de uma roleta específica
   * @param rouletteName Nome da roleta
   * @returns Array com até 1000 números históricos
   */
  async fetchRouletteHistory(rouletteName: string) {
    try {
      console.log(`[API] Buscando histórico para roleta: ${rouletteName}`);
      
      const data = await fetchWithCorsSupport(`/ROULETTE_HISTORY/${encodeURIComponent(rouletteName)}`);
      
      if (!data || !Array.isArray(data)) {
        console.error('[API] Resposta inválida do histórico:', data);
        return [];
      }
      
      console.log(`[API] ✅ Obtidos ${data.length} números históricos`);
      return data;
    } catch (error) {
      console.error(`[API] Erro ao buscar histórico da roleta ${rouletteName}:`, error);
      return [];
    }
  }
}; 