import axios from 'axios';
import { ENDPOINTS, getFullUrl } from './endpoints';
import { getLogger } from '../utils/logger';

const logger = getLogger('ApiService');

const API_BASE_URL = 'https://backendscraper-production.up.railway.app';

// Configurar o cliente Axios
const api = axios.create({
  timeout: 30000, // 30 segundos
  headers: {
    'Content-Type': 'application/json',
  }
});

// Adicionar interceptadores para logging
api.interceptors.request.use(
  (config) => {
    console.log(`🔄 Requisição enviada para: ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ Erro na requisição:', error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    console.log(`✅ Resposta recebida de: ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('❌ Erro na resposta:', error);
    return Promise.reject(error);
  }
);

/**
 * Função para buscar todas as roletas
 * @returns Promise com os dados das roletas
 */
export const fetchRoulettes = async () => {
  try {
    const response = await api.get(getFullUrl(ENDPOINTS.ROULETTES));
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao buscar roletas:', error);
    throw error;
  }
};

/**
 * Função para buscar roletas com limite
 * @returns Promise com os dados das roletas limitadas
 */
export const fetchLimitedRoulettes = async () => {
  try {
    const response = await api.get(getFullUrl(ENDPOINTS.ROULETTES_WITH_LIMIT));
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao buscar roletas limitadas:', error);
    throw error;
  }
};

export default api; 