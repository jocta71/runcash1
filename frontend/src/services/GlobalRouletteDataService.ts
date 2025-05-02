import { fetchWithCorsSupport } from '../utils/api-helpers';
import EventService from './EventService';

// Intervalo de polling padrão em milissegundos (4 segundos)
const POLLING_INTERVAL = 4000;

// Intervalo mínimo entre requisições forçadas (4 segundos)
const MIN_FORCE_INTERVAL = 4000;

// Limite padrão para requisições normais (1000 itens)
const DEFAULT_LIMIT = 1000;

// Limite para requisições detalhadas (1000 itens)
const DETAILED_LIMIT = 1000;

/**
 * Serviço Global para centralizar requisições de dados das roletas
 * Versão simplificada sem verificação de assinatura
 */
class GlobalRouletteDataService {
  private static instance: GlobalRouletteDataService;
  
  // Dados e estado
  private rouletteData: any[] = [];
  private lastFetchTime: number = 0;
  private isFetching: boolean = false;
  private pollingTimer: number | null = null;
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
  }
  
  /**
   * Busca dados de roletas usando axios
   */
  public async fetchRouletteData(): Promise<any[]> {
    // Verificar se já existe uma requisição em andamento
    if (this._currentFetchPromise) {
      console.log('[GlobalRouletteService] Já existe uma requisição em andamento, retornando a mesma promise');
      return this._currentFetchPromise;
    }
    
    // Verificar tempo desde a última requisição
    const now = Date.now();
    if (now - this.lastFetchTime < MIN_FORCE_INTERVAL) {
      console.log(`[GlobalRouletteService] Última requisição foi há ${now - this.lastFetchTime}ms, retornando dados em cache`);
      return this.rouletteData;
    }
    
    // Atualizar timestamp da última requisição
    this.lastFetchTime = now;
    
    if (this.isFetching) {
      console.log('[GlobalRouletteService] Requisição já em andamento, aguardando...');
      return this.rouletteData;
    }
    
    this.isFetching = true;
    
    try {
      // ENDPOINT DESCONTINUADO - Não mais acessar /api/roulettes
      console.warn('[GlobalRouletteService] ATENÇÃO: O endpoint /api/roulettes está descontinuado.');
      console.log('[GlobalRouletteService] Retornando dados em cache conforme política de descontinuação.');
      
      // Emitir evento global para notificar componentes que tentamos buscar dados
      EventService.emit('roulette:data-updated', {
        timestamp: new Date().toISOString(),
        count: this.rouletteData.length,
        fromCache: true
      });
      
      return this.rouletteData;
    } catch (error) {
      console.error('[GlobalRouletteService] Erro ao buscar dados:', error);
      return this.rouletteData;
    } finally {
      this.isFetching = false;
      this._currentFetchPromise = null;
    }
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
    
    console.log('[GlobalRouletteService] Serviço encerrado e recursos liberados');
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