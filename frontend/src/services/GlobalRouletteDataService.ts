import { fetchWithCorsSupport } from '../utils/api-helpers';
import EventService from './EventService';

// Intervalo de polling padrão em milissegundos (4 segundos)
const POLLING_INTERVAL = 4000;

// Tempo de vida do cache em milissegundos (15 segundos)
// const CACHE_TTL = 15000;

// Intervalo mínimo entre requisições forçadas (4 segundos)
const MIN_FORCE_INTERVAL = 4000;

// Limite padrão para requisições normais (1000 itens)
const DEFAULT_LIMIT = 1000;

// Limite para requisições detalhadas (1000 itens)
const DETAILED_LIMIT = 1000;

// Flag para controle de acesso (padrão: verdadeiro para compatibilidade com versões anteriores)
const REQUIRE_AUTHENTICATION = true;

// Flag para verificar plano ativo (nova funcionalidade)
const REQUIRE_PAID_PLAN = true;

// Tipo para os callbacks de inscrição
type SubscriberCallback = () => void;

/**
 * Serviço Global para centralizar requisições de dados das roletas
 * Este serviço implementa o padrão Singleton para garantir apenas uma instância
 * e evitar múltiplas requisições à API
 */
class GlobalRouletteDataService {
  private static instance: GlobalRouletteDataService;
  
  // Dados e estado
  private rouletteData: any[] = [];
  private lastFetchTime: number = 0;
  private isFetching: boolean = false;
  private pollingTimer: number | null = null;
  private subscribers: Map<string, SubscriberCallback> = new Map();
  private _currentFetchPromise: Promise<any[]> | null = null;
  private _isAuthenticated: boolean = false;
  private _hasPaidPlan: boolean = false;
  
  // Construtor privado para garantir Singleton
  private constructor() {
    console.log('[GlobalRouletteService] Inicializando serviço global de roletas');
    
    // Verificar assinatura ASAAS em segundo plano
    this.updateSubscriptionStatus();
    
    // Iniciar polling para dados
    this.startPolling();
  }

  /**
   * Obtém a instância única do serviço
   */
  public static getInstance(): GlobalRouletteDataService {
    if (!GlobalRouletteDataService.instance) {
      GlobalRouletteDataService.instance = new GlobalRouletteDataService();
    }
    return GlobalRouletteDataService.instance;
  }

  /**
   * Inicia o processo de polling
   */
  private startPolling(): void {
    if (this.pollingTimer) {
      window.clearInterval(this.pollingTimer);
    }
    
    // Buscar dados imediatamente
    this.fetchRouletteData();
    
    // Configurar polling
    this.pollingTimer = window.setInterval(() => {
      this.fetchRouletteData();
    }, POLLING_INTERVAL) as unknown as number;
    
    console.log(`[GlobalRouletteService] Polling iniciado com intervalo de ${POLLING_INTERVAL}ms`);
    
    // Configurar verificação periódica de assinatura ASAAS (a cada 5 minutos)
    setInterval(() => {
      console.log('[GlobalRouletteService] Verificando status de assinatura ASAAS periodicamente');
      this.updateSubscriptionStatus();
    }, 5 * 60 * 1000); // 5 minutos = 300000ms
    
    // Adicionar manipuladores de visibilidade para pausar quando a página não estiver visível
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('focus', this.resumePolling);
    window.addEventListener('blur', this.handleVisibilityChange);
  }
  
  /**
   * Pausa o polling quando a página não está visível
   */
  private handleVisibilityChange = (): void => {
    if (document.hidden || document.visibilityState === 'hidden') {
      console.log('[GlobalRouletteService] Página não visível, pausando polling');
      if (this.pollingTimer) {
        window.clearInterval(this.pollingTimer);
        this.pollingTimer = null;
      }
    } else {
      this.resumePolling();
    }
  }
  
