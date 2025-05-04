import { fetchWithCorsSupport } from '../utils/api-helpers';
import EventService from './EventService';

/**
 * IMPORTANTE: Este serviço deve acessar APENAS a rota /api/roulettes sem parâmetros adicionais!
 * Adicionar parâmetros de timestamp ou outros valores à URL causa falhas na API.
 * 
 * Este serviço fornece acesso global aos dados das roletas.
 */

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
   * Retorna a instância singleton do serviço
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
   * Busca os dados das roletas do endpoint /api/roulettes
   * IMPORTANTE: Não adicione parâmetros de timestamp ou outros à URL
   */
  private async fetchRouletteData(): Promise<any[]> {
    if (this.isFetching) {
      console.log('[GlobalRouletteDataService] Já existe uma busca em andamento, aguardando...');
      return this.rouletteData;
    }

    try {
      this.isFetching = true;
      
      // Obter token de autenticação de várias fontes
      let authToken = '';
      
      // Função para obter cookies
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return undefined;
      };
      
      // Tentar obter dos cookies primeiro (mais confiável)
      const tokenCookie = getCookie('token') || getCookie('token_alt');
      if (tokenCookie) {
        authToken = tokenCookie;
        console.log('[GlobalRouletteDataService] Usando token de autenticação dos cookies');
      } else {
        // Se não encontrou nos cookies, verificar localStorage
        const possibleKeys = [
          'auth_token_backup', // Usado pelo AuthContext
          'token',             // Nome do cookie usado na requisição bem-sucedida
          'auth_token',        // Usado em alguns componentes
          'authToken'          // Usado em alguns utilitários
        ];
        
        for (const key of possibleKeys) {
          const storedToken = localStorage.getItem(key);
          if (storedToken) {
            authToken = storedToken;
            console.log(`[GlobalRouletteDataService] Usando token de autenticação do localStorage (${key})`);
            
            // Restaurar para cookies se necessário
            try {
              document.cookie = `token=${authToken}; path=/; max-age=2592000`;
              document.cookie = `token_alt=${authToken}; path=/; max-age=2592000; SameSite=Lax`;
              console.log('[GlobalRouletteDataService] Token restaurado para cookies');
            } catch (cookieError) {
              console.warn('[GlobalRouletteDataService] Erro ao restaurar token para cookies:', cookieError);
            }
            
            break;
          }
        }
      }

      // Usar endpoint base sem parâmetros adicionais
      const endpoint = `/api/roulettes`;
      console.log(`[GlobalRouletteDataService] Buscando dados de ${endpoint}`);
      
      // Configurar headers exatamente como na requisição bem-sucedida
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'accept': 'application/json, text/plain, */*'
      };

      // Adicionar token de autenticação se disponível
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        console.log('[GlobalRouletteDataService] Token de autenticação adicionado ao cabeçalho da requisição');
      } else {
        console.warn('[GlobalRouletteDataService] Nenhum token de autenticação encontrado, tentando acessar endpoint sem autenticação');
      }

      const response = await fetch(endpoint, {
        method: 'GET',
        headers,
        credentials: 'include' // Importante: Incluir cookies na requisição
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.lastFetchTime = Date.now();
      this.rouletteData = data;
      this.notifySubscribers();
      console.log(`[GlobalRouletteDataService] ✅ Dados atualizados: ${data.length} roletas`);
      return data;
    } catch (error) {
      console.error('[GlobalRouletteDataService] Erro ao buscar dados das roletas:', error);
      return this.rouletteData;
    } finally {
      this.isFetching = false;
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