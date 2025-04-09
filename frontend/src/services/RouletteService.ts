import axios from 'axios';
import { ENDPOINTS, getFullUrl, API_BASE_URL } from './api/endpoints';
import { getLogger } from './utils/logger';

const logger = getLogger('RouletteService');

class RouletteService {
  /**
   * Busca todas as roletas disponíveis na API com fallback
   * @returns Lista de roletas
   */
  async fetchAllRoulettes() {
    try {
      logger.info('Buscando todas as roletas');
      
      // Tentativa 1: Usar axios
      try {
        const response = await axios.get(getFullUrl(ENDPOINTS.ROULETTES));
        logger.info(`✅ ${response.data.length} roletas encontradas`);
        return response.data;
      } catch (axiosError) {
        logger.warn('⚠️ Falha ao buscar com axios, tentando método alternativo com fetch');
      }
      
      // Fallback: usar fetch diretamente
      try {
        const response = await fetch(`${API_BASE_URL}${ENDPOINTS.ROULETTES}`);
        if (response.ok) {
          const data = await response.json();
          logger.info(`✅ ${data.length} roletas encontradas via fetch`);
          return data;
        }
      } catch (fetchError) {
        logger.error('❌ Falha também no método com fetch');
      }
      
      logger.error('❌ Todos os métodos de requisição falharam');
      return [];
    } catch (error) {
      logger.error('❌ Erro ao buscar roletas:', error);
      return [];
    }
  }

  /**
   * Busca roletas com limite de 100 com fallback
   * @returns Lista limitada de roletas
   */
  async fetchLimitedRoulettes() {
    try {
      logger.info('Buscando roletas (limitadas a 100)');
      
      // Tentativa 1: Usar axios
      try {
        const response = await axios.get(getFullUrl(ENDPOINTS.ROULETTES_WITH_LIMIT));
        logger.info(`✅ ${response.data.length} roletas encontradas`);
        return response.data;
      } catch (axiosError) {
        logger.warn('⚠️ Falha ao buscar com axios, tentando método alternativo com fetch');
      }
      
      // Fallback: usar fetch diretamente
      try {
        const response = await fetch(`${API_BASE_URL}${ENDPOINTS.ROULETTES_WITH_LIMIT}`);
        if (response.ok) {
          const data = await response.json();
          logger.info(`✅ ${data.length} roletas encontradas via fetch`);
          return data;
        }
      } catch (fetchError) {
        logger.error('❌ Falha também no método com fetch');
      }
      
      logger.error('❌ Todos os métodos de requisição falharam');
      return [];
    } catch (error) {
      logger.error('❌ Erro ao buscar roletas limitadas:', error);
      return [];
    }
  }

  /**
   * Busca uma roleta específica pelo ID com fallback
   * @param id ID da roleta
   * @returns Dados da roleta ou null se não encontrada
   */
  async fetchRouletteById(id: string) {
    try {
      logger.info(`Buscando roleta com ID: ${id}`);
      
      // Primeiro tenta buscar todas as roletas
      const allRoulettes = await this.fetchAllRoulettes();
      
      // Filtrar pelo ID
      const roulette = allRoulettes.find((r: any) => 
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
  
  /**
   * Busca o histórico de números de uma roleta específica
   * @param id ID da roleta
   * @returns Array com o histórico de números ou vazio se falhar
   */
  async fetchRouletteHistory(id: string) {
    try {
      logger.info(`Buscando histórico da roleta ${id}`);
      
      // Buscar dados da roleta
      const roulette = await this.fetchRouletteById(id);
      
      if (!roulette) {
        logger.warn(`❌ Não foi possível encontrar a roleta ${id} para obter histórico`);
        return [];
      }
      
      // Tentar obter o histórico nos diferentes campos possíveis
      const history = roulette.numeros || roulette.numero || roulette.numbers || [];
      
      logger.info(`✅ Encontrados ${history.length} números no histórico da roleta ${id}`);
      return history;
    } catch (error) {
      logger.error(`❌ Erro ao buscar histórico da roleta ${id}:`, error);
      return [];
    }
  }
}

export default new RouletteService(); 