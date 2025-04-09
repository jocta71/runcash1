/**
 * Utilitário para fazer requisições HTTP simples
 * Versão temporária sem suporte a CORS
 */
import config from '@/config/env';

// URL base da API principal
const API_BASE_URL = 'https://backendapi-production-36b5.up.railway.app/api';

/**
 * Realiza uma requisição simples para endpoints da API
 * @param endpoint Endpoint relativo (deve começar com /)
 * @param options Opções de requisição (opcional)
 * @returns Dados da resposta
 */
export async function fetchWithCorsSupport<T>(endpoint: string, options?: RequestInit): Promise<T> {
  // Se o endpoint já contém a URL completa, usamos ele diretamente
  // Caso contrário, combinamos com a URL base
  const url = endpoint.startsWith('http') ? 
    endpoint : 
    // Verificar se o endpoint já começa com 'api/' para evitar duplicação
    endpoint.startsWith('api/') ? 
      `${API_BASE_URL.replace(/\/api$/, '')}/${endpoint}` : 
      `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  console.log(`[API] Fazendo requisição para: ${url}`);
  
  try {
    // Configuração básica 
    const requestOptions: RequestInit = {
      method: options?.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'bypass-tunnel-reminder': 'true',
        ...(options?.headers || {})
      },
      // IMPORTANTE: Temporariamente removemos as verificações de CORS
      mode: 'no-cors', // Modo no-cors para ignorar verificações de CORS
      ...options
    };
    
    // Realizar a requisição de forma simplificada
    const response = await fetch(url, requestOptions);
    
    // Como estamos usando no-cors, não podemos verificar a resposta
    // Retornar objeto vazio como fallback
    console.log(`[API] ✅ Requisição enviada, mas dados podem não estar disponíveis devido ao modo no-cors: ${url}`);
    
    try {
      // Tentar fazer o parse, mas isso pode falhar em modo no-cors
      const data = await response.json();
      return data as T;
    } catch (parseError) {
      console.warn('[API] Não foi possível ler dados no modo no-cors, retornando objeto vazio');
      return {} as T;
    }
  } catch (error) {
    console.error(`[API] Erro na requisição para ${url}:`, error);
    
    // Retornar objeto vazio em caso de erro
    // NOTA: Isso é temporário para evitar erros durante o teste sem CORS
    console.warn('[API] Retornando objeto vazio como fallback');
    return {} as T;
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
 * Verifica se uma URL está acessível (versão simplificada)
 * @param url URL a ser verificada
 * @returns true se a URL estiver acessível, false caso contrário
 */
export async function isUrlAccessible(url: string): Promise<boolean> {
  try {
    await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store'
    });
    
    // Sempre retornar true em modo no-cors
    return true;
  } catch (error) {
    console.error(`[API] URL inacessível: ${url}`, error);
    return false;
  }
} 