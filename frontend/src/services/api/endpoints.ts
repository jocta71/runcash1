// Adicionar um endpoint para verificação de saúde da API
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://runcashh111.vercel.app';

// URLs para os endpoints da API
export const ENDPOINTS = {
  // Endpoints de streaming SSE - único endpoint mantido conforme solicitado
  STREAM: {
    // Endpoint principal para streaming de roletas
    ROULETTES: `${API_URL}/api/stream/roulettes`,
    
    // Endpoint para estatísticas do serviço de streaming
    STATS: '/api/stream/stats',
    
    // Endpoint para diagnóstico do serviço de streaming
    DIAGNOSTIC: '/api/stream/diagnostic'
  },

  // Endpoints para dados históricos
  HISTORICAL: {
    ALL_ROULETTES: `${API_URL}/api/historical/all-roulettes`, // Endpoint para buscar histórico inicial de todas as roletas
  },

  API: {
    HEALTH: `${API_URL}/api/health-check` // Ajustando o nome do endpoint para health-check
  }
};

// Obtém a URL base da API a partir de variáveis de ambiente
export const getApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_BASE_URL || '/api';
};

// Obtém a URL completa para um endpoint
export const getFullUrl = (endpoint: string): string => {
  return endpoint.startsWith('http') ? endpoint : endpoint;
}; 