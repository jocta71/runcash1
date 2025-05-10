/**
 * Serviço para comunicação com as APIs da aplicação
 * Inclui métodos para verificação de assinatura e autenticação
 */

import { getLogger } from './utils/logger';
import config from '@/config/env';
import EventService from './EventService';

const logger = getLogger('apiService');

interface SubscriptionStatus {
  active: boolean;
  plan?: string;
  expiresAt?: string;
  features?: string[];
  status?: string;
  subscriptionId?: string;
  error?: string;
  message?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class ApiService {
  private static instance: ApiService;
  private apiBaseUrl: string;
  private subscriptionStatus: SubscriptionStatus | null = null;
  private lastCheck: number = 0;
  private checkInterval: number = 5 * 60 * 1000; // 5 minutos
  
  private constructor() {
    this.apiBaseUrl = config.apiBaseUrl;
    this.loadCachedSubscriptionStatus();
    logger.info('ApiService inicializado');
  }
  
  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }
  
  /**
   * Carrega o status de assinatura armazenado em cache
   */
  private loadCachedSubscriptionStatus(): void {
    try {
      const cached = localStorage.getItem('api_subscription_cache');
      if (cached) {
        const data = JSON.parse(cached);
        this.subscriptionStatus = data.status;
        this.lastCheck = data.timestamp;
        logger.debug('Status de assinatura carregado do cache');
      }
    } catch (error) {
      logger.error('Erro ao carregar cache de assinatura:', error);
    }
  }
  
  /**
   * Salva o status de assinatura em cache
   */
  private saveSubscriptionStatusToCache(): void {
    try {
      const data = {
        status: this.subscriptionStatus,
        timestamp: this.lastCheck
      };
      localStorage.setItem('api_subscription_cache', JSON.stringify(data));
    } catch (error) {
      logger.error('Erro ao salvar cache de assinatura:', error);
    }
  }
  
