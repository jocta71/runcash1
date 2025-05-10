/**
 * Serviço centralizado para gerenciamento de eventos
 * Facilita a comunicação entre componentes independentes
 */
class EventService {
  private static instance: EventService;
  private events: Map<string, Function[]>;

  private constructor() {
    this.events = new Map();
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
   * Registra um listener para um evento
   * @param eventName Nome do evento
   * @param callback Função a ser chamada quando o evento ocorrer
   */
  public on(eventName: string, callback: Function): void {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }
    
    this.events.get(eventName)?.push(callback);
  }
  
  /**
   * Remove um listener de um evento
   * @param eventName Nome do evento
   * @param callback Função a ser removida
   */
  public off(eventName: string, callback: Function): void {
    if (!this.events.has(eventName)) {
      return;
    }
    
    const callbacks = this.events.get(eventName) || [];
    const filteredCallbacks = callbacks.filter(cb => cb !== callback);
    this.events.set(eventName, filteredCallbacks);
      
    // Se não houver mais listeners, remover o evento
    if (filteredCallbacks.length === 0) {
      this.events.delete(eventName);
    }
  }

  /**
   * Emite um evento para todos os listeners registrados
   * @param eventName Nome do evento
   * @param data Dados a serem passados aos listeners
   */
  public emit(eventName: string, data?: any): void {
    if (!this.events.has(eventName)) {
      return;
    }
    
    const callbacks = this.events.get(eventName) || [];
      callbacks.forEach(callback => {
        try {
        callback(data);
        } catch (error) {
        console.error(`Erro ao executar callback para evento '${eventName}':`, error);
        }
      });
  }

  /**
   * Remove todos os listeners de um evento específico
   * @param eventName Nome do evento
   */
  public removeAllListeners(eventName: string): void {
    this.events.delete(eventName);
    }
    
  /**
   * Lista todos os eventos registrados e o número de listeners
   * Útil para debugging
   */
  public listEvents(): Record<string, number> {
    const eventCounts: Record<string, number> = {};
    
    this.events.forEach((callbacks, eventName) => {
      eventCounts[eventName] = callbacks.length;
    });
    
    return eventCounts;
      }
  }
  
// Criando uma instância global para facilitar uso
const eventService = EventService.getInstance();
    
// Para compatibilidade com código que usa EventBus
const EventBus = eventService;

export { eventService as default, eventService as EventService, EventBus }; 