  /**
   * Retoma o polling quando a página fica visível novamente
   */
  private resumePolling = (): void => {
    if (!this.pollingTimer) {
      console.log('[GlobalRouletteService] Retomando polling');
      this.fetchRouletteData(); // Buscar dados imediatamente
      this.pollingTimer = window.setInterval(() => {
        this.fetchRouletteData();
      }, POLLING_INTERVAL) as unknown as number;
    }
  }
  
  /**
   * Verifica se o usuário tem plano pago ativo
   * @returns booleano indicando se usuário tem plano ativo
   */
  private hasActivePlan(): boolean {
    // Se já temos o estado em memória, usar esse
    if (this._hasPaidPlan) {
      console.log('[GlobalRouletteService] Usando flag em memória: usuário tem plano ativo');
      return true;
    }
    
    // ETAPA 1: Verificar subscription_cache que é usado pelo SubscriptionContext
    const subscriptionCacheStr = localStorage.getItem('subscription_cache');
    if (subscriptionCacheStr) {
      try {
        const subscriptionCache = JSON.parse(subscriptionCacheStr);
        
        // Verificar se há uma assinatura ativa no formato do SubscriptionContext
        // CORREÇÃO: Agora exigimos que o status seja active/ativo E o planId seja válido
        if (subscriptionCache && 
            // Primeiro verificar se o status é ativo
            (subscriptionCache.status === 'active' || 
             subscriptionCache.status === 'ativo') && 
            // Depois verificar se o planId é válido
            (subscriptionCache.planId === 'premium' || 
             subscriptionCache.planId === 'pro' || 
             subscriptionCache.planId === 'basic')) {
          
          // NOVA VERIFICAÇÃO: Verificar se há indicação de pagamento confirmado
          if (subscriptionCache.hasConfirmedPayment === true) {
            console.log(`[GlobalRouletteService] Verificação de plano: Tem plano ativo com pagamento confirmado (via subscription_cache: ${subscriptionCache.planId})`);
            this._hasPaidPlan = true;
            return true;
          }
          
          // Se não tiver confirmação de pagamento explícita, mas tiver informação legacy confiável
          if (subscriptionCache.paymentConfirmed === true || subscriptionCache.confirmed === true) {
            console.log(`[GlobalRouletteService] Verificação de plano: Tem plano ativo com pagamento confirmado via flags legacy (via subscription_cache: ${subscriptionCache.planId})`);
            this._hasPaidPlan = true;
            return true;
          }
          
          console.log(`[GlobalRouletteService] Verificação de plano: Tem plano ativo mas SEM confirmação de pagamento (via subscription_cache: ${subscriptionCache.planId})`);
        }
        
        // Se o status não for ACTIVE, logar informação para debug
        if (subscriptionCache && 
            (subscriptionCache.planId === 'premium' || 
             subscriptionCache.planId === 'pro' || 
             subscriptionCache.planId === 'basic') &&
            subscriptionCache.status !== 'active' && 
            subscriptionCache.status !== 'ativo') {
          console.log(`[GlobalRouletteService] Assinatura encontrada mas com status não ativo: ${subscriptionCache.status}`);
        }
      } catch (e) {
        console.warn('[GlobalRouletteService] Erro ao analisar subscription_cache:', e);
      }
    }
    
    // ETAPA 1.1: Verificar asaas_subscription_cache que é mantido por este serviço
    const asaasSubscriptionCacheStr = localStorage.getItem('asaas_subscription_cache');
    if (asaasSubscriptionCacheStr) {
      try {
        const asaasCache = JSON.parse(asaasSubscriptionCacheStr);
        
        // Verificar se a assinatura está ativa e se o cache não é muito antigo (max 1 hora)
        const cacheAge = Date.now() - (asaasCache.timestamp || 0);
        
        // CORREÇÃO: Validar explicitamente que status deve ser ACTIVE e não PENDING
        const statusAtivo = asaasCache.status?.toLowerCase() === 'active' || 
                           asaasCache.status?.toLowerCase() === 'ativo';
                           
        // NOVA VERIFICAÇÃO: Verificar pagamento confirmado
        const pagamentoConfirmado = asaasCache.hasConfirmedPayment === true;
        
        // Verificar explicitamente que o status não seja PENDING
        if (asaasCache.isActive && statusAtivo && 
            asaasCache.status?.toLowerCase() !== 'pending' && 
            asaasCache.status?.toLowerCase() !== 'pendente') {
            
          // VERIFICAÇÃO ADICIONAL: Exigir confirmação de pagamento
          if (pagamentoConfirmado) {
            console.log('[GlobalRouletteService] Verificação de plano: Tem plano ativo com pagamento confirmado (via asaas_subscription_cache)');
            this._hasPaidPlan = true;
            return true;
          } else {
            console.log('[GlobalRouletteService] Assinatura ACTIVE mas sem pagamento confirmado, negando acesso');
          }
        }
        
        // Logar quando uma assinatura PENDING for encontrada
        if (asaasCache.status?.toLowerCase() === 'pending' || 
            asaasCache.status?.toLowerCase() === 'pendente') {
          console.log('[GlobalRouletteService] Assinatura com status PENDING encontrada, acesso negado');
        }
      } catch (e) {
        console.warn('[GlobalRouletteService] Erro ao analisar asaas_subscription_cache:', e);
      }
    }
    
    // Iniciar verificação de assinatura ASAAS em segundo plano para atualizar o estado
    this.updateSubscriptionStatus();
    
    // ETAPA 2: Verificar no localStorage padrão usado por este serviço
    const userDataStr = localStorage.getItem('auth_user_cache');
    if (userDataStr) {
      try {
        const userData = JSON.parse(userDataStr);
        
        // CORREÇÃO: Verificar explicitamente o status da assinatura e confirmação de pagamento
        // Verificar se o usuário tem um plano ativo baseado nos dados do cache
        const hasPlan = !!(
          // Verificar formatos padrão COM status ativo e pagamento confirmado
          (userData.subscription?.active === true && userData.subscription?.paymentConfirmed === true) || 
          (userData.subscription?.status === 'active' && userData.subscription?.paymentConfirmed === true) || 
          (userData.subscription?.status === 'ativo' && userData.subscription?.status !== 'pending' && userData.subscription?.paymentConfirmed === true) || 
          (userData.plan?.active === true && userData.plan?.paymentConfirmed === true) || 
          userData.isAdmin // Administradores sempre têm acesso
        );
        
        if (hasPlan) {
          console.log(`[GlobalRouletteService] Verificação de plano: Tem plano ativo com pagamento confirmado (via auth_user_cache)`);
          this._hasPaidPlan = true;
          return true;
        }
        
        // Se tiver asaasCustomerId com subscription mas status for pending, negar acesso
        if (userData.asaasCustomerId && 
            userData.subscription && 
            (userData.subscription.status === 'pending' || 
             userData.subscription.status === 'pendente')) {
          console.log('[GlobalRouletteService] Assinatura ASAAS com status PENDING encontrada, acesso negado');
          return false;
        }
        
        // Se tiver assinatura active mas sem confirmação de pagamento, negar acesso
        if (userData.asaasCustomerId && 
            userData.subscription && 
            (userData.subscription.status === 'active' || userData.subscription.status === 'ativo') &&
            userData.subscription.paymentConfirmed !== true) {
          console.log('[GlobalRouletteService] Assinatura ACTIVE mas sem pagamento confirmado, acesso negado');
          return false;
        }
      } catch (e) {
        console.error('[GlobalRouletteService] Erro ao verificar plano:', e);
      }
    }
    
    // ETAPA 3: Verificar assinatura diretamente no sessionStorage e localStorage
    try {
      // Lista de chaves possíveis onde os dados de assinatura podem estar armazenados
      const possibleKeys = [
        'user_subscription',
        'asaas_subscription',
        'subscription_data',
        'subscription_status'
      ];
      
      for (const key of possibleKeys) {
        // Verificar no localStorage
        const localData = localStorage.getItem(key);
        if (localData) {
          try {
            const parsedData = JSON.parse(localData);
            
            // CORREÇÃO: Verificar explicitamente que o status não seja PENDING
            const isActive = parsedData && 
                (parsedData.status === 'active' || 
                 parsedData.status === 'ativo' ||
                 parsedData.active === true ||
                 parsedData.isActive === true);
                 
            const isPending = parsedData && 
                (parsedData.status === 'pending' || 
                 parsedData.status === 'pendente');
                 
            // NOVA VERIFICAÇÃO: Verificar pagamento confirmado
            const hasConfirmedPayment = parsedData && 
                (parsedData.paymentConfirmed === true ||
                 parsedData.hasConfirmedPayment === true ||
                 parsedData.confirmed === true);
            
            if (isActive && !isPending && hasConfirmedPayment) {
              console.log(`[GlobalRouletteService] Verificação de plano: Tem plano ativo com pagamento confirmado (via ${key})`);
              this._hasPaidPlan = true;
              return true;
            }
            
            // Logar status PENDING encontrados
            if (isPending) {
              console.log(`[GlobalRouletteService] Assinatura com status PENDING encontrada em ${key}, acesso negado`);
            }
            
            // Logar assinaturas ativas sem pagamento confirmado
            if (isActive && !isPending && !hasConfirmedPayment) {
              console.log(`[GlobalRouletteService] Assinatura ACTIVE mas sem pagamento confirmado em ${key}, acesso negado`);
            }
          } catch (e) {
            // Ignorar erros de parsing
          }
        }
        
        // Verificar no sessionStorage
        const sessionData = sessionStorage.getItem(key);
        if (sessionData) {
          try {
            const parsedData = JSON.parse(sessionData);
            
            // CORREÇÃO: Verificar explicitamente que o status não seja PENDING
            const isActive = parsedData && 
                (parsedData.status === 'active' || 
                 parsedData.status === 'ativo' ||
                 parsedData.active === true ||
                 parsedData.isActive === true);
                 
            const isPending = parsedData && 
                (parsedData.status === 'pending' || 
                 parsedData.status === 'pendente');
                 
            // NOVA VERIFICAÇÃO: Verificar pagamento confirmado
            const hasConfirmedPayment = parsedData && 
                (parsedData.paymentConfirmed === true ||
                 parsedData.hasConfirmedPayment === true ||
                 parsedData.confirmed === true);
            
            if (isActive && !isPending && hasConfirmedPayment) {
              console.log(`[GlobalRouletteService] Verificação de plano: Tem plano ativo com pagamento confirmado (via sessionStorage.${key})`);
              this._hasPaidPlan = true;
              return true;
            }
          } catch (e) {
            // Ignorar erros de parsing
          }
        }
      }
    } catch (e) {
      console.error('[GlobalRouletteService] Erro ao verificar planos em armazenamentos alternativos:', e);
    }
    
    // Se chegamos aqui, não encontramos nenhuma evidência de plano ativo
    console.log('[GlobalRouletteService] Verificação de plano: Sem plano ativo (após verificar todas as fontes)');
    return false;
  }
  
