import { io, Socket } from 'socket.io-client';
import { toast } from '@/components/ui/use-toast';
import config from '@/config/env';
import EventService, { 
  RouletteNumberEvent,
  RouletteEventCallback,
  StrategyUpdateEvent
} from './EventService';

// Nova interface para eventos recebidos pelo socket
interface SocketEvent {
  type: string;
  roleta_id: string;
  roleta_nome: string;
  [key: string]: any;
}

/**
 * Serviço que gerencia a conexão WebSocket via Socket.IO
 * para receber dados em tempo real do MongoDB
 */
class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private listeners: Map<string, Set<RouletteEventCallback>> = new Map();
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;
  private reconnectTimeout: number | null = null;
  
  private constructor() {
    console.log('[SocketService] Inicializando serviço Socket.IO');
    
    // Adicionar listener global para logging de todos os eventos
    this.subscribe('*', (event: RouletteNumberEvent | StrategyUpdateEvent) => {
      if (event.type === 'new_number') {
        console.log(`[SocketService][GLOBAL] Evento recebido para roleta: ${event.roleta_nome}, número: ${event.numero}`);
      } else if (event.type === 'strategy_update') {
        console.log(`[SocketService][GLOBAL] Atualização de estratégia para roleta: ${event.roleta_nome}, estado: ${event.estado}`);
      }
    });
    
    this.connect();
  }
  
  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }
  
  private getSocketUrl(): string {
    // URL do servidor WebSocket (ajustar conforme necessário)
    // Em ambiente de produção, deve apontar para a URL real do servidor
    const socketUrl = config.wsUrl;
    console.log(`[SocketService] URL do servidor Socket.IO: ${socketUrl}`);
    return socketUrl;
  }
  
  private connect(): void {
    if (this.socket) {
      console.log('[SocketService] Fechando conexão existente antes de reconectar');
      this.socket.close();
      this.socket = null;
    }
    
    try {
      const socketUrl = this.getSocketUrl();
      console.log(`[SocketService] Tentando conexão Socket.IO: ${socketUrl}`);
      
      // Conectar ao servidor Socket.IO
      this.socket = io(socketUrl, {
        reconnectionAttempts: 10,
        reconnectionDelay: 3000,
        timeout: 15000,
        autoConnect: true,
        transports: ['websocket', 'polling'], // Tentar WebSocket primeiro, depois polling
        forceNew: true,
        extraHeaders: {
          'ngrok-skip-browser-warning': 'true'  // Adicionar para ignorar a proteção do ngrok
        },
        auth: {
          token: 'anonymous' // Permitir conexão anônima sem autenticação
        }
      });
      
      // Evento de conexão estabelecida
      this.socket.on('connect', () => {
        console.log(`[SocketService] Conexão Socket.IO estabelecida! ID: ${this.socket?.id}`);
        this.isConnected = true;
        this.connectionAttempts = 0;
        
        // Solicitar números recentes imediatamente após a conexão
        this.requestRecentNumbers();
        
        // Configurar os listeners de eventos
        this.setupEventListeners();
        
        toast({
          title: "Conexão em tempo real estabelecida",
          description: "Recebendo atualizações instantâneas das roletas via WebSocket",
          variant: "default"
        });
      });
      
      // Evento de desconexão
      this.socket.on('disconnect', (reason) => {
        console.log(`[SocketService] Desconectado do Socket.IO: ${reason}`);
        this.isConnected = false;
        
        // Mostrar toast apenas se for desconexão inesperada
        if (reason !== 'io client disconnect') {
          toast({
            title: "Conexão em tempo real perdida",
            description: "Tentando reconectar...",
            variant: "destructive"
          });
        }
      });
      
      // Evento de erro
      this.socket.on('error', (error) => {
        console.error('[SocketService] Erro na conexão Socket.IO:', error);
      });
      
      // Evento de reconexão
      this.socket.on('reconnect', (attempt) => {
        console.log(`[SocketService] Reconectado após ${attempt} tentativas`);
        this.isConnected = true;
        
        // Solicitar dados novamente após reconexão
        this.requestRecentNumbers();
        
        toast({
          title: "Conexão restabelecida",
          description: "Voltando a receber atualizações em tempo real",
          variant: "default"
        });
      });
      
      // Evento de falha na reconexão
      this.socket.on('reconnect_failed', () => {
        console.error('[SocketService] Falha nas tentativas de reconexão');
        
        toast({
          title: "Não foi possível reconectar",
          description: "Por favor, recarregue a página para tentar novamente",
          variant: "destructive"
        });
      });
      
      // Receber novo número
      this.socket.on('new_number', (event: any) => {
        console.log(`[SocketService] Raw new_number: ${JSON.stringify(event)}`);
        
        // Garantir que o evento tenha a estrutura correta
        const formattedEvent: RouletteNumberEvent = {
          type: 'new_number',
          roleta_id: event.roleta_id || event.id || 'unknown-id',
          roleta_nome: event.roleta_nome || 'Desconhecida',
          numero: typeof event.numero === 'number' ? event.numero : 
                 typeof event.numero === 'string' ? parseInt(event.numero, 10) : 0,
          timestamp: event.timestamp || new Date().toISOString()
        };
        
        console.log(`[SocketService] Novo número processado: ${formattedEvent.roleta_nome} - ${formattedEvent.numero}`);
        this.notifyListeners(formattedEvent);
      });
      
      // Receber qualquer tipo de mensagem do socket
      this.socket.on('message', (message: any) => {
        console.log(`[SocketService] Mensagem genérica recebida:`, message);
        
        // Tentar processar como número se tiver dados relevantes
        if (message && message.roleta_nome && message.numero !== undefined) {
          const numberEvent: RouletteNumberEvent = {
            type: 'new_number',
            roleta_id: message.roleta_id || 'unknown-id',
            roleta_nome: message.roleta_nome,
            numero: typeof message.numero === 'number' ? message.numero : 
                   typeof message.numero === 'string' ? parseInt(message.numero, 10) : 0,
            timestamp: message.timestamp || new Date().toISOString()
          };
          
          console.log(`[SocketService] Convertendo mensagem genérica para evento de número: ${numberEvent.roleta_nome} - ${numberEvent.numero}`);
          this.notifyListeners(numberEvent);
        }
      });
      
      // Adicionar handler para evento de teste (útil para debugging)
      this.socket.on('test_event', (data: any) => {
        console.log(`[SocketService] Evento de teste recebido:`, data);
        
        // Enviar uma resposta para confirmar recepção
        this.socket?.emit('test_response', { 
          received: true, 
          clientTime: new Date().toISOString(),
          message: "Evento de teste recebido com sucesso"
        });
      });
      
    } catch (error) {
      console.error('[SocketService] Erro ao criar conexão Socket.IO:', error);
      
      // Tentar reconectar após um atraso
      this.scheduleReconnect();
    }
  }
  
  private scheduleReconnect(): void {
    // Limpar timeout existente
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Incrementar tentativas
    this.connectionAttempts++;
    
    // Calcular tempo de espera com backoff exponencial
    const delay = Math.min(1000 * Math.pow(1.5, this.connectionAttempts), 30000);
    console.log(`[SocketService] Tentando reconectar em ${Math.round(delay/1000)}s (tentativa ${this.connectionAttempts})`);
    
    // Agendar reconexão
    this.reconnectTimeout = window.setTimeout(() => {
      console.log('[SocketService] Executando reconexão agendada');
      this.connect();
    }, delay);
  }
  
  // Adiciona um listener para eventos de uma roleta específica
  public subscribe(roletaNome: string, callback: RouletteEventCallback): void {
    console.log(`[SocketService] Inscrevendo para eventos da roleta: ${roletaNome}`);
    
    if (!this.listeners.has(roletaNome)) {
      this.listeners.set(roletaNome, new Set());
      
      // Se for uma roleta específica (não o global '*')
      if (roletaNome !== '*' && this.socket && this.isConnected) {
        console.log(`[SocketService] Enviando subscrição para roleta: ${roletaNome}`);
        this.socket.emit('subscribe_to_roleta', roletaNome);
        
        // Também solicitar a estratégia atual
        this.sendMessage({
          type: 'get_strategy',
          roleta_nome: roletaNome
        });
      }
    }
    
    const listeners = this.listeners.get(roletaNome);
    listeners?.add(callback);
    
    const count = listeners?.size || 0;
    console.log(`[SocketService] Total de listeners para ${roletaNome}: ${count}`);
    
    // Verificar conexão ao inscrever um novo listener
    if (!this.isConnected || !this.socket) {
      console.log('[SocketService] Conexão Socket.IO não ativa, reconectando...');
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
      }
    }
  }
  
  // Notifica os listeners sobre um novo evento
  private notifyListeners(event: RouletteNumberEvent | StrategyUpdateEvent): void {
    try {
      // Verificar se é um evento de novo número ou de estratégia
      const eventType = event.type;
      const roletaNome = event.roleta_nome;
      
      // Log detalhado para debug
      console.log(`[SocketService] Notificando listeners para evento ${eventType} da roleta ${roletaNome}`);
      
      // Notificar os listeners específicos para esta roleta
      if (this.listeners.has(roletaNome)) {
        const roletaListeners = this.listeners.get(roletaNome);
        if (roletaListeners) {
          console.log(`[SocketService] Notificando ${roletaListeners.size} listeners específicos para ${roletaNome}`);
          roletaListeners.forEach(callback => {
            try {
              callback(event);
            } catch (error) {
              console.error(`[SocketService] Erro ao chamar callback para ${roletaNome}:`, error);
            }
          });
        }
      }
      
      // Notificar também os listeners globais
      if (this.listeners.has('*')) {
        const globalListeners = this.listeners.get('*');
        if (globalListeners) {
          console.log(`[SocketService] Notificando ${globalListeners.size} listeners globais`);
          globalListeners.forEach(callback => {
            try {
              callback(event);
            } catch (error) {
              console.error('[SocketService] Erro ao chamar callback global:', error);
            }
          });
        }
      }
      
      // Se for um evento de novo número, também notificar através dos listeners de números específicos
      if (eventType === 'new_number' && this.listeners.has('new_number')) {
        const numberListeners = this.listeners.get('new_number');
        if (numberListeners) {
          console.log(`[SocketService] Notificando ${numberListeners.size} listeners de números`);
          numberListeners.forEach(callback => {
            try {
              callback(event);
            } catch (error) {
              console.error('[SocketService] Erro ao chamar callback de número:', error);
            }
          });
        }
      }
      
      // Se for um evento de estratégia, também notificar através dos listeners de estratégia
      if (eventType === 'strategy_update' && this.listeners.has('strategy_update')) {
        const strategyListeners = this.listeners.get('strategy_update');
        if (strategyListeners) {
          console.log(`[SocketService] Notificando ${strategyListeners.size} listeners de estratégia`);
          strategyListeners.forEach(callback => {
            try {
              callback(event);
            } catch (error) {
              console.error('[SocketService] Erro ao chamar callback de estratégia:', error);
            }
          });
        }
      }
    } catch (error) {
      console.error('[SocketService] Erro ao notificar listeners:', error);
    }
  }
  
  // Fecha a conexão - chamar quando o aplicativo for encerrado
  public disconnect(): void {
    console.log('[SocketService] Desconectando Socket.IO');
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.isConnected = false;
  }
  
  // Verifica se a conexão está ativa
  public isSocketConnected(): boolean {
    return this.isConnected && !!this.socket;
  }
  
  // Alias para isSocketConnected para compatibilidade com o código existente
  public getConnectionStatus(): boolean {
    return this.isSocketConnected();
  }
  
  // Método para emitir eventos para o servidor
  public emit(eventName: string, data: any): void {
    if (this.socket && this.isConnected) {
      console.log(`[SocketService] Emitindo evento ${eventName}:`, data);
      this.socket.emit(eventName, data);
    } else {
      console.warn(`[SocketService] Tentativa de emitir evento ${eventName} falhou: Socket não conectado`);
    }
  }
  
  // Método para verificar se há dados reais disponíveis
  public hasRealData(): boolean {
    // Se não há conexão, não pode haver dados reais
    if (!this.isConnected || !this.socket) {
      return false;
    }
    
    // A conexão existe, então pode haver dados reais
    return true;
  }
  
  // Método para enviar mensagens via socket
  public sendMessage(data: any): void {
    if (!this.socket || !this.isConnected) {
      console.warn(`[SocketService] Tentativa de enviar mensagem sem conexão:`, data);
      return;
    }
    
    console.log(`[SocketService] Enviando mensagem:`, data);
    
    try {
      // Para mensagens de tipo get_strategy, aplicar um tratamento especial
      if (data.type === 'get_strategy') {
        // Adicionar um identificador único para rastrear esta solicitação
        const requestId = Date.now().toString();
        const enhancedData = {
          ...data,
          requestId,
          priority: 'high'
        };
        
        console.log(`[SocketService] Enviando solicitação prioritária de estratégia [${requestId}] para ${data.roleta_nome || data.roleta_id}`);
        
        // Emitir com evento específico para obter resposta mais rápida
        this.socket.emit('get_strategy', enhancedData);
        
        // Programar retry caso não receba resposta
        setTimeout(() => {
          console.log(`[SocketService] Verificando se obteve resposta para solicitação de estratégia [${requestId}]`);
          // Tentar novamente com outro evento se necessário
        }, 3000);
      } else {
        // Mensagens normais
      this.socket.emit('message', data);
      }
    } catch (error) {
      console.error(`[SocketService] Erro ao enviar mensagem:`, error);
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Registrar handlers para eventos do socket
    this.socket.on('connect', () => {
      console.log(`[SocketService] Conectado ao servidor WebSocket: ${this.getSocketUrl()}`);
      this.isConnected = true;
      this.notifyConnectionListeners();
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[SocketService] Desconectado do servidor WebSocket. Motivo: ${reason}`);
      this.isConnected = false;
      this.notifyConnectionListeners();
    });

    this.socket.on('message', (data: any) => {
      console.log(`[SocketService] Mensagem recebida:`, data);
      
      // Se temos dados de número, processar
      if (data && data.type === 'new_number' && data.roleta_nome) {
        this.processIncomingNumber(data);
      }
      
      // Se temos dados de estratégia, processar
      if (data && data.type === 'strategy_update') {
        console.log(`[SocketService] Dados de estratégia recebidos para ${data.roleta_nome || data.roleta_id}:`, {
          vitorias: data.vitorias,
          derrotas: data.derrotas,
          estado: data.estado
        });
        this.processStrategyEvent(data);
      }
    });

    // Ouvir especificamente por eventos de estratégia
    this.socket.on('strategy_update', (data: any) => {
      console.log(`[SocketService] Evento strategy_update recebido:`, data);
      if (data && (data.roleta_id || data.roleta_nome)) {
        // Garantir que o evento tenha o tipo correto
        const event = {
          ...data,
          type: 'strategy_update'
        };
        this.processStrategyEvent(event);
      }
    });
    
    // Ouvir por evento específico de vitórias/derrotas
    this.socket.on('wins_losses_update', (data: any) => {
      console.log(`[SocketService] Evento wins_losses_update recebido:`, data);
      if (data && (data.roleta_id || data.roleta_nome) && 
          (data.vitorias !== undefined || data.derrotas !== undefined)) {
        // Converter para formato de evento de estratégia
        const event = {
          ...data,
          type: 'strategy_update',
          estado: data.estado || 'NEUTRAL',
          vitorias: data.vitorias !== undefined ? parseInt(data.vitorias) : 0,
          derrotas: data.derrotas !== undefined ? parseInt(data.derrotas) : 0
        };
        this.processStrategyEvent(event);
      }
    });

    // Ouvir por eventos de estatísticas que também podem trazer vitórias/derrotas
    this.socket.on('statistics', (data: any) => {
      console.log(`[SocketService] Evento statistics recebido:`, data);
      if (data && (data.roleta_id || data.roleta_nome) && 
          (data.vitorias !== undefined || data.derrotas !== undefined)) {
        // Converter para formato de evento de estratégia
        const event = {
          ...data,
          type: 'strategy_update',
          vitorias: data.vitorias !== undefined ? parseInt(data.vitorias) : 0,
          derrotas: data.derrotas !== undefined ? parseInt(data.derrotas) : 0
        };
        this.processStrategyEvent(event);
      }
    });
  }

  // Método auxiliar para processar eventos de estratégia
  private processStrategyEvent(data: any): void {
    try {
      if (!data || (!data.roleta_id && !data.roleta_nome)) {
        console.warn('[SocketService] Evento de estratégia recebido sem identificador de roleta');
        return;
      }

      // Garantir que os valores de vitórias e derrotas sejam números válidos
      const vitorias = data.vitorias !== undefined ? parseInt(data.vitorias) : 0;
      const derrotas = data.derrotas !== undefined ? parseInt(data.derrotas) : 0;

      // Criar objeto de evento padronizado
      const event: StrategyUpdateEvent = {
        type: 'strategy_update',
        roleta_id: data.roleta_id || 'unknown-id',
        roleta_nome: data.roleta_nome || data.roleta_id || 'unknown',
        estado: data.estado || 'NEUTRAL',
        numero_gatilho: data.numero_gatilho || null,
        terminais_gatilho: data.terminais_gatilho || [],
        vitorias: vitorias,
        derrotas: derrotas,
        sugestao_display: data.sugestao_display || '',
        timestamp: data.timestamp || new Date().toISOString()
      };

      console.log(`[SocketService] Processando evento de estratégia:`, {
        roleta: event.roleta_nome,
        vitorias: event.vitorias,
        derrotas: event.derrotas,
        timestamp: event.timestamp
      });

      // Usar o EventService para notificar listeners
      const eventService = EventService.getInstance();
      eventService.emitStrategyUpdate(event);

      // Também notificar diretamente os callbacks específicos para esta roleta
      this.notifyListeners(event);
    } catch (error) {
      console.error('[SocketService] Erro ao processar evento de estratégia:', error);
    }
  }

  // Método para processar novos números
  private processIncomingNumber(data: any): void {
    try {
      if (!data || !data.roleta_nome || data.numero === undefined) {
        console.warn('[SocketService] Dados de número inválidos');
        return;
      }

      // Converter para formato padronizado
      const event: RouletteNumberEvent = {
        type: 'new_number',
        roleta_id: data.roleta_id || 'unknown-id',
        roleta_nome: data.roleta_nome,
        numero: parseInt(data.numero),
        timestamp: data.timestamp || new Date().toISOString()
      };

      // Notificar listeners
      this.notifyListeners(event);
    } catch (error) {
      console.error('[SocketService] Erro ao processar novo número:', error);
    }
  }

  // Notifica os listeners sobre mudanças de conexão
  private notifyConnectionListeners(): void {
    // Implementação aqui
  }

  // Método para solicitar números recentes de todas as roletas
  public requestRecentNumbers(): void {
    if (!this.socket || !this.isConnected) {
      console.warn('[SocketService] Não é possível solicitar números recentes: socket não conectado');
      return;
    }
    
    console.log('[SocketService] Solicitando números recentes de todas as roletas');
    
    // Emitir evento para solicitar números recentes
    this.socket.emit('get_recent_numbers', { count: 20 });
    
    // Também emitir evento de teste para verificar a conexão
    this.socket.emit('test_connection', { 
      timestamp: new Date().toISOString(),
      clientId: this.socket.id
    });
    
    // Subscrever para todas as roletas conhecidas
    const knownRoulettes = [
      'Brazilian Mega Roulette',
      'Speed Auto Roulette',
      'Bucharest Auto-Roulette',
      'Auto-Roulette',
      'Auto-Roulette VIP',
      'Immersive Roulette'
    ];
    
    knownRoulettes.forEach(roleta => {
      console.log(`[SocketService] Subscrevendo para roleta: ${roleta}`);
      this.socket?.emit('subscribe_to_roleta', roleta);
    });
  }

  // Adicionando um evento artificial para teste (deve ser removido em produção)
  public injectTestEvent(roleta: string, numero: number): void {
    if (!this.isConnected) {
      console.warn('[SocketService] Não é possível injetar evento de teste: socket não conectado');
      return;
    }
    
    console.log(`[SocketService] Injetando evento de teste para ${roleta}: número ${numero}`);
    
    // Criar evento de teste
    const testEvent: RouletteNumberEvent = {
      type: 'new_number',
      roleta_id: 'test-id',
      roleta_nome: roleta,
      numero: numero,
      timestamp: new Date().toISOString()
    };
    
    // Processar evento como se tivesse vindo do socket
    this.notifyListeners(testEvent);
  }
}

export default SocketService; 