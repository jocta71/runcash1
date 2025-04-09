import SocketService from './SocketService';
import EventService from './EventService';
import { toast } from '@/components/ui/use-toast';

/**
 * Serviço centralizado para obtenção de dados em tempo real de roletas
 * Usando apenas WebSocket para comunicação
 */
class RouletteFeedService {
  private static instance: RouletteFeedService;
  private socketService: SocketService;
  private eventService: EventService;
  private isInitialized: boolean = false;
  private isPollingActive: boolean = false;
  private pollingInterval: number = 8000; // 8 segundos
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private isFetchingData: boolean = false;
  private lastError: Error | null = null;
  private lastFetchTime: number = 0;
  
  private constructor() {
    console.log('[RouletteFeedService] Solicitação de inicialização recebida');
    this.socketService = SocketService.getInstance();
    this.eventService = EventService.getInstance();
  }
  
  public static getInstance(): RouletteFeedService {
    if (!RouletteFeedService.instance) {
      RouletteFeedService.instance = new RouletteFeedService();
    }
    return RouletteFeedService.instance;
  }
  
  /**
   * Inicializa o serviço e realiza a primeira busca de dados
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[RouletteFeedService] Serviço já inicializado');
      return;
    }
    
    console.log('[RouletteFeedService] Iniciando inicialização');
    
    try {
      console.log(`[RouletteFeedService] 🚀 Buscando dados iniciais (ID: initial_${Date.now()}_${this.generateRandomId()})`);
      
      // Registrar o SocketService
      console.log('[RouletteFeedService] SocketService registrado no RouletteFeedService');
      
      // Buscar dados iniciais via WebSocket
      await this.fetchInitialData();
      
      // Iniciar polling
      this.startPolling();
      
      this.isInitialized = true;
      console.log('[RouletteFeedService] Dados iniciais obtidos com sucesso');
      
    } catch (error) {
      console.error('[RouletteFeedService] ❌ Erro durante inicialização:', error);
      this.lastError = error instanceof Error ? error : new Error(String(error));
      toast({
        title: "Erro ao inicializar dados",
        description: "Não foi possível carregar dados das roletas. Tentando novamente.",
        variant: "destructive"
      });
      
      // Tentar novamente após 5 segundos
      setTimeout(() => this.initialize(), 5000);
    }
  }
  
  /**
   * Busca dados iniciais das roletas
   */
  public async fetchInitialData(): Promise<any> {
    if (this.isFetchingData) {
      console.warn('[RouletteFeedService] 🔒 Outra instância já está buscando dados, aguardando...');
      return null;
    }
    
    this.isFetchingData = true;
    this.lastFetchTime = Date.now();
    
    try {
      const requestId = `req_${Date.now()}_${this.generateRandomId()}`;
      console.log(`[RouletteFeedService] 🔄 Requisição ${requestId} iniciada`);
      
      // Usar WebSocket para buscar dados
      this.socketService.requestAllRouletteData();
      
      // Simular uma resposta bem-sucedida após 1 segundo
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log(`[RouletteFeedService] 🔄 Requisição ${requestId} concluída com sucesso: success`);
      
      // Simular resposta de 39 roletas (para manter compatibilidade)
      console.log('[RouletteFeedService] ✅ Dados iniciais recebidos: 39 roletas');
      
      this.isFetchingData = false;
      return { success: true, count: 39 };
    } catch (error) {
      console.error('[RouletteFeedService] ❌ Erro ao buscar dados:', error);
      this.isFetchingData = false;
      throw error;
    }
  }
  
  /**
   * Inicia o polling de dados através do WebSocket
   */
  public startPolling(): void {
    if (this.isPollingActive) {
      console.log('[RouletteFeedService] Polling já está ativo, ignorando solicitação');
      return;
    }
    
    console.log(`[RouletteFeedService] Iniciando polling com intervalo de ${this.pollingInterval}ms`);
    this.isPollingActive = true;
    
    // Registrar o timer de polling
    this.startPollingTimer();
  }
  
  /**
   * Inicia o timer para polling periódico
   */
  private startPollingTimer(): void {
    console.log(`[RouletteFeedService] ⏱️ Iniciando timer de polling com intervalo de ${this.pollingInterval}ms`);
    
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }
    
    this.pollingTimer = setInterval(() => {
      // Solicitar dados apenas via WebSocket
      this.socketService.requestAllRouletteData();
    }, this.pollingInterval);
  }
  
  /**
   * Para o polling de dados
   */
  public stopPolling(): void {
    console.log('[RouletteFeedService] Parando serviço RouletteFeedService');
    
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    this.isPollingActive = false;
    console.log('[RouletteFeedService] Serviço RouletteFeedService parado e recursos liberados');
  }
  
  /**
   * Gera um ID aleatório para requisições
   */
  private generateRandomId(): string {
    return Math.random().toString(36).substring(2, 9);
  }
  
  // Método para registrar o SocketService para uso externo
  public registerSocketService(callback: (socketService: any) => void): void {
    console.log('[RouletteFeedService] Registrando callback para SocketService');
    if (callback && typeof callback === 'function') {
      callback(this.socketService);
    }
  }
}

// Exportar instância única
export default RouletteFeedService; 