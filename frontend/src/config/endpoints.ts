/**
 * Configuração centralizada de endpoints da API
 * Este arquivo define os endpoints usados em toda a aplicação
 */

import { getApiBaseUrl } from './env';

/**
 * Interface para resposta do endpoint de teste de autenticação
 */
export interface AuthTestResponse {
  requestId: string;
  timestamp: string;
  path: string;
  method: string;
  authenticated: boolean;
  hasSubscription: boolean;
  userInfo: {
    id: string;
    username: string;
    email: string;
  } | null;
  subscriptionInfo: {
    id: string;
    status: string;
    plan: string;
    expiresAt: string;
  } | null;
  headers: {
    authorization: string | null;
    userAgent: string;
    origin: string;
    host: string;
  };
  client: {
    ip: string;
    protocol: string;
  };
}

/**
 * Define configuração centralizada para endpoints da API
 * IMPORTANTE: Sempre use os endpoints em minúsculas (/api/roulettes).
 * Os endpoints em maiúsculas (/api/ROULETTES) são obsoletos e serão removidos.
 */
export const ROULETTE_ENDPOINTS = {
  // ⚠️ ATENÇÃO: Sempre use este endpoint (minúsculo)
  ROULETTES: `/api/roulettes`,
  
  // ⚠️ NÃO USE este endpoint (maiúsculo) - OBSOLETO
  ROULETTES_OLD: `/api/ROULETTES`, // Mantido apenas para compatibilidade
  
  // ⚠️ Sempre use este endpoint (minúsculo)
  ROULETTE_HISTORY: `/api/roulettes/historico`,
  
  // ⚠️ NÃO USE este endpoint (maiúsculo) - OBSOLETO
  ROULETTE_HISTORY_OLD: `/api/ROULETTES/historico`, // Mantido apenas para compatibilidade
};

// Adicionar exportação da API_ENDPOINTS para compatibilidade com código legado
/**
 * Objeto de endpoints para compatibilidade com código legado
 * @deprecated Use getApiEndpoints() em vez disso
 */
export const API_ENDPOINTS = {
  ROULETTES: ROULETTE_ENDPOINTS,
  AUTH: {
    LOGIN: `${getApiBaseUrl()}/auth/login`,
    REGISTER: `${getApiBaseUrl()}/auth/register`,
    PROFILE: `${getApiBaseUrl()}/auth/profile`,
    REFRESH: `${getApiBaseUrl()}/auth/refresh-token`,
    TEST: `${getApiBaseUrl()}/auth-test`
  },
  SUBSCRIPTION: {
    STATUS: `${getApiBaseUrl()}/subscription/status`,
    CREATE: `${getApiBaseUrl()}/subscription/create`,
    PLANS: `${getApiBaseUrl()}/subscription/plans`
  },
  // Adicionar a função testAuth ao objeto para manter compatibilidade
  testAuth
};

/**
 * Interface para configuração de endpoints da API
 */
export interface ApiEndpoints {
  AUTH: {
    LOGIN: string;
    REGISTER: string;
    PROFILE: string;
    AUTH_TEST: string;
  };
  ROULETTE: {
    ROULETTES: string;
    ROULETTE_HISTORY: string;
    NUMBERS: string;
  };
  SUBSCRIPTION: {
    STATUS: string;
    CREATE: string;
    CANCEL: string;
  };
  BOT: {
    START: string;
    STOP: string;
    STATUS: string;
  };
  HEALTH: string;
}

/**
 * Obtém os endpoints da API com base na URL da API
 * @returns {ApiEndpoints} Objeto contendo todos os endpoints da API
 */
export function getApiEndpoints(): ApiEndpoints {
  const apiBaseUrl = getApiBaseUrl();
  
  return {
    AUTH: {
      LOGIN: `${apiBaseUrl}/auth/login`,
      REGISTER: `${apiBaseUrl}/auth/register`,
      PROFILE: `${apiBaseUrl}/auth/profile`,
      AUTH_TEST: `${apiBaseUrl}/auth-test`
    },
    ROULETTE: {
      // ⚠️ IMPORTANTE: Sempre use o endpoint em minúsculas
      ROULETTES: `${apiBaseUrl}/roulettes`,
      ROULETTE_HISTORY: `${apiBaseUrl}/roulettes/historico`,
      NUMBERS: `${apiBaseUrl}/numbers`
    },
    SUBSCRIPTION: {
      STATUS: `${apiBaseUrl}/subscription/status`,
      CREATE: `${apiBaseUrl}/subscription/create`,
      CANCEL: `${apiBaseUrl}/subscription/cancel`
    },
    BOT: {
      START: `${apiBaseUrl}/bot/start`,
      STOP: `${apiBaseUrl}/bot/stop`,
      STATUS: `${apiBaseUrl}/bot/status`
    },
    HEALTH: `${apiBaseUrl}/health`
  };
}

/**
 * Cria os cabeçalhos de autenticação para as requisições
 * @returns {HeadersInit} Cabeçalhos com token de autenticação, se disponível
 */
export function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

/**
 * Verifica se o token de autenticação é válido
 * @returns {Promise<boolean>} Verdadeiro se o token for válido
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) return false;
    
    const response = await fetch(`${getApiBaseUrl()}/auth/validate`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    return response.ok;
  } catch (error) {
    console.error('Erro ao verificar autenticação:', error);
    return false;
  }
}

/**
 * Função para testar o status de autenticação e obter informações detalhadas
 * Útil para diagnosticar problemas de autenticação
 * @returns {Promise<AuthTestResponse>} Informações detalhadas sobre a autenticação
 */
