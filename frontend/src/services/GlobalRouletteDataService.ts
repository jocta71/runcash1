import SocketService from './SocketService';
import EventService from './EventService';
import { toast } from '@/components/ui/use-toast';
import { getLogger } from './utils/logger';

const logger = getLogger('GlobalRouletteService');

/**
 * Serviço global para gerenciar dados de roletas
 * Usando apenas WebSocket para comunicação
 */
class GlobalRouletteDataService {
  private static instance: GlobalRouletteDataService;
  private socketService: SocketService;
  private eventService: EventService;
  private isPollingActive: boolean = false;
  private pollingInterval: number = 8000; // 8 segundos
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  
  // Registro de assinantes
  private subscribers: Map<string, (data: any) => void> = new Map();
  
  private constructor() {
    logger.info('Inicializando serviço global de roletas');
    this.socketService = SocketService.getInstance();
    this.eventService = EventService.getInstance();
    
    // Iniciar polling automático
    this.startPolling();
  }
  
  public static getInstance(): GlobalRouletteDataService {
    if (!GlobalRouletteDataService.instance) {
      GlobalRouletteDataService.instance = new GlobalRouletteDataService();
    }
    return GlobalRouletteDataService.instance;
  }
  
  /**
   * Inicia o polling para atualização de dados
   */
  public startPolling(): void {
    if (this.isPollingActive) {
      return;
    }
    
    logger.info(`Polling iniciado com intervalo de ${this.pollingInterval}ms`);
    this.isPollingActive = true;
    
    // Usar WebSocket para requisições
    this.pollingTimer = setInterval(() => {
      // Verificar visibilidade da página
      if (document.visibilityState === 'hidden') {
        logger.info('Página não visível, pausando polling');
        return;
      }

      // Usar WebSocket para obter dados
      this.fetchDataViaWebSocket();
    }, this.pollingInterval);
  }
  
  /**
   * Para o polling de dados
   */
  public stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    this.isPollingActive = false;
    logger.info('Polling parado');
  }
  
  /**
   * Busca dados das roletas via WebSocket
   */
  private fetchDataViaWebSocket(): void {
    try {
      logger.info('⛔ DESATIVADO: Requisição para API bloqueada para fins de diagnóstico');
      // Solicitar dados via WebSocket
      this.socketService.requestAllRouletteData();
    } catch (error) {
      logger.error('Erro ao buscar dados via WebSocket:', error);
    }
  }
  
  /**
   * Registra um assinante para receber atualizações
   */
  public subscribe(id: string, callback: (data: any) => void): void {
    this.subscribers.set(id, callback);
    logger.info(`Novo assinante registrado: ${id}`);
  }
  
  /**
   * Remove um assinante
   */
  public unsubscribe(id: string): void {
    this.subscribers.delete(id);
    logger.info(`Assinante removido: ${id}`);
  }
}

// Exportar a instância única do serviço
const globalRouletteDataService = GlobalRouletteDataService.getInstance();
export default globalRouletteDataService; 