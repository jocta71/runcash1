// URLs para os endpoints da API
export const ENDPOINTS = {
  // Endpoint principal para roletas (agora unificado)
  get ROULETTES() { return `${getApiBaseUrl()}/ROULETTES` },
  
  // Endpoint para histórico de roletas
  get ROULETTE_HISTORY() { return `${getApiBaseUrl()}/roulettes/history` },
  
  // Endpoint para eventos em tempo real
  get EVENTS() { return `${getApiBaseUrl()}/events` },
  
  // Endpoint para estratégias
  get STRATEGIES() { return `${getApiBaseUrl()}/strategies` }
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