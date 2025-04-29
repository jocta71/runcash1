/**
 * Utilitários para lidar com requisições à API com suporte a CORS
 */

/**
 * Função que tenta vários métodos de requisição até que um funcione
 * @param endpoint Endpoint relativo (ex: '/api/ROULETTES')
 * @param options Opções para fetch (opcional)
 */
export async function fetchWithCorsSupport<T>(endpoint: string, options?: RequestInit): Promise<T> {
  // Log detalhado para rastrear todas as chamadas
  const caller = new Error().stack?.split('\n')?.[2]?.trim() || 'unknown';
  console.log(`🔍 [API TRACKER] Requisição para: ${endpoint} | Chamado por: ${caller}`);
  
  // Log para debugging
  console.log(`[API] Iniciando requisição para: ${endpoint}`);
  
  try {
    // Configurações padrão para todas as requisições
    const defaultOptions: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include', // Enviar cookies para autenticação se necessário
      mode: 'cors',           // Mesclar com opções personalizadas
      ...options              
    };
    
  // Lista de métodos para tentar, em ordem de preferência
  const methods = [
    {
      name: 'API Proxy Local',
      fn: async () => {
        const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        console.log(`[API] Tentando método API Proxy Local: ${url}`);
        
        const response = await fetch(url, {
            ...defaultOptions,
          headers: {
              ...defaultOptions.headers,
            ...(options?.headers || {})
          }
        });
        
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        return await response.json();
      }
    },
    {
      name: 'Next.js API Route',
      fn: async () => {
        // Se o endpoint for para roletas, usar o proxy dedicado
        const nextApiUrl = endpoint.includes('ROULETTES') ? 
          '/api/proxy-roulette' : 
          '/api/proxy';
        
        console.log(`[API] Tentando método Next.js API Route: ${nextApiUrl}`);
        
        const response = await fetch(nextApiUrl, {
            ...defaultOptions,
          headers: {
              ...defaultOptions.headers,
            ...(options?.headers || {})
          }
        });
        
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        return await response.json();
      }
    },
    {
      name: 'CORS Proxy',
      fn: async () => {
        // Construir URL completa do backend
        const backendBaseUrl = 'https://backendapi-production-36b5.up.railway.app';
        const backendUrl = `${backendBaseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
        
        // Usar um serviço de proxy CORS
        const corsProxy = 'https://corsproxy.io/?';
        const proxiedUrl = `${corsProxy}${encodeURIComponent(backendUrl)}`;
        
        console.log(`[API] Tentando método CORS Proxy: ${proxiedUrl}`);
        
        const response = await fetch(proxiedUrl, {
            ...defaultOptions,
          headers: {
              ...defaultOptions.headers,
            ...(options?.headers || {})
          }
        });
        
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        return await response.json();
      }
    }
  ];
  
  // Tentar cada método em sequência
  let lastError = null;
  
  for (const method of methods) {
    try {
      console.log(`[API] Tentando método: ${method.name}`);
      const data = await method.fn();
      
      if (data) {
        console.log(`[API] Método '${method.name}' funcionou!`);
        return data as T;
      }
    } catch (error) {
      console.error(`[API] Método '${method.name}' falhou:`, error);
      lastError = error;
    }
  }
  
  // Se chegou aqui, todos os métodos falharam
  console.error('[API] Todos os métodos falharam');
  throw lastError || new Error('Falha ao buscar dados da API');
  } catch (error) {
    console.error(`[API] Erro geral na requisição para ${endpoint}:`, error);
    throw error;
  }
} 