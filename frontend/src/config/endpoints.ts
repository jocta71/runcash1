/**
 * Configuração centralizada de endpoints da API
 * Este arquivo define os endpoints usados em toda a aplicação
 */

// Base API URL é inferida do ambiente (pode ser vazia se estiver usando mesmo domínio)
const API_BASE_URL = '';

/**
 * ATENÇÃO: SEMPRE use o endpoint em minúsculas (/api/roulettes) para acessar as roletas.
 * O endpoint em maiúsculas (/api/ROULETTES) é apenas para compatibilidade e será depreciado!
 * 
 * Se você está tendo problemas de acesso sem assinatura, verifique se está usando o endpoint correto.
 */

// Endpoints para roletas
export const ROULETTE_ENDPOINTS = {
  // Lista de todas as roletas - SEMPRE USE ESTE
  LIST: `${API_BASE_URL}/api/roulettes`,
  
  // ⚠️ DEPRECIADO! EVITE USAR ESTE ENDPOINT! ⚠️
  // Mantenha apenas para compatibilidade com código legado
  LEGACY_LIST: `${API_BASE_URL}/api/ROULETTES`,
  
  // Informações detalhadas de uma roleta
  DETAIL: (id: string) => `${API_BASE_URL}/api/roulettes/${id}`,
  
  // Histórico de números de uma roleta
  HISTORY: (id: string) => `${API_BASE_URL}/api/numbers/byid/${id}`,
  
  // Endpoint para verificar status de assinatura
  SUBSCRIPTION_STATUS: `${API_BASE_URL}/api/subscription/status`,
  
  // Endpoint para diagnóstico de autenticação
  AUTH_TEST: `${API_BASE_URL}/api/auth-test`
};

// Endpoints para autenticação
export const AUTH_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/api/auth/login`,
  REGISTER: `${API_BASE_URL}/api/auth/register`,
  PROFILE: `${API_BASE_URL}/api/auth/profile`,
  REFRESH: `${API_BASE_URL}/api/auth/refresh-token`,
  TEST: `${API_BASE_URL}/api/auth-test`
};

// Endpoints para assinaturas
export const SUBSCRIPTION_ENDPOINTS = {
  STATUS: `${API_BASE_URL}/api/subscription/status`,
  CREATE: `${API_BASE_URL}/api/subscription/create`,
  PLANS: `${API_BASE_URL}/api/subscription/plans`
};

// Tipo para a função de diagnóstico
type TestAuthFunction = () => Promise<any>;

// Tipo da interface de endpoints
interface ApiEndpoints {
  ROULETTES: typeof ROULETTE_ENDPOINTS;
  AUTH: typeof AUTH_ENDPOINTS;
  SUBSCRIPTION: typeof SUBSCRIPTION_ENDPOINTS;
  testAuth?: TestAuthFunction;
}

// Configuração global de endpoints
export const API_ENDPOINTS: ApiEndpoints = {
  ROULETTES: ROULETTE_ENDPOINTS,
  AUTH: AUTH_ENDPOINTS,
  SUBSCRIPTION: SUBSCRIPTION_ENDPOINTS,
};

/**
 * Função para verificar e diagnosticar problemas de autenticação
 * Use no console do navegador para diagnosticar problemas:
 * 
 * import endpoints from './endpoints';
 * endpoints.testAuth();
 */
export async function testAuth(): Promise<any> {
  try {
    console.log('Iniciando diagnóstico de autenticação...');
    
    // Tentar fazer a requisição com as credenciais atuais
    const response = await fetch(AUTH_ENDPOINTS.TEST, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': localStorage.getItem('auth_token') 
          ? `Bearer ${localStorage.getItem('auth_token')}`
          : ''
      }
    });
    
    const data = await response.json();
    
    console.log('Resultado do diagnóstico:', data);
    console.log('Status de autenticação:', data.authenticated ? 'Autenticado' : 'Não autenticado');
    console.log('Status da assinatura:', data.hasSubscription ? 'Ativa' : 'Inativa ou inexistente');
    
    if (data.authenticated && !data.hasSubscription) {
      console.warn('⚠️ Você está autenticado mas não possui uma assinatura ativa!');
    }
    
    // Testar acesso aos endpoints de roletas
    console.log('Testando acesso aos endpoints de roletas...');
    
    // Teste minúsculas
    try {
      const rouletteResponseLower = await fetch(ROULETTE_ENDPOINTS.LIST, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem('auth_token') 
            ? `Bearer ${localStorage.getItem('auth_token')}`
            : ''
        }
      });
      
      console.log(`Endpoint minúsculas (/api/roulettes): ${rouletteResponseLower.status} ${rouletteResponseLower.statusText}`);
      
      if (rouletteResponseLower.status === 200) {
        console.warn('⚠️ O endpoint está permitindo acesso sem verificar assinatura!');
      } else if (rouletteResponseLower.status === 403) {
        console.log('✅ O endpoint está bloqueando corretamente sem assinatura.');
      }
    } catch (error) {
      console.error('Erro ao testar endpoint minúsculas:', error);
    }
    
    // Teste maiúsculas
    try {
      const rouletteResponseUpper = await fetch(ROULETTE_ENDPOINTS.LEGACY_LIST, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem('auth_token') 
            ? `Bearer ${localStorage.getItem('auth_token')}`
            : ''
        }
      });
      
      console.log(`Endpoint maiúsculas (/api/ROULETTES): ${rouletteResponseUpper.status} ${rouletteResponseUpper.statusText}`);
      
      if (rouletteResponseUpper.status === 200) {
        console.warn('⚠️ O endpoint legado está permitindo acesso sem verificar assinatura!');
      } else if (rouletteResponseUpper.status === 403) {
        console.log('✅ O endpoint legado está bloqueando corretamente sem assinatura.');
      }
    } catch (error) {
      console.error('Erro ao testar endpoint maiúsculas:', error);
    }
    
    return data;
  } catch (error) {
    console.error('Erro ao executar diagnóstico:', error);
    return { error: error.message };
  }
}

// Adicionar a função de teste ao objeto exportado
API_ENDPOINTS.testAuth = testAuth;

export default API_ENDPOINTS; 