export async function testAuth(): Promise<AuthTestResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const headers = getAuthHeaders();
  
  try {
    // Testar acesso ao endpoint principal de roletas
    console.log('Testando acesso ao endpoint principal de roletas...');
    try {
      const rouletteResponse = await fetch(`${apiBaseUrl}/roulettes`, {
        method: 'GET',
        headers
      });
      console.log(`Teste endpoint principal: ${rouletteResponse.status} ${rouletteResponse.statusText}`);
    } catch (e) {
      console.error('Falha ao testar endpoint principal:', e);
    }
    
    // Testar acesso ao endpoint legado em maiúsculas (deve estar bloqueado se não tiver assinatura)
    console.log('Testando acesso ao endpoint legado...');
    try {
      const legacyResponse = await fetch(`${apiBaseUrl}/ROULETTES`, {
        method: 'GET',
        headers
      });
      console.log(`Teste endpoint legado: ${legacyResponse.status} ${legacyResponse.statusText}`);
    } catch (e) {
      console.error('Falha ao testar endpoint legado:', e);
    }
    
    // Obter informações completas de autenticação
    console.log('Obtendo status completo de autenticação...');
    const response = await fetch(`${apiBaseUrl}/auth-test`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      throw new Error(`Erro ao testar autenticação: ${response.status}`);
    }
    
    const data: AuthTestResponse = await response.json();
    
    // Exibir resultados no console para diagnóstico
    console.log('==== RESULTADO DO TESTE DE AUTENTICAÇÃO ====');
    console.log(`Autenticado: ${data.authenticated ? 'SIM ✅' : 'NÃO ❌'}`);
    console.log(`Assinatura ativa: ${data.hasSubscription ? 'SIM ✅' : 'NÃO ❌'}`);
    if (data.authenticated) {
      console.log(`Usuário: ${data.userInfo?.email || 'N/A'}`);
      if (data.hasSubscription) {
        console.log(`Plano: ${data.subscriptionInfo?.plan || 'N/A'}`);
        console.log(`Expira em: ${data.subscriptionInfo?.expiresAt || 'N/A'}`);
      }
    }
    console.log('===========================================');
    
    return data;
  } catch (error) {
    console.error('Erro durante teste de autenticação:', error);
    return {
      requestId: 'error',
      timestamp: new Date().toISOString(),
      path: '',
      method: '',
      authenticated: false,
      hasSubscription: false,
      userInfo: null,
      subscriptionInfo: null,
      headers: {
        authorization: null,
        userAgent: '',
        origin: '',
        host: ''
      },
      client: {
        ip: '',
        protocol: ''
      }
    };
  }
}

/**
 * Obtém o token de autenticação do localStorage
 * @returns Token JWT ou null se não estiver autenticado
 */
export function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

/**
 * Função para obter dados das roletas em tempo real
 * Usa exatamente os mesmos cabeçalhos e parâmetros vistos em cgp.safe-iplay.com
 * @returns Dados de todas as roletas ativas
 */
export async function getLiveTables(): Promise<any> {
  const url = `${getApiBaseUrl()}/api/liveFeed/GetLiveTables`;
  
  try {
    // Obter token de autenticação
    const token = getAuthToken();
    if (!token) {
      console.error('[API] Erro: Token de autenticação não encontrado');
      throw new Error('Token de autenticação é obrigatório');
    }
    
    // Criar form data (application/x-www-form-urlencoded) com os mesmos campos do exemplo
    const formData = new URLSearchParams();
    formData.append('ClientTime', Date.now().toString());
    formData.append('ClientId', 'runcashh-web');
    formData.append('SessionId', localStorage.getItem('sessionId') || 'new-session');
    formData.append('RequestId', Math.random().toString(36).substring(2, 15));
    formData.append('locale', 'pt-BR');
    
    // Fazer requisição com EXATAMENTE os mesmos cabeçalhos do exemplo
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${token}`,
        'accept': '*/*',
        'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8,es;q=0.7',
        'origin': window.location.origin,
        'referer': window.location.origin,
        'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': 'Windows',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
      },
      body: formData
    });
    
    // Verificar se a resposta foi bem-sucedida
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[API] Erro na requisição LiveFeed:', errorData);
      throw new Error(errorData.message || 'Falha ao obter roletas em tempo real');
    }
    
    // Armazenar session ID se existir no cookie de resposta
    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      // Extrair todos os cookies relevantes como no exemplo
      const visitorIdMatch = cookies.match(/visid_incap_\d+=([^;]+)/);
      const sessionMatch = cookies.match(/incap_ses_\d+_\d+=([^;]+)/);
      
      if (visitorIdMatch && visitorIdMatch[0]) {
        const [cookieName, cookieValue] = visitorIdMatch[0].split('=');
        localStorage.setItem('visitorId', cookieName);
      }
      
      if (sessionMatch && sessionMatch[0]) {
        const [cookieName, cookieValue] = sessionMatch[0].split('=');
        localStorage.setItem('sessionId', cookieName);
      }
    }
    
    // Obter cabeçalhos de resposta para logs
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    // Log detalhado dos cabeçalhos recebidos (para debug)
    console.log('[API] Cabeçalhos da resposta LiveFeed:', headers);
    
    // Retornar dados
    return await response.json();
    
  } catch (error) {
    console.error('[API] Erro ao obter roletas em tempo real:', error);
    throw error;
  }
} 