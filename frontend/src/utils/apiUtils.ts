import axios from 'axios';
import { API_URL } from '@/config/constants';

/**
 * Função para realizar requisições com suporte a CORS
 * @param url URL relativa para a requisição
 * @param options Opções adicionais para fetch
 * @returns Promise com os dados da resposta
 */
export async function fetchWithCorsSupport<T>(url: string, options: RequestInit = {}): Promise<T> {
  try {
    const response = await axios.get(url.startsWith('http') ? url : `${API_URL}${url}`);
    return response.data as T;
  } catch (error) {
    console.error('Erro na requisição fetchWithCorsSupport:', error);
    throw error;
  }
} 