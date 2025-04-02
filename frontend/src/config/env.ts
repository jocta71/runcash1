/**
 * Configurações e utilitários para gerenciar variáveis de ambiente
 */

// Verificar se o ambiente é produção
export const isProduction = import.meta.env.PROD || 
  import.meta.env.MODE === 'production' ||
  window.location.hostname !== 'localhost';

// Valores padrão para cada ambiente
const defaultValues: Record<string, Record<string, string>> = {
  development: {
    VITE_WS_URL: 'https://backendscraper-production.up.railway.app',
    VITE_SSE_SERVER_URL: 'https://backendscraper-production.up.railway.app/api/events',
    VITE_API_URL: 'https://backendapi-production-36b5.up.railway.app/api'
  },
  production: {
    VITE_WS_URL: 'https://backendscraper-production.up.railway.app',
    VITE_SSE_SERVER_URL: 'https://backendscraper-production.up.railway.app/api/events',
    VITE_API_URL: 'https://backendapi-production-36b5.up.railway.app/api'
  }
};

/**
 * Obtém uma variável de ambiente obrigatória
 * @param name Nome da variável de ambiente
 * @returns Valor da variável de ambiente
 * @throws Error se a variável não estiver definida
 */
export function getRequiredEnvVar(name: string): string {
  // Primeiro, tentar obter do import.meta.env (Vite)
  const value = import.meta.env[name];
  
  if (value) {
    return value;
  }
  
  // Fallback para valores padrão baseados no ambiente
  const env = isProduction ? 'production' : 'development';
  const defaultValue = defaultValues[env][name];
  
  if (defaultValue) {
    return defaultValue;
  }
  
  // Se estivermos em desenvolvimento, dar um aviso mas retornar um valor default
  if (!isProduction) {
    console.warn(`[ENV] Variável ${name} não encontrada. Usando valor padrão.`);
    
    // Valores padrão para desenvolvimento
    if (name === 'VITE_WS_URL') {
      return 'https://backendscraper-production.up.railway.app';
    }
    if (name === 'VITE_SSE_SERVER_URL') {
      return 'https://backendscraper-production.up.railway.app/api/events';
    }
    if (name === 'VITE_API_URL' || name === 'VITE_API_BASE_URL') {
      return 'https://backendapi-production-36b5.up.railway.app/api';
    }
  }
  
  // Lançar erro se não conseguimos determinar o valor
  throw new Error(`Variável de ambiente obrigatória não fornecida: ${name}`);
}

/**
 * Obtém uma variável de ambiente opcional
 * @param name Nome da variável de ambiente
 * @param defaultValue Valor padrão caso não encontre
 * @returns Valor da variável de ambiente ou defaultValue
 */
export function getEnvVar(name: string, defaultValue: string): string {
  try {
    return getRequiredEnvVar(name);
  } catch (error) {
    return defaultValue;
  }
}

// Exportar o objeto de configuração padrão
export default {
  isProduction,
  getRequiredEnvVar,
  getEnvVar,
  
  // Atalhos para as principais URLs
  wsUrl: getRequiredEnvVar('VITE_WS_URL'),
  apiUrl: getRequiredEnvVar('VITE_API_URL') || getRequiredEnvVar('VITE_API_BASE_URL'),
  sseUrl: getRequiredEnvVar('VITE_SSE_SERVER_URL')
}; 