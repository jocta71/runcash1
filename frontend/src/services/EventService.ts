// Serviço para gerenciar eventos em tempo real usando Server-Sent Events (SSE)
import { toast } from '@/components/ui/use-toast';
import config from '@/config/env';
import SocketService from '@/services/SocketService';

// Debug flag - set to false to disable logs in production
const DEBUG_ENABLED = false;

// Helper function for controlled logging
const debugLog = (...args: any[]) => {
  if (DEBUG_ENABLED) {
    console.log(...args);
  }
};

// Definição dos tipos de eventos
export interface BaseEvent {
  type: string;
  roleta_id: string;
  timestamp: string;
}

export interface RouletteNumberEvent extends BaseEvent {
  type: 'new_number';
  roleta_nome: string;
  numero: number;
}

export interface RouletteHistoryEvent extends BaseEvent {
  type: 'history_update';
  numeros: number[];
}

export interface StrategyUpdateEvent extends BaseEvent {
  type: 'strategy_update';
  roleta_nome: string;
  estado: string;
}

export type RouletteEvent = RouletteNumberEvent | RouletteHistoryEvent | StrategyUpdateEvent;

// Tipo para callbacks de eventos
export type RouletteEventCallback = (event: RouletteEvent) => void | Promise<void> | boolean;

// Tipo para callbacks de eventos genéricos
export type EventCallback = (data: any) => void;

export class EventService {
  private static instance: EventService | null = null;
  private static isInitializing = false;
  private static initializationPromise: Promise<EventService> | null = null;

  private eventListeners: Record<string, Function[]> = {};
  private globalEventListeners: Record<string, Function[]> = {};
  private socketService: SocketService | null = null;

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
  
  // Map para armazenar callbacks de eventos personalizados
  private customEventListeners: Map<string, Set<EventCallback>> = new Map();

