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
    VITE_WS_URL: 'wss://backend-production-2f96.up.railway.app',
    VITE_API_URL: 'https://backendapi-production-36b5.up.railway.app/api',
    VITE_API_BASE_URL: 'https://backendapi-production-36b5.up.railway.app/api'
  },
  production: {
    VITE_WS_URL: 'wss://backend-production-2f96.up.railway.app',
    VITE_API_URL: 'https://backendapi-production-36b5.up.railway.app/api',
    VITE_API_BASE_URL: 'https://backendapi-production-36b5.up.railway.app/api'
  }
};

interface EnvConfig {
  apiBaseUrl: string;
  websocketUrl: string;
  debugMode: boolean;
  env: string;
  optimizePollingForVisibility?: boolean;
}

// Configuração para ambiente de produção
const productionConfig: EnvConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://backend-production-2f96.up.railway.app',
  websocketUrl: import.meta.env.VITE_WEBSOCKET_URL || 'wss://backend-production-2f96.up.railway.app',
  debugMode: false,
  env: 'production',
  optimizePollingForVisibility: true
};

// Configuração para ambiente de desenvolvimento
const developmentConfig: EnvConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://backendapi-production-36b5.up.railway.app/api',
  websocketUrl: import.meta.env.VITE_WEBSOCKET_URL || 'wss://backend-production-2f96.up.railway.app',
  debugMode: true,
  env: 'development',
  optimizePollingForVisibility: false
};

/**
 * Obtém a URL base da API
 * @returns URL base da API
 */
export function getApiBaseUrl(): string {
  // Primeiro tentar obter VITE_API_BASE_URL
  try {
    const apiUrl = getRequiredEnvVar('VITE_API_BASE_URL');
    return apiUrl;
  } catch (error) {
    // Se não encontrar, tentar VITE_API_URL
    try {
      const apiUrl = getRequiredEnvVar('VITE_API_URL');
      return apiUrl;
    } catch (error) {
      console.warn('[ENV] Não foi possível encontrar URL da API nas variáveis de ambiente');
      
      // Em produção, usar a origem da página
      if (isProduction) {
        const origin = window.location.origin;
        console.log(`[ENV] Usando origem da página como URL da API: ${origin}/api`);
        return `${origin}/api`;
      }
      
      // Em desenvolvimento, retornar URL padrão
      console.log('[ENV] Usando URL padrão da API para desenvolvimento');
      return 'https://backendapi-production-36b5.up.railway.app/api';
    }
  }
}

/**
 * Obtém uma variável de ambiente obrigatória
 * @param name Nome da variável de ambiente
 * @returns Valor da variável de ambiente
 * @throws Error se a variável não estiver definida
 */
export function getRequiredEnvVar(name: string): string {
  // Primeiro, tentar obter do import.meta.env (Vite)
  const value = import.meta.env[name];
  
  if (value !== undefined) {
    // Converter para string se for boolean
    return typeof value === 'boolean' ? String(value) : value as string;
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
      return 'wss://backend-production-2f96.up.railway.app';
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
  getApiBaseUrl,
  
  // Atalhos para as principais URLs
  wsUrl: getRequiredEnvVar('VITE_WS_URL'),
  apiUrl: getRequiredEnvVar('VITE_API_URL') || getRequiredEnvVar('VITE_API_BASE_URL'),
  apiBaseUrl: getApiBaseUrl(),
  
  // Novas propriedades
  optimizePollingForVisibility: isProduction
}; 