import axios from 'axios';
import { ENDPOINTS, getFullUrl } from './api/endpoints';
import { getLogger } from './utils/logger';

const logger = getLogger('RouletteService');

class RouletteService {
  /**
   * Busca todas as roletas disponíveis na API
   * @returns Lista de roletas
   */
  async fetchAllRoulettes() {
    try {
      logger.info('Buscando todas as roletas');
      const response = await axios.get(getFullUrl(ENDPOINTS.ROULETTES));
      logger.info(`✅ ${response.data.length} roletas encontradas`);
      return response.data;
    } catch (error) {
      logger.error('❌ Erro ao buscar roletas:', error);
      return [];
    }
  }

  /**
   * Busca roletas com limite de 100
   * @returns Lista limitada de roletas
   */
  async fetchLimitedRoulettes() {
    try {
      logger.info('Buscando roletas (limitadas a 100)');
      const response = await axios.get(getFullUrl(ENDPOINTS.ROULETTES_WITH_LIMIT));
      logger.info(`✅ ${response.data.length} roletas encontradas`);
      return response.data;
    } catch (error) {
      logger.error('❌ Erro ao buscar roletas limitadas:', error);
      return [];
    }
  }

  /**
   * Busca uma roleta específica pelo ID
   * @param id ID da roleta
   * @returns Dados da roleta ou null se não encontrada
   */
  async fetchRouletteById(id: string) {
    try {
      logger.info(`Buscando roleta com ID: ${id}`);
      // Usamos o endpoint principal e filtramos pelo ID
      const response = await axios.get(getFullUrl(ENDPOINTS.ROULETTES));
      const roulette = response.data.find((r: any) => 
        r.roleta_id === id || r._id === id || r.id === id
      );
      
      if (roulette) {
        logger.info(`✅ Roleta encontrada: ${roulette.nome || roulette.name}`);
        return roulette;
      }
      
      logger.warn(`❌ Roleta com ID ${id} não encontrada`);
      return null;
    } catch (error) {
      logger.error(`❌ Erro ao buscar roleta ${id}:`, error);
      return null;
    }
  }
}

export default new RouletteService(); 