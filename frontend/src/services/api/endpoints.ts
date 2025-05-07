// URLs para os endpoints da API
export const ENDPOINTS = {
  // Endpoints de streaming SSE - único endpoint mantido conforme solicitado
  STREAM: {
    // Endpoint principal para streaming de roletas
    ROULETTES: '/api/stream/roulettes',
    
    // Endpoint para estatísticas do serviço de streaming
    STATS: '/api/stream/stats',
    
    // Endpoint para diagnóstico do serviço de streaming
    DIAGNOSTIC: '/api/stream/diagnostic'
  },

  // Endpoints para dados históricos
  HISTORICAL: {
    ALL_ROULETTES: '/historical/all-roulettes', // Endpoint para buscar histórico inicial de todas as roletas
  },
  
  // Endpoint para metadados das roletas
  METADATA: {
    ROULETTES: '/api/metadados/roletas', // Endpoint para buscar metadados das roletas
  }
};

// Obtém a URL base da API a partir de variáveis de ambiente
export const getApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_BASE_URL || '/api';
};

// Obtém a URL completa para um endpoint
export const getFullUrl = (endpoint: string): string => {
  return `${getApiBaseUrl()}${endpoint}`;
}; 