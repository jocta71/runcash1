import { ENDPOINTS } from './endpoints';
import axios from 'axios';
import { getLogger } from '../utils/logger';

const logger = getLogger('ApiService');

const API_BASE_URL = 'https://backendscraper-production.up.railway.app';

// Cliente Axios principal
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 20000 // 20 segundos de timeout
});

// Interceptador para logging
apiClient.interceptors.request.use(config => {
  logger.debug(`📤 Requisição ${config.method?.toUpperCase()} para ${config.url}`);
  return config;
});

apiClient.interceptors.response.use(
  response => {
    logger.debug(`📥 Resposta ${response.status} de ${response.config.url}`);
    return response;
  },
  error => {
    if (error.response) {
      logger.error(`🚫 Erro ${error.response.status} de ${error.config.url}: ${error.message}`);
    } else if (error.request) {
      logger.error(`🚫 Sem resposta para ${error.config.url}: ${error.message}`);
    } else {
      logger.error(`🚫 Erro na requisição para ${error.config.url}: ${error.message}`);
    }
    return Promise.reject(error);
  }
);

/**
 * Busca todas as roletas disponíveis
 * @param limit Limite opcional de resultados
 * @returns Promise com os dados das roletas
 */
export const fetchRoulettes = async (limit?: number) => {
  try {
    const url = limit ? `${ENDPOINTS.ROULETTES}?limit=${limit}` : ENDPOINTS.ROULETTES;
    logger.info(`Buscando roletas de ${url}`);
    
    const response = await apiClient.get(url);
    logger.info(`Recebidos ${response.data.length} roletas`);
    
    return response.data;
  } catch (error) {
    logger.error('Erro ao buscar roletas:', error);
    throw error;
  }
};

export default {
  fetchRoulettes
}; 