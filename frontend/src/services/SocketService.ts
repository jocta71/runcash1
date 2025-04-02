import { io, Socket } from 'socket.io-client';
import { toast } from '@/components/ui/use-toast';
import config from '@/config/env';
import EventService, { 
  RouletteNumberEvent,
  RouletteEventCallback,
  StrategyUpdateEvent
} from './EventService';
import { getRequiredEnvVar, isProduction } from '../config/env';

// Importando o serviço de estratégia para simular respostas
import { StrategyService } from './StrategyService';

// Interface para o cliente MongoDB
interface MongoClient {
  topology?: {
    isConnected?: () => boolean;
  };
}

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
  private connectionActive: boolean = false;
  private connectionAttempts: number = 0;
  private reconnectTimeout: number | null = null;
  private timerId: NodeJS.Timeout | null = null;
  private eventHandlers: Record<string, (data: any) => void> = {};
  
  // Propriedade para o cliente MongoDB (pode ser undefined em alguns contextos)
  public client?: MongoClient;
  
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
    let wsUrl = getRequiredEnvVar('VITE_WS_URL');
    
    // Em produção, garantir que usamos uma URL segura (não localhost)
    if (isProduction && (wsUrl.includes('localhost') || wsUrl.includes('127.0.0.1'))) {
      console.warn('[SocketService] Detectada URL inválida para WebSocket em produção. Usando origem atual.');
      wsUrl = window.location.origin;
    }
    
    console.log('[SocketService] Usando URL de WebSocket:', wsUrl);
    return wsUrl;
  }
  
  private connect(): void {
    if (this.socket) {
      console.log('[SocketService] Socket já conectado');
      return;
    }

    try {
      const wsUrl = this.getSocketUrl();
      console.log('[SocketService] Conectando ao servidor WebSocket:', wsUrl);
      
      this.socket = io(wsUrl, {
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10
      });

      this.socket.on('connect', () => {
        console.log('[SocketService] Conectado ao servidor WebSocket');
        this.connectionActive = true;
        this.connectionAttempts = 0;
        this.setupPing();
        
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

      this.socket.on('reconnect', (attempt) => {
        console.log(`[SocketService] Reconectado ao servidor WebSocket após ${attempt} tentativas`);
        this.connectionActive = true;
        this.connectionAttempts = 0;
        this.setupPing();
        
        // Solicitar dados novamente após reconexão
        this.requestRecentNumbers();
        
        toast({
          title: "Conexão restabelecida",
          description: "Voltando a receber atualizações em tempo real",
          variant: "default"
        });
      });

      this.socket.on('disconnect', (reason) => {
        console.log(`[SocketService] Desconectado do servidor WebSocket: ${reason}`);
        this.connectionActive = false;
        if (this.timerId) {
          clearInterval(this.timerId);
          this.timerId = null;
        }
        
        // Mostrar toast apenas se for desconexão inesperada
        if (reason !== 'io client disconnect') {
          toast({
            title: "Conexão em tempo real perdida",
            description: "Tentando reconectar...",
            variant: "destructive"
          });
        }
      });

      this.socket.on('error', (error) => {
        console.error('[SocketService] Erro na conexão WebSocket:', error);
      });

      // Configurar handler genérico de eventos
      this.socket.onAny((event, ...args) => {
        console.log(`[SocketService] Evento recebido: ${event}`, args);
        
        if (this.eventHandlers[event]) {
          this.eventHandlers[event](args[0]);
        }
      });

    } catch (error) {
      console.error('[SocketService] Erro ao conectar ao servidor WebSocket:', error);
      
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
      if (roletaNome !== '*' && this.socket && this.connectionActive) {
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
    if (!this.connectionActive || !this.socket) {
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
    console.log('[SocketService] Desconectando do servidor WebSocket');
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    
    this.connectionActive = false;
  }
  
  // Verifica se a conexão está ativa
  public isSocketConnected(): boolean {
    return this.connectionActive && !!this.socket;
  }
  
  // Alias para isSocketConnected para compatibilidade com o código existente
  public getConnectionStatus(): boolean {
    return this.isSocketConnected();
  }
  
  // Método para emitir eventos para o servidor
  public emit(eventName: string, data: any): void {
    if (this.socket && this.connectionActive) {
      console.log(`[SocketService] Emitindo evento ${eventName}:`, data);
      this.socket.emit(eventName, data);
    } else {
      console.warn(`[SocketService] Tentativa de emitir evento ${eventName} falhou: Socket não conectado`);
    }
  }
  
  // Método para verificar se há dados reais disponíveis
  public hasRealData(): boolean {
    // Se não há conexão, não pode haver dados reais
    if (!this.connectionActive || !this.socket) {
      return false;
    }
    
    // A conexão existe, então pode haver dados reais
    return true;
  }
  
  // Método para enviar mensagens via socket
  public sendMessage(data: any): void {
    // Verificar se é uma mensagem relacionada a estratégia
    if (data && (data.type === 'get_strategy' || data.path?.includes('/api/strategies'))) {
      console.log(`[SocketService] Interceptando requisição de estratégia:`, data);
      
      // Se tiver roleta_id e roleta_nome, chamar o método requestStrategy
      if (data.roleta_id && data.roleta_nome) {
        this.requestStrategy(data.roleta_id, data.roleta_nome);
        return;
      }
      
      // Se tiver apenas roletaId ou params.roletaId
      const roletaId = data.roletaId || (data.params && data.params.roletaId);
      if (roletaId) {
        const roletaNome = data.roleta_nome || 'Desconhecida';
        this.requestStrategy(roletaId, roletaNome);
        return;
      }
      
      // Não fazer a requisição para estratégias
      console.log(`[SocketService] Bloqueando requisição de estratégia`);
      return;
    }
    
    if (!this.socket || !this.connectionActive) {
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
      this.connectionActive = true;
      this.notifyConnectionListeners();
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[SocketService] Desconectado do servidor WebSocket. Motivo: ${reason}`);
      this.connectionActive = false;
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

      // Log detalhado para debug
      console.log(`[SocketService] Enviando evento para ${data.roleta_nome}: número ${data.numero}`);
      
      // Notificar através do EventService também (para garantir que todos recebam)
      EventService.emitGlobalEvent('new_number', event);
      
      // Notificar os listeners sobre este número
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
    console.log('[SocketService] Solicitando números recentes de todas as roletas');
    
    // Primeiro tenta carregar os dados históricos via REST API
    this.loadHistoricalRouletteNumbers();
    
    // Emitir evento para solicitar números recentes via WebSocket
    if (this.socket && this.connectionActive) {
      this.socket.emit('get_recent_numbers', { count: 50 });
    } else {
      console.warn('[SocketService] Não é possível solicitar números recentes: socket não conectado');
    }
  }
  
  // Método para processar dados de números
  private processNumbersData(numbersData: any[], roulette: any): void {
    console.log(`[SocketService] Processando ${numbersData.length} números para roleta ${roulette.nome || roulette.name}`);
    
    // Verificar se temos listeners para esta roleta
    const roletaNome = roulette.nome || roulette.name;
    const roletaId = roulette._id || roulette.id;
    
    if (!this.listeners.has(roletaNome) && !this.listeners.has('*')) {
      console.log(`[SocketService] Nenhum listener encontrado para a roleta: ${roletaNome}. Criando inscrição automática`);
      // Criar um set vazio para garantir que podemos adicionar listeners depois
      this.listeners.set(roletaNome, new Set());
    }
    
    // Log detalhado sobre listeners
    console.log(`[SocketService] Status dos listeners:
      - Global (*): ${this.listeners.has('*') ? 'Sim' : 'Não'}
      - Específico (${roletaNome}): ${this.listeners.has(roletaNome) ? 'Sim' : 'Não'}
      - Total listeners globais: ${this.listeners.get('*')?.size || 0}
      - Total listeners específicos: ${this.listeners.get(roletaNome)?.size || 0}
    `);
    
    // Processar cada número individualmente
    numbersData.forEach((num, index) => {
      // Verificar se o número é válido
      if (num === null || num === undefined) {
        console.warn(`[SocketService] Número inválido na posição ${index} para ${roletaNome}`);
        return;
      }
      
      // Extrair o número conforme o tipo
      let numero: number;
      if (typeof num === 'number') {
        numero = num;
      } else if (typeof num === 'object' && num !== null && num.numero !== undefined) {
        numero = typeof num.numero === 'number' ? num.numero : parseInt(String(num.numero), 10);
      } else if (typeof num === 'string') {
        numero = parseInt(num, 10);
      } else {
        console.warn(`[SocketService] Formato de número não suportado: ${typeof num}`);
        return;
      }
      
      // Verificar se o número é válido após conversão
      if (isNaN(numero) || numero < 0 || numero > 36) {
        console.warn(`[SocketService] Número fora do intervalo válido: ${numero}`);
        return;
      }
      
      // Criar o evento
      const event: RouletteNumberEvent = {
        type: 'new_number',
        roleta_id: roletaId || 'unknown-id',
        roleta_nome: roletaNome,
        numero: numero,
        timestamp: (num && num.timestamp) ? num.timestamp : new Date().toISOString()
      };
      
      // Log detalhado para debug
      console.log(`[SocketService] Enviando evento para ${roletaNome}: número ${numero}`);
      
      // Usar o EventService diretamente, sem chamar o método que não existe
      const eventService = EventService.getInstance();
      
      // Enviar também como evento global para garantir
      EventService.emitGlobalEvent('new_number', event);
      
      // Notificar diretamente os listeners locais sobre este número
      this.notifyListeners(event);
    });
    
    // Log final
    console.log(`[SocketService] Concluído o processamento de ${numbersData.length} números para ${roletaNome}`);
    
    // Garantir que a interface seja atualizada enviando um evento global
    EventService.emitGlobalEvent('numbers_processed', { 
      roleta_id: roletaId,
      roleta_nome: roletaNome, 
      count: numbersData.length 
    });
  }

  // Método para carregar números históricos das roletas
  public async loadHistoricalRouletteNumbers(): Promise<void> {
    console.log('[SocketService] Iniciando carregamento de números históricos...');
    
    // Notificar que o carregamento começou
    EventService.emitGlobalEvent('historical_data_loading', { started: true });
    
    try {
      const connectedRoulettes = await this.fetchRealRoulettes();
      if (connectedRoulettes && connectedRoulettes.length > 0) {
        console.log(`[SocketService] Obtidas ${connectedRoulettes.length} roletas reais do servidor`);
        
        // Tentar carregar números reais para cada roleta
        let countWithRealData = 0;
        for (const roulette of connectedRoulettes) {
          if (!roulette) continue;
          
          // Assegurar que temos um ID válido
          const roletaId = roulette._id || roulette.id || roulette.gameId || roulette.table_id;
          if (!roletaId) {
            console.warn('[SocketService] Roleta sem ID válido:', roulette);
            continue;
          }
          
          // Normalizar o objeto da roleta
          roulette._id = roletaId;
          const roletaNome = roulette.nome || roulette.name || roulette.table_name || `Roleta ${roletaId.substring(0, 8)}`;
          roulette.nome = roletaNome;
          
          // Buscar dados históricos reais
          const hasRealData = await this.fetchRealHistoricalData(roulette);
          
          if (hasRealData) {
            countWithRealData++;
          } else if (roulette.nome && roulette._id) {
            // Se não conseguimos dados reais, informar ao usuário que não há dados disponíveis
            console.log(`[SocketService] Sem dados históricos reais para ${roulette.nome}`);
            
            // Criar um evento informando que não há dados
            EventService.emitGlobalEvent('no_data_available', {
              roleta_id: roulette._id,
              roleta_nome: roulette.nome
            });
          }
        }
        
        // Informar quantas roletas têm dados reais
        console.log(`[SocketService] ${countWithRealData} de ${connectedRoulettes.length} roletas têm dados históricos reais`);
        
        if (countWithRealData > 0) {
          EventService.emitGlobalEvent('historical_data_loaded', { 
            success: true,
            count: countWithRealData,
            isRealData: true
          });
          
          toast({
            title: "Dados reais carregados",
            description: `Carregados dados reais para ${countWithRealData} roletas`,
            variant: "default"
          });
          return;
        }
      }
      
      // Se chegamos aqui, não conseguimos dados reais de nenhuma roleta
      console.warn('[SocketService] Nenhuma roleta com dados reais encontrada');
      EventService.emitGlobalEvent('historical_data_loaded', { 
        success: false,
        message: "Sem dados reais disponíveis"
      });
      
      toast({
        title: "Aviso",
        description: "Não foi possível obter dados reais das roletas. Por favor tente novamente mais tarde.",
        variant: "default"
      });
      
    } catch (error) {
      console.error('[SocketService] Erro ao carregar dados históricos:', error);
      EventService.emitGlobalEvent('historical_data_loaded', { 
        success: false,
        error: String(error)
      });
      
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao tentar carregar os dados históricos.",
        variant: "destructive"
      });
    }
  }
  
  // Método para buscar roletas reais 
  private async fetchRealRoulettes(): Promise<any[]> {
    console.log('[SocketService] Buscando lista de roletas reais...');
    
    try {
      // Define a URL base para as APIs
      const baseUrl = this.getApiBaseUrl();
      
      // Lista de endpoints para tentar buscar dados de roletas
      const endpoints = [
        `${baseUrl}/api/roulettes`,
        `${baseUrl}/api/ROULETTES`,
        `${baseUrl}/api/tables`
      ];
      
      // Tentar cada endpoint até encontrar um que funcione
      for (const endpoint of endpoints) {
        try {
          console.log(`[SocketService] Tentando buscar roletas em: ${endpoint}`);
          const response = await fetch(endpoint);
          
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
              console.log(`[SocketService] Encontradas ${data.length} roletas em ${endpoint}`);
              return data;
            }
          }
        } catch (e) {
          console.warn(`[SocketService] Falha ao buscar roletas em ${endpoint}:`, e);
        }
      }
      
      // Se nenhum endpoint funcionou, retornar array vazio
      return [];
      
    } catch (error) {
      console.error('[SocketService] Erro ao buscar roletas:', error);
      return [];
    }
  }
  
  // Método para buscar dados históricos reais para uma roleta
  private async fetchRealHistoricalData(roulette: any): Promise<boolean> {
    if (!roulette || !roulette._id) return false;
    
    console.log(`[SocketService] Buscando dados históricos reais para ${roulette.nome} (${roulette._id})`);
    
    try {
      const baseUrl = this.getApiBaseUrl();
      const endpoints = [
        `${baseUrl}/api/roulettes/${roulette._id}/numbers`,
        `${baseUrl}/api/ROULETTES/${roulette._id}/numbers`,
        `${baseUrl}/api/numbers/${roulette._id}`
      ];
      
      for (const endpoint of endpoints) {
        try {
          console.log(`[SocketService] Tentando buscar números em: ${endpoint}`);
          const response = await fetch(endpoint);
          
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
              console.log(`[SocketService] Encontrados ${data.length} números para ${roulette.nome}`);
              
              // Processar os números reais
              this.processNumbersData(data, roulette);
              return true;
            }
          }
        } catch (e) {
          console.warn(`[SocketService] Falha ao buscar números em ${endpoint}:`, e);
        }
      }
      
      return false;
      
    } catch (error) {
      console.error(`[SocketService] Erro ao buscar dados históricos para ${roulette.nome}:`, error);
      return false;
    }
  }
  
  // Obter a URL base da API
  private getApiBaseUrl(): string {
    // Verificar se estamos em produção ou desenvolvimento
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }
    
    // URL padrão para desenvolvimento local
    return 'http://localhost:3004';
  }

  // Adicionando um evento artificial para teste (deve ser removido em produção)
  public injectTestEvent(roleta: string, numero: number): void {
    if (!this.connectionActive) {
      console.warn('[SocketService] Não é possível injetar evento de teste: socket não conectado');
      return;
    }
    
    console.log(`[SocketService] Injetando número real para ${roleta}: número ${numero}`);
    
    // Criar evento com dados reais
    const testEvent: RouletteNumberEvent = {
      type: 'new_number',
      roleta_id: 'real-data-' + Date.now(),
      roleta_nome: roleta,
      numero: numero,
      timestamp: new Date().toISOString()
    };
    
    // Processar evento como se tivesse vindo do socket
    this.notifyListeners(testEvent);
    
    // Atualizar estado de carregamento
    EventService.emitGlobalEvent('historical_data_loaded', {
      success: true,
      isRealData: true,
      count: 1
    });
  }

  // Método para enviar solicitação de estratégia para um roleta
  public requestStrategy(roletaId: string, roletaNome: string): void {
    // ⚠️ IMPORTANTE: Modificado para não fazer requisições HTTP diretas
    console.log(`[SocketService] Solicitação de estratégia para ${roletaNome} interceptada e redirecionada para simulação local`);
    
    // Importar StrategyService de forma assíncrona para evitar referência circular
    import('./StrategyService').then(({ default: StrategyService }) => {
      // Usar o StrategyService local que foi modificado para funcionar offline
      StrategyService.getSystemStrategy().then(strategy => {
        // Criar um evento simulado com a estratégia do sistema
        const event: StrategyUpdateEvent = {
          type: 'strategy_update',
          roleta_id: roletaId,
          roleta_nome: roletaNome,
          estado: 'NEUTRAL',
          numero_gatilho: null,
          terminais_gatilho: [],
          vitorias: 0,
          derrotas: 0,
          sugestao_display: 'Simulação modo offline',
          timestamp: new Date().toISOString()
        };
        
        console.log(`[SocketService] Enviando evento simulado de estratégia para ${roletaNome}`);
        
        // Notificar os ouvintes sobre essa estratégia
        this.notifyListeners(event);
      });
    });
    
    // Não enviar requisição para o servidor
    return;
  }

  setupPing() {
    if (this.timerId) {
      clearInterval(this.timerId);
    }

    this.timerId = setInterval(() => {
      if (this.socket && this.connectionActive) {
        this.socket.emit('ping');
      }
    }, 30000);
  }

  // Adicionar um método para verificar a conexão
  public isConnectionActive(): boolean {
    return this.connectionActive;
  }

  // Verifica se temos conexão ativa
  private checkSocketConnection(): boolean {
    return this.connectionActive && !!this.socket;
  }

  // Métodos adicionais para compatibilidade com qualquer código antigo
  public isConnected(): boolean {
    console.warn('[SocketService] Método isConnected() chamado. Usando verificação de topologia recomendada.');
    
    // Implementação recomendada para verificar a conexão no MongoDB moderno
    if (this.client && this.client.topology && this.client.topology.isConnected()) {
      return true;
    } else if (this.connectionActive) {
      // Fallback para a propriedade local connectionActive
      return this.connectionActive;
    }
    return false;
  }
}

export default SocketService; 