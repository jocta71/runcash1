/**
 * Utilitários para lidar com requisições à API com suporte a CORS
 */

// Cache de requisições recentes para evitar chamadas duplicadas
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

const requestCache: Record<string, CacheEntry<any>> = {};
const CACHE_DURATION = 10000; // 10 segundos de cache

/**
 * Função que tenta vários métodos de requisição até que um funcione
 * @param endpoint Endpoint relativo (ex: '/api/ROULETTES')
 * @param options Opções para fetch (opcional)
 * @param skipCache Se true, ignora o cache
 */
export async function fetchWithCorsSupport<T>(
  endpoint: string, 
  options?: RequestInit, 
  skipCache: boolean = false
): Promise<T> {
  // Cria uma chave única para esta requisição
  const cacheKey = `${endpoint}-${options?.method || 'GET'}-${JSON.stringify(options?.body || '')}`;
  
  // Verifica se existe um resultado em cache válido
  const now = Date.now();
  const cachedResult = requestCache[cacheKey];
  if (!skipCache && cachedResult && (now - cachedResult.timestamp < cachedResult.expiry)) {
    console.log(`[API] Usando resultado em cache para: ${endpoint}`);
    return cachedResult.data;
  }
  
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
        'bypass-tunnel-reminder': 'true'
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
            `/api/proxy?path=${encodeURIComponent(endpoint)}`;
          
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
          const backendBaseUrl = 'https://backend-production-2f96.up.railway.app';
          const backendUrl = `${backendBaseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
          
          // Usar um serviço de proxy CORS
          const corsProxy = 'https://corsproxy.io/?';
          const proxiedUrl = `${corsProxy}${encodeURIComponent(backendUrl)}`;
          
          console.log(`[API] Tentando método CORS Proxy: ${proxiedUrl}`);
          
          const response = await fetch(proxiedUrl, {
            ...defaultOptions,
            // Não enviar cookies para o serviço de proxy externo 
            credentials: 'omit',
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
    
    // Tentar cada método em sequência com controle de rejeição
    let lastError = null;
    
    for (const method of methods) {
      try {
        console.log(`[API] Tentando método: ${method.name}`);
        const data = await method.fn();
        
        if (data) {
          console.log(`[API] Método '${method.name}' funcionou!`);
          
          // Armazenar resultado no cache
          requestCache[cacheKey] = {
            data,
            timestamp: Date.now(),
            expiry: CACHE_DURATION
          };
          
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

/**
 * Limpa o cache de requisições
 */
export function clearRequestCache(): void {
  Object.keys(requestCache).forEach(key => {
    delete requestCache[key];
  });
  console.log('[API] Cache de requisições limpo');
} 