// Serviço para gerenciar eventos em tempo real usando Server-Sent Events (SSE)
import { toast } from '@/components/ui/use-toast';
import config from '@/config/env';
import SocketService from '@/services/SocketService';
import { v4 as uuidv4 } from 'uuid';

// Debug flag - set to false to disable logs in production
const DEBUG_ENABLED = false;

// Helper function for controlled logging
const debugLog = (...args: any[]) => {
  if (DEBUG_ENABLED) {
    console.log(...args);
  }
};

// Eventos que serão escutados
type EventType = 
  | 'numero.novo'            // Novo número adicionado (genérico, qualquer roleta)
  | 'roleta.numero.novo'     // Novo número para uma roleta específica
  | 'estrategia.atualizada'  // Atualização de estratégia (genérica)
  | 'roleta.estrategia'      // Atualização de estratégia para uma roleta específica
  | 'user.subscription'      // Eventos de assinatura do usuário
  | string;                  // Outras strings para flexibilidade
  
export interface NumeroUpdateEvent {
  evento?: string;
  tipo?: string;
  roleta_id: string;
  roleta_nome: string;
  numero: number;
  timestamp: number;
  cor?: string;
}

export interface StrategyUpdateEvent {
  evento?: string;
  tipo?: string;
  roleta_id: string; 
  roleta_nome: string;
  estado: string;
  estado_display: string; 
  terminais_gatilho: number[];
  vitorias: number;
  derrotas: number;
  timestamp: number;
}

interface EventCallback<T> {
  (event: T): void;
}

type EventListener = {
  id: string;
  eventType: EventType;
  roleta_id?: string;
  callback: EventCallback<any>;
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
}

export interface ConnectedEvent {
  type: 'connected';
  message: string;
}

export type EventData = RouletteNumberEvent | ConnectedEvent | StrategyUpdateEvent;

// Tipo para callbacks de eventos
export type RouletteEventCallback = (event: RouletteNumberEvent | StrategyUpdateEvent) => void;

// Serviço de eventos
class EventService {
  private static instance: EventService;
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Set<RouletteEventCallback>> = new Map();
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;
  private reconnectTimeout: number | null = null;
  private usingPolling: boolean = false;
  private pollingInterval: number | null = null;
  private lastEventId: string | null = null;
  private connectionMethods: string[] = ['socketio-fallback', 'direct', 'proxy', 'polling'];
  private currentMethodIndex: number = 0;
  private usingSocketService: boolean = false;
  private socketServiceSubscriptions: Set<string> = new Set();
  private eventListeners: EventListener[] = [];

  private constructor() {
    // Adicionar listener global para logging de todos os eventos
    this.subscribe('*', (event: RouletteNumberEvent) => {
      debugLog(`[EventService][GLOBAL] Evento: ${event.roleta_nome}, número: ${event.numero}`);
    });
    
    // Iniciar com SSE para comunicação em tempo real verdadeiro
    debugLog('[EventService] Iniciando conexão para eventos em tempo real');
    this.connect();
    
    // Adicionar listener para visibilidade da página
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  // Cleanup quando o serviço é destruído
  public destroy() {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.disconnect();
    
    // Limpar subscrições do SocketService
    if (this.usingSocketService) {
      const socketService = SocketService.getInstance();
      this.socketServiceSubscriptions.forEach(roletaNome => {
        socketService.unsubscribe(roletaNome, this.handleSocketEvent);
      });
      this.socketServiceSubscriptions.clear();
    }
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // Tentar reconectar se a página ficar visível e não estiver conectado
      if (!this.isConnected) {
        debugLog('[EventService] Página tornou-se visível, reconectando...');
        this.connect();
      }
    } else {
      // Opcionalmente desconectar quando a página não estiver visível
      // para economizar recursos (comentado por enquanto)
      // this.disconnect();
    }
  }

  public static getInstance(): EventService {
    if (!EventService.instance) {
      EventService.instance = new EventService();
    }
    return EventService.instance;
  }