  /**
   * Verifica especificamente a assinatura ASAAS do usuário
   * Método especializado para lidar com o formato de assinatura ASAAS
   * @returns Promise<boolean> indicando se o usuário tem plano ASAAS ativo
   */
  private async checkAsaasSubscription(): Promise<boolean> {
    try {
      // Obter ID do cliente do usuário atual
      const customerIdStr = localStorage.getItem('auth_user_cache');
      if (!customerIdStr) {
        console.log('[GlobalRouletteService] Sem dados de usuário disponíveis para verificar ASAAS');
        return false;
      }
      
      const userData = JSON.parse(customerIdStr);
      const customerId = userData.asaasCustomerId;
      
      if (!customerId) {
        console.log('[GlobalRouletteService] Usuário não possui asaasCustomerId');
        return false;
      }
      
      console.log(`[GlobalRouletteService] Verificando assinatura ASAAS para cliente: ${customerId}`);
      
      // Buscar assinatura do API
      const API_URL = window.location.origin;
      const subscriptionResponse = await fetch(`${API_URL}/api/asaas-find-subscription?customerId=${customerId}&_t=${Date.now()}`);
      
      // Se ocorrer um erro na API, manter qualquer status de assinatura anterior
      if (!subscriptionResponse.ok) {
        console.warn(`[GlobalRouletteService] Erro ao verificar assinatura ASAAS: ${subscriptionResponse.status}`);
        return false; 
      }
      
      const data = await subscriptionResponse.json();
      
      // Verificar se há uma assinatura ativa
      if (data && data.success && data.subscriptions && data.subscriptions.length > 0) {
        const subscription = data.subscriptions[0];
        
        // Verificar explicitamente que o status é ACTIVE e não é PENDING
        const isActive = 
          (subscription.status?.toLowerCase() === 'active' || subscription.status?.toLowerCase() === 'ativo') && 
          subscription.status?.toLowerCase() !== 'pending' && 
          subscription.status?.toLowerCase() !== 'pendente';
        
        // NOVO: Verificar também os pagamentos associados a esta assinatura
        let hasConfirmedPayment = false;
        
        // Se temos dados de pagamento na resposta
        if (data.payments && data.payments.length > 0) {
          // Verificar se há pelo menos um pagamento confirmado
          hasConfirmedPayment = data.payments.some(payment => 
            payment.status?.toLowerCase() === 'confirmed' || 
            payment.status?.toLowerCase() === 'received'
          );
          
          console.log(`[GlobalRouletteService] Verificação de pagamentos: ${hasConfirmedPayment ? 'Pagamento confirmado encontrado' : 'Nenhum pagamento confirmado'}`);
        } else {
          // Se não temos dados, buscar pagamentos específicos
          try {
            const paymentsResponse = await fetch(`${API_URL}/api/asaas-find-payments?subscriptionId=${subscription.id}&_t=${Date.now()}`);
            
            if (paymentsResponse.ok) {
              const paymentsData = await paymentsResponse.json();
              
              if (paymentsData && paymentsData.success && paymentsData.payments && paymentsData.payments.length > 0) {
                // Verificar pagamentos
                hasConfirmedPayment = paymentsData.payments.some(payment => 
                  payment.status?.toLowerCase() === 'confirmed' || 
                  payment.status?.toLowerCase() === 'received'
                );
                
                console.log(`[GlobalRouletteService] Verificação adicional de pagamentos: ${hasConfirmedPayment ? 'Pagamento confirmado encontrado' : 'Nenhum pagamento confirmado'}`);
              }
            }
          } catch (error) {
            console.error('[GlobalRouletteService] Erro ao buscar pagamentos da assinatura:', error);
          }
        }
          
        const isPending = subscription.status?.toLowerCase() === 'pending' || 
                        subscription.status?.toLowerCase() === 'pendente';
        
        // Salvar informações da assinatura no localStorage para uso futuro
        localStorage.setItem('asaas_subscription_cache', JSON.stringify({
          id: subscription.id,
          status: subscription.status,
          value: subscription.value,
          nextDueDate: subscription.nextDueDate,
          isActive: isActive,
          isPending: isPending,
          hasConfirmedPayment: hasConfirmedPayment,
          timestamp: Date.now()
        }));
        
        // Logar status para depuração
        console.log(`[GlobalRouletteService] Status da assinatura ASAAS: ${subscription.status} (isActive=${isActive}, isPending=${isPending}, hasConfirmedPayment=${hasConfirmedPayment})`);
        
        // MODIFICAÇÃO: Agora exigimos tanto isActive quanto hasConfirmedPayment
        if (isActive && hasConfirmedPayment) {
          console.log('[GlobalRouletteService] Assinatura ASAAS ativa COM pagamento confirmado, acesso liberado');
          this._hasPaidPlan = true;
          return true;
        } else if (isActive && !hasConfirmedPayment) {
          console.log('[GlobalRouletteService] Assinatura ASAAS ativa mas SEM pagamento confirmado, acesso negado');
          this._hasPaidPlan = false;
          return false;
        } else if (isPending) {
          console.log('[GlobalRouletteService] Assinatura ASAAS com status PENDING, acesso negado');
          this._hasPaidPlan = false;
          return false;
        }
      }
      
      console.log('[GlobalRouletteService] Nenhuma assinatura ASAAS ativa encontrada');
      return false;
    } catch (error) {
      console.error('[GlobalRouletteService] Erro ao verificar assinatura ASAAS:', error);
      return false;
    }
  }
  
