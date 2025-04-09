import axios from 'axios';
import { ENDPOINTS, getFullUrl, API_BASE_URL } from './endpoints';
import { getNumericId } from '../data/rouletteTransformer';
import { getLogger } from '../utils/logger';
import { fetchWithCorsHandling } from '../utils/cors-helpers';

const logger = getLogger('RouletteApi');

/**
 * API para interação com dados de roletas
 */
export class RouletteApi {
  /**
   * Busca todas as roletas disponíveis com tratamento de CORS
   * @returns Promise com os dados de todas as roletas
   */
  static async fetchAllRoulettes() {
    logger.info('🔄 Buscando todas as roletas...');
    
    try {
      // Usar o utilitário de CORS para garantir que a requisição funcione
      const endpoint = getFullUrl(ENDPOINTS.ROULETTES, false);
      const data = await fetchWithCorsHandling(endpoint);
      
      if (Array.isArray(data) && data.length > 0) {
        logger.info(`✅ ${data.length} roletas encontradas`);
        return data;
      } else {
        // Se não obteve dados com o primeiro endpoint, tentar alternativa direta
        logger.warn('⚠️ Não foi possível obter roletas com o endpoint principal, tentando alternativa...');
        
        const response = await fetch('/api/ROULETTES', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          mode: 'cors' // Tentar com cors primeiro
        });
        
        if (response.ok) {
          const data = await response.json();
          logger.info(`✅ ${data.length} roletas encontradas (via fetch direto)`);
          return data;
        } else {
          throw new Error(`Erro HTTP: ${response.status}`);
        }
      }
    } catch (error) {
      logger.error('❌ Erro ao buscar roletas:', error);
      // Último recurso: tentar com no-cors (retorna resposta vazia, mas não causa erro)
      logger.info('🔄 Tentando com modo no-cors como último recurso...');
      try {
        const response = await fetch('/api/ROULETTES', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          mode: 'no-cors'
        });
        // Resposta no-cors é opaca, retornamos um array vazio
        logger.info('⚠️ Usando array vazio devido ao modo no-cors');
        return [];
      } catch (e) {
        return []; // Retornar array vazio em vez de propagar erro
      }
    }
  }

  /**
   * Busca roletas com limite (100) com tratamento de CORS
   * @returns Promise com os dados das roletas limitadas
   */
  static async fetchLimitedRoulettes() {
    logger.info('🔄 Buscando roletas com limite...');
    
    try {
      // Usar o utilitário de CORS para garantir que a requisição funcione
      const endpoint = getFullUrl(ENDPOINTS.ROULETTES_WITH_LIMIT, false);
      const data = await fetchWithCorsHandling(endpoint);
      
      if (Array.isArray(data) && data.length > 0) {
        logger.info(`✅ ${data.length} roletas limitadas encontradas`);
        return data;
      } else {
        // Se não obteve dados com o primeiro endpoint, tentar alternativa direta
        const response = await fetch('/api/ROULETTES?limit=100', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          logger.info(`✅ ${data.length} roletas encontradas (via fetch)`);
          return data;
        } else {
          throw new Error(`Erro HTTP: ${response.status}`);
        }
      }
    } catch (error) {
      logger.error('❌ Erro ao buscar roletas limitadas:', error);
      return []; // Retornar array vazio em vez de propagar erro
    }
  }

  /**
   * Busca o histórico de uma roleta específica
   * @param roletaId ID da roleta
   * @returns Promise com o histórico da roleta
   */
  static async fetchRouletteHistory(roletaId: string) {
    logger.info(`🔄 Buscando histórico da roleta ${roletaId}...`);
    
    try {
      // Usar o endpoint principal, filtrando por ID
      const allRoulettes = await this.fetchAllRoulettes();
      
      // Encontrar a roleta específica pelo ID
      const roulette = allRoulettes.find((r: any) => 
        r.id === roletaId || r.roleta_id === roletaId || r._id === roletaId
      );
      
      if (!roulette) {
        logger.warn(`⚠️ Roleta com ID ${roletaId} não encontrada`);
        return [];
      }
      
      logger.info(`✅ Histórico da roleta ${roletaId} encontrado`);
      return roulette.numeros || roulette.history || [];
    } catch (error) {
      logger.error(`❌ Erro ao buscar histórico da roleta ${roletaId}:`, error);
      return []; // Retornar array vazio em vez de propagar erro
    }
  }
} 