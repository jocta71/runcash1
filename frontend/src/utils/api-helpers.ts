/**
 * Utilitário para fazer requisições HTTP com suporte a CORS
 * Implementa mecanismos para contornar problemas de CORS e fornecer fallbacks
 */

// URL base da API principal
const API_BASE_URL = 'https://backendapi-production-36b5.up.railway.app/api';

/**
 * Realiza uma requisição com suporte a CORS para endpoints da API
 * @param endpoint Endpoint relativo (deve começar com /)
 * @param options Opções de requisição (opcional)
 * @returns Dados da resposta
 */
export async function fetchWithCorsSupport<T>(endpoint: string, options?: RequestInit): Promise<T> {
  // Se o endpoint já contém a URL completa, usamos ele diretamente
  // Caso contrário, combinamos com a URL base
  const url = endpoint.startsWith('http') ? 
    endpoint : 
    `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  console.log(`[API] Fazendo requisição para: ${url}`);
  
  try {
    // Configuração para evitar problemas de CORS
    const requestOptions: RequestInit = {
      method: options?.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'bypass-tunnel-reminder': 'true',
        ...(options?.headers || {})
      },
      mode: 'cors',
      // Evitar credentials para evitar bloqueio de CORS
      credentials: 'omit',
      ...options
    };
    
    // Realizar a requisição com as opções aprimoradas
    const response = await fetch(url, requestOptions);
    
    // Verificar se a resposta foi bem-sucedida
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`[API] ✅ Resposta recebida com sucesso: ${url}`);
    return data as T;
  } catch (error) {
    console.error(`[API] Erro na requisição para ${url}:`, error);
    
    // Tentar método alternativo com proxy CORS (se disponível)
    try {
      console.log(`[API] Tentando método alternativo para ${url}`);
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      
      const proxyResponse = await fetch(proxyUrl);
      if (!proxyResponse.ok) {
        throw new Error(`Erro HTTP no proxy: ${proxyResponse.status}`);
      }
      
      const proxyData = await proxyResponse.json();
      
      if (proxyData && proxyData.contents) {
        // O proxy retorna os dados no campo 'contents' como string, precisamos fazer parse
        try {
          const parsedData = JSON.parse(proxyData.contents);
          console.log(`[API] ✅ Resposta recebida via proxy CORS: ${url}`);
          return parsedData as T;
        } catch (parseError) {
          console.error('[API] Erro ao fazer parse da resposta do proxy:', parseError);
          throw new Error('Erro ao processar resposta do proxy CORS');
        }
      }
    } catch (proxyError) {
      console.error(`[API] Método alternativo falhou para ${url}:`, proxyError);
    }
    
    // Se chegamos aqui, ambos os métodos falharam
    throw new Error(`Falha na requisição para ${endpoint}: ${error}`);
  }
}

/**
 * Formata um endpoint para usar a URL base correta da API
 * @param endpoint Endpoint relativo (ex: /ROULETTES)
 * @returns URL completa do endpoint
 */
export function getApiUrl(endpoint: string): string {
  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
}

/**
 * Verifica se uma URL está acessível
 * @param url URL a ser verificada
 * @returns true se a URL estiver acessível, false caso contrário
 */
export async function isUrlAccessible(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store'
    });
    
    // Mesmo com modo no-cors, podemos determinar se a requisição foi bem-sucedida
    return response.type === 'opaque' || response.ok;
  } catch (error) {
    console.error(`[API] URL inacessível: ${url}`, error);
    return false;
  }
} 