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
    // Verificar antes se o usuário tem assinatura ativa
    // Importar dinamicamente para evitar dependência circular
    const apiServiceModule = await import('../services/apiService');
    const apiService = apiServiceModule.default;
    
    try {
      console.log('[GlobalRouletteService] Verificando status da assinatura...');
      const { hasSubscription, subscription } = await apiService.checkSubscriptionStatus();
      
      if (!hasSubscription) {
        console.log('[GlobalRouletteService] Requisição a api/roulettes bloqueada - usuário sem assinatura');
        
        // Verificar se temos dados em cache em localStorage como medida de fallback
        try {
          const cachedData = localStorage.getItem('roulette_data_cache');
          if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            const cacheAge = Date.now() - (parsedData.timestamp || 0);
            
            // Usar cache se tiver menos de 1 hora
            if (cacheAge < 3600000) {
              console.log('[GlobalRouletteService] Usando dados em cache como fallback (idade: ' + 
                Math.round(cacheAge/60000) + ' minutos)');
              
              // Notificar com dados do cache
              this.notifySubscribers();
              
              return parsedData.data || [];
            }
          }
        } catch (cacheError) {
          console.error('[GlobalRouletteService] Erro ao acessar cache:', cacheError);
        }
        
        // Disparar evento para exibir modal de assinatura
        window.dispatchEvent(new CustomEvent('subscription:required', { 
          detail: {
            error: 'SUBSCRIPTION_REQUIRED',
            message: 'Para acessar os dados de roletas, é necessário ter uma assinatura ativa.'
          }
        }));
        
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
        
        return [];
      }
      
      // Log do plano do usuário para diagnóstico
      if (subscription) {
        console.log(`[GlobalRouletteService] Usuário com assinatura ativa: Plano ${subscription.plan || 'Desconhecido'}`);
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
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastFetchTime;
      
      if (timeSinceLastRequest < 2000 && this.rouletteData.length > 0) {
        console.log('[GlobalRouletteService] Requisição recente (${timeSinceLastRequest}ms atrás), retornando dados em cache');
        return this.rouletteData;
      }
      
      // Sinalizar que estamos buscando dados
      this.isFetching = true;
      this.lastFetchTime = now;
      
      const axiosInstance = apiService.getInstance();
      
      try {
        this._currentFetchPromise = new Promise<any[]>(async (resolve) => {
          try {
            console.log('[GlobalRouletteService] Buscando dados de roletas...');
            
            // Usar o endpoint ROULETTES em vez de roulettes, pois o primeiro tem suporte a verificação de assinatura
            const response = await axiosInstance.get('/api/ROULETTES', {
              headers: {
                'bypass-tunnel-reminder': 'true',
                'cache-control': 'no-cache',
                'pragma': 'no-cache'
              }
            });
            
            if (response.status === 200 && Array.isArray(response.data)) {
              console.log(`[GlobalRouletteService] Recebidos ${response.data.length} registros da API`);
              
              // Processar e armazenar os dados
              this.rouletteData = response.data;
              
              // Salvar em cache para utilização offline
              try {
                localStorage.setItem('roulette_data_cache', JSON.stringify({
                  timestamp: Date.now(),
                  data: response.data
                }));
              } catch (storageError) {
                console.warn('[GlobalRouletteService] Erro ao salvar cache:', storageError);
              }
              
              // Notificar assinantes sobre os novos dados
              this.notifySubscribers();
              
              resolve(response.data);
            } else {
              console.warn('[GlobalRouletteService] Resposta inesperada da API:', response.status);
              resolve(this.rouletteData);
            }
          } catch (error) {
            console.error('[GlobalRouletteService] Erro ao buscar dados da API:', error);
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
}

// Exportar a instância única do serviço
const globalRouletteDataService = GlobalRouletteDataService.getInstance();
export default globalRouletteDataService;
// Também exportar a classe para permitir o uso de getInstance() diretamente
export { GlobalRouletteDataService }; 