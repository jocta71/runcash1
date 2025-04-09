// URLs para os endpoints da API
export const ENDPOINTS = {
  // Endpoint principal para roletas
  ROULETTES: '/api/ROULETTES',
  
  // Endpoint para roletas com limite
  ROULETTES_WITH_LIMIT: '/api/ROULETTES?limit=100'
};

// Obtém a URL base da API a partir de variáveis de ambiente
export const getApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_URL || 'https://backendscraper-production.up.railway.app';
};

// Obtém a URL completa para um endpoint
export const getFullUrl = (endpoint: string): string => {
  return `${getApiBaseUrl()}${endpoint}`;
}; 