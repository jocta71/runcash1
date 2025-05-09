/**
 * Serviço Socket que implementa a conexão SSE e fallback para REST
 * Este arquivo combina a funcionalidade de socket com SSE
 */

import RESTSocketService, { HistoryRequest, HistoryData, RouletteEventCallback } from "./RESTSocketService";
import { EventService } from "./EventService";

// Classe para gerenciar a conexão com o servidor
class SocketService {
  private static _instance: SocketService;
  private eventService: EventService | null = null;
  private isUsingSSE: boolean = false;
  private restSocketService: RESTSocketService;
  private listeners: Map<string, Set<RouletteEventCallback>> = new Map();
  private pendingInitialization: boolean = false;

  private constructor() {
    // Obter instância do serviço REST
    this.restSocketService = RESTSocketService.getInstance();
    
    console.log('[SocketService] Inicializando serviço híbrido Socket+SSE');
    
    // Inicialização segura e assíncrona do EventService
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
      
      // Verificar se a instância é válida antes de usá-la
      if (eventService) {
        this.eventService = eventService;
        
        // Tentar iniciar a conexão SSE após ter o EventService
        setTimeout(() => {
          this.initSSEConnection();
        }, 500); // Pequeno atraso para garantir que o EventService tenha tempo de inicializar completamente
      } else {
        console.warn('[SocketService] EventService não disponível, usando apenas REST');
        this.isUsingSSE = false;
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
   * Inicializa a conexão SSE
   */
  private initSSEConnection(): void {
    try {
      console.log('[SocketService] Tentando iniciar conexão SSE...');
      
      // Verificar se o eventService está disponível
      if (!this.eventService) {
        console.warn('[SocketService] EventService não inicializado, tentando novamente...');
        // Reagendar a inicialização
        setTimeout(() => this.initEventService(), 1000);
        return;
      }
      
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
    
    // Se estivermos usando SSE, registre também no EventService
    if (this.eventService) {
      try {
        this.eventService.subscribe(roletaNome, callback);
      } catch (e) {
        console.warn(`[SocketService] Não foi possível registrar no EventService:`, e);
      }
    }
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
    
    // Se estivermos usando SSE, remova também do EventService
    if (this.eventService) {
      try {
        this.eventService.unsubscribe(roletaNome, callback);
      } catch (e) {
        console.warn(`[SocketService] Erro ao remover listener do EventService:`, e);
      }
    }
  }

  /**
   * Desconecta o serviço
   */
  public disconnect(): void {
    // Desconectar do EventService
    if (this.eventService) {
      try {
        this.eventService.disconnect();
      } catch (e) {
        console.error('[SocketService] Erro ao desconectar EventService:', e);
      }
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
  
  /**
   * Carrega o histórico de números para todas as roletas
   */
  public async loadHistoricalRouletteNumbers(): Promise<void> {
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