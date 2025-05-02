import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';
import { API_URL } from '@/config/constants';

/**
 * Serviço para gerenciar requisições à API com autenticação
 */
class ApiService {
  private api: AxiosInstance;
  private lastSubscriptionEventTime: number = 0;
  private subscriptionEventCooldown: number = 10000; // 10 segundos de cooldown entre eventos
  
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
              error.response.data?.error === 'NO_VALID_SUBSCRIPTION' || 
              error.response.data?.error === 'SUBSCRIPTION_REQUIRED') {
            
            // Verificar se o modal foi exibido recentemente para evitar múltiplos eventos
            const now = Date.now();
            const timeSinceLastEvent = now - this.lastSubscriptionEventTime;
            
            // Se já foi mostrado um evento recentemente, não mostrar novamente
            if (timeSinceLastEvent < this.subscriptionEventCooldown) {
              console.log('[API] Cooldown ativo para eventos de assinatura:', 
                `Último: ${Math.round(timeSinceLastEvent/1000)}s atrás, Limite: ${this.subscriptionEventCooldown/1000}s`);
              return Promise.reject(error);
            }
            
            // Atualizar o timestamp do último evento
            this.lastSubscriptionEventTime = now;
            
            // Verificar se o modal já foi fechado recentemente pelo usuário
            try {
              const modalClosedTime = localStorage.getItem('subscription_modal_closed');
              if (modalClosedTime) {
                const closedAt = parseInt(modalClosedTime, 10);
                const timeSinceClosed = now - closedAt;
                
                // Se o usuário fechou o modal nos últimos 2 minutos, não mostrar novamente
                if (timeSinceClosed < 2 * 60 * 1000) {
                  console.log('[API] Modal fechado recentemente pelo usuário, não mostrando novamente');
                  return Promise.reject(error);
                }
              }
            } catch (e) {
              console.error('[API] Erro ao verificar estado de fechamento do modal:', e);
            }
            
            // Disparar evento para mostrar modal de assinatura
            console.log('[API] Disparando evento subscription:required');
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
   * Verifica se o usuário possui assinatura ativa
   * @returns Promise com o status da assinatura
   */
  public async checkSubscriptionStatus(): Promise<{ hasSubscription: boolean; subscription?: any }> {
    try {
      console.log('[API] Verificando status da assinatura...');
      const response = await this.get<any>('/subscription/status');
      // Extrair diretamente os dados da resposta
      const data = response.data || {};
      
      // Log detalhado para diagnóstico
      console.log('[API] Resposta da verificação de assinatura:', JSON.stringify(data, null, 2));
      
      // Verificar se o usuário tem assinatura ativa baseado nos dados recebidos
      // Aceitar status 'active', 'received' ou 'confirmed'
      const status = data.subscription?.status?.toLowerCase() || '';
      const hasActiveSubscription = !!(
        data.success && 
        data.hasSubscription && 
        (status === 'active' || status === 'ativo' || 
         status === 'received' || status === 'recebido' || 
         status === 'confirmed' || status === 'confirmado')
      );
      
      console.log(`[API] Status da assinatura: ${hasActiveSubscription ? 'ATIVA' : 'INATIVA/INEXISTENTE'}`);
      if (data.subscription) {
        console.log(`[API] Tipo do plano: ${data.subscription.plan}, Status: ${data.subscription.status}`);
      }
      
      return {
        hasSubscription: hasActiveSubscription,
        subscription: data.subscription
      };
    } catch (error) {
      console.error('[API] Erro ao verificar status da assinatura:', error);
      
      // Tentar usar dados do contexto local como fallback
      try {
        // Importação dinâmica para evitar dependência circular
        const { useSubscription } = await import('../context/SubscriptionContext');
        if (typeof useSubscription === 'function') {
          // Não podemos usar hooks diretamente, então verificamos localStorage
          const storedSubscription = localStorage.getItem('user_subscription_cache');
          if (storedSubscription) {
            const subData = JSON.parse(storedSubscription);
            const isActive = subData.status?.toLowerCase() === 'active' || 
                           subData.status?.toLowerCase() === 'ativo';
            
            console.log('[API] Usando dados de assinatura em cache:', isActive ? 'ATIVA' : 'INATIVA');
            return { 
              hasSubscription: isActive,
              subscription: subData
            };
          }
        }
      } catch (fallbackError) {
        console.error('[API] Erro ao usar fallback de assinatura:', fallbackError);
      }
      
      return { hasSubscription: false };
    }
  }
  
  /**
   * Requisição específica para obter dados de roletas
   * @param id ID da roleta
   * @param dataType Tipo de dados (basic, detailed, stats, historical, batch)
   * @returns Promise com a resposta
   */
  public async getRoulette<T = any>(id: string, dataType: string = 'basic'): Promise<AxiosResponse<T>> {
    // Verificar primeiro se o usuário tem assinatura ativa
    const { hasSubscription } = await this.checkSubscriptionStatus();
    
    if (!hasSubscription) {
      // Usuário sem assinatura - retornar resposta simulada com mensagem de erro
      console.log('[API] Requisição a api/roulettes bloqueada - usuário sem assinatura');
      
      return {
        data: {
          success: false,
          message: 'Para acessar estes dados, é necessário ter uma assinatura ativa',
          error: 'SUBSCRIPTION_REQUIRED',
          requiresSubscription: true
        } as any as T,
        status: 403,
        statusText: 'Forbidden',
        headers: {},
        config: {} as any
      };
    }
    
    // Usuário com assinatura - fazer a requisição normal
    return this.get<T>(`/roulettes/${id}/${dataType}`);
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