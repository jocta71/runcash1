// Endpoints da API principal
export const ENDPOINTS = {
  // Endpoints da API principal
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  PROFILE: '/auth/profile',
  EVENTS: '/events',
  ROULETTES: '/roulettes',
  
  // Endpoints de stream/eventos
  STREAM: '/stream',
  SSE: '/stream',
  
  // Endpoints de status
  STATUS: '/status',
  HEALTH: '/health'
} as const;

export default ENDPOINTS;

// Obtém a URL base da API a partir de variáveis de ambiente
export const getApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_BASE_URL || '/api';
};

// Obtém a URL completa para um endpoint
export const getFullUrl = (endpoint: string): string => {
  return `${getApiBaseUrl()}${endpoint}`;
}; 