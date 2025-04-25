// URLs para os endpoints da API
export const ENDPOINTS = {
  // Endpoints principais para roletas
  ROULETTES: '/api/ROULETTES',
  ROULETTES_BASIC: '/api/ROULETTES/basic',
  ROULETTE_NUMBERS: (roletaId: string) => `/api/ROULETTES/${roletaId}/numbers`,
  
  // Endpoints para histórico e estratégia
  ROULETTE_HISTORY: '/api/roulettes/history',
  STRATEGIES: '/api/strategies',
  
  // Endpoints de eventos e tempo real
  EVENTS: '/api/events',
  ROULETTE_EVENTS: '/api/events/roulette',
  
  // Endpoints de status
  STATUS: '/api/status',
};

// Obtém a URL base da API a partir de variáveis de ambiente
export const getApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_BASE_URL || '/api';
};

// Obtém a URL completa para um endpoint
export const getFullUrl = (endpoint: string): string => {
  return `${getApiBaseUrl()}${endpoint}`;
}; 