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
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'wss://backend-production-2f96.up.railway.app',
  websocketUrl: import.meta.env.VITE_WEBSOCKET_URL ? String(import.meta.env.VITE_WEBSOCKET_URL) : 'wss://backend-production-2f96.up.railway.app',
  debugMode: false,
  env: 'production',
  optimizePollingForVisibility: true
};

// Configuração para ambiente de desenvolvimento
const developmentConfig: EnvConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'ws://localhost:3000',
  websocketUrl: import.meta.env.VITE_WEBSOCKET_URL ? String(import.meta.env.VITE_WEBSOCKET_URL) : 'ws://localhost:3000',
  debugMode: true,
  env: 'development',
  optimizePollingForVisibility: false
};

/**
 * Obtém a URL base da API (via WebSocket)
 * @returns URL base do WebSocket
 */
export function getApiBaseUrl(): string {
  return getSocketUrl();
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
    return typeof value === 'boolean' ? String(value) : String(value);
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

/**
 * Obtém a URL do socket, garantindo que use o protocolo wss:// quando necessário
 */
export function getSocketUrl(): string {
  try {
    let configuredUrl = getRequiredEnvVar('VITE_WS_URL');
    
    // Garantir que a URL use o protocolo wss://
    if (configuredUrl && !configuredUrl.startsWith('wss://') && !configuredUrl.startsWith('ws://')) {
      if (configuredUrl.startsWith('https://')) {
        console.warn('[ENV] Convertendo URL de https:// para wss://');
        configuredUrl = configuredUrl.replace('https://', 'wss://');
      } else if (configuredUrl.startsWith('http://')) {
        console.warn('[ENV] Convertendo URL de http:// para ws://');
        configuredUrl = configuredUrl.replace('http://', 'ws://');
      }
    }
    
    // Verificar se a URL termina com / e não com /api/ 
    if (configuredUrl.endsWith('/') && !configuredUrl.endsWith('/api/')) {
      console.warn('[ENV] Adicionando /api ao caminho da URL WebSocket');
      configuredUrl = configuredUrl + 'api/';
    }
    // Adicionar api/ se não estiver presente e não terminar com /
    else if (!configuredUrl.includes('/api/') && !configuredUrl.endsWith('/')) {
      console.warn('[ENV] Adicionando /api/ ao caminho da URL WebSocket');
      configuredUrl = configuredUrl + '/api/';
    }
    
    return configuredUrl;
  } catch (error) {
    console.warn('Não foi possível determinar a URL do socket, usando valor padrão');
    return isProduction ? 'wss://backend-production-2f96.up.railway.app/api/' : 'ws://localhost:3000/api/';
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