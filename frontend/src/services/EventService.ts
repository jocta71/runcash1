/**
 * Serviço de Eventos para comunicação entre componentes
 * Implementa um padrão pub/sub (publicador/assinante) para permitir
 * que diferentes partes da aplicação se comuniquem sem acoplamento direto
 */

// Tipo para os handlers de eventos
type EventHandler = (data: any) => void;

class EventService {
  private static instance: EventService;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  
  // Construtor privado para padrão Singleton
  private constructor() {
    console.log('[EventService] Inicializado');
  }
  
  /**
   * Obtém a instância única do serviço de eventos
   */
  public static getInstance(): EventService {
    if (!EventService.instance) {
      EventService.instance = new EventService();
    }
    return EventService.instance;
  }
  
  /**
   * Registra um handler para um evento específico
   * @param eventName - Nome do evento
   * @param handler - Função callback para executar quando o evento ocorrer
   * @returns Função para cancelar inscrição
   */
  public on(eventName: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    
    const handlers = this.handlers.get(eventName);
    handlers?.add(handler);
    
    console.log(`[EventService] Registrado handler para ${eventName}, total: ${handlers?.size}`);
    
    // Retorna uma função para cancelar esta inscrição
    return () => {
      const handlers = this.handlers.get(eventName);
      if (handlers) {
        handlers.delete(handler);
        console.log(`[EventService] Removido handler para ${eventName}, restantes: ${handlers.size}`);
        
        // Se não há mais handlers, remover o conjunto
        if (handlers.size === 0) {
          this.handlers.delete(eventName);
        }
      }
    };
  }
  
  /**
   * Emite um evento com dados opcionais
   * @param eventName - Nome do evento
   * @param data - Dados para passar aos handlers (opcional)
   */
  public emit(eventName: string, data?: any): void {
    const handlers = this.handlers.get(eventName);
    
    if (handlers && handlers.size > 0) {
      console.log(`[EventService] Emitindo evento ${eventName} para ${handlers.size} handlers`);
      
      // Executar cada handler assincronamente para evitar bloqueios
      handlers.forEach(handler => {
        try {
          setTimeout(() => handler(data), 0);
        } catch (error) {
          console.error(`[EventService] Erro ao executar handler para ${eventName}:`, error);
        }
      });
    } else {
      console.log(`[EventService] Evento ${eventName} emitido, mas sem handlers registrados`);
    }
  }
  
  /**
   * Remove todos os handlers para um evento específico
   * @param eventName - Nome do evento
   */
  public clearEvent(eventName: string): void {
    this.handlers.delete(eventName);
    console.log(`[EventService] Todos os handlers removidos para ${eventName}`);
  }
  
  /**
   * Remove todos os handlers para todos os eventos
   */
  public clearAll(): void {
    this.handlers.clear();
    console.log('[EventService] Todos os handlers removidos');
  }
}

// Exportar a instância única do serviço
const eventService = EventService.getInstance();
export default eventService; 