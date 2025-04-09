// Serviço para gerenciar eventos locais na aplicação
import { toast } from '@/components/ui/use-toast';
import config from '@/config/env';

// Debug flag - set to false to disable logs in production
const DEBUG_ENABLED = false;

// Helper function for controlled logging
const debugLog = (...args: any[]) => {
  if (DEBUG_ENABLED) {
    console.log(...args);
  }
};

// Definição dos tipos de eventos
export interface RouletteEvent {
  type: string;
  roleta_id: string;
  timestamp: string;
}

export interface RouletteNumberEvent extends RouletteEvent {
  type: 'new_number';
  roleta_nome: string;
  numero: number;
}

export interface StrategyUpdateEvent extends RouletteEvent {
  type: 'strategy_update';
  roleta_nome: string;
  estado: string;
  numero_gatilho?: number;
}

export interface RouletteHistoryEvent extends RouletteEvent {
  type: 'history_update';
  numeros: number[];
}

export type RouletteEventCallback = (event: RouletteEvent) => void;

// Tipo para callbacks de eventos genéricos
export type EventCallback = (data: any) => void;

export class EventService {
  private static instance: EventService | null = null;
  private static isInitializing = false;
  private static initializationPromise: Promise<EventService> | null = null;

  // Map para armazenar os event listeners
  private static eventCallbacks: Map<string, Set<Function>> = new Map();

  private constructor() {
    if (EventService.instance) {
      throw new Error('Erro: Tentativa de criar uma nova instância do EventService. Use EventService.getInstance()');
    }
    
    debugLog('[EventService] Inicializando serviço de eventos');
  }

  /**
   * Obtém a única instância do EventService (Singleton)
   */
  public static getInstance(): EventService {
    // Se já existe uma instância, retorna imediatamente
    if (EventService.instance) {
      return EventService.instance;
    }

    // Se já está inicializando, aguarde
    if (EventService.isInitializing) {
      console.log('[EventService] Inicialização em andamento, aguardando...');
      return EventService.instance as EventService;
    }

    // Inicia o processo de inicialização
    EventService.isInitializing = true;
    
    // Cria instância apenas se ainda não existir
    if (!EventService.instance) {
      console.log('[EventService] Criando nova instância');
      EventService.instance = new EventService();
    }
    
    // Libera o flag de inicialização
    EventService.isInitializing = false;
    
    return EventService.instance;
  }

  /**
   * Registra um callback para receber eventos
   * @param eventName Nome do evento
   * @param callback Função a ser chamada quando o evento ocorrer
   */
  public static on(eventName: string, callback: Function): void {
    if (!eventName || typeof callback !== 'function') {
      console.warn('[EventService] Parâmetros inválidos para registrar evento');
      return;
    }

    // Se não existir um conjunto para este evento, criar
    if (!EventService.eventCallbacks.has(eventName)) {
      EventService.eventCallbacks.set(eventName, new Set());
    }

    // Adicionar callback ao conjunto
    EventService.eventCallbacks.get(eventName)?.add(callback);
    debugLog(`[EventService] Callback registrado para evento: ${eventName}`);
  }

  /**
   * Remove um callback registrado para um evento
   * @param eventName Nome do evento
   * @param callback Função a ser removida
   */
  public static off(eventName: string, callback: Function): void {
    if (!eventName || typeof callback !== 'function') {
      console.warn('[EventService] Parâmetros inválidos para remover evento');
      return;
    }

    // Se existir um conjunto para este evento, remover o callback
    if (EventService.eventCallbacks.has(eventName)) {
      EventService.eventCallbacks.get(eventName)?.delete(callback);
      debugLog(`[EventService] Callback removido do evento: ${eventName}`);

      // Se o conjunto ficar vazio, remover a entrada
      if (EventService.eventCallbacks.get(eventName)?.size === 0) {
        EventService.eventCallbacks.delete(eventName);
      }
    }
  }

  /**
   * Emite um evento para todos os callbacks registrados
   * @param eventName Nome do evento
   * @param data Dados do evento
   */
  public static emit(eventName: string, data: any): void {
    if (!eventName) {
      console.warn('[EventService] Nome de evento inválido para emitir');
      return;
    }

    debugLog(`[EventService] Emitindo evento: ${eventName}`);

    // Se existir callbacks para este evento, chamar cada um
    const callbacks = EventService.eventCallbacks.get(eventName);
    if (callbacks && callbacks.size > 0) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[EventService] Erro ao executar callback para evento ${eventName}:`, error);
        }
      });
    }

    // Emitir também para listeners '*' (todos os eventos)
    const globalCallbacks = EventService.eventCallbacks.get('*');
    if (globalCallbacks && globalCallbacks.size > 0) {
      globalCallbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[EventService] Erro ao executar callback global para evento ${eventName}:`, error);
        }
      });
    }
  }

  /**
   * Limpa todos os callbacks registrados
   */
  public static clear(): void {
    EventService.eventCallbacks.clear();
    debugLog('[EventService] Todos os callbacks foram removidos');
  }

  /**
   * Destrói a instância do EventService
   */
  public destroy(): void {
    EventService.clear();
    if (EventService.instance === this) {
      EventService.instance = null;
    }
  }
}

// Exportação padrão para permitir import simplificado
export default EventService; 