  private constructor() {
    if (EventService.instance) {
      throw new Error('Erro: Tentativa de criar uma nova instância do EventService. Use EventService.getInstance()');
    }
    
    // Inicialização padrão
    this.eventListeners = {};
    this.globalEventListeners = {};
    
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

  /**
   * Obtém a única instância do EventService (Singleton)
   * Implementa um mecanismo que previne múltiplas instâncias mesmo com chamadas paralelas
   */
  public static getInstance(): EventService {
    // Se já existe uma instância, retorna imediatamente
    if (EventService.instance) {
      return EventService.instance;
    }

    // Se já está inicializando, aguarde
    if (EventService.isInitializing) {
      console.log('[EventService] Inicialização em andamento, aguardando...');
      // Não tentamos retornar a promise de inicialização, pois não é utilizada corretamente
      // Apenas retornamos a instância, que deve estar definida neste ponto
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
          let data: RouletteEvent;
          
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
    if (!event || !event.type) {
      console.error('[EventService] Evento inválido recebido do SocketService:', event);
      return;
    }
    
    console.log(`[EventService] Evento recebido do SocketService: ${event.type} para ${event.roleta_nome}`);
    
    // Formatar evento (garantir compatibilidade completa)
    let formattedEvent: RouletteNumberEvent | StrategyUpdateEvent;
    
    if (event.type === 'new_number') {
      formattedEvent = {
        type: 'new_number',
        roleta_id: event.roleta_id || '',
        roleta_nome: event.roleta_nome || 'Desconhecida',
        numero: typeof event.numero === 'number' ? event.numero : 
                typeof event.numero === 'string' ? parseInt(event.numero, 10) : 0,
        timestamp: event.timestamp || new Date().toISOString(),
        // Incluir campos opcionais de estratégia, se presentes
        estado_estrategia: event.estado_estrategia,
        sugestao_display: event.sugestao_display,
        terminais_gatilho: event.terminais_gatilho
      };
      
      console.log(`[EventService] Novo número formatado: ${formattedEvent.roleta_nome} - ${formattedEvent.numero}`);
    } else if (event.type === 'strategy_update') {
      formattedEvent = {
        type: 'strategy_update',
        roleta_id: event.roleta_id || '',
        roleta_nome: event.roleta_nome || 'Desconhecida',
        estado: event.estado || 'UNKNOWN',
        numero_gatilho: event.numero_gatilho || 0,
        terminais_gatilho: event.terminais_gatilho || [],
        vitorias: event.vitorias !== undefined ? event.vitorias : 0,
        derrotas: event.derrotas !== undefined ? event.derrotas : 0,
        sugestao_display: event.sugestao_display,
        timestamp: event.timestamp || new Date().toISOString()
      };
      
      console.log(`[EventService] Estratégia formatada: ${formattedEvent.roleta_nome} - ${formattedEvent.estado}`);
    } else {
      console.warn(`[EventService] Tipo de evento desconhecido: ${event.type}`);
      return;
    }
    
    // Notificar todos os ouvintes registrados
    this.notifyListeners(formattedEvent);
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
      const baseUrl = config.apiBaseUrl;
      const url = `${baseUrl}/latest-numbers`;
      
      const response = await fetch(url, {
        headers: {
          'bypass-tunnel-reminder': 'true'
        }
      });
      
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
    const roletaListeners = this.listeners.get(event.roleta_id);
    if (roletaListeners && roletaListeners.size > 0) {
      roletaListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          debugLog(`[EventService] Erro ao notificar listener para ${event.roleta_id}`);
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

  // Adiciona um listener para eventos de um tipo específico
  public subscribeToEvent(eventType: string, callback: RouletteEventCallback): void {
    debugLog(`[EventService] Inscrevendo para eventos do tipo: ${eventType}`);
    this.subscribe(eventType, callback);
  }

  // Remove um listener de um tipo específico
  public unsubscribeFromEvent(eventType: string, callback: RouletteEventCallback): void {
    this.unsubscribe(eventType, callback);
  }

  // Adiciona um listener para todos os eventos
  public subscribeToGlobalEvents(callback: RouletteEventCallback): void {
    debugLog(`[EventService] Inscrevendo para todos os eventos`);
    this.subscribe('*', callback);
  }

  // Remove um listener global
  public unsubscribeFromGlobalEvents(callback: RouletteEventCallback): void {
    this.unsubscribe('*', callback);
  }

  // Método para emitir eventos de atualização de estratégia diretamente
  public emitStrategyUpdate(data: any): void {
    if (!data || !data.roleta_nome) {
      debugLog('[EventService] Dados inválidos para emitir atualização de estratégia');
      return;
    }
    
    debugLog(`[EventService] Emitindo atualização de estratégia para ${data.roleta_nome}`);
    
    const event: StrategyUpdateEvent = {
      type: 'strategy_update',
      roleta_id: data.roleta_id || 'unknown-id',
      roleta_nome: data.roleta_nome,
      estado: data.estado || 'desconhecido',
      numero_gatilho: data.numero_gatilho || 0,
      terminais_gatilho: data.terminais_gatilho || [],
      vitorias: data.vitorias || 0,
      derrotas: data.derrotas || 0,
      sugestao_display: data.sugestao_display || '',
      timestamp: new Date().toISOString()
    };
    
    this.notifyListeners(event);
  }

  // Método para emitir eventos globais do sistema
  public static emitGlobalEvent(eventType: string, payload: any): void {
    const instance = EventService.getInstance();
    debugLog(`[EventService] Emitindo evento global: ${eventType}`, payload);
    
    // Criar um objeto de evento genérico
    const event: any = {
      type: eventType,
      ...payload,
      timestamp: new Date().toISOString()
    };
    
    // Notificar listeners globais
    instance.notifyListeners(event as any);
  }

  /**
   * Envia um evento para todos os ouvintes registrados
   * @param event Evento a ser enviado
   */
  public dispatchEvent(event: RouletteEvent): void {
    // Garantir que o timestamp seja uma string
    if (event.timestamp instanceof Date) {
      event.timestamp = event.timestamp.toISOString();
    }
    
    // Notificar listeners específicos da roleta
    if (this.listeners.has(event.roleta_id)) {
      const listeners = this.listeners.get(event.roleta_id);
      if (listeners) {
        listeners.forEach(callback => {
          try {
            callback(event);
          } catch (error) {
            console.error(`[EventService] Erro ao notificar listener para ${event.roleta_id}:`, error);
          }
        });
      }
    }
    
    // Notificar listeners globais
    if (this.listeners.has('*')) {
      const globalListeners = this.listeners.get('*');
      if (globalListeners) {
        globalListeners.forEach(callback => {
          try {
            callback(event);
          } catch (error) {
            console.error('[EventService] Erro ao notificar listener global:', error);
          }
        });
      }
    }
  }

  // Adicionar método para gerenciar atualizações em tempo real
  public receiveRealtimeUpdate(event: RouletteNumberEvent | StrategyUpdateEvent): void {
    if (!event) return;
    
    debugLog(`[EventService] Recebendo atualização em tempo real para ${event.roleta_nome}`);
    
    // Marcar evento como atualização em tempo real
    if (event.type === 'new_number') {
      event.realtime_update = true;
    }
    
    // Enviar para processamento normal de eventos
    this.dispatchEvent(event);
    
    // Notificar os listeners específicos para atualizações em tempo real
    if (this.listeners.has('realtime_updates')) {
      const realtimeListeners = this.listeners.get('realtime_updates');
      if (realtimeListeners) {
        debugLog(`[EventService] Notificando ${realtimeListeners.size} listeners de atualizações em tempo real`);
        realtimeListeners.forEach(callback => {
          try {
            callback(event);
          } catch (error) {
            console.error('[EventService] Erro ao chamar callback de atualização em tempo real:', error);
          }
        });
      }
    }
    
    // Também exibir notificação visual para destacar novos dados
    if (event.type === 'new_number') {
      const numero = event.numero;
      const roletaNome = event.roleta_nome;
      
      // Mostrar pequena notificação para novos números
      toast({
        title: `Novo número: ${numero}`,
        description: `${roletaNome}`,
        variant: "default",
        duration: 2000 // Duração curta para não incomodar
      });
    }
  }

  // Método para verificar e solicitar atualizações em tempo real
  public requestRealtimeUpdates(): void {
    debugLog('[EventService] Solicitando atualizações em tempo real');
    
    if (this.usingSocketService) {
      // Solicitar através do SocketService
      const socketService = SocketService.getInstance();
      
      // Verificar conexão do SocketService
      if (!socketService.isSocketConnected()) {
        debugLog('[EventService] Socket não conectado, tentando reconectar');
        // Simplificar a chamada para evitar problema com o tipo void
        socketService.reconnect();
        // Solicitar atualizações em qualquer caso
        socketService.requestRecentNumbers();
        socketService.broadcastConnectionState();
      } else {
        // Se estiver conectado, solicitar atualização
        socketService.requestRecentNumbers();
      }
    } else if (this.isConnected && this.eventSource) {
      // Se estiver usando SSE, enviar evento para solicitar atualização
      debugLog('[EventService] Solicitando atualizações via SSE');
      // Não é possível enviar diretamente via SSE, mas podemos reconectar para atualizar
      this.disconnect();
      this.connect();
    } else if (this.usingPolling) {
      // Se estiver usando polling, forçar uma verificação imediata
      debugLog('[EventService] Forçando verificação via polling');
      this.performPoll();
    }
  }

  /**
   * Registra um callback para um evento personalizado
   */
  public static on(eventName: string, callback: EventCallback): void {
    const instance = EventService.getInstance();
    
    if (!instance.customEventListeners.has(eventName)) {
      instance.customEventListeners.set(eventName, new Set());
    }
    
    instance.customEventListeners.get(eventName)?.add(callback);
  }
  
  /**
   * Remove um callback previamente registrado
   */
  public static off(eventName: string, callback: EventCallback): void {
    const instance = EventService.getInstance();
    
    if (instance.customEventListeners.has(eventName)) {
      instance.customEventListeners.get(eventName)?.delete(callback);
    }
  }
  
  /**
   * Emite um evento personalizado com dados
   */
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

export default EventService; 