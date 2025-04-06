// URLs para os endpoints da API
export const ENDPOINTS = {
  // Endpoint principal para roletas (agora unificado)
  ROULETTES: 'https://backendapi-production-36b5.up.railway.app/api/ROULETTES',
  
  // Endpoint para histórico de roletas
  ROULETTE_HISTORY: 'https://backendapi-production-36b5.up.railway.app/api/roulettes/history',
  
  // Endpoint para eventos em tempo real
  EVENTS: 'https://backendapi-production-36b5.up.railway.app/api/events',
  
  // Endpoint para estratégias
  STRATEGIES: 'https://backendapi-production-36b5.up.railway.app/api/strategies'
};

// Obtém a URL base da API a partir de variáveis de ambiente ou usa o Railway por padrão
export const getApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_BASE_URL || 'https://backendapi-production-36b5.up.railway.app/api';
};

// Obtém a URL completa para um endpoint
export const getFullUrl = (endpoint: string): string => {
  // Se o endpoint já começar com http, retorna o próprio endpoint
  if (endpoint.startsWith('http')) {
    return endpoint;
  }
  return `${getApiBaseUrl()}${endpoint}`;
}; 