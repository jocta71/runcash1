/**
 * Serviço Socket que implementa a conexão SSE e fallback para REST
 * 
 * NOTA DE MIGRAÇÃO: Este arquivo está sendo gradualmente substituído por UnifiedDataService.
 * Esta versão é uma ponte que internamente usa o SocketServiceAdapter.
 */

import RESTSocketService, { HistoryRequest, HistoryData, RouletteEventCallback } from "./RESTSocketService";
import { EventService } from "./EventService";
import SocketServiceAdapter from "./SocketServiceAdapter";

// Classe para gerenciar a conexão com o servidor
class SocketService {
  private static _instance: SocketService;
  private adapter: SocketServiceAdapter | null = null;
  private eventService: EventService | null = null;
  private isUsingSSE: boolean = false;
  private restSocketService: RESTSocketService;
  private listeners: Map<string, Set<RouletteEventCallback>> = new Map();
  private pendingInitialization: boolean = false;

  private constructor() {
    console.log('[SocketService] Inicializando versão em transição que usa SocketServiceAdapter');
    
    // Obter instância do adaptador
    this.adapter = SocketServiceAdapter.getInstance();
    
    // Manter RESTSocketService para compatibilidade total com código existente
    this.restSocketService = RESTSocketService.getInstance();
    
    // Ainda inicializar o EventService para compatibilidade
    this.initEventService();
  }

