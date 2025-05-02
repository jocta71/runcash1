// URLs para os endpoints da API
export const ENDPOINTS = {
  // Endpoint principal para roletas (agora unificado)
  ROULETTES: '/api/ROULETTES',
  
  // Endpoint para histórico de roletas
  ROULETTE_HISTORY: '/api/roulettes/history',
  
  // Endpoint para eventos em tempo real
  EVENTS: '/api/events',
  
  // Endpoint para estratégias
  STRATEGIES: '/api/strategies'
};

// URL base fixa da API para garantir consistência
const API_BASE_URL = 'https://backendapi-production-36b5.up.railway.app';

// Obtém a URL base da API a partir de variáveis de ambiente
export const getApiBaseUrl = (): string => {
  // Forçar uso da URL correta do Railway
  return API_BASE_URL;
};

// Obtém a URL completa para um endpoint
export const getFullUrl = (endpoint: string): string => {
  // Remover possível /api do início do endpoint para evitar duplicação
  const cleanEndpoint = endpoint.startsWith('/api') 
    ? endpoint 
    : `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
  return `${getApiBaseUrl()}${cleanEndpoint}`;
}; 