/**
 * Definições de endpoints da API
 */

// URL base da API em produção
const API_BASE_URL = 'https://backendapi-production-36b5.up.railway.app';

/**
 * Retorna a URL base da API
 */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

/**
 * Retorna a URL completa para um endpoint
 * @param endpoint Caminho do endpoint
 * @returns URL completa
 */
export function getFullUrl(endpoint: string): string {
  // Se o endpoint já for uma URL completa, retorna como está
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  
  // Remove a barra inicial do endpoint se existir
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  
  // Constrói a URL completa
  return `${API_BASE_URL}/${cleanEndpoint}`;
}

/**
 * Endpoints disponíveis na API
 */
const ENDPOINTS = {
  // Endpoint para buscar todas as roletas
  ROULETTES: '/api/ROULETTES',
  
  // Endpoint para buscar roletas com limite (máximo 100)
  ROULETTES_LIMITED: '/api/ROULETTES?limit=100',
  
  // Endpoint para histórico de números de roletas
  HISTORY: '/api/HISTORY',
  
  // Endpoint para eventos
  EVENTS: '/api/EVENTS',
  
  // Endpoint para estratégias
  STRATEGIES: '/api/STRATEGIES'
};

export default ENDPOINTS; 