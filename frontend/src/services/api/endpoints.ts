/**
 * Definição de endpoints da API
 */

// URL base da API
export const API_BASE_URL = 'https://backendapi-production-36b5.up.railway.app';

// URL de proxy para contornar CORS
export const PROXY_URL = '/api-proxy';

/**
 * Endpoints disponíveis
 */
export const ENDPOINTS = {
  // Roletas
  ROULETTES: '/api/ROULETTES',
  ROULETTES_WITH_LIMIT: '/api/ROULETTES?limit=100'
};

/**
 * Obtém a URL completa para um endpoint
 * @param endpoint Endpoint a ser acessado
 * @param useProxy Se true, usa o proxy para contornar CORS
 * @returns URL completa
 */
export const getFullUrl = (endpoint: string, useProxy = false): string => {
  // Se estamos em produção e precisamos contornar CORS
  if (useProxy) {
    return `${PROXY_URL}${endpoint}`; 
  }
  
  // Se estamos em desenvolvimento local ou não precisamos contornar CORS
  return `${API_BASE_URL}${endpoint}`;
};

// Função que verifica se a api está disponível e troca para local em caso de erro
export const checkAPIHealth = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      signal: controller.signal,
      mode: 'no-cors'
    });
    
    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    console.warn('❌ API remota não disponível, usando fallback local');
    return false;
  }
};

export default ENDPOINTS; 