  /**
   * Atualiza o estado de verificação de plano usando ASAAS
   * Este método é chamado em segundo plano para manter o estado atualizado
   */
  private updateSubscriptionStatus(): void {
    // Tentar verificar em segundo plano, sem bloquear a execução
    this.checkAsaasSubscription().then(hasActivePlan => {
      if (hasActivePlan && !this._hasPaidPlan) {
        console.log('[GlobalRouletteService] Estado de assinatura atualizado: usuário tem plano ativo');
        this._hasPaidPlan = true;
      } else if (!hasActivePlan && this._hasPaidPlan) {
        console.log('[GlobalRouletteService] Estado de assinatura atualizado: usuário não tem plano ativo');
        this._hasPaidPlan = false;
      }
    });
  }
  
  /**
   * Busca dados das roletas da API (usando limit=1000) - método principal
   * @returns Promise com dados das roletas
   */
  public async fetchRouletteData(): Promise<any[]> {
    // Evitar requisições simultâneas
    if (this.isFetching) {
      console.log('[GlobalRouletteService] Requisição já em andamento, aguardando...');
      
      // Aguardar a conclusão da requisição atual
      if (this._currentFetchPromise) {
        return this._currentFetchPromise;
      }
      
      return this.rouletteData;
    }
    
    // Verificar se já fizemos uma requisição recentemente
    const now = Date.now();
    if (now - this.lastFetchTime < MIN_FORCE_INTERVAL) {
      console.log(`[GlobalRouletteService] Última requisição foi feita há ${Math.round((now - this.lastFetchTime)/1000)}s. Aguardando intervalo mínimo de ${MIN_FORCE_INTERVAL/1000}s.`);
      return this.rouletteData;
    }
    
    // Obter token de autenticação (do localStorage ou cookies)
    const authToken = this.getAuthToken();
    
    // Se a autenticação for obrigatória e não houver token, não fazer a requisição
    if (REQUIRE_AUTHENTICATION && !authToken) {
      console.log('[GlobalRouletteService] Usuário não autenticado, requisição cancelada');
      
      // Emitir evento para notificar que usuário precisa autenticar
      EventService.emit('auth:required', {
        message: 'Autenticação necessária para acessar os dados das roletas',
        timestamp: new Date().toISOString()
      });
      
      return this.rouletteData;
    }
    
    // NOVA VERIFICAÇÃO: Se o plano for obrigatório e o usuário não tiver plano, não fazer a requisição
    if (REQUIRE_PAID_PLAN && !this.hasActivePlan()) {
      console.log('[GlobalRouletteService] Usuário sem plano ativo, requisição cancelada');
      
      // Emitir evento para notificar que usuário precisa de plano
      EventService.emit('subscription:required', {
        message: 'Assinatura necessária para acessar os dados das roletas',
        timestamp: new Date().toISOString()
      });
      
      // Também emitir evento de auth:required para mostrar o modal caso necessário
      EventService.emit('auth:required', {
        message: 'Assinatura necessária para acessar os dados das roletas',
        timestamp: new Date().toISOString(),
        requiresSubscription: true
      });
      
      return this.rouletteData;
    }
    
    try {
      this.isFetching = true;
      
      // Removendo a verificação de cache para sempre buscar dados frescos
      console.log('[GlobalRouletteService] Buscando dados atualizados da API (limit=1000)');
      
      // Criar e armazenar a promessa atual
      this._currentFetchPromise = (async () => {
        // Usar a função utilitária com suporte a CORS - com limit=1000 para todos os casos
        const data = await fetchWithCorsSupport<any[]>(`/api/ROULETTES?limit=${DEFAULT_LIMIT}`, {
          headers: authToken ? {
            'Authorization': `Bearer ${authToken}`
          } : undefined
        });
        
        // Verificar se os dados são válidos
        if (data && Array.isArray(data)) {
          console.log(`[GlobalRouletteService] Dados recebidos com sucesso: ${data.length} roletas com um total de ${this.contarNumerosTotais(data)} números`);
          this.rouletteData = data;
          this.lastFetchTime = now;
          this._isAuthenticated = true; // Marcar que autenticação está ok
          this._hasPaidPlan = true;     // Marcar que plano está ok (se chegou aqui, tem plano)
          
          // Notificar todos os assinantes sobre a atualização
          this.notifySubscribers();
          
          // Emitir evento global para outros componentes que possam estar ouvindo
          EventService.emit('roulette:data-updated', {
            timestamp: new Date().toISOString(),
            count: data.length,
            source: 'central-service'
          });
          
          return data;
        } else {
          console.error('[GlobalRouletteService] Resposta inválida da API');
          return this.rouletteData;
        }
      })();
      
      return await this._currentFetchPromise;
    } catch (error) {
      // Verificar se o erro é de autenticação (401)
      if (error.response && error.response.status === 401) {
        console.error('[GlobalRouletteService] Erro de autenticação (401)');
        this._isAuthenticated = false;
        
        // Emitir evento para notificar que usuário precisa autenticar
        EventService.emit('auth:required', {
          message: 'Sessão expirada ou inválida',
          timestamp: new Date().toISOString(),
          status: 401
        });
      } 
      // Verificar se é erro de permissão (403) - normalmente relacionado a plano
      else if (error.response && error.response.status === 403) {
        console.error('[GlobalRouletteService] Erro de permissão (403)');
        this._hasPaidPlan = false;
        
        // Emitir evento para notificar que usuário precisa de plano
        EventService.emit('subscription:required', {
          message: 'Assinatura necessária para acessar este conteúdo',
          timestamp: new Date().toISOString(),
          status: 403
        });
        
        // Também emitir evento de auth:required para mostrar o modal caso necessário
        EventService.emit('auth:required', {
          message: 'Assinatura necessária para acessar este conteúdo',
          timestamp: new Date().toISOString(),
          requiresSubscription: true,
          status: 403
        });
      } else {
        console.error('[GlobalRouletteService] Erro ao buscar dados:', error);
      }
      
      return this.rouletteData;
    } finally {
      this.isFetching = false;
      this._currentFetchPromise = null;
    }
  }
  
