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
          // Verificar se existe um token de autenticação
          const token = localStorage.getItem('token');
          if (!token) {
            console.warn('[GlobalRouletteService] Token de autenticação não encontrado. Tentando buscar dados mesmo assim...');
            // Continuar mesmo sem token - tentar requisição anônima
          }
          
          console.log('[GlobalRouletteService] Buscando dados das roletas da API');
          
          // Importar o serviço RouletteApi dinamicamente para evitar dependência circular
          const rouletteApiModule = await import('../services/api/rouletteApi');
          const RouletteApi = rouletteApiModule.RouletteApi;
          
          try {
            // Buscar dados da API com timeout de 10 segundos
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Timeout ao buscar dados da API')), 10000);
            });
            
            // Tentar primeiro com a rota normal
            const response = await Promise.race([
              RouletteApi.fetchAllRoulettes(),
              timeoutPromise
            ]) as ApiResponse<any[]>;
            
            // Verificar se é um erro ou se não tem a propriedade 'data'
            if (response.error || !('data' in response)) {
              console.error(`[GlobalRouletteService] Erro ao buscar roletas: ${response.message || 'Resposta inválida'}`);
              
              // Tentar usar dados em cache
              this.tryUseCachedData(resolve);
              return;
            }
            
            // Verificar se os dados são válidos
            if (!response.data || !Array.isArray(response.data)) {
              console.error('[GlobalRouletteService] Resposta inválida da API:', response);
              
              // Tentar usar dados em cache
              this.tryUseCachedData(resolve);
              return;
            }
            
            console.log(`[GlobalRouletteService] ✅ Obtidas ${response.data.length} roletas da API`);
            
            // Atualizar dados
            this.rouletteData = response.data;
            
            // Salvar em cache para uso futuro
            try {
              localStorage.setItem('roulette_data_cache', JSON.stringify({
                timestamp: Date.now(),
                data: response.data
              }));
              console.log('[GlobalRouletteService] Dados salvos em cache para uso futuro');
            } catch (storageError) {
              console.warn('[GlobalRouletteService] Erro ao salvar cache:', storageError);
            }
            
            // Notificar assinantes sobre os novos dados
            this.notifySubscribers();
            
            resolve(this.rouletteData);
          } catch (apiError) {
            console.error('[GlobalRouletteService] Erro na primeira tentativa de API:', apiError);
            
            // Tentar rota alternativa se a primeira falhar
            try {
              console.log('[GlobalRouletteService] Tentando rota alternativa /api/ROULETTES...');
              const alternativeResponse = await fetch('/api/ROULETTES');
              if (alternativeResponse.ok) {
                const data = await alternativeResponse.json();
                console.log('[GlobalRouletteService] Dados recebidos da rota alternativa:', data);
                
                // Verificar se os dados são um array
                const rouletteData = Array.isArray(data) ? data : 
                                   (data.data && Array.isArray(data.data) ? data.data : []);
                
                if (rouletteData.length > 0) {
                  // Atualizar dados
                  this.rouletteData = rouletteData;
                  
                  // Salvar em cache
                  localStorage.setItem('roulette_data_cache', JSON.stringify({
                    timestamp: Date.now(),
                    data: rouletteData
                  }));
                  
                  // Notificar assinantes
                  this.notifySubscribers();
                  
                  resolve(this.rouletteData);
                  return;
                }
              }
              
              // Se chegou aqui, a rota alternativa falhou
              throw new Error('Falha na rota alternativa');
            } catch (altError) {
              console.error('[GlobalRouletteService] Erro na rota alternativa:', altError);
              // Passar para o uso de cache
              this.tryUseCachedData(resolve);
            }
          }
        } catch (error) {
          console.error('[GlobalRouletteService] Erro geral ao processar dados:', error);
          
          // Tentar usar dados em cache
          this.tryUseCachedData(resolve);
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
      // Verificar se existe cache
      const cachedDataString = localStorage.getItem('roulette_data_cache');
      if (!cachedDataString) {
        console.warn('[GlobalRouletteService] Sem dados em cache disponíveis');
        
        // Sem cache disponível, retornar dados vazios ou mockados
        // Em vez de array vazio, usar dados simulados básicos
        const mockData = [
          { id: '2010096', nome: 'Speed Auto Roulette', numero: [] },
          { id: '2010016', nome: 'Immersive Roulette', numero: [] },
          { id: '2010017', nome: 'Roulette VIP', numero: [] }
        ];
        
        this.rouletteData = mockData;
        
        console.log('[GlobalRouletteService] Usando dados mockados básicos na ausência de cache');
        this.notifySubscribers();
        resolve(this.rouletteData);
        return;
      }
      
      // Parsear o cache
      const cachedData = JSON.parse(cachedDataString);
      
      // Verificar se o cache é válido e não está expirado (2 horas = 7200000 ms)
      const CACHE_TTL = 7200000;
      const now = Date.now();
      
      if (cachedData && cachedData.data && Array.isArray(cachedData.data) && 
          cachedData.timestamp && (now - cachedData.timestamp < CACHE_TTL)) {
        console.log(`[GlobalRouletteService] Usando dados em cache de ${new Date(cachedData.timestamp).toLocaleTimeString()}`);
        
        // Atualizar dados com o cache
        this.rouletteData = cachedData.data;
        this.notifySubscribers();
        resolve(this.rouletteData);
      } else {
        console.warn('[GlobalRouletteService] Cache expirado ou inválido');
        
        // Mesmo com cache expirado, usar como fallback se tivermos dados
        if (cachedData && cachedData.data && Array.isArray(cachedData.data) && cachedData.data.length > 0) {
          console.log('[GlobalRouletteService] Usando cache expirado como fallback');
          this.rouletteData = cachedData.data;
          this.notifySubscribers();
          resolve(this.rouletteData);
        } else {
          // Sem cache válido, retornar dados simulados básicos
          const mockData = [
            { id: '2010096', nome: 'Speed Auto Roulette', numero: [] },
            { id: '2010016', nome: 'Immersive Roulette', numero: [] },
            { id: '2010017', nome: 'Roulette VIP', numero: [] }
          ];
          
          this.rouletteData = mockData;
          
          console.log('[GlobalRouletteService] Usando dados mockados básicos');
          this.notifySubscribers();
          resolve(this.rouletteData);
        }
      }
    } catch (error) {
      console.error('[GlobalRouletteService] Erro ao processar cache:', error);
      
      // Em caso de erro, retornar array vazio ou dados simulados
      const mockData = [
        { id: '2010096', nome: 'Speed Auto Roulette', numero: [] },
        { id: '2010016', nome: 'Immersive Roulette', numero: [] }
      ];
      
      this.rouletteData = mockData;
      this.notifySubscribers();
      resolve(this.rouletteData);
    }
  }
}

// Exportar a instância única do serviço
const globalRouletteDataService = GlobalRouletteDataService.getInstance();
export default globalRouletteDataService;
// Também exportar a classe para permitir o uso de getInstance() diretamente
export { GlobalRouletteDataService }; 