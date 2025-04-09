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
    VITE_WS_URL: 'wss://runcashh1-chi.vercel.app',
    VITE_API_URL: 'https://runcashh1-chi.vercel.app/api',
    VITE_API_BASE_URL: 'https://runcashh1-chi.vercel.app/api'
  },
  production: {
    VITE_WS_URL: 'wss://runcashh1-chi.vercel.app',
    VITE_API_URL: 'https://runcashh1-chi.vercel.app/api',
    VITE_API_BASE_URL: 'https://runcashh1-chi.vercel.app/api'
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
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://runcashh1-chi.vercel.app/api',
  websocketUrl: import.meta.env.VITE_WEBSOCKET_URL || 'wss://runcashh1-chi.vercel.app',
  debugMode: false,
  env: 'production',
  optimizePollingForVisibility: true
};

// Configuração para ambiente de desenvolvimento
const developmentConfig: EnvConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002',
  websocketUrl: import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:3000',
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
      return 'https://runcashh1-chi.vercel.app/api';
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
      return 'wss://runcashh1-chi.vercel.app';
    }
    if (name === 'VITE_API_URL' || name === 'VITE_API_BASE_URL') {
      return 'https://runcashh1-chi.vercel.app/api';
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

/**
 * Obtém a URL do socket, utilizando a mesma origem quando em produção
 */
export function getSocketUrl(): string {
  try {
    const configuredUrl = getRequiredEnvVar('VITE_WS_URL');
    
    // Se estamos em produção e a URL não é a mesma origem, usar a mesma origem
    if (isProduction) {
      const origin = window.location.origin;
      return `${origin}/api/socket`;
    }
    
    return configuredUrl;
  } catch (error) {
    console.warn('Não foi possível determinar a URL do socket, usando a origem atual');
    const origin = window.location.origin;
    return `${origin}/api/socket`;
  }
}

// Exportar o objeto de configuração padrão
export default {
  isProduction,
  getRequiredEnvVar,
  getEnvVar,
  getApiBaseUrl,
  getSocketUrl,
  
  // Atalhos para as principais URLs
  wsUrl: getSocketUrl(),
  apiUrl: getRequiredEnvVar('VITE_API_URL') || getRequiredEnvVar('VITE_API_BASE_URL'),
  apiBaseUrl: getApiBaseUrl(),
  
  // Novas propriedades
  optimizePollingForVisibility: isProduction
}; 