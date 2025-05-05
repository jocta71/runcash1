import { fetchWithCorsSupport } from '../utils/api-helpers';
import EventService from './EventService';
import EventBus from './EventBus';
import { cryptoService } from '../utils/crypto-utils';
import UnifiedRouletteClient from './UnifiedRouletteClient';

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

// Interface para resposta da API (temporária até importação dinâmica)
interface ApiErrorResponse {
  error: boolean;
  code: string;
  message: string;
  statusCode: number;
}

interface ApiSuccessResponse<T> {
  error: false;
  data: T;
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Serviço Global para centralizar requisições de dados das roletas
 * Este serviço implementa o padrão Singleton para garantir apenas uma instância
 * e evitar múltiplas requisições à API
 * 
 * @deprecated Este serviço está sendo substituído pelo UnifiedRouletteClient
 * que oferece suporte a streaming e polling de maneira otimizada
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
  
  // Referência ao novo cliente unificado
  private unifiedClient: UnifiedRouletteClient;
  
  // Construtor privado para garantir Singleton
  private constructor() {
    console.log('[GlobalRouletteService] Inicializando serviço global de roletas (DEPRECIADO)');
    console.warn('[GlobalRouletteService] Este serviço está sendo substituído pelo UnifiedRouletteClient');
    
    // Inicializar o cliente unificado
    this.unifiedClient = UnifiedRouletteClient.getInstance({
      enableLogging: false // Evitar logs duplicados
    });
    
    // Registrar listener para atualizações do cliente unificado
    this.unifiedClient.on('update', (data) => {
      if (Array.isArray(data)) {
        this.rouletteData = data;
      } else if (data && data.id) {
        // Atualizar uma única roleta no array local
        const index = this.rouletteData.findIndex(r => r.id === data.id);
        if (index >= 0) {
          this.rouletteData[index] = data;
        } else {
          this.rouletteData.push(data);
        }
      }
      
      // Notificar assinantes sobre os novos dados
      this.notifySubscribers();
    });
    
    // Manter compatibilidade com o polling antigo
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
   * @deprecated Use o UnifiedRouletteClient diretamente
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
   * Busca dados das roletas da API usando o cliente unificado
   * @deprecated Use o UnifiedRouletteClient diretamente
   * @returns Promise com dados das roletas
   */
  public async fetchRouletteData(): Promise<any[]> {
    console.warn('[GlobalRouletteService] fetchRouletteData está depreciado. Use UnifiedRouletteClient.getInstance().fetchRouletteData()');
    
    try {
      // Registrar o tempo para limitar requisições muito frequentes
      this.lastFetchTime = Date.now();
      
      // Usar o cliente unificado para buscar dados
      const data = await this.unifiedClient.fetchRouletteData();
      
      // Atualizar dados locais
      this.rouletteData = data;
      
      // Notificar assinantes
      this.notifySubscribers();
      
      return this.rouletteData;
    } catch (error) {
      console.error('[GlobalRouletteService] Erro ao buscar dados:', error);
      
      // Emitir evento de erro
      EventBus.emit('roulette:fetch-error', {
        error,
        message: `Erro ao buscar dados: ${error.message}`
      });
      
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
   * @deprecated Use UnifiedRouletteClient.getInstance().forceUpdate()
   */
  public forceUpdate(): void {
    const now = Date.now();
    
    // Verificar se a última requisição foi recente demais
    if (now - this.lastFetchTime < MIN_FORCE_INTERVAL) {
      console.log(`[GlobalRouletteService] Requisição forçada muito próxima da anterior (${now - this.lastFetchTime}ms), ignorando`);
      return;
    }
    
    console.log('[GlobalRouletteService] Forçando atualização de dados');
    this.unifiedClient.forceUpdate();
  }
  
  /**
   * Obtém a roleta pelo nome
   * @deprecated Use UnifiedRouletteClient.getInstance().getRouletteByName()
   * @param rouletteName Nome da roleta
   * @returns Objeto com dados da roleta ou undefined
   */
  public getRouletteByName(rouletteName: string): any {
    return this.unifiedClient.getRouletteByName(rouletteName);
  }
  
  /**
   * Obtém todos os dados das roletas
   * @deprecated Use UnifiedRouletteClient.getInstance().getAllRoulettes()
   * @returns Array com todas as roletas
   */
  public getAllRoulettes(): any[] {
    return this.unifiedClient.getAllRoulettes();
  }
  
  /**
   * Obtém todos os dados detalhados das roletas
   * @deprecated Use UnifiedRouletteClient.getInstance().getAllRoulettes()
   * @returns Array com todas as roletas
   */
  public getAllDetailedRoulettes(): any[] {
    return this.unifiedClient.getAllRoulettes();
  }
  
  /**
   * Registra um callback para receber notificações quando os dados forem atualizados
   * @deprecated Use UnifiedRouletteClient.getInstance().on('update', callback)
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
   * @deprecated Use UnifiedRouletteClient.getInstance().on('update', callback)
   * @param id Identificador único para o subscriber
   * @param callback Função a ser chamada quando houver atualização
   */
  public subscribeToDetailedData(id: string, callback: SubscriberCallback): void {
    // Agora que temos apenas uma fonte de dados, direcionamos para o método principal
    this.subscribe(id, callback);
  }
  
  /**
   * Cancela a inscrição de um assinante
   * @deprecated Use o retorno de UnifiedRouletteClient.getInstance().on() para cancelar inscrição
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
   * Busca dados detalhados das roletas
   * @deprecated Use UnifiedRouletteClient.getInstance().fetchRouletteData()
   */
  public async fetchDetailedRouletteData(): Promise<any[]> {
    // Método mantido apenas para compatibilidade, mas agora usa o cliente unificado
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
  }
  
  /**
   * Tenta usar dados em cache quando a API falha
   * @deprecated Implementado internamente no UnifiedRouletteClient
   */
  private tryUseCachedData(resolve: (value: any[]) => void): void {
    console.log('[GlobalRouletteService] Tentando usar dados em cache');
    
    try {
      const cachedDataStr = localStorage.getItem('roulette_data_cache');
      if (cachedDataStr) {
        const cachedData = JSON.parse(cachedDataStr);
        if (cachedData.data && Array.isArray(cachedData.data) && cachedData.data.length > 0) {
          console.log(`[GlobalRouletteService] Usando ${cachedData.data.length} roletas do cache`);
          
          // Verificar se o cache não é muito antigo (mais de 5 minutos)
          const cacheAge = Date.now() - cachedData.timestamp;
          if (cacheAge > 5 * 60 * 1000) {
            console.warn(`[GlobalRouletteService] Cache muito antigo (${Math.round(cacheAge/1000/60)} minutos)`);
          }
          
          this.rouletteData = cachedData.data;
          this.notifySubscribers();
          resolve(this.rouletteData);
          return;
        }
      }
    } catch (cacheError) {
      console.error('[GlobalRouletteService] Erro ao ler cache:', cacheError);
    }
    
    // Se não conseguiu usar o cache, retornar o que tem
    console.log('[GlobalRouletteService] Sem dados em cache, retornando dados atuais');
    resolve(this.rouletteData);
  }
}

// Para uso com 'import globalRouletteDataService from...'
const globalRouletteDataService = GlobalRouletteDataService.getInstance();
export default globalRouletteDataService; 