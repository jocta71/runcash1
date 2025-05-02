// URLs para os endpoints da API
export const ENDPOINTS = {
  // Endpoint principal para roletas (descontinuado)
  ROULETTES: 'https://backendapi-production-36b5.up.railway.app/api/roulettes',
  
  // Endpoint para histórico de roletas
  ROULETTE_HISTORY: '/api/roulettes/history',
  
  // Endpoint para eventos em tempo real
  EVENTS: '/api/events',
  
  // Endpoint para estratégias
  STRATEGIES: '/api/strategies'
};

// Obtém a URL base da API a partir de variáveis de ambiente
export const getApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_BASE_URL || '/api';
};

// Obtém a URL completa para um endpoint
export const getFullUrl = (endpoint: string): string => {
  // Se o endpoint já for uma URL completa, retorná-la diretamente
  if (endpoint.startsWith('http')) {
    return endpoint;
  }
  return `${getApiBaseUrl()}${endpoint}`;
}; 