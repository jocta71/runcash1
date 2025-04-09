import { fetchWithCorsSupport } from '../utils/api-helpers';
import EventService from './EventService';

// Intervalo de polling padrão em milissegundos (8 segundos)
const POLLING_INTERVAL = 8000;

// Tempo de vida do cache em milissegundos (15 segundos)
const CACHE_TTL = 15000;

// Intervalo mínimo entre requisições forçadas (2 segundos)
const MIN_FORCE_INTERVAL = 2000;

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
   * Busca dados atualizados da API
   */
  private async fetchRouletteData(): Promise<void> {
    // Evitar requisições simultâneas
    if (this.isFetching) {
      console.log('[GlobalRouletteService] Requisição já em andamento, ignorando');
      return;
    }
    
    try {
      const now = Date.now();
      this.isFetching = true;
      
      // Verificar se os dados em cache ainda são válidos
      if (this.rouletteData.length > 0 && now - this.lastFetchTime < CACHE_TTL) {
        console.log(`[GlobalRouletteService] Usando dados em cache, idade: ${Math.round((now - this.lastFetchTime)/1000)}s`);
        return;
      }
      
      console.log('[GlobalRouletteService] Buscando dados atualizados da API');
      
      try {
        // Usar a função utilitária com suporte a CORS
        const data = await fetchWithCorsSupport<any[]>('/ROULETTES?limit=1000');
        
        // Verificar se os dados são válidos
        if (data && Array.isArray(data) && data.length > 0) {
          console.log(`[GlobalRouletteService] Dados recebidos com sucesso: ${data.length} roletas`);
          this.rouletteData = data;
          this.lastFetchTime = now;
          
          // Notificar todos os assinantes sobre a atualização
          this.notifySubscribers();
        } else if (Object.keys(data).length === 0) {
          // Sem dados recebidos - provavelmente devido ao modo no-cors
          console.log('[GlobalRouletteService] Sem dados recebidos (esperado em modo no-cors), usando dados simulados');
          
          // Gerar dados simulados se não temos dados
          if (this.rouletteData.length === 0) {
            const mockRoulettes = [
              { _id: '2380335', id: '2380335', nome: 'Brazilian Mega Roulette', ativa: true },
              { _id: '2010096', id: '2010096', nome: 'Speed Auto Roulette', ativa: true },
              { _id: '2010065', id: '2010065', nome: 'Bucharest Auto-Roulette', ativa: true },
              { _id: '2010016', id: '2010016', nome: 'Immersive Roulette', ativa: true },
              { _id: '2010017', id: '2010017', nome: 'Ruleta Automática', ativa: true }
            ];
            
            console.log(`[GlobalRouletteService] Usando ${mockRoulettes.length} roletas simuladas`);
            this.rouletteData = mockRoulettes;
            this.lastFetchTime = now;
            
            // Notificar assinantes
            this.notifySubscribers();
          }
        } else {
          console.error('[GlobalRouletteService] Resposta inválida da API:', data);
        }
      } catch (error) {
        console.error('[GlobalRouletteService] Erro ao buscar dados:', error);
      }
    } catch (generalError) {
      console.error('[GlobalRouletteService] Erro geral:', generalError);
    } finally {
      this.isFetching = false;
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
   * Retorna a roleta pelo nome
   */
  public getRouletteByName(rouletteName: string): any {
    if (!this.rouletteData || this.rouletteData.length === 0) {
      return null;
    }
    
    // Procurar a roleta pelo nome (insensível a maiúsculas/minúsculas)
    return this.rouletteData.find((roleta: any) => {
      const roletaName = roleta.nome || roleta.name || '';
      return roletaName.toLowerCase() === rouletteName.toLowerCase();
    });
  }
  
  /**
   * Retorna todas as roletas disponíveis
   */
  public getAllRoulettes(): any[] {
    return this.rouletteData || [];
  }
  
  /**
   * Inscreve um componente para receber atualizações
   */
  public subscribe(id: string, callback: SubscriberCallback): void {
    console.log(`[GlobalRouletteService] Novo assinante registrado: ${id}`);
    this.subscribers.set(id, callback);
    
    // Se já tivermos dados, notificar o novo assinante imediatamente
    if (this.rouletteData.length > 0) {
      setTimeout(() => callback(), 0);
    }
  }
  
  /**
   * Cancela a inscrição de um componente
   */
  public unsubscribe(id: string): void {
    console.log(`[GlobalRouletteService] Assinante removido: ${id}`);
    this.subscribers.delete(id);
  }
  
  /**
   * Notifica todos os assinantes sobre a atualização de dados
   */
  private notifySubscribers(): void {
    console.log(`[GlobalRouletteService] Notificando ${this.subscribers.size} assinantes`);
    this.subscribers.forEach(callback => {
      try {
        // Executar callbacks em um setTimeout para evitar bloqueios
        setTimeout(() => callback(), 0);
      } catch (error) {
        console.error('[GlobalRouletteService] Erro ao notificar assinante:', error);
      }
    });
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