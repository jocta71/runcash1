declare module 'react' {
  export const useState: any;
  export const useEffect: any;
  export const useRef: any;
  export const useCallback: any;
  export const useMemo: any;
}

declare module 'uuid' {
  export const v4: () => string;
}

declare module '@/services/EventService' {
  export interface StrategyUpdateEvent {
    roleta_id: string;
    estado: string;
    estado_display: string;
    terminais_gatilho: number[];
    vitorias: number;
    derrotas: number;
  }

  export default class EventService {
    static getInstance(): EventService;
    subscribe(eventType: string, callback: Function, entityId?: string): string;
    unsubscribe(subscriptionId: string): void;
    fetchCurrentStrategy(roletaId: string): Promise<any>;
  }
}

declare module '@/services/SocketService' {
  export default class SocketService {
    static getInstance(): SocketService;
    isSocketConnected(): boolean;
    on(event: string, callback: Function): string;
    off(subscriptionId: string): void;
  }
}

// Add type definition for ImportMeta to fix TypeScript error
declare global {
  interface ImportMeta {
    env: Record<string, string>;
  }
} 