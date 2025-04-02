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
  private timerId: NodeJS.Timeout | null = null;
  private eventHandlers: Record<string, (data: any) => void> = {};
  
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
        this.isConnected = true;
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
        this.isConnected = true;
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
        this.isConnected = false;
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
    console.log('[SocketService] Solicitando números recentes de todas as roletas');
    
    // Primeiro tenta carregar os dados históricos via REST API
    this.loadHistoricalRouletteNumbers();
    
    // Emitir evento para solicitar números recentes via WebSocket
    if (this.socket && this.isConnected) {
      this.socket.emit('get_recent_numbers', { count: 50 });
    } else {
      console.warn('[SocketService] Não é possível solicitar números recentes: socket não conectado');
    }
  }
  
  // Método auxiliar para processar dados de números
  private processNumbersData(numbersData: any[], roulette: any): void {
    numbersData.forEach(num => {
      // Verificar se o número é válido
      if (num && (typeof num === 'number' || typeof num.numero === 'number')) {
        const numero = typeof num === 'number' ? num : num.numero;
        
        const event: RouletteNumberEvent = {
          type: 'new_number',
          roleta_id: roulette._id,
          roleta_nome: roulette.nome || roulette.name,
          numero: numero,
          timestamp: (num && num.timestamp) ? num.timestamp : new Date().toISOString()
        };
        
        // Notificar os listeners sobre este número
        this.notifyListeners(event);
      }
    });
  }

  // Método para carregar os números históricos via REST API
  public async loadHistoricalRouletteNumbers(): Promise<void> {
    try {
      const apiBaseUrl = getRequiredEnvVar('VITE_API_BASE_URL');
      console.log(`[SocketService] Carregando dados históricos das roletas. API Base URL: ${apiBaseUrl}`);
      
      // Verificar estrutura da URL base da API
      if (!apiBaseUrl) {
        console.error("[SocketService] URL base da API não definida");
        return;
      }
      
      // Testar URL direta do servidor (verificando disponibilidade)
      const testUrl = "https://backendapi-production-36b5.up.railway.app/api";
      console.log(`[SocketService] Testando disponibilidade do servidor: ${testUrl}`);
      
      // NOVA ABORDAGEM: Tentar buscar os dados diretamente do endpoint de roletas que sabemos que funciona
      try {
        const allDataEndpoint = `${testUrl}/ROULETTES`;
        console.log(`[SocketService] Tentando extrair números diretamente do endpoint de roletas: ${allDataEndpoint}`);
        
        const response = await fetch(allDataEndpoint);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            console.log(`[SocketService] Obtidas ${data.length} roletas com possíveis números incluídos`);
            
            // Verificar se os objetos de roleta já contêm números (alguns servidores podem incluí-los)
            let foundEmbeddedNumbers = false;
            
            // Contadores para estatísticas
            let roletasProcessadas = 0;
            let roletasComNumeros = 0;
            let totalNumeros = 0;
            
            for (const roulette of data) {
              if (!roulette) continue;
              
              // Assegurar que temos um ID válido
              const roletaId = roulette._id || roulette.id || roulette.gameId || roulette.table_id || roulette.tableId;
              if (!roletaId) {
                continue;
              }
              
              // Normalizar o objeto da roleta
              roulette._id = roletaId;
              const roletaNome = roulette.nome || roulette.name || roulette.table_name || `Roleta ${roletaId.substring(0, 8)}`;
              roulette.nome = roletaNome;
              
              roletasProcessadas++;
              
              // Verificar se a roleta já tem números incluídos
              let numerosArray = null;
              
              // Procurar por diferentes campos que podem conter números
              if (Array.isArray(roulette.numeros) && roulette.numeros.length > 0) {
                numerosArray = roulette.numeros;
                foundEmbeddedNumbers = true;
              } else if (Array.isArray(roulette.numbers) && roulette.numbers.length > 0) {
                numerosArray = roulette.numbers;
                foundEmbeddedNumbers = true;
              } else if (Array.isArray(roulette.history) && roulette.history.length > 0) {
                numerosArray = roulette.history;
                foundEmbeddedNumbers = true;
              } else if (typeof roulette.numeros === 'string' && roulette.numeros.includes(',')) {
                // Caso esteja em formato de string separada por vírgulas
                numerosArray = roulette.numeros.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
                foundEmbeddedNumbers = true;
              }
              
              // Processar os números se encontrados
              if (numerosArray && numerosArray.length > 0) {
                roletasComNumeros++;
                totalNumeros += numerosArray.length;
                
                console.log(`[SocketService] Encontrados ${numerosArray.length} números embutidos para ${roletaNome}`);
                this.processNumbersData(numerosArray, roulette);
              }
            }
            
            // Logar estatísticas
            console.log(`[SocketService] Estatísticas de extração direta:
              Roletas processadas: ${roletasProcessadas}
              Roletas com números: ${roletasComNumeros}
              Total de números extraídos: ${totalNumeros}
              Números encontrados embutidos: ${foundEmbeddedNumbers ? 'SIM' : 'NÃO'}`);
            
            // Continuar com o processamento normal se não encontramos números embutidos
            if (!foundEmbeddedNumbers || roletasComNumeros === 0) {
              console.log(`[SocketService] Números não encontrados embutidos, prosseguindo com busca individual por roleta`);
              // Seguir para o método tradicional abaixo...
            } else {
              // Se encontramos números embutidos, podemos encerrar o processamento aqui
              console.log('[SocketService] Carregamento de todos os dados históricos concluído via extração direta');
              EventService.emitGlobalEvent('historical_data_loaded', { success: true });
              toast({
                title: "Dados históricos carregados",
                description: `Carregados dados de ${roletasComNumeros} roletas com ${totalNumeros} números`,
                variant: "default"
              });
              return; // Encerrar o método aqui
            }
          }
        }
      } catch (error) {
        console.error(`[SocketService] Erro ao tentar extrair números diretamente: ${error}`);
        // Continuar com o método tradicional abaixo...
      }
    } catch (error) {
      console.error('[SocketService] Erro ao carregar dados históricos:', error);
      // Tentar endpoints alternativos se o principal falhar
      this.tryAlternativeHistoricalEndpoints();
    }
  }
  
  // Método para tentar endpoints alternativos
  private async tryAlternativeHistoricalEndpoints(): Promise<void> {
    try {
      const apiBaseUrl = getRequiredEnvVar('VITE_API_BASE_URL');
      console.log(`[SocketService] Tentando endpoints alternativos para dados históricos`);
      
      // Endpoint alternativo que retorna todas as roletas com seus números
      const response = await fetch(`${apiBaseUrl}/roletas-com-numeros`);
      
      if (!response.ok) {
        throw new Error(`Falha ao buscar dados históricos alternativos: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && Array.isArray(data)) {
        let validRoulettesCount = 0;
        
        data.forEach(roulette => {
          // Verificar se a roleta tem ID válido e números
          // Verificar vários campos possíveis de ID
          const roletaId = roulette._id || roulette.id || roulette.gameId || roulette.table_id || roulette.tableId;
          
          if (!roletaId) {
            console.warn(`[SocketService] Ignorando roleta alternativa sem ID válido: ${roulette.nome || roulette.name || 'desconhecida'}`);
            return;
          }
          
          // Adicionar o ID encontrado ao objeto da roleta para garantir que '_id' exista
          roulette._id = roletaId;
          
          if (roulette && (roulette.nome || roulette.name) && Array.isArray(roulette.numeros)) {
            validRoulettesCount++;
            roulette.numeros.forEach(numero => {
              const event: RouletteNumberEvent = {
                type: 'new_number',
                roleta_id: roulette._id,
                roleta_nome: roulette.nome || roulette.name,
                numero: numero,
                timestamp: new Date().toISOString()
              };
              
              this.notifyListeners(event);
            });
          }
        });
        
        console.log(`[SocketService] Processadas ${validRoulettesCount} roletas válidas de fonte alternativa`);
      } else {
        console.warn('[SocketService] Resposta alternativa inválida:', data);
        
        // Se estamos em desenvolvimento, usar dados simulados como último recurso
        if (!isProduction) {
          this.loadMockDataInDevelopment();
        }
      }
    } catch (error) {
      console.error('[SocketService] Erro ao tentar endpoints alternativos:', error);
      
      // Em último caso, usar dados simulados em desenvolvimento
      if (!isProduction) {
        this.loadMockDataInDevelopment();
      }
    }
  }

  // Carregar dados simulados apenas em desenvolvimento se tudo falhar
  private loadMockDataInDevelopment(): void {
    if (!isProduction) {
      console.log('[SocketService] Carregando dados simulados para ambiente de desenvolvimento');
      
      const mockRoulettes = [
        { id: 'roulette-1', name: 'Brazilian Mega Roulette', numbers: [1, 7, 13, 36, 24, 17] },
        { id: 'roulette-2', name: 'Speed Auto Roulette', numbers: [0, 32, 15, 19, 4, 21] },
        { id: 'roulette-3', name: 'Bucharest Auto-Roulette', numbers: [26, 3, 35, 12, 28, 5] }
      ];
      
      // Processar os dados simulados
      mockRoulettes.forEach(roulette => {
        console.log(`[SocketService] Processando dados simulados para ${roulette.name}`);
        
        // Enviar cada número como um evento separado
        roulette.numbers.forEach(num => {
          const event: RouletteNumberEvent = {
            type: 'new_number',
            roleta_id: roulette.id,
            roleta_nome: roulette.name,
            numero: num,
            timestamp: new Date().toISOString()
          };
          
          // Notificar os listeners
          this.notifyListeners(event);
        });
      });
    }
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
      if (this.socket && this.isConnected) {
        this.socket.emit('ping');
      }
    }, 30000);
  }

  // Adicionar um método para verificar a conexão
  public isConnectionActive(): boolean {
    return this.isConnected;
  }

  // Verifica se temos conexão ativa
  private checkSocketConnection(): boolean {
    return this.isConnected && !!this.socket;
  }

  // Métodos adicionais para compatibilidade com qualquer código antigo
  public getIsConnectedStatusDeprecated(): boolean {
    console.warn('[SocketService] Método obsoleto isConnected() chamado. Use isConnectionActive() ou checkSocketConnection() em vez disso.');
    return this.isConnected;
  }
}

export default SocketService; 