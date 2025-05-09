/**
 * Adaptador do SocketService que utiliza o UnifiedDataService
 * 
 * Este adaptador mantém a API do SocketService mas internamente
 * delega todas as operações para o UnifiedDataService.
 * 
 * Isso facilita a migração gradual sem quebrar código existente.
 */

import UnifiedDataService from './UnifiedDataService';
import { RouletteEventCallback } from './RESTSocketService';

class SocketServiceAdapter {
  private static _instance: SocketServiceAdapter;
  private unifiedService: UnifiedDataService;
  
  private constructor() {
    console.log('[SocketServiceAdapter] Inicializando adaptador que usa UnifiedDataService');
    this.unifiedService = UnifiedDataService.getInstance();
  }
  
  /**
   * Obtém a instância única do adaptador
   */
  public static getInstance(): SocketServiceAdapter {
    if (!SocketServiceAdapter._instance) {
      SocketServiceAdapter._instance = new SocketServiceAdapter();
    }
    return SocketServiceAdapter._instance;
  }
  
  /**
   * Verifica se está conectado
   */
  public isConnected(): boolean {
    return this.unifiedService.isSocketConnected();
  }
  
  /**
   * Retorna o status da conexão
   */
  public getConnectionStatus(): any {
    return this.unifiedService.getConnectionStatus();
  }
  
  /**
   * Subscreve para receber eventos de uma roleta específica
   */
  public subscribe(roletaNome: string, callback: RouletteEventCallback): void {
    this.unifiedService.subscribe(roletaNome, callback);
  }
  
  /**
   * Remove a inscrição de um listener
   */
  public unsubscribe(roletaNome: string, callback: RouletteEventCallback): void {
    this.unifiedService.unsubscribe(roletaNome, callback);
  }
  
  /**
   * Desconecta o serviço
   */
  public disconnect(): void {
    this.unifiedService.disconnect();
  }
  
  /**
   * Reconecta o serviço
   */
  public reconnect(): void {
    this.unifiedService.reconnect();
  }
  
  /**
   * Verifica se o socket está conectado
   */
  public isSocketConnected(): boolean {
    return this.unifiedService.isSocketConnected();
  }
  
  /**
   * Emite um evento
   */
  public emit(eventName: string, data: any): void {
    this.unifiedService.emit(eventName, data);
  }
  
  /**
   * Obtém o histórico de números de uma roleta
   */
  public getRouletteHistory(roletaId: string): number[] {
    return this.unifiedService.getRouletteHistory(roletaId);
  }
  
  /**
   * Define o histórico de números de uma roleta
   */
  public setRouletteHistory(roletaId: string, numbers: number[]): void {
    this.unifiedService.setRouletteHistory(roletaId, numbers);
  }
  
  /**
   * Solicita números de uma roleta específica
   */
  public async requestRouletteNumbers(roletaId: string): Promise<boolean> {
    return this.unifiedService.requestRouletteNumbers(roletaId);
  }
  
  /**
   * Solicita todos os números recentes
   */
  public async requestRecentNumbers(): Promise<boolean> {
    return this.unifiedService.requestRecentNumbers();
  }
  
  /**
   * Carrega o histórico de números para todas as roletas
   */
  public async loadHistoricalRouletteNumbers(): Promise<void> {
    return this.unifiedService.loadHistoricalRouletteNumbers();
  }
  
  /**
   * Método compatível com a API antiga
   */
  public async fetchRouletteNumbersREST(roletaId: string, limit: number = 200): Promise<boolean> {
    return this.unifiedService.requestRouletteNumbers(roletaId);
  }
}

export default SocketServiceAdapter; 