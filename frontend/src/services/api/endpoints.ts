/**
 * Definição de endpoints da API
 */

// URL base da API
export const API_BASE_URL = 'https://backendscraper-production.up.railway.app';

/**
 * Endpoints disponíveis
 */
export const ENDPOINTS = {
  // Roletas
  ROULETTES: '/api/ROULETTES',
  ROULETTES_WITH_LIMIT: '/api/ROULETTES?limit=100'
};

/**
 * Obtém a URL completa para um endpoint
 * @param endpoint Endpoint a ser acessado
 * @returns URL completa
 */
export const getFullUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};

export default ENDPOINTS; 