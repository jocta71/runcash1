/**
 * Implementação simples de EventEmitter compatível com navegadores
 * Substitui a dependência do módulo 'events' do Node.js
 */
class BrowserEventEmitter {
  private events: Record<string, Function[]> = {};

  /**
   * Registra um ouvinte para um evento específico
   * @param event Nome do evento
   * @param listener Função callback a ser executada
   * @returns Referência ao próprio EventEmitter para encadeamento
   */
  on(event: string, listener: Function): BrowserEventEmitter {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  /**
   * Remove um ouvinte específico de um evento
   * @param event Nome do evento
   * @param listener Função callback a ser removida
   * @returns Referência ao próprio EventEmitter para encadeamento
   */
  off(event: string, listener: Function): BrowserEventEmitter {
    if (!this.events[event]) return this;

    const index = this.events[event].indexOf(listener);
    if (index > -1) {
      this.events[event].splice(index, 1);
    }
    return this;
  }

  /**
   * Registra um ouvinte que será executado apenas uma vez
   * @param event Nome do evento
   * @param listener Função callback a ser executada uma única vez
   * @returns Referência ao próprio EventEmitter para encadeamento
   */
  once(event: string, listener: Function): BrowserEventEmitter {
    const wrapper = (...args: any[]) => {
      listener(...args);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  /**
   * Emite um evento com os argumentos especificados
   * @param event Nome do evento a ser emitido
   * @param args Argumentos a serem passados para os ouvintes
   * @returns true se o evento tinha ouvintes, false caso contrário
   */
  emit(event: string, ...args: any[]): boolean {
    if (!this.events[event]) return false;

    this.events[event].forEach(listener => {
      listener(...args);
    });
    return true;
  }

  /**
   * Remove todos os ouvintes de um evento específico ou de todos os eventos
   * @param event Nome do evento (opcional)
   * @returns Referência ao próprio EventEmitter para encadeamento
   */
  removeAllListeners(event?: string): BrowserEventEmitter {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
    return this;
  }

  /**
   * Retorna todos os ouvintes para um evento específico
   * @param event Nome do evento
   * @returns Array de funções de ouvinte
   */
  listeners(event: string): Function[] {
    return this.events[event] || [];
  }
}

export default BrowserEventEmitter; 