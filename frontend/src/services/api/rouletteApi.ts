import axios from 'axios';
import { ENDPOINTS } from './endpoints';

/**
 * Cliente de API para comunicação com os endpoints de roleta
 */
export const RouletteApi = {
  /**
   * Busca todas as roletas disponíveis
   * @returns Array de objetos de roleta
   */
  async fetchAllRoulettes() {
    try {
      console.log('[API] Buscando todas as roletas disponíveis');
      const response = await axios.get(ENDPOINTS.ROULETTES);
      
      if (!response.data || !Array.isArray(response.data)) {
        console.error('[API] Resposta inválida da API de roletas:', response.data);
        return [];
      }
      
      console.log(`[API] ✅ Obtidas ${response.data.length} roletas`);
      return response.data;
    } catch (error) {
      console.error('[API] Erro ao buscar roletas:', error);
      return [];
    }
  },

  /**
   * Busca uma roleta específica pelo ID
   * @param id ID da roleta a ser buscada
   * @returns Objeto da roleta encontrada ou null
   */
  async fetchRouletteById(id: string) {
    try {
      console.log(`[API] Buscando roleta com ID: ${id}`);
      // Buscar todas as roletas e filtrar localmente
      // Este método é mais eficiente do que fazer múltiplas requisições
      const allRoulettes = await this.fetchAllRoulettes();
      
      const roulette = allRoulettes.find((r: any) => 
        r.id === id || r.canonical_id === id
      );
      
      if (roulette) {
        console.log(`[API] ✅ Roleta encontrada: ${roulette.nome || roulette.name}`);
        return roulette;
      }
      
      console.warn(`[API] ❌ Roleta com ID ${id} não encontrada`);
      return null;
    } catch (error) {
      console.error(`[API] Erro ao buscar roleta ${id}:`, error);
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
      
      // Buscar dados da roleta que já incluem a estratégia
      const roulette = await this.fetchRouletteById(id);
      
      if (!roulette) {
        console.warn(`[API] Roleta ${id} não encontrada para estratégia`);
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
      
      console.log(`[API] ✅ Estratégia obtida para roleta ${id}`);
      return strategy;
    } catch (error) {
      console.error(`[API] Erro ao buscar estratégia para roleta ${id}:`, error);
      return null;
    }
  }
}; 