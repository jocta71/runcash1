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

// Tipo para os callbacks de inscrição
type SubscriberCallback = () => void;

// Adicionar a declaração para estender a interface Window
declare global {
  interface Window {
    _lastSubscriptionEventTime?: number;
  }
}

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
  
  // Construtor privado para garantir Singleton
  private constructor() {
    console.log('[GlobalRouletteService] Inicializando serviço global de roletas');
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
   * Busca dados das roletas da API (usando limit=1000) - método principal
   * @returns Promise com dados das roletas
   */
  public async fetchRouletteData(): Promise<any[]> {
    try {
      // Verificar se o usuário tem uma assinatura válida
      const { hasSubscription, subscription } = await this.checkSubscriptionStatus();
      
      if (!hasSubscription) {
        console.log('[GlobalRouletteService] Usuário sem assinatura ativa');
        
        // Tentar usar o cache se disponível
        try {
          const cachedData = localStorage.getItem('roulette_data_cache');
          if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            const cacheAge = Date.now() - (parsedData.timestamp || 0);
            
            // Usar cache mesmo se for antigo em caso de erro no servidor (aumentar para 24 horas)
            if (cacheAge < 86400000) {
              console.log('[GlobalRouletteService] Usando dados em cache como fallback (idade: ' + 
                Math.round(cacheAge/60000) + ' minutos)');
              
              // Notificar com dados do cache
              this.rouletteData = parsedData.data || [];
              this.notifySubscribers();
              
              return this.rouletteData;
            }
          }
        } catch (cacheError) {
          console.error('[GlobalRouletteService] Erro ao acessar cache:', cacheError);
        }
        
        // Verificar se já enviamos um evento recentemente
        const currentTime = Date.now();
        const lastEventTime = window._lastSubscriptionEventTime || 0;
        const cooldownPeriod = 15000; // 15 segundos
        
        if (currentTime - lastEventTime < cooldownPeriod) {
          console.log(`[GlobalRouletteService] Evento de assinatura em cooldown (${Math.round((currentTime - lastEventTime) / 1000)}s / ${cooldownPeriod / 1000}s)`);
        } else {
          // Verificar se o modal foi fechado recentemente pelo usuário
          try {
            const modalClosedTime = localStorage.getItem('subscription_modal_closed');
            if (modalClosedTime) {
              const closedAt = parseInt(modalClosedTime, 10);
              const timeSinceClosed = currentTime - closedAt;
              
              // Se o usuário fechou o modal nos últimos 2 minutos, não mostrar novamente
              if (timeSinceClosed < 2 * 60 * 1000) {
                console.log('[GlobalRouletteService] Modal fechado pelo usuário nos últimos 2 minutos, não mostrando novamente');
              } else {
                // Atualizar o timestamp do último evento e disparar evento
                window._lastSubscriptionEventTime = currentTime;
                
                // Disparar evento para exibir modal de assinatura
                console.log('[GlobalRouletteService] Disparando evento subscription:required');
                window.dispatchEvent(new CustomEvent('subscription:required', { 
                  detail: {
                    error: 'SUBSCRIPTION_REQUIRED',
                    message: 'Para acessar os dados de roletas, é necessário ter uma assinatura ativa.',
                    userDetails: {
                      hasSubscription: false,
                      subscriptionStatus: subscription?.status || 'none'
                    }
                  }
                }));
              }
            } else {
              // Não há registro de fechamento, pode disparar evento
              window._lastSubscriptionEventTime = currentTime;
              
              // Disparar evento para exibir modal de assinatura
              console.log('[GlobalRouletteService] Disparando evento subscription:required - sem registro prévio');
              window.dispatchEvent(new CustomEvent('subscription:required', { 
                detail: {
                  error: 'SUBSCRIPTION_REQUIRED',
                  message: 'Para acessar os dados de roletas, é necessário ter uma assinatura ativa.',
                  userDetails: {
                    hasSubscription: false,
                    subscriptionStatus: subscription?.status || 'none'
                  }
                }
              }));
            }
          } catch (e) {
            console.error('[GlobalRouletteService] Erro ao verificar estado de fechamento do modal:', e);
            
            // Em caso de erro, ainda assim enviar um evento com cooldown
            window._lastSubscriptionEventTime = currentTime;
            
            // Disparar evento para exibir modal de assinatura
            console.log('[GlobalRouletteService] Disparando evento subscription:required após erro');
            window.dispatchEvent(new CustomEvent('subscription:required', { 
              detail: {
                error: 'SUBSCRIPTION_REQUIRED',
                message: 'Para acessar os dados de roletas, é necessário ter uma assinatura ativa.',
                userDetails: {
                  hasSubscription: false,
                  subscriptionStatus: subscription?.status || 'none'
                }
              }
            }));
          }
        }
        
        // Notificar os assinantes mesmo sem dados novos para evitar travamentos na interface
        this.notifySubscribers();
        
        // Emitir evento global para outros componentes que possam estar ouvindo
        const EventService = (await import('./EventService')).default;
        EventService.emit('roulette:data-updated', {
          timestamp: new Date().toISOString(),
          count: 0,
          source: 'central-service',
          error: 'SUBSCRIPTION_REQUIRED'
        });
        
        return this.rouletteData;
      }
      
      // Log do plano do usuário para diagnóstico
      if (subscription) {
        console.log(`[GlobalRouletteService] Usuário com assinatura ativa: Plano ${subscription.plan || 'Desconhecido'}, Status: ${subscription.status}`);
      }
      
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
      const currentTime = Date.now();
      const timeSinceLastRequest = currentTime - this.lastFetchTime;
      
      if (timeSinceLastRequest < 2000 && this.rouletteData.length > 0) {
        console.log(`[GlobalRouletteService] Requisição recente (${timeSinceLastRequest}ms atrás), retornando dados em cache`);
        return this.rouletteData;
      }
      
      // Sinalizar que estamos buscando dados
      this.isFetching = true;
      this.lastFetchTime = currentTime;
      
      const axiosInstance = (await import('axios')).default.create();
      
      try {
        this._currentFetchPromise = new Promise<any[]>(async (resolve) => {
          try {
            console.log('[GlobalRouletteService] Buscando dados de roletas...');
            
            // Tentar vários endpoints diferentes para aumentar as chances de sucesso
            // Adicionar timestamp para evitar cache
            const timestamp = Date.now();
            const endpoints = [
              `/api/ROULETTES?_t=${timestamp}`,
              `/api/roulettes?_t=${timestamp}`,
              `/api/roletas?_t=${timestamp}`
            ];
            
            let response = null;
            let successEndpoint = '';
            
            // Tentar cada endpoint em sequência
            for (const endpoint of endpoints) {
              try {
                console.log(`[GlobalRouletteService] Tentando endpoint: ${endpoint}`);
                response = await axiosInstance.get(endpoint, {
                  headers: {
                    'bypass-tunnel-reminder': 'true',
                    'cache-control': 'no-cache',
                    'pragma': 'no-cache'
                  },
                  timeout: 5000 // Timeout mais curto para evitar esperar muito tempo
                });
                
                if (response.status === 200 && Array.isArray(response.data)) {
                  successEndpoint = endpoint;
                  break;
                }
              } catch (endpointError) {
                console.warn(`[GlobalRouletteService] Falha ao acessar ${endpoint}:`, endpointError.message);
                // Continuar para o próximo endpoint
              }
            }
            
            if (response && response.status === 200 && Array.isArray(response.data)) {
              console.log(`[GlobalRouletteService] Recebidos ${response.data.length} registros da API via ${successEndpoint}`);
              
              // Processar e armazenar os dados
              this.rouletteData = response.data;
              
              // Salvar em cache para utilização offline
              try {
                localStorage.setItem('roulette_data_cache', JSON.stringify({
                  timestamp: Date.now(),
                  data: response.data
                }));
                console.log('[GlobalRouletteService] Dados salvos em cache para uso offline');
              } catch (storageError) {
                console.warn('[GlobalRouletteService] Erro ao salvar cache:', storageError);
              }
              
              // Notificar assinantes sobre os novos dados
              this.notifySubscribers();
              
              resolve(response.data);
            } else {
              console.warn('[GlobalRouletteService] Resposta inesperada da API, tentando usar cache');
              
              // Tentar usar cache se disponível
              try {
                const cachedData = localStorage.getItem('roulette_data_cache');
                if (cachedData) {
                  const parsedData = JSON.parse(cachedData);
                  const cacheAge = Date.now() - (parsedData.timestamp || 0);
                  
                  console.log(`[GlobalRouletteService] Usando cache com ${parsedData.data?.length || 0} roletas e idade de ${Math.round(cacheAge/60000)} minutos`);
                  this.rouletteData = parsedData.data || [];
                  this.notifySubscribers();
                }
              } catch (cacheError) {
                console.error('[GlobalRouletteService] Erro ao usar cache:', cacheError);
              }
              
              resolve(this.rouletteData);
            }
          } catch (error) {
            console.error('[GlobalRouletteService] Erro ao buscar dados da API:', error);
            
            // Tentar usar cache se disponível
            try {
              const cachedData = localStorage.getItem('roulette_data_cache');
              if (cachedData) {
                const parsedData = JSON.parse(cachedData);
                console.log('[GlobalRouletteService] Usando dados em cache devido a erro na API');
                this.rouletteData = parsedData.data || [];
                this.notifySubscribers();
              }
            } catch (cacheError) {
              console.error('[GlobalRouletteService] Erro ao usar cache:', cacheError);
            }
            
            resolve(this.rouletteData);
          } finally {
            this.isFetching = false;
            this._currentFetchPromise = null;
          }
        });
        
        return await this._currentFetchPromise;
      } catch (err) {
        console.error('[GlobalRouletteService] Erro ao buscar dados:', err);
        this.isFetching = false;
        this._currentFetchPromise = null;
        return this.rouletteData;
      }
    } catch (error) {
      console.error('[GlobalRouletteService] Erro ao verificar assinatura:', error);
      this.isFetching = false;
      
      // Tentar usar cache em caso de erro
      try {
        const cachedData = localStorage.getItem('roulette_data_cache');
        if (cachedData) {
          const parsedData = JSON.parse(cachedData);
          console.log('[GlobalRouletteService] Usando dados em cache devido a erro na verificação de assinatura');
          this.rouletteData = parsedData.data || [];
        }
      } catch (cacheError) {
        console.error('[GlobalRouletteService] Erro ao usar cache:', cacheError);
      }
      
      // Notificar assinantes para evitar travamentos na interface
      this.notifySubscribers();
      
      return this.rouletteData;
    }
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

  async checkSubscriptionStatus(): Promise<{ hasSubscription: boolean; subscription?: any }> {
    try {
      console.log('[GlobalRouletteDataService] Verificando status da assinatura');
      
      // Importar axios para fazer a requisição diretamente
      const axios = (await import('axios')).default;
      const token = localStorage.getItem('token');
      const API_URL = window.location.origin;
      
      if (!token) {
        console.log('[GlobalRouletteDataService] Usuário não autenticado');
        return { hasSubscription: false };
      }
      
      // Fazer a requisição
      const response = await axios.get(`${API_URL}/subscription/status?_t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const data = response.data || {};
      
      // Verificar se o usuário tem assinatura ativa baseado nos dados recebidos
      const status = data.subscription?.status?.toLowerCase() || '';
      const hasActiveSubscription = !!(
        data.success && 
        data.hasSubscription && 
        (status === 'active' || status === 'ativo' || 
         status === 'received' || status === 'recebido' || 
         status === 'confirmed' || status === 'confirmado')
      );
      
      return {
        hasSubscription: hasActiveSubscription,
        subscription: data.subscription
      };
    } catch (error) {
      console.error('[GlobalRouletteDataService] Erro ao verificar status da assinatura:', error);
      return { hasSubscription: false };
    }
  }

  fetchRouletteDataWithAxios = async (url: string): Promise<any> => {
    console.log(`[GlobalRouletteDataService] Fetchando dados do URL: ${url}`);
    
    // Importar axios para fazer a requisição
    const axios = (await import('axios')).default;
    const token = localStorage.getItem('token');
    
    try {
      const axiosConfig = {
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      // Adicionar token se existir
      if (token) {
        axiosConfig.headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await axios.get(url, axiosConfig);
      return response.data || null;
    } catch (error) {
      console.error(`[GlobalRouletteDataService] Erro ao buscar dados com axios:`, error);
      return null;
    }
  }
}

// Exportar a instância única do serviço
const globalRouletteDataService = GlobalRouletteDataService.getInstance();
export default globalRouletteDataService;
// Também exportar a classe para permitir o uso de getInstance() diretamente
export { GlobalRouletteDataService }; 