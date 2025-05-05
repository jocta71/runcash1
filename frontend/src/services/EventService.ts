// Serviço para gerenciar eventos em tempo real
import { toast } from '@/components/ui/use-toast';
import config from '@/config/env';
import Cookies from 'js-cookie';

// Debug flag - set to false to disable logs in production
const DEBUG_ENABLED = false;

// Helper function for controlled logging
const debugLog = (...args: any[]) => {
  if (DEBUG_ENABLED) {
    console.log(...args);
  }
};

// Definição dos tipos de eventos
export interface RouletteNumberEvent {
  type: 'new_number';
  roleta_id: string;
  roleta_nome: string;
  numero: number;
  timestamp: string;
  // Campos opcionais de estratégia
  estado_estrategia?: string;
  sugestao_display?: string;
  terminais_gatilho?: number[];
  // Flag para indicar se dados existentes devem ser preservados
  preserve_existing?: boolean;
  // Flag para indicar se é uma atualização em tempo real (após carregamento inicial)
  realtime_update?: boolean;
}

export interface StrategyUpdateEvent {
  type: 'strategy_update';
  roleta_id: string;
  roleta_nome: string;
  estado: string;
  numero_gatilho: number;
  terminais_gatilho: number[];
  vitorias: number;
  derrotas: number;
  sugestao_display?: string;
  timestamp?: string;
}

export interface ConnectedEvent {
  type: 'connected';
  message: string;
}

export type EventData = RouletteNumberEvent | ConnectedEvent | StrategyUpdateEvent;

// Tipo para callbacks de eventos
export type RouletteEventCallback = (event: RouletteNumberEvent | StrategyUpdateEvent) => void;

// Tipo para callbacks de eventos genéricos
export type EventCallback = (data: any) => void;

interface Subscription {
  unsubscribe: () => void;
}

export class EventService {
  private static instance: EventService | null = null;
  private static isInitializing = false;

  private eventListeners: Record<string, Function[]> = {};
  private globalEventListeners: Record<string, Function[]> = {};

  private listeners: Map<string, Set<RouletteEventCallback>> = new Map();
  private customEventListeners: Map<string, Set<EventCallback>> = new Map();

  private constructor() {
    if (EventService.instance) {
      throw new Error('Erro: Tentativa de criar uma nova instância do EventService. Use EventService.getInstance()');
    }
    this.eventListeners = {};
    this.globalEventListeners = {};
    this.listeners = new Map();
    this.customEventListeners = new Map();
    
    console.log('[EventService] Instância criada (sem conexão interna).');
  }

  /**
   * Obtém a única instância do EventService (Singleton)
   * Implementa um mecanismo que previne múltiplas instâncias mesmo com chamadas paralelas
   */
  public static getInstance(): EventService {
    if (!EventService.instance) {
        console.log('[EventService] Criando nova instância singleton');
        EventService.instance = new EventService();
    }
    return EventService.instance;
  }

  public destroy() {
    this.listeners.clear();
    this.customEventListeners.clear();
    console.log('[EventService] Destruído.');
  }

  public subscribe(roletaNome: string, callback: RouletteEventCallback): void {
      debugLog(`[EventService] Listener adicionado para: ${roletaNome}`);
      if (!this.listeners.has(roletaNome)) {
          this.listeners.set(roletaNome, new Set());
      }
      const listeners = this.listeners.get(roletaNome);
      listeners?.add(callback);
  }

  public unsubscribe(roletaNome: string, callback: RouletteEventCallback): void {
      debugLog(`[EventService] Listener removido para: ${roletaNome}`);
      const callbacks = this.listeners.get(roletaNome);
      if (callbacks) {
          callbacks.delete(callback);
          if (callbacks.size === 0) {
              this.listeners.delete(roletaNome);
          }
      }
  }

  private notifyListeners(event: RouletteNumberEvent | StrategyUpdateEvent): void {
      const { roleta_nome } = event;
      debugLog(`[EventService] Notificando listeners para: ${roleta_nome}`);
      
      const specificListeners = this.listeners.get(roleta_nome);
      specificListeners?.forEach(listener => {
          try {
              listener(event);
          } catch (error) {
              console.error(`[EventService] Erro ao executar listener para ${roleta_nome}:`, error);
          }
      });

      // Notificar listeners globais (*)
      const globalListeners = this.listeners.get('*');
      globalListeners?.forEach(listener => {
          try {
              listener(event); // Envia o evento completo
          } catch (error) {
              console.error('[EventService] Erro ao executar listener global:', error);
          }
      });
  }

  public isSocketConnected(): boolean { 
      console.warn('[EventService] isSocketConnected() chamado, mas obsoleto.');
      return false; // Estado de conexão é externo
  }
  public disconnect(): void { 
       console.warn('[EventService] disconnect() chamado, mas obsoleto.');
  }

  public subscribeToEvent(eventType: string, callback: EventCallback): void {
    if (!this.customEventListeners.has(eventType)) {
      this.customEventListeners.set(eventType, new Set());
    }
    this.customEventListeners.get(eventType)?.add(callback);
  }

  public unsubscribeFromEvent(eventType: string, callback: EventCallback): void {
    this.customEventListeners.get(eventType)?.delete(callback);
  }
  
  public dispatchEvent(eventType: string, payload: any): void {
    console.log(`[EventService] Despachando evento interno: ${eventType}`, payload);
    this.customEventListeners.get(eventType)?.forEach(listener => {
        try {
            listener(payload);
        } catch (error) {
            console.error(`[EventService] Erro em listener de evento interno ${eventType}:`, error);
        }
    });
  }

  public static on(eventName: string, callback: EventCallback): Subscription {
    const instance = EventService.getInstance();
    
    if (!instance.customEventListeners.has(eventName)) {
      instance.customEventListeners.set(eventName, new Set());
    }
    
    instance.customEventListeners.get(eventName)?.add(callback);

    // Retornar objeto com método para cancelar a inscrição
    return {
      unsubscribe: () => {
        EventService.off(eventName, callback);
      }
    };
  }
  
  public static off(eventName: string, callback: EventCallback): void {
    const instance = EventService.getInstance();
    
    if (instance.customEventListeners.has(eventName)) {
      instance.customEventListeners.get(eventName)?.delete(callback);
    }
  }
  
  public static emit(eventName: string, data: any): void {
    const instance = EventService.getInstance();
    
    if (instance.customEventListeners.has(eventName)) {
      instance.customEventListeners.get(eventName)?.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[EventService] Erro ao executar callback para ${eventName}:`, error);
        }
      });
    }
  }
}

// Exportar instância única (Manter)
const eventServiceInstance = EventService.getInstance();
export default eventServiceInstance; 