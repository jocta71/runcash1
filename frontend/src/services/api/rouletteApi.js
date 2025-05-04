/**
 * Serviço para comunicação com a API de roletas
 * Esta versão suporta a decodificação de respostas criptografadas
 */

import { ENDPOINTS } from '../config/endpoints';
import { fetchAndDecrypt } from '../../utils/decryptionUtils';

export class RouletteApi {
  /**
   * Busca a lista de todas as roletas disponíveis
   * @returns {Promise<Array>} Lista de roletas
   */
  static async getAll() {
    try {
      // Usando o novo método fetchAndDecrypt para lidar com dados criptografados
      const roulettes = await fetchAndDecrypt(ENDPOINTS.ROULETTES);
      return roulettes;
    } catch (error) {
      console.error('Erro ao buscar roletas:', error);
      throw error;
    }
  }

  /**
   * Busca os dados de uma roleta específica
   * @param {string} id - ID da roleta
   * @returns {Promise<Object>} Dados da roleta
   */
  static async getById(id) {
    try {
      const url = `${ENDPOINTS.ROULETTES}/${id}`;
      const rouletteData = await fetchAndDecrypt(url);
      return rouletteData;
    } catch (error) {
      console.error(`Erro ao buscar roleta ${id}:`, error);
      throw error;
    }
  }

  /**
   * Busca os números de uma roleta específica
   * @param {string} id - ID da roleta
   * @param {number} limit - Limite de números a retornar
   * @returns {Promise<Array>} Números da roleta
   */
  static async getNumbers(id, limit = 50) {
    try {
      const url = `${ENDPOINTS.ROULETTES}/${id}/numbers?limit=${limit}`;
      const numbersData = await fetchAndDecrypt(url);
      return numbersData;
    } catch (error) {
      console.error(`Erro ao buscar números da roleta ${id}:`, error);
      throw error;
    }
  }
}

export default RouletteApi; 