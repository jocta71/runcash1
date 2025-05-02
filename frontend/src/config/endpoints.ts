/**
 * Configuração centralizada de endpoints da API
 * Este arquivo define os endpoints usados em toda a aplicação
 */

// Base API URL é inferida do ambiente (pode ser vazia se estiver usando mesmo domínio)
const API_BASE_URL = '';

// Endpoints para roletas
export const ROULETTE_ENDPOINTS = {
  // Lista de todas as roletas
  // NOTA: SEMPRE use minúsculas para endpoint de roletas
  LIST: `${API_BASE_URL}/api/roulettes`,
  
  // Endpoint alternativo para compatibilidade com versões anteriores
  LEGACY_LIST: `${API_BASE_URL}/api/ROULETTES`,
  
  // Informações detalhadas de uma roleta
  DETAIL: (id: string) => `${API_BASE_URL}/api/roulettes/${id}`,
  
  // Histórico de números de uma roleta
  HISTORY: (id: string) => `${API_BASE_URL}/api/numbers/byid/${id}`,
  
  // Endpoint para verificar status de assinatura
  SUBSCRIPTION_STATUS: `${API_BASE_URL}/api/subscription/status`
};

// Endpoints para autenticação
export const AUTH_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/api/auth/login`,
  REGISTER: `${API_BASE_URL}/api/auth/register`,
  PROFILE: `${API_BASE_URL}/api/auth/profile`,
  REFRESH: `${API_BASE_URL}/api/auth/refresh-token`
};

// Endpoints para assinaturas
export const SUBSCRIPTION_ENDPOINTS = {
  STATUS: `${API_BASE_URL}/api/subscription/status`,
  CREATE: `${API_BASE_URL}/api/subscription/create`,
  PLANS: `${API_BASE_URL}/api/subscription/plans`
};

// Configuração global de endpoints
export const API_ENDPOINTS = {
  ROULETTES: ROULETTE_ENDPOINTS,
  AUTH: AUTH_ENDPOINTS,
  SUBSCRIPTION: SUBSCRIPTION_ENDPOINTS,
};

export default API_ENDPOINTS; 