  /**
   * Obtém o token de autenticação do localStorage ou cookies
   */
  private getAuthToken(): string | null {
    // Tentar obter do localStorage
    let token = localStorage.getItem('auth_token');
    
    // Se não encontrar no localStorage, tentar obter dos cookies
    if (!token) {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'auth_token' || name === 'token') {
          token = value;
          break;
        }
      }
    }
    
    return token;
  }
  
  /**
   * Verifica se o usuário está autenticado
   * @returns true se estiver autenticado, false caso contrário
   */
  public isAuthenticated(): boolean {
    return this._isAuthenticated || this.getAuthToken() !== null;
  }
  
  /**
   * Verifica se o usuário tem plano ativo
   * @returns true se tiver plano ativo, false caso contrário
   */
  public hasPaidPlan(): boolean {
    return this.hasActivePlan();
  }
  
  /**
   * Conta o número total de números em todas as roletas
   */
  private contarNumerosTotais(roletas: any[]): number {
    let total = 0;
    roletas.forEach(roleta => {
      if (roleta.numero && Array.isArray(roleta.numero)) {
        total += roleta.numero.length;
      }
    });
    return total;
  }
  
  /**
   * Força uma atualização imediata dos dados
   */
  public forceUpdate(): void {
    const now = Date.now();
    
    // Verificar se a última requisição foi recente demais
    if (now - this.lastFetchTime < MIN_FORCE_INTERVAL) {
      console.log(`[GlobalRouletteService] Requisição forçada muito próxima da anterior (${now - this.lastFetchTime}ms), ignorando`);
      return;
    }
    
    console.log('[GlobalRouletteService] Forçando atualização de dados');
    this.fetchRouletteData();
  }
  
  /**
   * Obtém a roleta pelo nome
   * @param rouletteName Nome da roleta
   * @returns Objeto com dados da roleta ou undefined
   */
  public getRouletteByName(rouletteName: string): any {
    return this.rouletteData.find(roulette => {
      const name = roulette.nome || roulette.name || '';
      return name.toLowerCase() === rouletteName.toLowerCase();
    });
  }
  
  /**
   * Obtém todos os dados das roletas
   * @returns Array com todas as roletas
   */
  public getAllRoulettes(): any[] {
    return this.rouletteData;
  }
  
  /**
   * Obtém todos os dados detalhados das roletas
   * @returns Array com todas as roletas (dados detalhados)
   */
  public getAllDetailedRoulettes(): any[] {
    // Agora retornamos os mesmos dados, pois sempre buscamos com limit=1000
    return this.rouletteData;
  }
  
  /**
   * Registra um callback para receber notificações quando os dados forem atualizados
   * @param id Identificador único para o subscriber
   * @param callback Função a ser chamada quando houver atualização
   */
  public subscribe(id: string, callback: SubscriberCallback): void {
    if (!id || typeof callback !== 'function') {
      console.error('[GlobalRouletteService] ID ou callback inválido para subscription');
      return;
    }
    
    this.subscribers.set(id, callback);
    console.log(`[GlobalRouletteService] Novo assinante registrado: ${id}`);
    
    // Chamar o callback imediatamente se já tivermos dados
    if (this.rouletteData.length > 0) {
      callback();
    }
  }
  
  /**
   * Registra um assinante para dados detalhados
   * @param id Identificador único para o subscriber
   * @param callback Função a ser chamada quando houver atualização
   */
  public subscribeToDetailedData(id: string, callback: SubscriberCallback): void {
    // Agora que temos apenas uma fonte de dados, direcionamos para o método principal
    this.subscribe(id, callback);
  }
  
  /**
   * Cancela a inscrição de um assinante
   * @param id Identificador do assinante
   */
  public unsubscribe(id: string): void {
    this.subscribers.delete(id);
  }
  
  /**
   * Notifica todos os assinantes sobre atualização nos dados
   */
  private notifySubscribers(): void {
    console.log(`[GlobalRouletteService] Notificando ${this.subscribers.size} assinantes`);
    
    this.subscribers.forEach((callback, id) => {
      try {
        callback();
      } catch (error) {
        console.error(`[GlobalRouletteService] Erro ao notificar assinante ${id}:`, error);
      }
    });
  }
  
  /**
   * Busca dados detalhados (usando limit=1000) - método mantido para compatibilidade
   */
  public async fetchDetailedRouletteData(): Promise<any[]> {
    // Método mantido apenas para compatibilidade, mas agora usa o mesmo método principal
    return this.fetchRouletteData();
  }
  
  /**
   * Limpa todos os recursos ao desmontar
   */
  public dispose(): void {
    if (this.pollingTimer) {
      window.clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('focus', this.resumePolling);
    window.removeEventListener('blur', this.handleVisibilityChange);
    
    this.subscribers.clear();
    console.log('[GlobalRouletteService] Serviço encerrado e recursos liberados');
  }
}

// Exportar a instância única do serviço
const globalRouletteDataService = GlobalRouletteDataService.getInstance();
export default globalRouletteDataService;
// Também exportar a classe para permitir o uso de getInstance() diretamente
export { GlobalRouletteDataService }; 