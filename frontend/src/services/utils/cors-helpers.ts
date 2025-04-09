/**
 * Utilitários para lidar com requisições CORS
 */
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { getLogger } from './logger';

const logger = getLogger('CorsHelpers');

/**
 * Realiza uma requisição HTTP com tratamento de CORS
 * Tenta diferentes abordagens: 
 * 1. Requisição normal com axios
 * 2. Requisição com fetch e modo no-cors
 * 3. Usando um proxy interno se disponível
 */
export async function fetchWithCorsHandling<T>(
  url: string, 
  options: RequestInit = {}
): Promise<T> {
  logger.info(`🔄 Fazendo requisição para ${url}`);
  
  // Tenta método 1: Axios padrão
  try {
    logger.debug('Tentando com axios padrão');
    const response = await axios.get(url);
    logger.info('✅ Requisição com axios bem-sucedida');
    return response.data as T;
  } catch (error) {
    logger.warn('⚠️ Falha ao fazer requisição com axios padrão', error);
  }
  
  // Tenta método 2: Fetch com no-cors
  try {
    logger.debug('Tentando com fetch e modo no-cors');
    const response = await fetch(url, {
      ...options,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {})
      },
      mode: 'no-cors'
    });
    
    // Verifica se a resposta está ok (pode não ser possível ler o corpo no modo no-cors)
    if (response.type === 'opaque') {
      logger.info('⚠️ Resposta opaca recebida (no-cors), não é possível ler o conteúdo');
      // Retorna um objeto vazio em caso de resposta opaca
      return {} as T;
    }
    
    if (response.ok) {
      const data = await response.json();
      logger.info('✅ Requisição com fetch bem-sucedida');
      return data as T;
    } else {
      throw new Error(`Erro HTTP: ${response.status}`);
    }
  } catch (error) {
    logger.warn('⚠️ Falha ao fazer requisição com fetch no-cors', error);
  }
  
  // Tenta método 3: Usando proxy interno
  try {
    logger.debug('Tentando com proxy interno');
    // Converte a URL externa para usar o proxy interno
    const proxyUrl = `/api-proxy?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl, {
      ...options,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      logger.info('✅ Requisição via proxy bem-sucedida');
      return data as T;
    } else {
      throw new Error(`Erro HTTP no proxy: ${response.status}`);
    }
  } catch (error) {
    logger.error('❌ Todas as tentativas de requisição falharam', error);
    throw new Error(`Falha em todas as estratégias de requisição para ${url}`);
  }
} 