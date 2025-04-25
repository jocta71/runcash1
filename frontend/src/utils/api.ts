/**
 * Utilitários para requisições de API
 */

/**
 * Faz uma requisição com suporte a contorno de CORS
 * @param url URL da requisição
 * @param options Opções da requisição (opcional)
 * @returns Dados da resposta como JSON
 */
export async function fetchWithCorsSupport<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    // Tentar primeiro com o modo normal
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options?.headers || {}),
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
    if (response.ok) {
      return await response.json();
    }
    
    // Se falhar, tentar com no-cors como fallback
    console.log(`Requisição falhou (${response.status}), tentando com no-cors para: ${url}`);
    
    const corsResponse = await fetch(url, {
      ...options,
      mode: 'no-cors',
      headers: {
        ...(options?.headers || {}),
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
    // No modo no-cors, normalmente recebemos uma resposta 'opaque'
    // que não nos permite acessar o conteúdo diretamente
    if (corsResponse.type === 'opaque') {
      console.warn('Resposta opaque devido a CORS, usando cache se disponível');
      
      // Tentar buscar do cache local
      const cacheKey = `api_cache_${url}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData) as T;
      }
      
      throw new Error('Não foi possível acessar os dados devido a restrições de CORS');
    }
    
    if (corsResponse.ok) {
      const data = await corsResponse.json();
      
      // Armazenar no cache local
      const cacheKey = `api_cache_${url}`;
      localStorage.setItem(cacheKey, JSON.stringify(data));
      
      return data;
    }
    
    throw new Error(`Erro na requisição: ${corsResponse.status}`);
  } catch (error) {
    console.error(`Erro ao fazer requisição para ${url}:`, error);
    throw error;
  }
} 