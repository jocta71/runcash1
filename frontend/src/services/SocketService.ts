/**
 * Serviço Socket que implementa a conexão SSE e fallback para REST
 * Este arquivo combina a funcionalidade de socket com SSE
 */

import RESTSocketService, { HistoryRequest, HistoryData, RouletteEventCallback } from "./RESTSocketService";
import { EventService } from "./EventService";

// Classe para gerenciar a conexão com o servidor
class SocketService {
  private static _instance: SocketService;
  private eventService: EventService;
  private isUsingSSE: boolean = false;
  private restSocketService: RESTSocketService;
  private listeners: Map<string, Set<RouletteEventCallback>> = new Map();

  private constructor() {
    // Obter instância do serviço REST
    this.restSocketService = RESTSocketService.getInstance();
    
    console.log('[SocketService] Inicializando serviço híbrido Socket+SSE');
    this.eventService = EventService.getInstance();
    
    // Tentar iniciar a conexão SSE
    this.initSSEConnection();
  }

  /**
   * Obtém a instância única do SocketService
   */
  public static getInstance(): SocketService {
    if (!SocketService._instance) {
      SocketService._instance = new SocketService();
    }
    return SocketService._instance;
  }

  /**
   * Inicializa a conexão SSE
   */
  private initSSEConnection(): void {
    try {
      console.log('[SocketService] Tentando iniciar conexão SSE...');
      
      // Registrar callback global para receber eventos SSE
      this.eventService.subscribeToGlobalEvents((event) => {
        if (event && event.type === 'new_number') {
          console.log(`[SocketService] Evento SSE recebido: ${event.type} para roleta ${event.roleta_nome}`);
          this.notifyListeners(event);
          this.isUsingSSE = true;
        }
      });
      
      // Solicitar updates em tempo real
      this.eventService.requestRealtimeUpdates();
      
      console.log('[SocketService] Conexão SSE inicializada com sucesso');
    } catch (error) {
      console.error('[SocketService] Erro ao iniciar conexão SSE:', error);
      console.log('[SocketService] Usando fallback para REST...');
      this.isUsingSSE = false;
    }
  }

  /**
   * Notifica os ouvintes sobre um evento
   */
  private notifyListeners(event: any): void {
    // Notificar ouvintes específicos para esta roleta
    const roletaNome = event.roleta_nome || 'unknown';
    
    if (this.listeners.has(roletaNome)) {
      const listeners = this.listeners.get(roletaNome);
      if (listeners) {
        listeners.forEach(callback => {
          try {
            callback(event);
          } catch (error) {
            console.error(`[SocketService] Erro em listener para ${roletaNome}:`, error);
          }
        });
      }
    }
    
    // Notificar ouvintes globais (*)
    if (this.listeners.has('*')) {
      const globalListeners = this.listeners.get('*');
      if (globalListeners) {
        globalListeners.forEach(callback => {
          try {
            callback(event);
          } catch (error) {
            console.error('[SocketService] Erro em listener global:', error);
          }
        });
      }
    }
  }

  /**
   * Sobrescreve o método isConnected para considerar tanto REST quanto SSE
   */
  public isConnected(): boolean {
    return this.isUsingSSE || this.restSocketService.isConnected();
  }

  /**
   * Retorna o status de conexão
   */
  public getConnectionStatus(): { isConnected: boolean; usingSSE: boolean; connectionType: string } {
    return {
      isConnected: this.isConnected(),
      usingSSE: this.isUsingSSE,
      connectionType: this.isUsingSSE ? 'SSE' : 'REST'
    };
  }

  /**
   * Subscreve para receber eventos de uma roleta específica
   */
  public subscribe(roletaNome: string, callback: RouletteEventCallback): void {
    // Registrar no serviço local
    if (!this.listeners.has(roletaNome)) {
      this.listeners.set(roletaNome, new Set());
    }
    
    const listeners = this.listeners.get(roletaNome);
    if (listeners) {
      listeners.add(callback);
      console.log(`[SocketService] Registrado listener para ${roletaNome}, total: ${listeners.size}`);
    }
    
    // Registrar também no serviço REST para garantir dados históricos
    this.restSocketService.subscribe(roletaNome, callback);
  }

  /**
   * Remove a inscrição de um listener
   */
  public unsubscribe(roletaNome: string, callback: RouletteEventCallback): void {
    // Remover do serviço local
    if (this.listeners.has(roletaNome)) {
      const listeners = this.listeners.get(roletaNome);
      if (listeners) {
        listeners.delete(callback);
        console.log(`[SocketService] Listener removido para ${roletaNome}, restantes: ${listeners.size}`);
      }
    }
    
    // Remover também do serviço REST
    this.restSocketService.unsubscribe(roletaNome, callback);
  }

  /**
   * Desconecta o serviço
   */
  public disconnect(): void {
    // Desconectar do EventService
    try {
      this.eventService.disconnect();
    } catch (e) {
      console.error('[SocketService] Erro ao desconectar EventService:', e);
    }
    
    // Desconectar também do serviço REST
    this.restSocketService.disconnect();
    
    console.log('[SocketService] Serviço desconectado');
  }

  /**
   * Reconecta o serviço
   */
  public reconnect(): void {
    // Tentar reconectar o SSE
    this.initSSEConnection();
    
    // Reconectar também o serviço REST
    this.restSocketService.reconnect();
    
    console.log('[SocketService] Serviço reconectado');
  }

  /**
   * Verifica se o socket está conectado
   */
  public isSocketConnected(): boolean {
    return this.isConnected();
  }

  /**
   * Emite um evento para o servidor
   */
  public emit(eventName: string, data: any): void {
    // Simplesmente delegamos para o serviço REST
    this.restSocketService.emit(eventName, data);
  }

  /**
   * Obtém o histórico de números de uma roleta
   */
  public getRouletteHistory(roletaId: string): number[] {
    return this.restSocketService.getRouletteHistory(roletaId);
  }

  /**
   * Define o histórico de números de uma roleta
   */
  public setRouletteHistory(roletaId: string, numbers: number[]): void {
    this.restSocketService.setRouletteHistory(roletaId, numbers);
  }

  /**
   * Solicita números de uma roleta específica
   */
  public async requestRouletteNumbers(roletaId: string): Promise<boolean> {
    return this.restSocketService.requestRouletteNumbers(roletaId);
  }

  /**
   * Solicita todos os números recentes
   */
  public async requestRecentNumbers(): Promise<boolean> {
    return this.restSocketService.requestRecentNumbers();
  }
}

// Exportar a classe SocketService
export default SocketService;

// Re-exportar também os tipos
export type {
  HistoryRequest,
  HistoryData
};