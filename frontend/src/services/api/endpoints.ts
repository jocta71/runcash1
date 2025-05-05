// URLs para os endpoints da API
export const ENDPOINTS = {
  // Endpoints de streaming SSE
  STREAM: {
    ROULETTES: 'stream/roulettes',
    STATS: 'stream/stats',
    DIAGNOSTIC: 'stream/diagnostic'
  },

  // Endpoints para dados históricos
  HISTORICAL: {
    ALL_ROULETTES: 'historical/all-roulettes',
  }
};

// Obtém a URL base da API a partir de variáveis de ambiente
export const getApiBaseUrl = (): string => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  return baseUrl === '/' ? '' : baseUrl;
};

// Obtém a URL completa para um endpoint
export const getFullUrl = (endpoint: string): string => {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
}; 