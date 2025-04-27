import { fetchWithCorsSupport } from '../utils/api-helpers';
import EventService from './EventService';

// Tipo para informações de assinatura na resposta da API
interface SubscriptionInfo {
  plan: string;
  limits: {
    maxRoulettes: number | null;
    maxHistoryItems: number | null;
    refreshInterval: number;
  }
}

// Tipo para a resposta da API com envelope
interface ApiResponse<T> {
  data: T;
  subscription?: SubscriptionInfo;
}

// Intervalo de polling padrão em milissegundos (4 segundos)
const DEFAULT_POLLING_INTERVAL = 4000;

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
  
  // Informações da assinatura do usuário
  private subscriptionInfo: SubscriptionInfo | null = null;
  private pollingInterval: number = DEFAULT_POLLING_INTERVAL;
  
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
    
    // Configurar polling com intervalo baseado na assinatura
    this.pollingTimer = window.setInterval(() => {
      this.fetchRouletteData();
    }, this.pollingInterval) as unknown as number;
    
    console.log(`[GlobalRouletteService] Polling iniciado com intervalo de ${this.pollingInterval}ms`);
    
    // Adicionar manipuladores de visibilidade para pausar quando a página não estiver visível
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('focus', this.resumePolling);
    window.addEventListener('blur', this.handleVisibilityChange);
  }
  
  /**
   * Atualiza o intervalo de polling com base na assinatura
   */
  private updatePollingInterval(): void {
    if (this.subscriptionInfo && this.subscriptionInfo.limits.refreshInterval) {
      // Usar o intervalo definido pela assinatura
      this.pollingInterval = this.subscriptionInfo.limits.refreshInterval;
    } else {
      // Usar intervalo padrão
      this.pollingInterval = DEFAULT_POLLING_INTERVAL;
    }
    
    // Reiniciar polling com novo intervalo
    if (this.pollingTimer) {
      window.clearInterval(this.pollingTimer);
      this.pollingTimer = window.setInterval(() => {
        this.fetchRouletteData();
      }, this.pollingInterval) as unknown as number;
      
      console.log(`[GlobalRouletteService] Intervalo de polling atualizado para ${this.pollingInterval}ms`);
    }
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
      }, this.pollingInterval) as unknown as number;
    }
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
    
    try {
      this.isFetching = true;
      
      // Removendo a verificação de cache para sempre buscar dados frescos
      console.log('[GlobalRouletteService] Buscando dados atualizados da API (limit=1000)');
      
      // Criar e armazenar a promessa atual
      this._currentFetchPromise = (async () => {
        // Usar a função utilitária com suporte a CORS - com limit=1000 para todos os casos
        const response = await fetchWithCorsSupport<ApiResponse<any[]> | any[]>(`/api/ROULETTES?limit=${DEFAULT_LIMIT}`);
        
        // Verificar se a resposta está no formato de envelope com informações de assinatura
        if (response && typeof response === 'object' && 'data' in response && Array.isArray(response.data)) {
          console.log(`[GlobalRouletteService] Dados recebidos com envelope: ${response.data.length} roletas`);
          
          // Extrair e armazenar informações da assinatura
          if (response.subscription) {
            this.subscriptionInfo = response.subscription;
            console.log(`[GlobalRouletteService] Informações de assinatura atualizadas: ${this.subscriptionInfo.plan}`);
            
            // Atualizar o intervalo de polling conforme o plano
            this.updatePollingInterval();
            
            // Emitir evento de assinatura atualizada
            EventService.emit('subscription:updated', {
              plan: this.subscriptionInfo.plan,
              limits: this.subscriptionInfo.limits
            });
          }
          
          // Usar os dados contidos no envelope
          this.rouletteData = response.data;
          this.lastFetchTime = now;
          
          // Notificar todos os assinantes sobre a atualização
          this.notifySubscribers();
          
          // Emitir evento global para outros componentes que possam estar ouvindo
          EventService.emit('roulette:data-updated', {
            timestamp: new Date().toISOString(),
            count: response.data.length,
            source: 'central-service',
            subscriptionPlan: this.subscriptionInfo?.plan || 'basic'
          });
          
          return response.data;
        }
        // Verificar se a resposta é um array direto (formato antigo)
        else if (Array.isArray(response)) {
          console.log(`[GlobalRouletteService] Dados recebidos em formato antigo: ${response.length} roletas`);
          this.rouletteData = response;
          this.lastFetchTime = now;
          
          // Notificar todos os assinantes sobre a atualização
          this.notifySubscribers();
          
          // Emitir evento global para outros componentes que possam estar ouvindo
          EventService.emit('roulette:data-updated', {
            timestamp: new Date().toISOString(),
            count: response.length,
            source: 'central-service'
          });
          
          return response;
        } else {
          console.error('[GlobalRouletteService] Resposta inválida da API');
          return this.rouletteData;
        }
      })();
      
      return await this._currentFetchPromise;
    } catch (error) {
      console.error('[GlobalRouletteService] Erro ao buscar dados:', error);
      return this.rouletteData;
    } finally {
      this.isFetching = false;
      this._currentFetchPromise = null;
    }
  }
  
  /**
   * Retorna as informações da assinatura atual
   */
  public getSubscriptionInfo(): SubscriptionInfo | null {
    return this.subscriptionInfo;
  }
  
  /**
   * Verifica se o usuário está no plano básico
   */
  public isBasicPlan(): boolean {
    return !this.subscriptionInfo || this.subscriptionInfo.plan === 'basic';
  }
  
  /**
   * Verifica se o usuário possui plano premium ou superior
   */
  public isPremiumOrAbove(): boolean {
    return this.subscriptionInfo?.plan === 'premium' || this.subscriptionInfo?.plan === 'vip';
  }
  
  /**
   * Verifica se o usuário possui plano VIP
   */
  public isVipPlan(): boolean {
    return this.subscriptionInfo?.plan === 'vip';
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