  /**
   * Verifica o status da assinatura do usuário
   */
  public async checkSubscriptionStatus(): Promise<SubscriptionStatus> {
    // Verificar se temos dados em cache recentes
    const now = Date.now();
    if (
      this.subscriptionStatus && 
      this.lastCheck && 
      now - this.lastCheck < this.checkInterval
    ) {
      logger.debug('Usando status de assinatura em cache');
      return this.subscriptionStatus;
    }
    
    try {
      logger.info('Verificando status de assinatura...');
      
      // Obter token de autenticação (se disponível)
      const token = localStorage.getItem('auth_token');
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'bypass-tunnel-reminder': 'true'
      };
      
      // Adicionar token se disponível
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Fazer requisição para verificar assinatura
      const response = await fetch(`${this.apiBaseUrl}/subscription/status`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        // Se houver erro na requisição
        if (response.status === 401) {
          // Problema de autenticação
          this.subscriptionStatus = {
            active: false,
            error: 'AUTHENTICATION_REQUIRED',
            message: 'Autenticação necessária para verificar assinatura'
          };
          
          // Disparar evento de autenticação necessária
          EventService.emit('auth:required', {
            message: 'Autenticação necessária para verificar assinatura',
            source: 'subscription-check'
          });
        } else if (response.status === 402) {
          // Assinatura necessária
          this.subscriptionStatus = {
            active: false,
            error: 'SUBSCRIPTION_REQUIRED',
            message: 'Assinatura necessária para acessar este recurso'
          };
          
          // Disparar evento de assinatura necessária
          this.dispatchSubscriptionRequired({
            error: 'SUBSCRIPTION_REQUIRED',
            message: 'Assinatura necessária para acessar este recurso'
          });
        } else {
          // Outro erro
          this.subscriptionStatus = {
            active: false,
            error: 'API_ERROR',
            message: `Erro ao verificar assinatura: ${response.status}`
          };
        }
        
        this.lastCheck = now;
        this.saveSubscriptionStatusToCache();
        return this.subscriptionStatus;
      }
      
      // Processar resposta de sucesso
      const data: ApiResponse<SubscriptionStatus> = await response.json();
      
      if (!data.success) {
        // API retornou sucesso=false
        this.subscriptionStatus = {
          active: false,
          error: data.error || 'UNKNOWN_ERROR',
          message: data.message || 'Erro desconhecido ao verificar assinatura'
        };
        
        // Disparar evento de assinatura necessária
        if (data.error === 'SUBSCRIPTION_REQUIRED') {
          this.dispatchSubscriptionRequired({
            error: 'SUBSCRIPTION_REQUIRED',
            message: data.message || 'Assinatura necessária para acessar este recurso'
          });
        } else if (data.error === 'SUBSCRIPTION_INACTIVE') {
          this.dispatchSubscriptionInactive({
            error: 'SUBSCRIPTION_INACTIVE',
            message: data.message || 'Sua assinatura não está ativa'
          });
        }
      } else if (data.data) {
        // API retornou dados de sucesso
        this.subscriptionStatus = {
          ...data.data,
          // Garantir que o campo active seja booleano
          active: !!data.data.active
        };
        
        // Se assinatura não estiver ativa, disparar evento
        if (!this.subscriptionStatus.active) {
          if (this.subscriptionStatus.status === 'inactive') {
            this.dispatchSubscriptionInactive({
              error: 'SUBSCRIPTION_INACTIVE',
              status: this.subscriptionStatus.status,
              message: 'Sua assinatura não está ativa',
              subscription: {
                id: this.subscriptionStatus.subscriptionId,
                plan: this.subscriptionStatus.plan
              }
            });
          } else {
            this.dispatchSubscriptionRequired({
              error: 'NO_ACTIVE_SUBSCRIPTION',
              message: 'Você não possui uma assinatura ativa',
              currentType: this.subscriptionStatus.plan
            });
          }
        }
      } else {
        // Dados ausentes na resposta
        this.subscriptionStatus = {
          active: false,
          error: 'INVALID_RESPONSE',
          message: 'Resposta inválida do servidor'
        };
      }
      
      this.lastCheck = now;
      this.saveSubscriptionStatusToCache();
      return this.subscriptionStatus;
    } catch (error) {
      logger.error('Erro ao verificar status de assinatura:', error);
      
      // Em caso de falha, definir status de erro
      this.subscriptionStatus = {
        active: false,
        error: 'CONNECTION_ERROR',
        message: 'Erro de conexão ao verificar assinatura'
      };
      
      this.lastCheck = now;
      this.saveSubscriptionStatusToCache();
      return this.subscriptionStatus;
    }
  }
  
  /**
   * Dispara evento quando assinatura é necessária
   */
  private dispatchSubscriptionRequired(details: any): void {
    const event = new CustomEvent('subscription:required', {
      detail: details
    });
    window.dispatchEvent(event);
  }
  
  /**
   * Dispara evento quando assinatura está inativa
   */
  private dispatchSubscriptionInactive(details: any): void {
    const event = new CustomEvent('subscription:inactive', {
      detail: details
    });
    window.dispatchEvent(event);
  }
  
  /**
   * Obtém o status atual da assinatura
   */
  public getSubscriptionStatus(): SubscriptionStatus | null {
    return this.subscriptionStatus;
  }
  
  /**
   * Verifica se o usuário tem uma assinatura ativa
   */
  public hasActiveSubscription(): boolean {
    return !!this.subscriptionStatus?.active;
  }
  
  /**
   * Limpa o cache de assinatura
   */
  public clearSubscriptionCache(): void {
    localStorage.removeItem('api_subscription_cache');
    this.subscriptionStatus = null;
    this.lastCheck = 0;
    logger.debug('Cache de assinatura limpo');
  }
  
  /**
   * Método genérico para fazer requisições GET
   */
  public async get<T>(endpoint: string, headers: Record<string, string> = {}): Promise<ApiResponse<T>> {
    try {
      // Obter token de autenticação
      const token = localStorage.getItem('auth_token');
      
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'bypass-tunnel-reminder': 'true',
        ...headers
      };
      
      // Adicionar token se disponível
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
      
      // Fazer requisição
      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        method: 'GET',
        headers: requestHeaders
      });
      
      if (!response.ok) {
        return {
          success: false,
          error: `HTTP_ERROR_${response.status}`,
          message: `Erro HTTP: ${response.status}`
        };
      }
      
      const data = await response.json();
      return data;
    } catch (error: any) {
      logger.error(`Erro na requisição GET ${endpoint}:`, error);
      return {
        success: false,
        error: 'REQUEST_FAILED',
        message: error.message || 'Falha na requisição'
      };
    }
  }
  
  /**
   * Método genérico para fazer requisições POST
   */
  public async post<T>(endpoint: string, body: any, headers: Record<string, string> = {}): Promise<ApiResponse<T>> {
    try {
      // Obter token de autenticação
      const token = localStorage.getItem('auth_token');
      
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'bypass-tunnel-reminder': 'true',
        ...headers
      };
      
      // Adicionar token se disponível
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
      
      // Fazer requisição
      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        return {
          success: false,
          error: `HTTP_ERROR_${response.status}`,
          message: `Erro HTTP: ${response.status}`
        };
      }
      
      const data = await response.json();
      return data;
    } catch (error: any) {
      logger.error(`Erro na requisição POST ${endpoint}:`, error);
      return {
        success: false,
        error: 'REQUEST_FAILED',
        message: error.message || 'Falha na requisição'
      };
    }
  }
}

export default ApiService.getInstance(); 