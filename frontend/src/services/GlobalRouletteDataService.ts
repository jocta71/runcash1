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
  private subscriptionRequired: boolean = false;
  
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
   * Busca dados das roletas da API
   * @returns Promise com dados das roletas
   */
  public async fetchRouletteData(): Promise<any[]> {
    if (this.isFetching) {
      console.log('[GlobalRouletteService] Requisição já em andamento, aguardando...');
      return this.rouletteData;
    }
    
    this.isFetching = true;
    
    try {
      const axiosInstance = (await import('axios')).default.create();
      const timestamp = Date.now();
      const endpoint = `/api/roulettes?_t=${timestamp}`;
      
      console.log(`[GlobalRouletteService] Buscando dados em: ${endpoint}`);
      
      // Obter token do local storage
      const token = localStorage.getItem('token');
      
      // Configurar headers
      const headers: Record<string, string> = {
        'bypass-tunnel-reminder': 'true',
        'cache-control': 'no-cache'
      };
      
      // Adicionar token se disponível
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await axiosInstance.get(endpoint, {
        headers,
        timeout: 5000
      });
      
      if (response.status === 200 && Array.isArray(response.data)) {
        console.log(`[GlobalRouletteService] Recebidos ${response.data.length} registros da API`);
        this.rouletteData = response.data;
        
        // Se recuperamos dados com sucesso, resetar a flag de assinatura obrigatória
        if (this.subscriptionRequired) {
          this.subscriptionRequired = false;
          
          // Emitir evento informando que o problema de assinatura foi resolvido
          EventService.emit('roulette:subscription-resolved', {
            timestamp: new Date().toISOString()
          });
        }
        
        // Emitir evento global para notificar componentes
        EventService.emit('roulette:data-updated', {
          timestamp: new Date().toISOString(),
          count: response.data.length
        });
        
        return response.data;
      } else {
        console.warn('[GlobalRouletteService] Resposta inesperada da API');
        return this.rouletteData;
      }
    } catch (error) {
      console.error('[GlobalRouletteService] Erro ao buscar dados:', error);
      
      // Verificar se é erro de permissão (assinatura necessária)
      if (error.response) {
        if (error.response.status === 403) {
          this.handleSubscriptionError(error.response.data);
        } else if (error.response.status === 401) {
          this.handleAuthenticationError();
        }
      }
      
      return this.rouletteData;
    } finally {
      this.isFetching = false;
    }
  }
  
  /**
   * Processa erro de assinatura
   */
  private handleSubscriptionError(errorData: any): void {
    console.log('[GlobalRouletteService] Erro de assinatura detectado');
    
    // Marcar que assinatura é necessária
    this.subscriptionRequired = true;
    
    // Emitir evento para notificar componentes sobre necessidade de assinatura
    EventService.emit('roulette:subscription-required', {
      message: errorData?.message || 'Você precisa de uma assinatura para acessar todos os dados',
      code: errorData?.code || 'SUBSCRIPTION_REQUIRED',
      details: errorData
    });
  }
  
  /**
   * Processa erro de autenticação
   */
  private handleAuthenticationError(): void {
    console.log('[GlobalRouletteService] Erro de autenticação detectado');
    
    // Emitir evento para notificar componentes sobre necessidade de login
    EventService.emit('auth:login-required', {
      message: 'Você precisa estar logado para acessar estes dados',
      redirectTo: '/login'
    });
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
  
  /**
   * Verificar se é necessário assinatura
   * @returns true se assinatura é necessária
   */
  public isSubscriptionRequired(): boolean {
    return this.subscriptionRequired;
  }
}

// Exportar a instância única do serviço
const globalRouletteDataService = GlobalRouletteDataService.getInstance();
export default globalRouletteDataService;
// Também exportar a classe para permitir o uso de getInstance() diretamente
export { GlobalRouletteDataService }; 