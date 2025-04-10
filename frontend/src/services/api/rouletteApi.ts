import axios from 'axios';
import ENDPOINTS, { getFullUrl } from './endpoints';
import { getLogger } from '../utils/logger';

// Logger para a API
const Logger = getLogger('RouletteAPI');

/**
 * Interface para dados da roleta
 */
export interface RouletteData {
  id?: string;
  _id?: string;
  roleta_id?: string;
  name?: string;
  nome?: string;
  numeros?: Array<{
    numero: string | number;
    roleta_id?: string;
    timestamp?: number;
    cor?: string;
  }>;
  lastNumbers?: Array<{
    numero: string | number;
    roleta_id?: string;
    timestamp?: number;
    cor?: string;
  }>;
  vitorias?: number;
  derrotas?: number;
  estado_estrategia?: string;
  active?: boolean;
}

/**
 * Função auxiliar para extrair o ID numérico da roleta
 * @param roulette Dados da roleta
 * @returns ID numérico da roleta
 */
function getNumericId(roulette: RouletteData): string {
  if (roulette.roleta_id) return roulette.roleta_id;
  
  if (roulette.numeros && roulette.numeros.length > 0) {
    const firstNumber = roulette.numeros[0];
    if (firstNumber && firstNumber.roleta_id) {
      return firstNumber.roleta_id;
    }
  }
  
  return roulette.id || roulette._id || '';
}

/**
 * API para interação com dados de roletas
 */
export class RouletteApi {
  /**
   * Busca todas as roletas disponíveis
   * @returns Lista de roletas processadas
   */
  static async fetchAllRoulettes(): Promise<RouletteData[]> {
    try {
      Logger.info('Buscando todas as roletas do servidor de produção');
      const response = await axios.get(getFullUrl(ENDPOINTS.ROULETTES_LIMITED));
      
      if (!response || !response.data) {
        Logger.warn('Nenhuma roleta retornada pela API');
        return [];
      }
      
      // Certifica que todas as roletas tenham um ID válido
      const roulettes = response.data.map((roulette: RouletteData) => {
        // Garante que cada roleta tenha um roleta_id (pode vir de diferentes lugares)
        if (!roulette.roleta_id) {
          const numericId = getNumericId(roulette);
          if (numericId) {
            roulette.roleta_id = numericId;
          } else {
            Logger.warn(`Roleta sem ID válido: ${JSON.stringify(roulette)}`);
          }
        }
        return roulette;
      });
      
      return roulettes;
    } catch (error) {
      Logger.error('Erro ao buscar roletas:', error);
      return [];
    }
  }
  
  /**
   * Busca uma roleta específica pelo ID
   * @param id ID da roleta
   * @returns Dados da roleta ou null se não encontrada
   */
  static async fetchRouletteById(id: string): Promise<RouletteData | null> {
    if (!id) {
      Logger.warn('ID da roleta não fornecido para busca');
      return null;
    }
    
    try {
      Logger.info(`Buscando roleta com ID: ${id}`);
      const response = await axios.get(getFullUrl(`${ENDPOINTS.ROULETTES}/${id}`));
      
      if (!response || !response.data) {
        Logger.warn(`Roleta com ID ${id} não encontrada`);
        return null;
      }
      
      // Garante que a roleta retornada tenha um ID válido
      const roulette = response.data;
      if (!roulette.roleta_id) {
        roulette.roleta_id = id;
      }
      
      return roulette;
    } catch (error) {
      Logger.error(`Erro ao buscar roleta com ID ${id}:`, error);
      return null;
    }
  }
  
  /**
   * Busca o histórico de números de uma roleta específica
   * @param id ID da roleta
   * @returns Lista de números da roleta
   */
  static async fetchRouletteHistory(id: string): Promise<any[]> {
    if (!id) {
      Logger.warn('ID da roleta não fornecido para busca de histórico');
      return [];
    }
    
    try {
      Logger.info(`Buscando histórico da roleta com ID: ${id}`);
      const response = await axios.get(getFullUrl(`${ENDPOINTS.HISTORY}/${id}`));
      
      if (!response || !response.data) {
        Logger.warn(`Histórico da roleta com ID ${id} não encontrado`);
        return [];
      }
      
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      Logger.error(`Erro ao buscar histórico da roleta com ID ${id}:`, error);
      return [];
    }
  }
}

// Exportar a API como default
export default RouletteApi; 