  // Obtém a URL do servidor de eventos baseado no método atual
  private getServerUrl(method: string = 'direct'): string {
    const baseUrl = 'https://short-mammals-help.loca.lt/api/events';
    
    switch (method) {
      case 'direct':
        // Tentar conexão direta primeiro
        return baseUrl;
      case 'proxy':
        // Usar um proxy CORS quando a conexão direta falhar
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(baseUrl)}`;
        return proxyUrl;
      default:
        return baseUrl;
    }
  }

  private connect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    // Se já tentou todos os métodos, voltar para o primeiro
    if (this.currentMethodIndex >= this.connectionMethods.length) {
      // Limitar tentativas a 2 ciclos completos
      if (this.connectionAttempts > 2 * this.connectionMethods.length) {
        debugLog('[EventService] Máximo de ciclos de tentativas atingido. Usando SocketService como fallback final.');
        this.useSocketServiceAsFallback();
        return;
      }
      
      this.currentMethodIndex = 0;
    }
    
    const currentMethod = this.connectionMethods[this.currentMethodIndex];
    
    if (currentMethod === 'socketio-fallback') {
      // Tentar SocketService primeiro por ser mais confiável
      this.useSocketServiceAsFallback();
      return;
    } else if (currentMethod === 'polling') {
      this.startPolling();
      return;
    }
    
    try {
      const serverUrl = this.getServerUrl(currentMethod);
      debugLog(`[EventService] Tentando conexão ${currentMethod}: ${serverUrl}`);
      
      // Usar EventSource com configuração mínima
      this.eventSource = new EventSource(serverUrl);
      
      // Configurar um timeout para esta tentativa
      const connectionTimeout = setTimeout(() => {
        debugLog(`[EventService] Timeout na tentativa ${currentMethod}`);
        this.handleConnectionFailure();
      }, 3000);

      this.eventSource.onopen = () => {
        clearTimeout(connectionTimeout);
        debugLog('[EventService] Conexão estabelecida com sucesso!');
        this.isConnected = true;
        this.connectionAttempts = 0;
        this.currentMethodIndex = 0; // Resetar para o método preferido
        
        // Só mostrar toast na primeira conexão bem-sucedida
        if (this.connectionAttempts === 0) {
          toast({
            title: "Conexão em tempo real estabelecida",
            description: "Você receberá atualizações instantâneas das roletas",
            variant: "default"
          });
        }
      };

      this.eventSource.onerror = (error) => {
        clearTimeout(connectionTimeout);
        this.handleConnectionFailure();
      };

      this.eventSource.onmessage = (event) => {
        try {
          // Parsing inicial do JSON
          let parsedData;
          try {
            parsedData = JSON.parse(event.data);
          } catch (e) {
            debugLog('[EventService] Erro ao fazer parse do JSON');
            return;
          }
          
          // Adaptar formato da nova API para o formato esperado
          let data: EventData;
          
          // Verificar formato e adaptar conforme necessário
          if (parsedData.type === 'new_number') {
            // Já está no formato esperado para números
            data = parsedData as RouletteNumberEvent;
          } else if (parsedData.type === 'strategy_update') {
            // Evento de atualização de estratégia
            data = parsedData as StrategyUpdateEvent;
          } else if (parsedData.roleta_nome && parsedData.numero !== undefined) {
            // Formato da nova API: converter para o formato esperado
            data = {
              type: 'new_number',
              roleta_id: parsedData.roleta_id || parsedData.id || 'unknown-id',
              roleta_nome: parsedData.roleta_nome,
              numero: Number(parsedData.numero),
              timestamp: parsedData.timestamp || new Date().toISOString()
            };
          } else if (parsedData.message && typeof parsedData.message === 'string') {
            // Evento de conexão ou outro evento informativo
            data = {
              type: 'connected',
              message: parsedData.message
            };
          } else {
            return;
          }
          
          // Armazenar ID do último evento para polling
          if (event.lastEventId) {
            this.lastEventId = event.lastEventId;
          }
          
          if (data.type === 'new_number') {
            debugLog(`[EventService] Novo número: ${data.roleta_nome} - ${data.numero}`);
            this.notifyListeners(data);
          } else if (data.type === 'strategy_update') {
            debugLog(`[EventService] Estratégia: ${data.roleta_nome} - Estado: ${data.estado}`);
            this.notifyListeners(data as any);
          }
        } catch (error) {
          debugLog('[EventService] Erro ao processar evento');
        }
      };
    } catch (error) {
      debugLog('[EventService] Erro ao criar conexão, tentando próximo método...');
      this.handleConnectionFailure();
    }
  }
  
  private handleConnectionFailure(): void {
    this.isConnected = false;
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    // Incrementar tentativas e avançar para o próximo método
    this.connectionAttempts++;
    this.currentMethodIndex++;
    
    // Aplicar backoff exponencial com limitação
    const delay = Math.min(1000 * Math.pow(1.5, Math.min(this.connectionAttempts, 8)), 10000);
    
    debugLog(`[EventService] Tentativa ${this.connectionAttempts} falhou. Tentando próximo método em ${Math.round(delay/1000)}s`);
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
    }, delay);
  }
  
  // NOVO: Usar SocketService como fallback final
  private useSocketServiceAsFallback(): void {
    if (this.usingSocketService) {
      return; // Já está usando SocketService
    }
    
    debugLog('[EventService] Utilizando SocketService como fallback para eventos em tempo real');
    
    this.usingSocketService = true;
    this.isConnected = true; // Simular conexão estabelecida
    
    // Registrar com o global listener para todos os eventos (*)
    const socketService = SocketService.getInstance();
    socketService.subscribe('*', this.handleSocketEvent);
    this.socketServiceSubscriptions.add('*');
    
    toast({
      title: "Conexão de backup estabelecida",
      description: "Usando Socket.IO como alternativa para receber atualizações",
      variant: "default"
    });
  }
  
  // Handler para eventos do SocketService
  private handleSocketEvent = (event: any) => {
    // Verificar se é um evento válido
    if (!event || !event.roleta_nome) return;
    
    // Converter formato do SocketService para o formato do EventService
    let convertedEvent: EventData;
    
    if (event.type === 'strategy_update') {
      // Evento de atualização de estratégia
      convertedEvent = event as StrategyUpdateEvent;
    } else if (event.numero !== undefined) {
      // Evento de novo número
      convertedEvent = {
        type: 'new_number',
        roleta_id: event.roleta_id || 'unknown-id',
        roleta_nome: event.roleta_nome,
        numero: Number(event.numero),
        timestamp: event.timestamp || new Date().toISOString()
      };
    } else {
      return; // Evento desconhecido
    }
    
    // Notificar listeners usando o mesmo sistema
    this.notifyListeners(convertedEvent as any);
  }
  
  // Método alternativo de polling para quando SSE falhar
  private startPolling(): void {
    if (this.pollingInterval !== null) {
      clearInterval(this.pollingInterval);
    }
    
    this.usingPolling = true;
    debugLog('[EventService] Iniciando polling como fallback');
    
    // Simular conexão estabelecida para fins de UI
    this.isConnected = true;
    
    // Polling a cada 3 segundos
    this.pollingInterval = window.setInterval(() => {
      this.performPoll();
    }, 3000);
    
    // Primeira chamada imediata
    this.performPoll();
  }
  
  private async performPoll(): Promise<void> {
    try {
      // Tentar endpoint Socket.IO alternativo que sabemos que funciona 
      const url = 'http://localhost:5000/api/latest-numbers';
      
      const response = await fetch(url);
      
      if (!response.ok) {
        // Se falhar, tentar o url original
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      
      if (Array.isArray(data)) {
        // Processar vários eventos
        data.forEach(item => {
          if (item.roleta_nome && item.numero !== undefined) {
            const event: RouletteNumberEvent = {
              type: 'new_number',
              roleta_id: item.roleta_id || 'unknown-id',
              roleta_nome: item.roleta_nome,
              numero: Number(item.numero),
              timestamp: item.timestamp || new Date().toISOString()
            };
            this.notifyListeners(event);
          } else if (item.type === 'strategy_update') {
            this.notifyListeners(item as StrategyUpdateEvent);
          }
        });
      } else if (data.roleta_nome && data.numero !== undefined) {
        // Processar evento único
        const event: RouletteNumberEvent = {
          type: 'new_number',
          roleta_id: data.roleta_id || 'unknown-id',
          roleta_nome: data.roleta_nome,
          numero: Number(data.numero),
          timestamp: data.timestamp || new Date().toISOString()
        };
        this.notifyListeners(event);
      }
    } catch (error) {
      debugLog(`[EventService] Erro no polling: ${error}, tentando usar SocketService...`);
      
      // Se polling falhar após algumas tentativas, usar SocketService
      this.connectionAttempts++;
      
      if (this.connectionAttempts > 3) {
        if (this.pollingInterval !== null) {
          clearInterval(this.pollingInterval);
          this.pollingInterval = null;
        }
        
        this.useSocketServiceAsFallback();
      }
    }
  }

  // Adiciona um listener para eventos de uma roleta específica
  public subscribe(roletaNome: string, callback: RouletteEventCallback): void {
    debugLog(`[EventService] Inscrevendo para eventos: ${roletaNome}`);
    
    if (!this.listeners.has(roletaNome)) {
      this.listeners.set(roletaNome, new Set());
    }

    const listeners = this.listeners.get(roletaNome);
    listeners?.add(callback);
    
    // Se estiver usando SocketService como fallback, registrar também lá
    if (this.usingSocketService && !this.socketServiceSubscriptions.has(roletaNome)) {
      const socketService = SocketService.getInstance();
      socketService.subscribe(roletaNome, this.handleSocketEvent);
      this.socketServiceSubscriptions.add(roletaNome);
    }
    
    // Sempre verificar a conexão ao inscrever um novo listener
    if (!this.isConnected) {
      debugLog(`[EventService] Conexão não ativa, reconectando...`);
      this.connect();
    }
  }

  // Remove um listener
  public unsubscribe(roletaNome: string, callback: RouletteEventCallback): void {
    const callbacks = this.listeners.get(roletaNome);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(roletaNome);
        
        // Se estiver usando SocketService, cancelar inscrição lá também
        if (this.usingSocketService && this.socketServiceSubscriptions.has(roletaNome)) {
          const socketService = SocketService.getInstance();
          socketService.unsubscribe(roletaNome, this.handleSocketEvent);
          this.socketServiceSubscriptions.delete(roletaNome);
        }
      }
    }
  }

  // Notifica os listeners sobre um novo evento
  private notifyListeners(event: RouletteNumberEvent | StrategyUpdateEvent): void {
    // Log simplificado para melhor desempenho em modo tempo real
    if (event.type === 'new_number') {
      debugLog(`[EventService] Novo número: ${event.roleta_nome} - ${event.numero}`);
    } else if (event.type === 'strategy_update') {
      debugLog(`[EventService] Estratégia: ${event.roleta_nome} - Estado: ${event.estado}`);
    }
    
    // Notificar listeners da roleta específica
    const roletaListeners = this.listeners.get(event.roleta_nome);
    if (roletaListeners && roletaListeners.size > 0) {
      roletaListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          debugLog(`[EventService] Erro ao notificar listener para ${event.roleta_nome}`);
        }
      });
    }
    
    // Notificar listeners globais (*)
    const globalListeners = this.listeners.get('*');
    if (globalListeners && globalListeners.size > 0) {
      globalListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          debugLog('[EventService] Erro ao notificar listener global');
        }
      });
    }
  }

  // Verifica se o sistema está conectado (SSE ou polling)
  public isSocketConnected(): boolean {
    return this.isConnected;
  }

  // Desconecta o EventSource e limpa polling
  public disconnect(): void {
    if (this.eventSource) {
      debugLog('[EventService] Desconectando EventSource');
      this.eventSource.close();
      this.eventSource = null;
    }
    
    // Limpar polling se estiver ativo
    if (this.pollingInterval !== null) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    this.isConnected = false;
    this.usingPolling = false;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Limpar subscrições do SocketService
    if (this.usingSocketService) {
      const socketService = SocketService.getInstance();
      this.socketServiceSubscriptions.forEach(roletaNome => {
        socketService.unsubscribe(roletaNome, this.handleSocketEvent);
      });
      this.socketServiceSubscriptions.clear();
      this.usingSocketService = false;
    }
  }

  /**
   * Adiciona um listener para um tipo de evento específico
   */
  public subscribe<T>(
    eventType: EventType, 
    callback: EventCallback<T>,
    roleta_id?: string
  ): string {
    const listenerId = uuidv4();
    
    this.eventListeners.push({
      id: listenerId,
      eventType,
      roleta_id,
      callback
    });
    
    console.log(`[EventService] Subscribed to ${eventType}${roleta_id ? ` for roleta ${roleta_id}` : ''}`);
    
    return listenerId;
  }
  
  /**
   * Remove um listener específico pelo ID
   */
  public unsubscribe(listenerId: string): void {
    const initialLength = this.eventListeners.length;
    this.eventListeners = this.eventListeners.filter(
      listener => listener.id !== listenerId
    );
    
    if (initialLength !== this.eventListeners.length) {
      console.log(`[EventService] Unsubscribed listener ${listenerId}`);
    }
  }
  
  /**
   * Publica um evento para todos os listeners registrados
   */
  public publish<T>(eventType: EventType, event: T, roleta_id?: string): void {
    // Filtrar listeners que correspondem ao tipo de evento
    // Se for um evento específico de roleta, também filtra pelo ID da roleta
    const matchingListeners = this.eventListeners.filter(listener => {
      const typeMatches = listener.eventType === eventType;
      
      // Se não tiver roleta_id no evento, considera apenas o tipo
      if (!roleta_id) return typeMatches;
      
      // Se tiver roleta_id, verifica se o listener está inscrito para essa roleta específica
      // ou se está inscrito para todas as roletas desse tipo de evento (roleta_id não especificado)
      return typeMatches && (!listener.roleta_id || listener.roleta_id === roleta_id);
    });
    
    // Log para debug
    if (matchingListeners.length > 0) {
      console.log(`[EventService] Publishing ${eventType}${roleta_id ? ` for roleta ${roleta_id}` : ''} to ${matchingListeners.length} listeners`);
    }
    
    // Notificar cada listener
    matchingListeners.forEach(listener => {
      try {
        listener.callback(event);
      } catch (error) {
        console.error(`[EventService] Error in listener for ${eventType}:`, error);
      }
    });
  }
  
  /**
   * Atualiza dados de um novo número de roleta
   */
  public publishNumeroUpdate(eventData: NumeroUpdateEvent): void {
    // Publicar como evento genérico (para qualquer número novo)
    this.publish('numero.novo', eventData);
    
    // Publicar também como evento específico para essa roleta
    this.publish('roleta.numero.novo', eventData, eventData.roleta_id);
  }
  
  /**
   * Atualiza estratégia de uma roleta específica
   */
  public publishStrategyUpdate(eventData: StrategyUpdateEvent): void {
    // Publicar como evento genérico de estratégia
    this.publish('estrategia.atualizada', eventData);
    
    // Publicar também como evento específico para essa roleta
    this.publish('roleta.estrategia', eventData, eventData.roleta_id);
  }
  
  /**
   * Busca a estratégia atual
   * (Placeholder - Em uma implementação real isso chamaria uma API)
   */
  public async fetchCurrentStrategy(roletaId: string): Promise<StrategyUpdateEvent | null> {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
      
      // Simula uma chamada de API
      return fetch(`${apiUrl}/api/roletas/${roletaId}`)
        .then(response => {
          if (!response.ok) {
            throw new Error('Não foi possível obter a estratégia atual');
          }
          return response.json();
        })
        .then(data => {
          // Formatar resultado para o formato esperado
          if (data && data.strategy) {
            const strategy = data.strategy;
            return {
              roleta_id: roletaId,
              roleta_nome: data.nome || 'Roleta',
              estado: strategy.estado || 'aguardando',
              estado_display: strategy.estado_display || 'Aguardando',
              terminais_gatilho: strategy.terminais_gatilho || [],
              vitorias: strategy.vitorias || 0,
              derrotas: strategy.derrotas || 0,
              timestamp: Date.now()
            };
          }
          return null;
        });
    } catch (error) {
      console.error('[EventService] Error fetching strategy:', error);
      return null;
    }
  }
}

export default EventService; 