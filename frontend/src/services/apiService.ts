import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';
import { API_URL } from '@/config/constants';

/**
 * Serviço para gerenciar requisições à API com autenticação
 */
class ApiService {
  private api: AxiosInstance;
  
  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Adicionar interceptor para incluir token em todas as requisições
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
    
    // Interceptor para tratar erros de resposta
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        // Verificar se o erro é de autenticação (401)
        if (error.response && error.response.status === 401) {
          // Talvez redirecionar para página de login ou disparar evento
          localStorage.removeItem('token');
          window.dispatchEvent(new CustomEvent('auth:logout', { detail: 'token_expired' }));
        }
        
        // Verificar se é erro de assinatura (403)
        if (error.response && error.response.status === 403) {
          if (error.response.data?.error === 'NO_ACTIVE_SUBSCRIPTION' || 
              error.response.data?.error === 'SUBSCRIPTION_REQUIRED') {
            // Disparar evento para mostrar modal de assinatura
            window.dispatchEvent(new CustomEvent('subscription:required', { 
              detail: error.response.data 
            }));
          }
        }
        
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Realiza requisição GET
   * @param url Endpoint da API
   * @param config Configurações adicionais para a requisição
   * @returns Promise com a resposta
   */
  public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.api.get<T>(url, config);
  }
  
  /**
   * Realiza requisição POST
   * @param url Endpoint da API
   * @param data Dados a serem enviados
   * @param config Configurações adicionais para a requisição
   * @returns Promise com a resposta
   */
  public async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.api.post<T>(url, data, config);
  }
  
  /**
   * Realiza requisição PUT
   * @param url Endpoint da API
   * @param data Dados a serem enviados
   * @param config Configurações adicionais para a requisição
   * @returns Promise com a resposta
   */
  public async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.api.put<T>(url, data, config);
  }
  
  /**
   * Realiza requisição DELETE
   * @param url Endpoint da API
   * @param config Configurações adicionais para a requisição
   * @returns Promise com a resposta
   */
  public async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.api.delete<T>(url, config);
  }
  
  /**
   * Requisição específica para obter dados de roletas
   * @param id ID da roleta
   * @param dataType Tipo de dados (basic, detailed, stats, historical, batch)
   * @returns Promise com a resposta
   */
  public async getRoulette<T = any>(id: string, dataType: string = 'basic'): Promise<AxiosResponse<T>> {
    // Requisição a api/roulettes desativada
    console.log('[API] Requisições a api/roulettes foram desativadas');
    
    // Retornar uma resposta simulada vazia
    return {
      data: {} as T,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any
    };
    
    // Código original comentado
    // return this.get<T>(`/roulettes/${id}/${dataType}`);
  }
  
  /**
   * Retorna a instância do axios para uso direto
   * @returns Instância configurada do axios
   */
  public getInstance(): AxiosInstance {
    return this.api;
  }
}

// Exportar uma instância única do serviço
export const apiService = new ApiService();

export default apiService; 