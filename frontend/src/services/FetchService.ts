/**
 * Serviço para buscar dados em tempo real via WebSocket
 * 
 * AVISO: Este serviço agora usa apenas WebSocket e foi mantido para compatibilidade
 * com o código existente.
 */

import SocketService from './SocketService';
import { getLogger } from './utils/logger';

const logger = getLogger('FetchService');

class FetchService {
  private static instance: FetchService;
  private socketService: SocketService;
  private isPolling: boolean = false;
  
  constructor() {
    this.socketService = SocketService.getInstance();
    logger.info('FetchService inicializado usando apenas WebSocket');
  }
  
  public static getInstance(): FetchService {
    if (!FetchService.instance) {
      FetchService.instance = new FetchService();
    }
    return FetchService.instance;
  }
  
  /**
   * Inicia polling regular via WebSocket
   */
  public startPolling(): void {
    if (this.isPolling) {
      logger.info('Polling já está em execução');
      return;
    }
    
    logger.info('Redirecionando para SocketService');
    this.isPolling = true;
    
    // Solicitar dados via WebSocket
    this.socketService.requestAllRouletteData();
  }
  
  /**
   * Para o polling de dados
   */
  public stopPolling(): void {
    this.isPolling = false;
    logger.info('Polling parado');
  }
  
  /**
   * Método de compatibilidade para fetch
   */
  public async get<T>(url: string, options?: any): Promise<T> {
    logger.warn('Método REST GET redirecionado para WebSocket');
    // Emitir solicitação via WebSocket
    this.socketService.requestAllRouletteData();
    
    // Retornar promessa vazia para compatibilidade
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([] as unknown as T);
      }, 100);
    });
  }
  
  /**
   * Método de compatibilidade para post
   */
  public async post<T>(url: string, data: any, options?: any): Promise<T> {
    logger.warn('Método REST POST redirecionado para WebSocket');
    
    // Retornar promessa vazia para compatibilidade
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({} as T);
      }, 100);
    });
  }
}

export default FetchService; 