  /**
   * Inicializa o EventService de forma segura
   */
  private async initEventService(): Promise<void> {
    if (this.pendingInitialization) {
      return; // Evitar inicializações duplicadas
    }

    this.pendingInitialization = true;

    try {
      // Obter a instância do EventService
      const eventService = EventService.getInstance();
      
      if (eventService) {
        this.eventService = eventService;
        this.isUsingSSE = true;
        console.log('[SocketService] EventService inicializado');
      }
    } catch (error) {
      console.error('[SocketService] Erro ao inicializar EventService:', error);
      this.isUsingSSE = false;
    } finally {
      this.pendingInitialization = false;
    }
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
   * Sobrescreve o método isConnected para considerar o adaptador
   */
  public isConnected(): boolean {
    return this.adapter?.isConnected() || this.restSocketService.isConnected();
  }

  /**
   * Retorna o status de conexão
   */
  public getConnectionStatus(): { isConnected: boolean; usingSSE: boolean; connectionType: string } {
    if (this.adapter) {
      const status = this.adapter.getConnectionStatus();
      return {
        isConnected: status.isConnected,
        usingSSE: status.connectionType === 'SSE',
        connectionType: status.connectionType
      };
    }
    
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
    // Registrar no adaptador
    if (this.adapter) {
      this.adapter.subscribe(roletaNome, callback);
    }
    
    // Manter registro local para compatibilidade
    if (!this.listeners.has(roletaNome)) {
      this.listeners.set(roletaNome, new Set());
    }
    
    const listeners = this.listeners.get(roletaNome);
    if (listeners) {
      listeners.add(callback);
    }
    
    // Registrar também no serviço REST como fallback
    this.restSocketService.subscribe(roletaNome, callback);
  }

  /**
   * Remove a inscrição de um listener
   */
  public unsubscribe(roletaNome: string, callback: RouletteEventCallback): void {
    // Remover do adaptador
    if (this.adapter) {
      this.adapter.unsubscribe(roletaNome, callback);
    }
    
    // Atualizar registro local
    if (this.listeners.has(roletaNome)) {
      const listeners = this.listeners.get(roletaNome);
      if (listeners) {
        listeners.delete(callback);
      }
    }
    
    // Remover também do serviço REST
    this.restSocketService.unsubscribe(roletaNome, callback);
  }

  /**
   * Desconecta o serviço
   */
  public disconnect(): void {
    // Desconectar o adaptador
    if (this.adapter) {
      this.adapter.disconnect();
    }
    
    // Desconectar os serviços existentes
    if (this.eventService) {
      try {
        this.eventService.disconnect();
      } catch (e) {
        console.error('[SocketService] Erro ao desconectar EventService:', e);
      }
    }
    
    this.restSocketService.disconnect();
  }

  /**
   * Reconecta o serviço
   */
  public reconnect(): void {
    // Reconectar o adaptador
    if (this.adapter) {
      this.adapter.reconnect();
    }
    
    // Reconectar o serviço REST
    this.restSocketService.reconnect();
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
    // Emitir via adaptador
    if (this.adapter) {
      this.adapter.emit(eventName, data);
    }
    
    // Manter comportamento legacy para compatibilidade
    this.restSocketService.emit(eventName, data);
  }

  /**
   * Obtém o histórico de números de uma roleta
   */
  public getRouletteHistory(roletaId: string): number[] {
    // Usar o adaptador se disponível
    if (this.adapter) {
      return this.adapter.getRouletteHistory(roletaId);
    }
    
    // Fallback para implementação legada
    return this.restSocketService.getRouletteHistory(roletaId);
  }

  /**
   * Define o histórico de números de uma roleta
   */
  public setRouletteHistory(roletaId: string, numbers: number[]): void {
    // Usar o adaptador se disponível
    if (this.adapter) {
      this.adapter.setRouletteHistory(roletaId, numbers);
    }
    
    // Atualizar também o cache legado
    this.restSocketService.setRouletteHistory(roletaId, numbers);
  }

  /**
   * Solicita números de uma roleta específica
   */
  public async requestRouletteNumbers(roletaId: string): Promise<boolean> {
    // Usar o adaptador se disponível
    if (this.adapter) {
      return this.adapter.requestRouletteNumbers(roletaId);
    }
    
    // Fallback para implementação legada
    return this.restSocketService.requestRouletteNumbers(roletaId);
  }

  /**
   * Solicita todos os números recentes
   */
  public async requestRecentNumbers(): Promise<boolean> {
    // Usar o adaptador se disponível
    if (this.adapter) {
      return this.adapter.requestRecentNumbers();
    }
    
    // Fallback para implementação legada
    return this.restSocketService.requestRecentNumbers();
  }
  
  /**
   * Carrega o histórico de números para todas as roletas
   */
  public async loadHistoricalRouletteNumbers(): Promise<void> {
    // Usar o adaptador se disponível
    if (this.adapter) {
      return this.adapter.loadHistoricalRouletteNumbers();
    }
    
    console.log('[SocketService] Carregando histórico de números para todas as roletas');
    
    try {
      // Verificar se o método existe no restSocketService
      if (typeof this.restSocketService.loadHistoricalRouletteNumbers === 'function') {
        await this.restSocketService.loadHistoricalRouletteNumbers();
        console.log('[SocketService] Histórico carregado com sucesso via RESTSocketService');
      } else {
        // Implementação alternativa caso o método não exista no RESTSocketService
        console.log('[SocketService] Usando implementação alternativa para carregar histórico');
        const response = await fetch('/api/historical/all-roulettes');
        if (response.ok) {
          const data = await response.json();
          console.log(`[SocketService] Carregados dados históricos de ${data.length || 0} roletas`);
          
          // Processar dados se necessário
          if (Array.isArray(data)) {
            data.forEach(roulette => {
              if (roulette && roulette.id && Array.isArray(roulette.numbers)) {
                // Extrair apenas os números
                const numbers = roulette.numbers.map((n: any) => 
                  typeof n === 'number' ? n : (n.number || n.numero)
                ).filter(Boolean);
                
                // Armazenar no cache do serviço
                if (numbers.length > 0) {
                  this.setRouletteHistory(roulette.id, numbers);
                }
              }
            });
          }
        } else {
          console.warn(`[SocketService] Falha ao carregar histórico: ${response.status} ${response.statusText}`);
        }
      }
    } catch (error) {
      console.error('[SocketService] Erro ao carregar histórico de números:', error);
    }
  }
  
  /**
   * Método compatível com a API do RESTSocketService para carregamento de histórico
   */
  public async fetchRouletteNumbersREST(roletaId: string, limit: number = 200): Promise<boolean> {
    // Usar o adaptador se disponível
    if (this.adapter) {
      return this.adapter.fetchRouletteNumbersREST(roletaId, limit);
    }
    
    // Verificar se o método existe no restSocketService
    if (typeof this.restSocketService.requestRouletteNumbers === 'function') {
      return this.restSocketService.requestRouletteNumbers(roletaId);
    }
    
    // Fallback se o método não existir
    console.warn('[SocketService] Método fetchRouletteNumbersREST não implementado no RESTSocketService');
    return false;
  }
}

// Exportar a classe SocketService
export default SocketService;

// Re-exportar também os tipos
export type {
  HistoryRequest,
  HistoryData
};