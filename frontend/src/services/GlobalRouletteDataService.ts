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
    // Importar dinamicamente para evitar dependência circular
    const apiServiceModule = await import('../services/apiService');
    const apiService = apiServiceModule.default;
    
    // Evitar requisições simultâneas
    if (this.isFetching) {
      console.log('[GlobalRouletteService] Requisição já em andamento, aguardando...');
      
      // Aguardar a conclusão da requisição atual
      if (this._currentFetchPromise) {
        return this._currentFetchPromise;
      }
      
      return this.rouletteData;
    }
    
    // Sinalizar que estamos buscando dados
    this.isFetching = true;
    this.lastFetchTime = Date.now();
    
    try {
      this._currentFetchPromise = new Promise<any[]>(async (resolve) => {
        try {
          console.log('[GlobalRouletteService] Requisições para /api/roulettes desativadas, usando dados locais');
          
          // Tentar usar dados do cache primeiro
          const cachedData = localStorage.getItem('roulette_data_cache');
          if (cachedData) {
            try {
              const parsedData = JSON.parse(cachedData);
              console.log(`[GlobalRouletteService] Usando dados em cache com ${parsedData.data?.length || 0} roletas`);
              this.rouletteData = parsedData.data || [];
              this.notifySubscribers();
              resolve(this.rouletteData);
              return;
            } catch (cacheError) {
              console.error('[GlobalRouletteService] Erro ao usar cache:', cacheError);
            }
          }
          
          // Se não houver cache, usar dados mockados
          console.log('[GlobalRouletteService] Sem cache disponível, usando dados mockados');
          
          // Dados mockados básicos de roletas
          const mockRoulettes = [
            {
              id: '1',
              nome: 'Roleta Europeia VIP',
              status: 'online',
              provider: 'Evolution',
              numero: [
                { numero: 12, cor: 'vermelho', timestamp: new Date().toISOString() },
                { numero: 35, cor: 'preto', timestamp: new Date().toISOString() },
                { numero: 0, cor: 'verde', timestamp: new Date().toISOString() },
                { numero: 26, cor: 'preto', timestamp: new Date().toISOString() },
                { numero: 3, cor: 'vermelho', timestamp: new Date().toISOString() }
              ]
            },
            {
              id: '2',
              nome: 'Roleta Brasileira',
              status: 'online',
              provider: 'Pragmatic Play',
              numero: [
                { numero: 7, cor: 'vermelho', timestamp: new Date().toISOString() },
                { numero: 15, cor: 'preto', timestamp: new Date().toISOString() },
                { numero: 21, cor: 'vermelho', timestamp: new Date().toISOString() },
                { numero: 0, cor: 'verde', timestamp: new Date().toISOString() },
                { numero: 18, cor: 'vermelho', timestamp: new Date().toISOString() }
              ]
            },
            {
              id: '3',
              nome: 'Lightning Roulette',
              status: 'online',
              provider: 'Evolution',
              numero: [
                { numero: 25, cor: 'vermelho', timestamp: new Date().toISOString() },
                { numero: 10, cor: 'preto', timestamp: new Date().toISOString() },
                { numero: 36, cor: 'vermelho', timestamp: new Date().toISOString() },
                { numero: 23, cor: 'vermelho', timestamp: new Date().toISOString() },
                { numero: 5, cor: 'vermelho', timestamp: new Date().toISOString() }
              ]
            }
          ];
          
          // Atualizar dados e notificar
          this.rouletteData = mockRoulettes;
          
          // Salvar mock em cache para uso futuro
          try {
            localStorage.setItem('roulette_data_cache', JSON.stringify({
              timestamp: Date.now(),
              data: mockRoulettes
            }));
            console.log('[GlobalRouletteService] Dados mockados salvos em cache para uso futuro');
          } catch (storageError) {
            console.warn('[GlobalRouletteService] Erro ao salvar cache:', storageError);
          }
          
          // Notificar assinantes sobre os novos dados
          this.notifySubscribers();
          
          resolve(mockRoulettes);
        } catch (error) {
          console.error('[GlobalRouletteService] Erro ao processar dados:', error);
          resolve(this.rouletteData);
        } finally {
          this.isFetching = false;
          this._currentFetchPromise = null;
        }
      });
      
      return this._currentFetchPromise;
    } catch (error) {
      console.error('[GlobalRouletteService] Erro crítico ao processar dados:', error);
      this.isFetching = false;
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

  /**
   * Tenta usar dados em cache quando a API falha
   * @param resolve Função resolve da Promise
   */
  private tryUseCachedData(resolve: (value: any[]) => void): void {
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
}

// Exportar a instância única do serviço
const globalRouletteDataService = GlobalRouletteDataService.getInstance();
export default globalRouletteDataService;
// Também exportar a classe para permitir o uso de getInstance() diretamente
export { GlobalRouletteDataService }; 