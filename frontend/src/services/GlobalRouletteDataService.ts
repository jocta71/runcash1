import { fetchWithCorsSupport } from '../utils/api-helpers';
import EventService from './EventService';
import { exibirDiagnosticoNoConsole } from '../utils/diagnostico';
import { compararEndpoints } from '../utils/endpoint-tester';

// Intervalo de polling padrão em milissegundos (4 segundos)
const POLLING_INTERVAL = 4000;

// Tempo de vida do cache em milissegundos (15 segundos)
// const CACHE_TTL = 15000;

// Intervalo mínimo entre requisições forçadas (4 segundos)
const MIN_FORCE_INTERVAL = 10000;

// Limite padrão para requisições normais (800 itens - otimizado)
const DEFAULT_LIMIT = 800;

// Limite para requisições detalhadas (800 itens - otimizado)
const DETAILED_LIMIT = 800;

// Tipo para os callbacks de inscrição
type SubscriberCallback = () => void;

/**
 * Serviço Global para centralizar requisições de dados das roletas
 * Este serviço implementa o padrão Singleton para garantir apenas uma instância
 * e evitar múltiplas requisições à API
 */
export class GlobalRouletteDataService {
  private static instance: GlobalRouletteDataService;
  
  // Dados e estado
  private rouletteData: any[] = [];
  private lastFetchTime: number = 0;
  private isFetching: boolean = false;
  private pollingTimer: number | null = null;
  private subscribers: Map<string, SubscriberCallback> = new Map();
  private _currentFetchPromise: Promise<any[]> | null = null;
  private fetchStatus: 'idle' | 'pending' | 'success' | 'error' = 'idle';
  private fetchError: string | null = null;
  
  // Construtor privado para garantir Singleton
  private constructor() {
    console.log('[GlobalRouletteService] Inicializando serviço global de roletas');
    this.startPolling();
    
    // Expor o serviço no escopo global para diagnóstico
    (window as any).__globalRouletteService = this;
    console.log('[GlobalRouletteService] Serviço exposto globalmente para diagnóstico');
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
   * Busca dados das roletas da API (usando endpoint padrão otimizado) - método principal
   * @returns Promise com dados das roletas
   */
  public async fetchRouletteData(): Promise<any[]> {
    try {
      // Verificar se já existe uma requisição em andamento
      if (this._currentFetchPromise) {
        console.log(`GlobalRouletteService: Já existe uma requisição em andamento, retornando a mesma promise`);
        return this._currentFetchPromise;
      }
      
      this.setFetchStatus('pending');
      this.isFetching = true;
      
      // Log da requisição com o novo endpoint otimizado
      console.log(`GlobalRouletteService: Buscando dados atualizados da API (endpoint otimizado /api/roulettes-batch, limite: ${DEFAULT_LIMIT})`);
      
      // Adicionar timestamp para evitar cache do navegador
      const timestamp = new Date().getTime();
      
      // Armazenar a promise para evitar requisições duplicadas
      this._currentFetchPromise = new Promise(async (resolve, reject) => {
        try {
          // Usar o novo endpoint otimizado com limite reduzido
          const response = await fetch(`/api/roulettes-batch?limit=${DEFAULT_LIMIT}&_t=${timestamp}&subject=poll`);
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro na API: ${response.status} - ${errorText}`);
          }

          const data = await response.json();

          // Armazenar os dados
          if (Array.isArray(data)) {
            this.rouletteData = data;
            console.log(`GlobalRouletteService: Dados atualizados com sucesso. Total de roletas: ${data.length}`);
            
            // Contar números para diagnóstico
            const totalNumeros = this.contarNumerosTotais(data);
            console.log(`GlobalRouletteService: Total de números em todas as roletas: ${totalNumeros}`);
          } else if (data.data && Array.isArray(data.data)) {
            // Formato alternativo com wrapper de sucesso
            this.rouletteData = data.data;
            console.log(`GlobalRouletteService: Dados atualizados com sucesso (formato wrapper). Total de roletas: ${data.data.length}`);
          } else {
            console.warn(`GlobalRouletteService: Formato inesperado na resposta da API:`, data);
            this.rouletteData = [];
          }
          
          // Atualizar timestamp da última requisição
          this.lastFetchTime = Date.now();
          
          // Notificar assinantes sobre novos dados
          this.notifySubscribers();
          
          this.setFetchStatus('success');
          resolve(this.rouletteData);
        } catch (error) {
          console.error('Erro ao buscar dados de roletas:', error);
          this.setFetchStatus('error', error.message);
          reject(error);
        } finally {
          this.isFetching = false;
          this._currentFetchPromise = null;
        }
      });
      
      return this._currentFetchPromise;
    } catch (error) {
      console.error('Erro ao iniciar busca de dados de roletas:', error);
      this.setFetchStatus('error', error.message);
      this.isFetching = false;
      this._currentFetchPromise = null;
      throw error;
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
   * Busca dados detalhados (usando endpoint padrão) - método mantido para compatibilidade
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
   * Realiza um diagnóstico completo da aplicação e exibe no console
   * Útil para depuração e solução de problemas
   */
  public async realizarDiagnostico(): Promise<void> {
    console.log('[GlobalRouletteService] Iniciando diagnóstico completo');
    try {
      await exibirDiagnosticoNoConsole();
    } catch (error) {
      console.error('[GlobalRouletteService] Erro durante o diagnóstico:', error);
    }
  }

  /**
   * Define o status atual da busca de dados
   * @param status O novo status da busca
   * @param errorMessage Mensagem de erro opcional (apenas para status 'error')
   */
  private setFetchStatus(status: 'idle' | 'pending' | 'success' | 'error', errorMessage: string | null = null) {
    this.fetchStatus = status;
    this.fetchError = status === 'error' ? errorMessage : null;
    
    // Notificar sobre mudança de status se necessário
    console.log(`GlobalRouletteDataService: Status da busca alterado para ${status}${errorMessage ? ': ' + errorMessage : ''}`);
  }
}

// Exportar a instância única do serviço
const globalRouletteDataService = GlobalRouletteDataService.getInstance();

// Expor o serviço globalmente para diagnóstico via console
(window as any).__runcashDiagnostico = () => {
  return globalRouletteDataService.realizarDiagnostico();
};

// Adicionar função para comparar endpoints
(window as any).__runcashCompararEndpoints = compararEndpoints;

export default globalRouletteDataService;
// Exportamos apenas uma vez a classe para evitar redeclaração 