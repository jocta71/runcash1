import { fetchWithCorsSupport } from '../utils/api-helpers';
import EventService from './EventService';

// Intervalo de polling padrão em milissegundos (4 segundos)
const POLLING_INTERVAL = 4000;

// Tempo de vida do cache em milissegundos (15 segundos)
// const CACHE_TTL = 15000;

// Intervalo mínimo entre requisições forçadas (4 segundos)
const MIN_FORCE_INTERVAL = 30000;

// Limite padrão para requisições normais (1000 itens)
const DEFAULT_LIMIT = 1000;

// Limite para requisições detalhadas (1000 itens)
const DETAILED_LIMIT = 1000;

// Configurações e constantes
const CACHE_VALIDITY_MS = 60000; // 1 minuto

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
  private lastUpdateTime: number = 0;
  private hasCachedData: boolean = false;
  private shouldLoadDetailedData: boolean = true; // Por padrão, carrega dados detalhados
  
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
   * Busca dados atualizados de roletas da API
   */
  public async fetchRouletteData(): Promise<any[]> {
    // Evitar requisições simultâneas
    if (this.isFetching && this._currentFetchPromise) {
      console.log('[GlobalRouletteService] Já existe uma busca em andamento, aguardando...');
      return this._currentFetchPromise;
    }
    
    // Verificar se temos dados em cache e se o cache ainda é válido
    const now = Date.now();
    if (this.hasCachedData && (now - this.lastUpdateTime < CACHE_VALIDITY_MS)) {
      console.log('[GlobalRouletteService] Usando dados em cache (expiram em ' + 
        ((this.lastUpdateTime + CACHE_VALIDITY_MS - now) / 1000).toFixed(1) + 's)');
      return this.rouletteData;
    }
    
    try {
      this.isFetching = true;
      
      // Removendo a verificação de cache para sempre buscar dados frescos
      console.log('[GlobalRouletteService] Buscando dados atualizados da API (endpoint básico)');
      
      // Criar e armazenar a promessa atual
      this._currentFetchPromise = (async () => {
        // Usar endpoint básico para informações sem números
        const basicData = await fetchWithCorsSupport<any[]>(`/api/roulettes/basic`);
        
        // Verificar se os dados são válidos
        if (basicData && Array.isArray(basicData)) {
          console.log(`[GlobalRouletteService] Dados básicos recebidos: ${basicData.length} roletas`);
          
          // Para cada roleta, buscar apenas os últimos números quando necessário
          if (this.shouldLoadDetailedData) {
            console.log('[GlobalRouletteService] Carregando amostras de números para cada roleta...');
            
            // Converter array para objeto mapeado por ID
            const rouletteMap = basicData.reduce((acc, roleta) => {
              acc[roleta.id] = {...roleta, numero: []};
              return acc;
            }, {});
            
            // Buscar 20 números mais recentes para cada roleta em paralelo (limit=20)
            const fetchPromises = basicData.map(roleta => {
              return fetchWithCorsSupport<any>(`/api/roulettes/${roleta.id}/numbers?limit=20`)
                .then(data => {
                  if (data && data.numeros) {
                    console.log(`[GlobalRouletteService] Recebidos ${data.numeros.length} números para ${roleta.nome}`);
                    rouletteMap[roleta.id].numero = data.numeros;
                  }
                })
                .catch(err => console.error(`Erro ao buscar números para ${roleta.nome}:`, err));
            });
            
            // Aguardar todas as requisições completarem
            await Promise.all(fetchPromises);
            
            // Converter mapa de volta para array
            const enrichedData = Object.values(rouletteMap);
            
            this.rouletteData = enrichedData;
            console.log(`[GlobalRouletteService] Dados completos recebidos com sucesso: ${enrichedData.length} roletas`);
          } else {
            // Se não precisamos de dados detalhados, usar apenas os dados básicos
            this.rouletteData = basicData.map(roleta => ({...roleta, numero: []}));
            console.log('[GlobalRouletteService] Usando apenas dados básicos sem números');
          }
          
          this.lastFetchTime = now;
          
          // Notificar todos os assinantes sobre a atualização
          this.notifySubscribers();
          
          // Emitir evento global para outros componentes que possam estar ouvindo
          EventService.emit('roulette:data-updated', {
            timestamp: new Date().toISOString(),
            count: this.rouletteData.length,
            source: 'central-service'
          });
          
          return this.rouletteData;
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