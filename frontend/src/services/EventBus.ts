/**
 * EventBus - Serviço simples para comunicação por eventos entre componentes
 */

type EventCallback = (data: any) => void;

interface Subscription {
  unsubscribe: () => void;
}

class EventBus {
  private static instance: EventBus;
  private events: Map<string, Set<EventCallback>>;

  private constructor() {
    this.events = new Map();
  }

  /**
   * Obtém a instância singleton do serviço
   */
  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Registra um callback para um tipo de evento
   * @param eventName Nome do evento
   * @param callback Função a ser chamada quando o evento ocorrer
   * @returns Objeto com método para cancelar a inscrição
   */
  public on(eventName: string, callback: EventCallback): Subscription {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, new Set());
    }

    const callbacks = this.events.get(eventName)!;
    callbacks.add(callback);

    // Retornar objeto com método para cancelar a inscrição
    return {
      unsubscribe: () => {
        this.off(eventName, callback);
      }
    };
  }

  /**
   * Remove um callback para um tipo de evento
   * @param eventName Nome do evento
   * @param callback Função a ser removida
   */
  public off(eventName: string, callback: EventCallback): void {
    if (!this.events.has(eventName)) {
      return;
    }

    const callbacks = this.events.get(eventName)!;
    callbacks.delete(callback);
    
    // Se não houver mais callbacks, remover o conjunto
    if (callbacks.size === 0) {
      this.events.delete(eventName);
    }
  }

  /**
   * Emite um evento para todos os callbacks registrados
   * @param eventName Nome do evento
   * @param data Dados a serem passados para os callbacks
   */
  public emit(eventName: string, data: any): void {
    if (!this.events.has(eventName)) {
      return;
    }

    const callbacks = this.events.get(eventName)!;
    for (const callback of callbacks) {
      try {
        callback(data);
      } catch (error) {
        console.error(`Erro ao executar callback para evento ${eventName}:`, error);
      }
    }
  }
}

// Exportar instância singleton
const eventBus = EventBus.getInstance();
export default eventBus; 