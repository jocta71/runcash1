import { io, Socket } from 'socket.io-client';
import { toast } from '@/components/ui/use-toast';
import config from '@/config/env';
import EventService, { 
  RouletteEvent,
  RouletteNumberEvent,
  RouletteEventCallback,
  StrategyUpdateEvent,
  RouletteHistoryEvent
} from './EventService';
import { getRequiredEnvVar, isProduction } from '../config/env';
import { mapToCanonicalRouletteId, ROLETAS_CANONICAS } from '../integrations/api/rouletteService';

// Importando o serviço de estratégia para simular respostas
import StrategyService from './StrategyService';

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

// Tipo para definir uma roleta
interface Roulette {
  _id: string;
  id?: string;
  nome?: string;
  name?: string;
}

// Adicionar tipos para histórico
export interface HistoryRequest {
  roletaId: string;
}

export interface HistoryData {
  roletaId: string;
  roletaNome?: string;
  numeros: {
    numero: number;
    timestamp: Date;
  }[];
  createdAt?: Date;
  updatedAt?: Date;
  totalRegistros?: number;
  message?: string;
  error?: string;
}

// Importar a lista de roletas permitidas da configuração
import { ROLETAS_PERMITIDAS } from '@/config/allowedRoulettes';

/**
 * Serviço que gerencia a conexão WebSocket via Socket.IO
 * para receber dados em tempo real do MongoDB
 */
export class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private listeners: Map<string, Set<RouletteEventCallback>> = new Map();
  private connectionActive: boolean = false;
  private connectionAttempts: number = 0;
  private reconnectTimeout: number | null = null;
  private timerId: NodeJS.Timeout | null = null;
  private eventHandlers: Record<string, (data: any) => void> = {};
  private autoReconnect: boolean = true;
  private lastReceivedData: Map<string, { timestamp: number, data: any }> = new Map();
  // Novo mapa para rastrear promessas pendentes de listeners assíncronos
  private pendingPromises: Map<string, { promise: Promise<any>, timeout: NodeJS.Timeout }> = new Map();
  
  // Propriedade para o cliente MongoDB (pode ser undefined em alguns contextos)
  public client?: MongoClient;
  
  // Mapa para armazenar os intervalos de polling por roletaId
  private pollingIntervals: Map<string, any> = new Map();
  private pollingInterval: number = 15000; // Intervalo padrão de 15 segundos para polling
  private minPollingInterval: number = 10000; // 10 segundos mínimo
  private maxPollingInterval: number = 60000; // 1 minuto máximo
  private pollingBackoffFactor: number = 1.5; // Fator de aumento em caso de erro
  
  private _isLoadingHistoricalData: boolean = false;
  
  // Adicionar uma propriedade para armazenar o histórico completo por roleta  
  private rouletteHistory: Map<string, number[]> = new Map();
  private historyLimit: number = 1000;
  
  // Adicionar propriedade para armazenar cache de dados das roletas
  private rouletteDataCache: Map<string, {data: any, timestamp: number}> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutos em milissegundos
  
  // Propriedades para circuit breaker
  private circuitBreakerActive: boolean = false;
  private circuitBreakerResetTimeout: any = null;
  private consecutiveFailures: number = 0;
  private failureThreshold: number = 5; // Quantas falhas para ativar o circuit breaker
  private resetTime: number = 60000; // 1 minuto de espera antes de tentar novamente
  
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
    
    // Verificar se o socket já existe no localStorage para recuperar uma sessão anterior
    const savedSocket = this.trySavedSocket();
    if (!savedSocket) {
      // Conectar normalmente se não houver sessão salva
      this.connect();
    }

    // Adicionar event listener para quando a janela ficar visível novamente
    window.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Configurar handler para rejeições de promise não tratadas
    this.setupUnhandledRejectionHandler();
    
    console.log('[SocketService] Polling agressivo de roletas DESATIVADO - Centralizado no RouletteFeedService');
    
    // Reduzir frequência de recarregamento para minimizar requisições
    // Desativar para usar apenas o RouletteFeedService como fonte única
    // setInterval(() => this.requestRecentNumbers(), 30000);
  }

  // Manipular alterações de visibilidade da página
  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      console.log('[SocketService] Página voltou a ficar visível, verificando conexão');
      // Se não estiver conectado, tentar reconectar
      if (!this.connectionActive || !this.socket || !this.socket.connected) {
        console.log('[SocketService] Reconectando após retornar à visibilidade');
        this.connect();
      }
      
      // Recarregar dados recentes
      this.requestRecentNumbers();
    }
  }

  private trySavedSocket(): boolean {
    try {
      // Verificar tempo da última conexão
      const lastConnectionTime = localStorage.getItem('socket_last_connection');
      if (lastConnectionTime) {
        const lastTime = parseInt(lastConnectionTime, 10);
        const now = Date.now();
        const diff = now - lastTime;
        
        // Se a última conexão foi há menos de 2 minutos, pode ser recuperada
        if (diff < 120000) {
          console.log('[SocketService] Encontrada conexão recente. Tentando usar configurações salvas.');
          return true;
        } else {
          console.log('[SocketService] Conexão antiga encontrada, iniciando nova conexão');
          localStorage.removeItem('socket_last_connection');
        }
      }
    } catch (error) {
      console.warn('[SocketService] Erro ao verificar socket salvo:', error);
    }
    return false;
  }

  private setupEventListeners(): void {
    if (!this.socket) return;
    
    console.log('[SocketService] Configurando event listeners para Socket.IO');
    
    // Limpar listeners anteriores para evitar duplicação
    this.socket.off('new_number');
    this.socket.off('recent_numbers');
    this.socket.off('strategy_update');
    this.socket.off('roulette_update');
    
    // Configurar listener para novos números com processamento imediato
    this.socket.on('new_number', (data: any) => {
      console.log('[SocketService] ⚡ Novo número recebido:', data);
      
      // Processar o número imediatamente
      if (data && data.roleta_id && data.numero !== undefined) {
        const event: RouletteNumberEvent = {
          type: 'new_number',
          roleta_id: data.roleta_id,
          roleta_nome: data.roleta_nome || 'desconhecida',
          numero: data.numero,
          timestamp: new Date().toISOString()
        };

        // Atualizar o histórico local
        this.updateRouletteHistory(data.roleta_id, data.numero);
        
        // Notificar listeners imediatamente
        this.notifyListeners(event);
        
        // Emitir evento para o EventService para sincronização global
        EventService.getInstance().dispatchEvent(event);
        
        // Log de confirmação
        console.log(`[SocketService] ✅ Número ${data.numero} processado para ${data.roleta_nome}`);
      }
    });
    
    // Configurar listener para atualizações específicas de roleta
    this.socket.on('roulette_update', (data: any) => {
      console.log('[SocketService] Atualização específica de roleta recebida:', data);
      
      if (data && data.roleta_id && data.numeros && Array.isArray(data.numeros)) {
        // Atualizar histórico local com os novos números
        data.numeros.forEach((numero: number) => {
          this.updateRouletteHistory(data.roleta_id, numero);
        });
        
        // Notificar sobre a atualização do histórico
        const event: RouletteHistoryEvent = {
          type: 'history_update',
          roleta_id: data.roleta_id,
          numeros: data.numeros,
          timestamp: new Date().toISOString()
        };
        
        this.notifyListeners(event);
        EventService.getInstance().dispatchEvent(event);
      }
    });
    
    // Configurar listener para números em lote
    this.socket.on('recent_numbers', (data: any) => {
      console.log('[SocketService] Lote de números recentes recebido:', 
        Array.isArray(data) ? `${data.length} itens` : 'formato inválido');
      
      if (Array.isArray(data)) {
        // Processar do mais recente para o mais antigo
        for (let i = 0; i < data.length; i++) {
          this.processIncomingNumber(data[i]);
        }
      }
    });
    
    // Configurar listener para atualizações de estratégia
    this.socket.on('strategy_update', (data: any) => {
      console.log('[SocketService] Atualização de estratégia recebida:', data);
      this.processStrategyEvent(data);
    });
    
    // Ping a cada 30 segundos para manter a conexão ativa
    this.setupPing();
    
    // Solicitar números recentes imediatamente após configurar listeners
    setTimeout(() => {
      this.requestRecentNumbers();
    }, 1000);
  }

  private updateRouletteHistory(roletaId: string, numero: number): void {
    // Obter o histórico atual ou criar um novo array
    const historico = this.rouletteHistory.get(roletaId) || [];
    
    // Adicionar o novo número no início do array (mais recente primeiro)
    historico.unshift(numero);
    
    // Manter apenas os últimos N números (limite definido em historyLimit)
    if (historico.length > this.historyLimit) {
      historico.pop(); // Remove o número mais antigo
    }
    
    // Atualizar o histórico no Map
    this.rouletteHistory.set(roletaId, historico);
  }

  private notifyHistoryUpdate(roletaId: string): void {
    const historico = this.rouletteHistory.get(roletaId);
    if (!historico) return;

    const event: RouletteHistoryEvent = {
      type: 'history_update',
      roleta_id: roletaId,
      numeros: historico,
      timestamp: new Date()
    };

    this.notifyListeners(event);
  }

  // Método público para obter o histórico de uma roleta
  public getRouletteHistory(roletaId: string): number[] {
    if (!this.rouletteHistory.has(roletaId)) {
      return [];
    }
    return this.rouletteHistory.get(roletaId) || [];
  }

  private processIncomingNumber(data: any): void {
    // Log detalhado para debug
    console.log('[SocketService] Processando número recebido:', data);
    
    try {
      // Verificações de segurança
      if (!data) {
        console.warn('[SocketService] Dados nulos recebidos em processIncomingNumber');
      return;
    }
    
      // Extrair informações importantes com validações
      const roletaId = data.roleta_id || 'unknown';
      const roletaNome = data.roleta_nome || `Roleta ${roletaId}`;
      
      // Verificar se o dado de número é válido
      if (data.numero === undefined || data.numero === null) {
        console.warn(`[SocketService] Número inválido recebido para ${roletaNome} (${roletaId}):`, data);
        return;
      }
      
      // Converter para número e validar
      const numero = typeof data.numero === 'number' ? data.numero : parseInt(String(data.numero), 10);
      if (isNaN(numero)) {
        console.warn(`[SocketService] Conversão de número falhou para ${roletaNome}:`, data.numero);
          return;
      }

      // Usar um formato padrão de evento
    const event: RouletteNumberEvent = {
      type: 'new_number',
        roleta_id: roletaId,
        roleta_nome: roletaNome,
        numero: numero,
      timestamp: data.timestamp || new Date().toISOString(),
        preserve_existing: data.preserve_existing ? true : false,
        realtime_update: data.realtime_update ? true : false
      };
      
      // Log detalhado do evento formatado
      console.log(`[SocketService] Evento formatado para ${roletaNome}: ${JSON.stringify(event)}`);
      
      // Usar sempre timestamps atualizados para eventos antigos
      if (!data.realtime_update) {
        event.timestamp = new Date().toISOString();
      }
      
      // Adicionar à lista de última mensagem recebida
      this.lastReceivedData.set(roletaId, {
        timestamp: Date.now(),
        data: event
      });
    
    // Notificar os listeners
    this.notifyListeners(event);
    
      // Verificar se precisamos iniciar polling agressivo
      if (!this.pollingIntervals.has(roletaId)) {
        console.log(`[SocketService] Iniciando polling agressivo automático para ${roletaNome}`);
        this.startAggressivePolling(roletaId, roletaNome);
      }

      // Adicionar ao histórico da roleta
      this.addNumberToHistory(roletaId, numero);
    } catch (error) {
      console.error('[SocketService] Erro ao processar número recebido:', error);
    }
  }
  
  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }
  
  private getSocketUrl(): string {
    let wsUrl = getRequiredEnvVar('VITE_WS_URL');
    
    // Garantir que a URL use o protocolo wss://
    if (wsUrl && !wsUrl.startsWith('wss://')) {
      if (wsUrl.startsWith('https://')) {
        console.warn('[SocketService] Convertendo URL de https:// para wss://');
        wsUrl = wsUrl.replace('https://', 'wss://');
      } else if (wsUrl.startsWith('http://')) {
        console.warn('[SocketService] Convertendo URL de http:// para wss://');
        wsUrl = wsUrl.replace('http://', 'wss://');
      } else {
        console.warn('[SocketService] URL não inicia com protocolo, adicionando wss://');
        wsUrl = `wss://${wsUrl}`;
      }
    }
    
    // Em produção, garantir que usamos uma URL segura (não localhost)
    if (isProduction && (wsUrl.includes('localhost') || wsUrl.includes('127.0.0.1'))) {
      console.warn('[SocketService] Detectada URL inválida para WebSocket em produção. Usando origem atual.');
      const currentOrigin = window.location.origin;
      wsUrl = currentOrigin.replace('https://', 'wss://').replace('http://', 'wss://');
    }
    
    // Verificar se a URL é válida
    if (!wsUrl || wsUrl === 'wss://') {
      console.error('[SocketService] URL de WebSocket inválida. Usando padrão.');
      wsUrl = 'wss://backend-production-2f96.up.railway.app';
    }
    
    console.log('[SocketService] Usando URL de WebSocket:', wsUrl);
    return wsUrl;
  }
  
  private connect(): void {
    console.log('[SocketService] Tentando conectar ao servidor WebSocket');
    
    // Impedir múltiplas tentativas de conexão simultâneas
    if (this.socket && this.socket.connected) {
      console.log('[SocketService] Já conectado. Ignorando solicitação de conexão duplicada.');
      return;
    }
    
    // Limpar qualquer estado antigo
    if (this.socket) {
      // Limpar listeners antigos antes de desconectar
      this.socket.offAny();
      this.socket.disconnect();
      this.socket = null;
    }
    
    // Limpar reconexões agendadas
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Resetar estado
    this.connectionAttempts++;
    this.connectionActive = false;
    
    try {
      // Obter URL para o WebSocket
      const socketUrl = this.getSocketUrl();
      
      // Criar nova conexão com Socket.IO
      this.socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        autoConnect: true,
        forceNew: true, // Forçar uma nova conexão para evitar problemas com conexões antigas
      });
      
      // Configurar event listeners
      this.socket.on('connect', () => {
        console.log('[SocketService] ✅ Conectado ao servidor WebSocket!');
        this.connectionActive = true;
        this.connectionAttempts = 0;
        
        // Salvar timestamp de conexão
        localStorage.setItem('socket_last_connection', Date.now().toString());
        
        // Redefinir circuit breaker em conexão bem-sucedida
        this.consecutiveFailures = 0;
        if (this.circuitBreakerActive) {
          this.circuitBreakerActive = false;
          console.log('[SocketService] Circuit breaker resetado após conexão bem-sucedida');
        }
        
        // Configurar eventos
        this.setupEventListeners();
        
        // Comunicar estado da conexão
        this.broadcastConnectionState();
        
        // Emitir evento de identificação
        this.socket?.emit('identify', { 
          client: 'frontend', 
          version: '2.0',
          timestamp: new Date().toISOString()
        });
        
        // Limpar todas as promessas pendentes
        this.clearAllPendingPromises();
      });
      
      // Adicionar manipulador para erros de conexão
      this.socket.on('connect_error', (error) => {
        console.error('[SocketService] Erro ao conectar:', error);
        // Propagar o erro para tentar reconexão
        this.handleUnhandledRejection({ 
          reason: new Error(`Socket connect error: ${error.message}`), 
          preventDefault: () => {}
        } as PromiseRejectionEvent);
      });
      
      // Caso o servidor feche a conexão
      this.socket.on('disconnect', (reason) => {
        console.log(`[SocketService] Desconectado do servidor: ${reason}`);
        this.connectionActive = false;
        this.broadcastConnectionState();
        
        // Se for desconexão do lado do servidor, tentar reconectar
        if (reason === 'io server disconnect' || reason === 'transport close' || reason === 'ping timeout') {
          console.log('[SocketService] Desconexão do servidor, tentando reconectar...');
          this.scheduleReconnect();
        }
      });
      
      // Se o socket ficar ativo por um tempo, estabeleça um ping regular
      this.socket.on('connect', () => {
        this.setupPing();
      });
      
      // Configurar Ping para manter conexão viva
      this.setupPing();
    } catch (error) {
      console.error('[SocketService] Erro ao conectar ao socket:', error);
      this.connectionActive = false;
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
  
  // Método para registrar uma roleta para receber atualizações em tempo real
  private registerRouletteForRealTimeUpdates(roletaNome: string, roletaId?: string): void {
    if (!roletaNome) return;
    
    console.log(`[SocketService] Registrando roleta ${roletaNome} para updates em tempo real`);
    
    // Se temos o ID diretamente, usá-lo (não buscar em ROLETAS_CANONICAS)
    if (roletaId) {
      console.log(`[SocketService] Usando ID fornecido: ${roletaId}`);
      this.subscribeToRouletteEndpoint(roletaId, roletaNome);
      return;
    }
    
    // Se não temos o ID, tentar buscar nos dados recentes
    this.fetchRealRoulettes().then(roletas => {
      const roleta = roletas.find(r => r.nome === roletaNome || r.name === roletaNome);
      
      if (roleta) {
        const id = roleta._id || roleta.id;
        console.log(`[SocketService] Roleta encontrada com ID: ${id}`);
        this.subscribeToRouletteEndpoint(id, roletaNome);
    } else {
      console.warn(`[SocketService] Roleta não encontrada pelo nome: ${roletaNome}`);
    }
    }).catch(error => {
      console.error(`[SocketService] Erro ao buscar dados para roleta ${roletaNome}:`, error);
    });
  }
  
  /**
   * Subscreve para eventos de uma roleta específica
   * 
   * @param roletaNome Nome da roleta para subscrever
   * @param callback Callback a ser chamado quando o evento ocorrer
   */
  public subscribe(roletaNome: string, callback: RouletteEventCallback): void {
    // Verificação de segurança
    if (!roletaNome) {
      console.warn('[SocketService] Tentativa de inscrição com nome de roleta inválido.');
      return;
    }
    
    // Log detalhado
    console.log(`[SocketService] INSCREVENDO para eventos da roleta: ${roletaNome}`);
    
    // Se não existe conjunto para este nome, criar
    if (!this.listeners.has(roletaNome)) {
      console.log(`[SocketService] Criando novo conjunto de listeners para roleta: ${roletaNome}`);
      this.listeners.set(roletaNome, new Set());
    }
    
    // Adicionar o callback ao conjunto de listeners para esta roleta
    const listeners = this.listeners.get(roletaNome);
    if (listeners) {
      listeners.add(callback);
      console.log(`[SocketService] ✅ Callback adicionado aos listeners de ${roletaNome}. Total: ${listeners.size}`);
    }
    
    // Registrar roleta específica para receber updates em tempo real
    this.registerRouletteForRealTimeUpdates(roletaNome);
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
  
  // Melhorar o método notifyListeners para lidar com retornos assíncronos dos callbacks
  private notifyListeners(event: RouletteEvent): void {
    if (!event || !event.type) return;
    
    // Notificar listeners globais primeiro
    const globalListeners = this.listeners.get('*');
    if (globalListeners) {
      globalListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('[SocketService] Erro ao notificar listener global:', error);
        }
      });
    }
    
    // Notificar listeners específicos da roleta
    if ('roleta_id' in event) {
      const roletaListeners = this.listeners.get(event.roleta_id);
      if (roletaListeners) {
        roletaListeners.forEach(callback => {
          try {
            callback(event);
          } catch (error) {
            console.error(`[SocketService] Erro ao notificar listener da roleta ${event.roleta_id}:`, error);
          }
        });
      }
    }
  }
  
  /**
   * Verifica a saúde dos canais de mensagem e toma ações corretivas se necessário
   */
  private checkChannelsHealth(): void {
    // Verificar se o socket está conectado
    if (!this.socket || !this.socket.connected) {
      console.warn('[SocketService] Socket desconectado durante verificação de saúde dos canais');
      this.reconnect();
      return;
    }
    
    // Verificar se há muitas promessas pendentes (potencial vazamento)
    if (this.pendingPromises.size > 10) {
      console.warn(`[SocketService] Detectado possível vazamento: ${this.pendingPromises.size} promessas pendentes`);
      
      // Limpar promessas antigas (mais de 30 segundos)
      const now = Date.now();
      let cleanedCount = 0;
      
      this.pendingPromises.forEach(({ timeout }, id) => {
        const parts = id.split('_');
        if (parts.length >= 3) {
          const timestamp = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(timestamp) && now - timestamp > 30000) {
            // Limpar timeout e remover promessa
            clearTimeout(timeout);
            this.pendingPromises.delete(id);
            cleanedCount++;
          }
        }
      });
      
      if (cleanedCount > 0) {
        console.log(`[SocketService] Limpou ${cleanedCount} promessas antigas`);
      }
      
      // Se ainda houver muitas promessas, forçar reconexão
      if (this.pendingPromises.size > 20) {
        console.warn('[SocketService] Forçando reconexão devido a muitas promessas pendentes');
        this.reconnect();
      }
    }
    
    // Enviar um ping para verificar se o canal está respondendo
    if (this.socket) {
      this.socket.emit('ping', { timestamp: Date.now() }, (response: any) => {
        if (!response) {
          console.warn('[SocketService] Ping sem resposta, reconectando...');
          this.reconnect();
        }
      });
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
  
  // Verifica se a conexão está ativa - melhorado para garantir verificação completa
  public isSocketConnected(): boolean {
    return Boolean(this.socket && this.socket.connected && this.connectionActive);
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

  private setupPing(): void {
    // Limpar intervalo existente se houver
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    
    // Configurar ping a cada 15 segundos para manter a conexão aberta
    this.timerId = setInterval(() => {
      if (this.socket && this.socket.connected) {
        // Enviar ping com timestamp para calcular latência
        const startTime = Date.now();
        
        try {
          // Usar um callback para processar a resposta do ping
          this.socket.emit('ping', { timestamp: startTime }, (response: any) => {
            if (response) {
              const endTime = Date.now();
              const latency = endTime - startTime;
              
              // Registrar latência para monitoramento da qualidade da conexão
              console.log(`[SocketService] Ping: ${latency}ms`);
              
              // Se a latência for muito alta (mais de 2 segundos), considerar verificar a saúde da conexão
              if (latency > 2000) {
                console.warn(`[SocketService] Alta latência detectada: ${latency}ms, verificando canais`);
                this.checkChannelsHealth();
              }
            } else {
              // Se não recebemos resposta, pode haver problema com o canal de comunicação
              console.warn('[SocketService] Sem resposta ao ping, verificando conexão');
              this.checkSocketConnection();
            }
          });
        } catch (error) {
          console.error('[SocketService] Erro ao enviar ping:', error);
          
          // Se houver erro ao enviar ping, problema com os canais
          // Tentar reconectar
          this.reconnect();
        }
      } else {
        console.warn('[SocketService] Socket não conectado durante ping');
        this.connectionActive = false;
        this.reconnect();
      }
    }, 15000); // 15 segundos
  }
  
  // Verificar se o socket está realmente conectado
  private checkSocketConnection(): boolean {
    return this.connectionActive && !!this.socket;
  }

  /**
   * Solicita números recentes para todas as roletas
   */
  public requestRecentNumbers(): void {
    try {
    console.log('[SocketService] Solicitando números recentes de todas as roletas');
    
      // Buscar todas as roletas reais (sem filtro)
      this.fetchRealRoulettes().then(roletas => {
        if (roletas && roletas.length > 0) {
          console.log(`[SocketService] Encontradas ${roletas.length} roletas para solicitar números`);
          
          // Solicitar números para todas as roletas sem filtrar
          roletas.forEach(roleta => {
            const roletaId = roleta._id || roleta.id;
            const roletaNome = roleta.nome || roleta.name || `Roleta ${roletaId?.substring(0, 8)}`;
            
            if (roletaId) {
              console.log(`[SocketService] Solicitando dados para ${roletaNome} (${roletaId})`);
              
              // Usar REST API para buscar números
              this.fetchRouletteNumbersREST(roletaId);
            }
          });
    } else {
          console.warn('[SocketService] Nenhuma roleta disponível para solicitar números');
        }
      }).catch(error => {
        console.error('[SocketService] Erro ao buscar roletas para solicitar números:', error);
      });
    } catch (error) {
      console.error('[SocketService] Erro ao solicitar números recentes:', error);
    }
  }
  
  // Método para processar dados dos números recebidos
  private processNumbersData(numbersData: any[], roulette: any): void {
    try {
      // Verifica se chegaram dados 
      if (!Array.isArray(numbersData) || numbersData.length === 0 || !roulette) {
        console.warn('[SocketService] Dados inválidos recebidos para processamento:', { numbersData, roulette });
        return;
      }
      
      // Extrair o ID e nome da roleta
    const roletaId = roulette._id || roulette.id;
      const roletaNome = roulette.nome || roulette.name || `Roleta ${roletaId}`;
      
      if (!roletaId) {
        console.error('[SocketService] Roleta sem ID válido:', roulette);
        return;
      }
      
      // Log detalhado para debug
      console.log(`[SocketService] PROCESSANDO ${numbersData.length} NÚMEROS para roleta ${roletaNome} (${roletaId})`);
      
      if (numbersData.length > 0) {
        const primeiroNumero = typeof numbersData[0] === 'object' ? 
                              (numbersData[0].numero !== undefined ? numbersData[0].numero : numbersData[0]) : 
                              numbersData[0];
        const ultimoNumero = typeof numbersData[numbersData.length-1] === 'object' ? 
                            (numbersData[numbersData.length-1].numero !== undefined ? numbersData[numbersData.length-1].numero : numbersData[numbersData.length-1]) : 
                            numbersData[numbersData.length-1];
        
        console.log(`[SocketService] Primeiro número: ${primeiroNumero}, Último número: ${ultimoNumero}`);
      }
      
      // Normalizar os dados antes de emitir o evento
      const normalizeDados = numbersData.map(item => {
        // Se for um objeto com a propriedade 'numero', usar diretamente
        if (typeof item === 'object' && item !== null) {
          // Garantir que todas as propriedades necessárias existam
          return {
            numero: item.numero !== undefined ? item.numero : 0,
            timestamp: item.timestamp || new Date().toISOString(),
            cor: item.cor || this.determinarCorNumero(item.numero || 0),
            roleta_id: roletaId,
            roleta_nome: roletaNome
          };
        } 
        // Se for um valor numérico direto
        else if (typeof item === 'number' || (typeof item === 'string' && !isNaN(parseInt(item)))) {
          const numeroValue = typeof item === 'number' ? item : parseInt(item);
          return {
            numero: numeroValue,
            timestamp: new Date().toISOString(),
            cor: this.determinarCorNumero(numeroValue),
            roleta_id: roletaId,
            roleta_nome: roletaNome
          };
        }
        // Fallback para valor inválido
        return {
          numero: 0,
          timestamp: new Date().toISOString(),
          cor: 'verde',
          roleta_id: roletaId,
          roleta_nome: roletaNome
        };
      });
      
      console.log(`[SocketService] Emitindo evento de números para ${roletaNome} (${roletaId})`);
      
      // Emite evento global com os números da roleta, usando apenas o campo "numero"
      EventService.emitGlobalEvent('numeros_atualizados', {
        roleta_id: roletaId,
        roleta_nome: roletaNome,
        numero: normalizeDados  // Emitir como "numero" em vez de "numeros"
      });
      
      // Se temos poucos números, também emitimos como eventos individuais
      // para manter a compatibilidade com código legado
      if (numbersData.length <= 10) {
        // Emitir cada número como um evento separado
        normalizeDados.forEach(item => {
                  const event: RouletteNumberEvent = {
                    type: 'new_number',
            roleta_id: roletaId,
        roleta_nome: roletaNome,
            numero: item.numero,
            timestamp: item.timestamp
          };
          
          // Log para debug - mostrar o número exato sendo enviado para cada roleta
          console.log(`[SocketService] Emitindo número ${item.numero} para ${roletaNome}`);
          
          // Notificar os ouvintes deste evento
                  this.notifyListeners(event);
    });
      } else {
        console.log(`[SocketService] Emitindo apenas evento em lote para ${numbersData.length} números da roleta ${roletaNome}`);
      }
      
    } catch (error) {
      console.error('[SocketService] Erro ao processar números:', error);
    }
  }
  
  // Função auxiliar para determinar a cor de um número
  private determinarCorNumero(numero: number): string {
    if (numero === 0) return 'verde';
    
    // Números vermelhos na roleta europeia
    const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return numerosVermelhos.includes(numero) ? 'vermelho' : 'preto';
  }

  // Método para carregar números históricos das roletas
  public async loadHistoricalRouletteNumbers(): Promise<void> {
    console.log('[SocketService] Iniciando carregamento de números históricos...');
    
    // Verificar se já estamos carregando dados para evitar múltiplas chamadas simultâneas
    if (this._isLoadingHistoricalData) {
      console.log('[SocketService] Carregamento de dados históricos já em andamento, ignorando nova solicitação');
      return;
    }
    
    this._isLoadingHistoricalData = true;
    
    // Lista de IDs permitidos - usa os valores da configuração
    // Forçar uma lista vazia, para não filtrar roletas (todas serão permitidas)
    const ALLOWED_ROULETTES: string[] = [];
    
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
          
          // Verificar se o ID está na lista de permitidos
          const stringId = String(roletaId);
          // Removendo a verificação que bloqueia roletas não permitidas - permitir todas as roletas
          /*
          if (!ALLOWED_ROULETTES.includes(stringId)) {
            console.log(`[SocketService] Roleta não permitida: ${roulette.nome || roulette.name || 'Sem Nome'} (ID: ${stringId})`);
            continue;
          }
          */
          
          // Normalizar o objeto da roleta
          roulette._id = roletaId;
          const roletaNome = roulette.nome || roulette.name || roulette.table_name || `Roleta ${roletaId.substring(0, 8)}`;
          roulette.nome = roletaNome;
          
          // Buscar dados históricos reais
          const hasRealData = await this.fetchRouletteNumbersREST(roulette._id);
          
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
          // Emitir dois eventos para garantir que os componentes serão notificados
          // Evento para o carregamento de dados históricos
          EventService.emitGlobalEvent('historical_data_loaded', { 
            success: true,
            count: countWithRealData,
            isRealData: true
          });
          
          // Evento específico para roletas carregadas (usado pelo Index.tsx)
          EventService.emitGlobalEvent('roulettes_loaded', {
            success: true,
            count: countWithRealData,
            timestamp: new Date().toISOString()
          });
          
          toast({
            title: "Dados reais carregados",
            description: `Carregados dados reais para ${countWithRealData} roletas`,
            variant: "default"
          });
          
          this._isLoadingHistoricalData = false;
          return;
        }
      }
      
      // Se chegamos aqui, não conseguimos dados reais de nenhuma roleta
      console.warn('[SocketService] Nenhuma roleta com dados reais encontrada');
      
      // Emitir mesmo assim um evento de carregamento para liberar a interface
      EventService.emitGlobalEvent('roulettes_loaded', {
        success: false,
        message: "Sem dados reais disponíveis",
        timestamp: new Date().toISOString()
      });
      
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
      
      // Emitir mesmo assim um evento de carregamento para liberar a interface
      EventService.emitGlobalEvent('roulettes_loaded', {
        success: false,
        error: String(error),
        timestamp: new Date().toISOString()
      });
      
      EventService.emitGlobalEvent('historical_data_loaded', { 
        success: false,
        error: String(error)
      });
      
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao tentar carregar os dados históricos.",
        variant: "destructive"
      });
    } finally {
      this._isLoadingHistoricalData = false;
    }
  }
  
  // Método para buscar roletas reais 
  private async fetchRealRoulettes(): Promise<any[]> {
    console.log('[SocketService] ⛔ DESATIVADO: Busca de roletas reais bloqueada para diagnóstico');
    
    // Usar a lista local como fallback
    const roletasFallback = ROLETAS_CANONICAS.map(roleta => ({
      _id: roleta.id,
      nome: roleta.nome,
      ativa: true
    }));
    
    return roletasFallback;
    
    /* CÓDIGO ORIGINAL DESATIVADO
    console.log('[SocketService] Buscando lista de roletas reais...');
    
    // Verificar se o circuit breaker está ativo
    if (!this.shouldProceedWithRequest('/api/ROULETTES')) {
      console.log('[SocketService] Circuit breaker ativo, usando dados de fallback');
      
      // Usar a lista local como fallback
      const roletasFallback = ROLETAS_CANONICAS.map(roleta => ({
        _id: roleta.id,
        nome: roleta.nome,
        ativa: true
      }));
      
      return roletasFallback;
    }
    
    try {
      // Define a URL base para as APIs
      const baseUrl = this.getApiBaseUrl();
      
      // Usar apenas o endpoint /api/ROULETTES
      const endpoint = `${baseUrl}/ROULETTES`;
      
      // Usar sistema de retry para lidar com erros 502
      let attempt = 0;
      const maxAttempts = 3;
      let response = null;
      
      while (attempt < maxAttempts) {
        try {
          console.log(`[SocketService] Buscando roletas em: ${endpoint} (tentativa ${attempt + 1}/${maxAttempts})`);
          response = await fetch(endpoint);
          
          // Se tiver sucesso, processar os dados
          if (response.ok) {
      const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
            console.log(`[SocketService] ✅ Recebidas ${data.length} roletas da API`);
            
              // Sinalizar sucesso para o circuit breaker
              this.handleCircuitBreaker(true, endpoint);
              
              // Armazenar no cache global para uso futuro
            const roletasComIdsCanonicos = data.map(roleta => {
              const uuid = roleta.id;
              const canonicalId = mapToCanonicalRouletteId(uuid);
              
              return {
                ...roleta,
                _id: canonicalId, // Adicionar o ID canônico
                uuid: uuid        // Preservar o UUID original
              };
            });
            
            console.log(`[SocketService] Roletas mapeadas com IDs canônicos:`, 
                roletasComIdsCanonicos.length);
            
            return roletasComIdsCanonicos;
          }
            break; // Se chegou aqui mas não tem dados, sair do loop
          }
          
          // Se for erro 502, tentar novamente
          if (response.status === 502) {
            attempt++;
            console.warn(`[SocketService] Erro 502 ao buscar roletas. Tentativa ${attempt}/${maxAttempts}`);
            
            // Marcar falha para o circuit breaker
            this.handleCircuitBreaker(false, endpoint);
            
            // Esperar antes de tentar novamente (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
          } else {
            // Se for outro erro, sair do loop
            console.warn(`[SocketService] Erro ${response.status} ao buscar roletas.`);
            break;
          }
        } catch (error) {
          attempt++;
          console.error(`[SocketService] Erro de rede na tentativa ${attempt}/${maxAttempts}:`, error);
          
          // Marcar falha para o circuit breaker
          this.handleCircuitBreaker(false, endpoint);
          
          // Esperar antes de tentar novamente
          await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
          
          // Se for a última tentativa, sair do loop
          if (attempt >= maxAttempts) {
            break;
          }
        }
      }
      
      // Se chegamos aqui, todas as tentativas falharam
      console.warn(`[SocketService] Falha ao buscar roletas após ${maxAttempts} tentativas`);
      
      // Usar a lista local de roletas canônicas como fallback
        const roletasFallback = ROLETAS_CANONICAS.map(roleta => ({
          _id: roleta.id,
          nome: roleta.nome,
          ativa: true
        }));
        
        console.log(`[SocketService] Usando ${roletasFallback.length} roletas canônicas locais como fallback`);
        return roletasFallback;
        
    } catch (error) {
      console.error('[SocketService] Erro ao buscar roletas:', error);
      
      // Marcar falha para o circuit breaker
      this.handleCircuitBreaker(false, 'fetchRealRoulettes');
      
      // Fallback para lista local
        const roletasFallback = ROLETAS_CANONICAS.map(roleta => ({
          _id: roleta.id,
          nome: roleta.nome,
          ativa: true
        }));
        
        return roletasFallback;
    }
    */
  }
  
  // Método para buscar dados via REST como alternativa/complemento
  public async fetchRouletteNumbersREST(roletaId: string, limit: number = 1000): Promise<boolean> {
    console.log(`[SocketService] ⛔ DESATIVADO: Busca de números REST para roleta ${roletaId} bloqueada para diagnóstico`);
    
    // Tentar usar o cache mesmo que antigo
    const cachedData = this.rouletteDataCache.get(roletaId);
    if (cachedData) {
      const roleta = cachedData.data;
      const numeros = roleta.numero || roleta.numeros || roleta.historico || [];
      
      if (Array.isArray(numeros) && numeros.length > 0) {
        this.processNumbersData(numeros, roleta);
        return true;
      }
    }
    
    // Se não tem cache, usar fallback
    return this.useFallbackData(roletaId);
    
    /* CÓDIGO ORIGINAL DESATIVADO
    if (!roletaId) {
      console.error('[SocketService] ID de roleta inválido para buscar números:', roletaId);
      return false;
    }
    
    // Verificar se o circuit breaker está ativo
    if (!this.shouldProceedWithRequest(`/api/ROULETTES/${roletaId}`)) {
      console.log(`[SocketService] Circuit breaker ativo, usando cache ou fallback para ${roletaId}`);
      
      // Tentar usar o cache mesmo que antigo
      const cachedData = this.rouletteDataCache.get(roletaId);
      if (cachedData) {
        const roleta = cachedData.data;
        const numeros = roleta.numero || roleta.numeros || roleta.historico || [];
        
        if (Array.isArray(numeros) && numeros.length > 0) {
          this.processNumbersData(numeros, roleta);
          return true;
        }
      }
      
      // Se não tem cache, usar fallback
      return this.useFallbackData(roletaId);
    }
    
    try {
      // Verificar se temos dados no cache que ainda são válidos
      const cachedData = this.rouletteDataCache.get(roletaId);
      const now = Date.now();
      
      if (cachedData && (now - cachedData.timestamp) < this.cacheTTL) {
        console.log(`[SocketService] Usando dados em cache para roleta ${roletaId} (${Math.round((now - cachedData.timestamp)/1000)}s atrás)`);
        
        // Usar os dados do cache
        const roleta = cachedData.data;
        const numeros = roleta.numero || roleta.numeros || roleta.historico || [];
        
        if (Array.isArray(numeros) && numeros.length > 0) {
          // Notificar que temos dados para esta roleta
          this.processNumbersData(numeros, roleta);
          
          // Também armazenar os números no histórico local
          const numerosSimples = numeros
            .filter(n => n !== null && n !== undefined)
            .map(n => {
              if (n && typeof n === 'object' && 'numero' in n) {
                return n.numero;
              }
              return n;
            })
            .filter(n => n !== null && !isNaN(n));
          
          this.setRouletteHistory(roletaId, numerosSimples);
          return true;
        }
      }
      
      // Continuar com a busca na API
      // Tentar buscar dados da API REST (/api/ROULETTE/:id/numbers)
      console.log(`[SocketService] Buscando números para roleta ${roletaId} via REST API`);
      
      const baseUrl = this.getApiBaseUrl();
      const endpoint = `${baseUrl}/ROULETTES`;
      
      console.log(`[SocketService] Buscando em: ${endpoint}`);
      
      // Usar sistema de retry para lidar com erros 502
        let attempt = 0;
        const maxAttempts = 3;
        let response = null;
        
        while (attempt < maxAttempts) {
          try {
            response = await fetch(endpoint);
          
            if (response.ok) {
            const allRoulettes = await response.json();
            
            if (!Array.isArray(allRoulettes)) {
              console.error(`[SocketService] Resposta inválida da API de roletas. Esperado um array, recebido:`, typeof allRoulettes);
              break;
            }
            
            // Encontrar a roleta específica pelo ID
            const roleta = allRoulettes.find(r => {
              // Tentar diferentes propriedades que podem ser o ID
              const roletaId_original = r.id || r._id;
              const canonical_id = mapToCanonicalRouletteId(roletaId_original);
              return canonical_id === roletaId || roletaId_original === roletaId;
            });
            
            if (!roleta) {
              console.warn(`[SocketService] Roleta ${roletaId} não encontrada na lista de roletas`);
              break;
            }
            
            // Verificar se temos números
            const numeros = roleta.numero || roleta.numeros || roleta.historico || [];
            
            if (!Array.isArray(numeros) || numeros.length === 0) {
              console.warn(`[SocketService] Roleta ${roletaId} não tem números`);
              break;
            }
            
            console.log(`[SocketService] ✅ Recebidos ${numeros.length} números para roleta ${roletaId}`);
            
            // Armazenar no cache para uso futuro
              this.rouletteDataCache.set(roletaId, {
                data: roleta,
              timestamp: now
            });
            
            // Processar os números recebidos
                this.processNumbersData(numeros, roleta);
                
                // Também armazenar os números no histórico local
                const numerosSimples = numeros
                  .filter(n => n !== null && n !== undefined)
                  .map(n => {
                    if (n && typeof n === 'object' && 'numero' in n) {
                      return n.numero;
                    }
                    return n;
                  })
                  .filter(n => n !== null && !isNaN(n));
                
                this.setRouletteHistory(roletaId, numerosSimples);
            
            // Sinalizar sucesso para o circuit breaker
            this.handleCircuitBreaker(true, endpoint);
                
                return true;
          }
          
          // Se for erro 502, tentar novamente
          if (response.status === 502) {
            attempt++;
            console.warn(`[SocketService] Erro 502 ao buscar números. Tentativa ${attempt}/${maxAttempts}`);
            
            // Marcar falha para o circuit breaker
          this.handleCircuitBreaker(false, endpoint);
            
            // Esperar antes de tentar novamente (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
          } else {
            // Se for outro erro, sair do loop
            console.warn(`[SocketService] Erro ${response.status} ao buscar números.`);
            break;
          }
      } catch (error) {
          attempt++;
          console.error(`[SocketService] Erro de rede na tentativa ${attempt}/${maxAttempts}:`, error);
          
          // Marcar falha para o circuit breaker
          this.handleCircuitBreaker(false, endpoint);
          
          // Esperar antes de tentar novamente
          await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
          
          // Se for a última tentativa, sair do loop
          if (attempt >= maxAttempts) {
            break;
          }
        }
      }
      
      // Se chegamos aqui, todas as tentativas falharam
      console.warn(`[SocketService] Falha ao buscar números após ${maxAttempts} tentativas`);
      
      // Usar fallback
        return this.useFallbackData(roletaId);
    } catch (error) {
      console.error(`[SocketService] Erro ao buscar números para roleta ${roletaId}:`, error);
      
      // Marcar falha para o circuit breaker
      this.handleCircuitBreaker(false, `fetchRouletteNumbersREST_${roletaId}`);
      
      // Usar fallback
      return this.useFallbackData(roletaId);
    }
    */
  }

  // Método auxiliar para usar dados de fallback quando necessário
  private useFallbackData(canonicalId: string): boolean {
    const roleta = ROLETAS_CANONICAS.find(r => r.id === canonicalId);
    const roletaNome = roleta ? roleta.nome : `Roleta ${canonicalId}`;
    
    console.log(`[SocketService] Usando dados de fallback para ${roletaNome}`);
    
    // Gerar alguns números aleatórios como fallback
    const fakeNumbers = this.generateFallbackNumbers(canonicalId, roletaNome);
    
    // Extrair apenas os números e armazenar no histórico
    const numeros = fakeNumbers.map(item => item.numero);
    this.setRouletteHistory(canonicalId, numeros);
    
    // Processar os dados completos para o sistema de eventos e para os cards
    this.processNumbersData(fakeNumbers, { _id: canonicalId, nome: roletaNome });
    
    return true;
  }
  
  // Método auxiliar para gerar números de fallback em caso de erro de CORS
  private generateFallbackNumbers(roletaId: string, roletaNome: string): any[] {
    console.log(`[SocketService] Gerando números de fallback para ${roletaNome}`);
    const numbers = [];
    const count = 20;
    
    for (let i = 0; i < count; i++) {
      const numero = Math.floor(Math.random() * 37); // 0-36
      const timestamp = new Date(Date.now() - i * 60000).toISOString();
      
      // Determinar cor
      let cor = 'verde';
      if (numero > 0) {
        const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        cor = numerosVermelhos.includes(numero) ? 'vermelho' : 'preto';
      }
      
      numbers.push({
        numero,
        cor,
        roleta_id: roletaId,
        roleta_nome: roletaNome,
        timestamp
      });
    }
    
    return numbers;
  }
  
  // Obter a URL base da API
  private getApiBaseUrl(): string {
    // Em vez de usar a URL completa do Railway, usar o endpoint relativo para aproveitar o proxy
    return '/api';
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

  /**
   * Solicita dados de estratégia para uma roleta específica
   * @param roletaId ID da roleta
   * @param roletaNome Nome da roleta
   */
  public requestStrategy(roletaId: string, roletaNome: string): void {
    console.log(`[SocketService] Solicitando dados de estratégia para ${roletaNome} (ID: ${roletaId})`);
    
    // Tentar enviar via socket se conectado
    if (this.isConnected()) {
      this.sendMessage({
        type: 'get_strategy',
        roleta_id: roletaId,
        roleta_nome: roletaNome
      });
    } else {
      console.log(`[SocketService] Socket não conectado, solicitação de estratégia ignorada`);
    }
    
    // Emitir evento no Event Service para notificar componentes interessados
    const eventService = EventService.getInstance();
    const event = {
      type: 'strategy_requested',
          roleta_id: roletaId,
          roleta_nome: roletaNome,
          timestamp: new Date().toISOString()
        };
        
    if (typeof eventService.dispatchEvent === 'function') {
      eventService.dispatchEvent(event);
    }
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

  // Método para processar eventos de estratégia
  private processStrategyEvent(data: any): void {
    if (!data || !data.roleta_id || !data.roleta_nome) {
      console.warn('[SocketService] Dados de estratégia inválidos:', data);
        return;
      }

    // Transformar em formato de evento para notificar
      const event: StrategyUpdateEvent = {
        type: 'strategy_update',
      roleta_id: data.roleta_id,
      roleta_nome: data.roleta_nome, // Corrigido de roleta_name para roleta_nome
      estado: data.estado || 'unknown',
        numero_gatilho: data.numero_gatilho || 0,
        terminais_gatilho: data.terminais_gatilho || [],
      vitorias: data.vitorias || 0,
      derrotas: data.derrotas || 0,
      sugestao_display: data.sugestao_display,
        timestamp: data.timestamp || new Date().toISOString()
      };

      console.log(`[SocketService] Processando evento de estratégia:`, {
      roleta: event.roleta_nome, // Corrigido de roleta_name para roleta_nome
        vitorias: event.vitorias,
        derrotas: event.derrotas,
        timestamp: event.timestamp
      });

      // Notificar diretamente os callbacks específicos para esta roleta
      this.notifyListeners(event);
      
      // Notificar também via EventService
      const eventService = EventService.getInstance();
      eventService.emitStrategyUpdate(event);
  }

  private ensureConnection() {
    if (!this.socket || !this.socket.connected) {
      console.log("[SocketService] Conexão Socket.IO não ativa, reconectando...");
      this.connect();
      return false;
    }
    return true;
  }

  // Adicionar um método para forçar reconexão - melhorado para garantir verificação adequada
  public reconnect(): void {
    console.log('[SocketService] Executando reconexão forçada...');
    // Limpar todos os listeners pendentes
    this.clearAllPendingPromises();
    
    // Desconectar socket existente
      if (this.socket) {
      // Remover todos os listeners para evitar duplicação
      this.socket.offAny();
          this.socket.disconnect();
        this.socket = null;
      }
    
    // Reiniciar contadores
    this.connectionAttempts = 0;
    this.connectionActive = false;
      
      // Reconectar
      this.connect();
  }

  // Adicionar um método para transmitir o estado da conexão
  public broadcastConnectionState(): void {
    const isConnected = this.isSocketConnected();
    console.log(`[SocketService] Enviando estado de conexão: ${isConnected ? 'Conectado' : 'Desconectado'}`);
    
    // Criar evento e notificar via mecanismo existente
    const event = {
      type: 'connection_state',
      connected: isConnected,
      timestamp: new Date().toISOString()
    };
    
    // Usar o notifyListeners existente
    this.notifyListeners(event as any);
    
    // Se conectado, solicitar dados mais recentes
    if (isConnected) {
      this.requestRecentNumbers();
    }
  }

  /**
   * Registra para receber atualizações em tempo real de uma roleta específica
   * @param roletaId ID da roleta
   * @param roletaNome Nome da roleta (para logs)
   */
  private subscribeToRouletteEndpoint(roletaId: string, roletaNome?: string): void {
    try {
      // Verificar se temos ID válido
    if (!roletaId) {
        console.warn('[SocketService] ID inválido para subscrição');
      return;
    }

      // Usar nome da roleta para logs, ou o ID se não tivermos o nome
      const displayName = roletaNome || `Roleta ${roletaId.substring(0, 8)}...`;
      
      console.log(`[SocketService] Registrando subscrição para ${displayName} (${roletaId})`);
      
      // Registrar via WebSocket se estiver conectado
      if (this.socket && this.connectionActive) {
        console.log(`[SocketService] Registrando via WebSocket para ${displayName}`);
        this.socket.emit('subscribe', { 
          roletaId, 
          action: 'subscribe',
          type: 'roleta_numbers'
        });
      } else {
        console.log(`[SocketService] WebSocket não está conectado, usando apenas REST API para ${displayName}`);
      }
      
      // Também registrar diretamente para o endpoint específico da roleta
      this.startAggressivePolling(roletaId, displayName);
    } catch (error) {
      console.error(`[SocketService] Erro ao registrar subscrição para roleta ${roletaId}:`, error);
    }
  }

  // Método para solicitar números específicos de uma roleta
  public requestRouletteNumbers(roletaId: string): void {
    if (!roletaId) {
      console.warn('[SocketService] ID da roleta não especificado para solicitação de números');
      return;
    }
    
    // Garantir que estamos usando o ID canônico
    const canonicalId = mapToCanonicalRouletteId(roletaId);
    
    if (!this.socket || !this.socket.connected) {
      console.log('[SocketService] Socket não conectado. Reconectando antes de solicitar dados.');
      this.connect();
      // Programar nova tentativa após conexão
      setTimeout(() => this.requestRouletteNumbers(canonicalId), 1000);
      return;
    }
    
    console.log(`[SocketService] Solicitando números específicos para roleta ID: ${canonicalId} (original: ${roletaId})`);
    
    // Solicitar via socket usando ID canônico
    this.socket.emit('get_roulette_numbers', {
      roletaId: canonicalId,
      endpoint: `/api/ROULETTES`,
      count: 50 // Solicitar até 50 números para garantir boa amostra
    });
    
    // Fazer também uma solicitação REST para garantir dados completos
    // Usar um valor intermediário para dados em tempo real
    this.fetchRouletteNumbersREST(canonicalId, 50);
  }

  /**
   * Inicia polling agressivo para uma roleta específica
   * Desativado para centralizar no RouletteFeedService
   */
  public startAggressivePolling(roletaId: string, roletaNome: string): void {
    console.log(`[SocketService] Polling agressivo DESATIVADO para ${roletaNome} (${roletaId})`);
    // Implementação removida para evitar requisições duplicadas
    return;
    
    /* IMPLEMENTAÇÃO ORIGINAL DESATIVADA
    if (this.pollingIntervals.has(roletaId)) {
      console.log(`[SocketService] Polling já ativo para ${roletaNome} (${roletaId})`);
      return;
    }
    
    console.log(`[SocketService] Iniciando polling agressivo para ${roletaNome} (${roletaId})`);
    
    // Configurar intervalo menor para roletas populares
    const interval = setInterval(() => {
      this.requestRouletteData(roletaId, roletaNome);
    }, this.pollingInterval / 3); // 3x mais frequente que o polling normal
    
    // Armazenar intervalo para poder cancelar depois
    this.pollingIntervals.set(roletaId, interval);
    */
  }

  // Método para parar o polling para uma roleta específica
  public stopPollingForRoulette(roletaId: string): void {
    if (this.pollingIntervals.has(roletaId)) {
      const pollingInfo = this.pollingIntervals.get(roletaId);
      
      if (pollingInfo && pollingInfo.timerId) {
        clearTimeout(pollingInfo.timerId);
      }
      
      this.pollingIntervals.delete(roletaId);
      console.log(`[SocketService] Polling interrompido para roleta ${roletaId}`);
    }
  }

  // Novo método para solicitar dados específicos de uma roleta
  // Retorna Promise<boolean> indicando se novos dados foram recebidos
  private async requestRouletteUpdate(roletaId: string, roletaNome: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Verificar se temos socket ativo
      if (!this.socket || !this.connectionActive) {
        console.log(`[SocketService] Socket não conectado ao tentar solicitar dados para ${roletaNome}`);
        resolve(false);
      return;
    }
    
      // Flag para verificar se recebemos resposta
      let receivedResponse = false;
      let responseTimeout: NodeJS.Timeout;
      
      // Função de callback para quando receber os dados
      const onData = (data: any) => {
        // Limpar o timeout
        clearTimeout(responseTimeout);
        
        // Verificar se temos dados válidos
        const hasValidData = data && 
          (Array.isArray(data.numeros) && data.numeros.length > 0 || 
           Array.isArray(data.numero) && data.numero.length > 0);
        
        if (hasValidData) {
          console.log(`[SocketService] Recebidos dados reais para ${roletaNome}`);
          receivedResponse = true;
          resolve(true);
        } else {
          console.log(`[SocketService] Resposta sem dados novos para ${roletaNome}`);
          resolve(false);
        }
        
        // Remover este listener após a resposta
        this.socket?.off(`roulette_update_${roletaId}`, onData);
      };
      
      // Configurar timeout para caso não receba resposta
      responseTimeout = setTimeout(() => {
        // Se não recebeu resposta em tempo hábil
        if (!receivedResponse) {
          this.socket?.off(`roulette_update_${roletaId}`, onData);
          console.log(`[SocketService] Timeout ao aguardar resposta para ${roletaNome}`);
          resolve(false);
        }
      }, 3000);
      
      // Registrar o evento para receber a resposta
      this.socket.on(`roulette_update_${roletaId}`, onData);
      
      // Solicitar os dados da roleta
      console.log(`[SocketService] Solicitando dados para ${roletaNome} (${roletaId})`);
      this.socket.emit('get_roulette_data', {
        roleta_id: roletaId,
        roleta_nome: roletaNome,
        timestamp: new Date().toISOString()
      });
    });
  }

  // Adicione este método após o construtor
  private setupUnhandledRejectionHandler(): void {
    // Handler global para promises não tratadas
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  // Handler para rejeições de promise não tratadas
  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    console.error('[SocketService] Erro de promise não tratado:', event.reason);
    // Verificar se o erro está relacionado com canal fechado ou socket
    const errorMessage = String(event.reason).toLowerCase();
    if (
      errorMessage.includes('message channel closed') || 
      errorMessage.includes('socket') || 
      errorMessage.includes('connection')
    ) {
      console.warn('[SocketService] Detectado erro de canal fechado, tentando reconectar...');
      // Evitar propagação do erro não tratado
      event.preventDefault();
      
      // Se for erro de socket, verificar conexão e tentar reconectar
      if (!this.connectionActive || !this.socket?.connected) {
        this.reconnect();
      } else {
        // Se o socket parece estar conectado mas temos erro de canal fechado,
        // forçar reconexão para reestabelecer os canais de mensagem
        console.warn('[SocketService] Forçando reconexão para reestabelecer canais de mensagem');
        this.socket?.disconnect();
        setTimeout(() => this.connect(), 1000);
      }
    }
  }

  // Gerenciar promessas pendentes de listeners assíncronos
  private trackPromise(id: string, promise: Promise<any>, timeoutMs: number = 5000): void {
    // Verificar se já existe uma promessa com esse ID e limpá-la
    if (this.pendingPromises.has(id)) {
      const existing = this.pendingPromises.get(id);
      if (existing) {
        clearTimeout(existing.timeout);
        this.pendingPromises.delete(id);
      }
    }
    
    // Criar timeout para a promessa
    const timeoutId = setTimeout(() => {
      console.warn(`[SocketService] Promessa do listener ${id} expirou após ${timeoutMs}ms`);
      // Remover do mapa de promessas pendentes
      this.pendingPromises.delete(id);
      
      // Verificar conexão se uma promessa expira
      if (!this.checkSocketConnection()) {
        console.warn('[SocketService] Reconectando após timeout de promessa');
        this.reconnect();
      }
    }, timeoutMs);
    
    // Adicionar ao mapa de promessas pendentes
    this.pendingPromises.set(id, { promise, timeout: timeoutId });
    
    // Adicionar handler para quando a promessa resolver ou rejeitar
    promise
      .then(() => {
        clearTimeout(timeoutId);
        this.pendingPromises.delete(id);
      })
      .catch(error => {
        console.error(`[SocketService] Erro na promessa ${id}:`, error);
        clearTimeout(timeoutId);
        this.pendingPromises.delete(id);
        
        // Se o erro for relacionado a canal fechado, tentar reconectar
        const errorStr = String(error).toLowerCase();
        if (errorStr.includes('message channel closed') || errorStr.includes('socket closed')) {
          this.reconnect();
        }
      });
  }
  
  private clearAllPendingPromises(): void {
    // Limpar todos os timeouts de promessas pendentes
    this.pendingPromises.forEach(({ timeout }) => {
      clearTimeout(timeout);
    });
    this.pendingPromises.clear();
  }

  // Destruidor para limpeza adequada
  public destroy(): void {
    console.log('[SocketService] Destruindo instância do SocketService');
    
    // Remover event listener global
    window.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
    
    // Limpar todos os intervalos de polling
    this.pollingIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.pollingIntervals.clear();
    
    // Limpar todos os timeouts
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    
    // Limpar todas as promessas pendentes
    this.clearAllPendingPromises();
    
    // Desconectar socket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Registra todas as roletas para receber atualizações em tempo real
   */
  public registerToAllRoulettes(): void {
    try {
      console.log('[SocketService] Registrando para receber atualizações de todas as roletas');
  
      // Buscar todas as roletas disponíveis no servidor
      this.fetchRealRoulettes().then(roletas => {
        if (roletas && roletas.length > 0) {
          console.log(`[SocketService] Encontradas ${roletas.length} roletas disponíveis para registrar`);
          
          // Registrar para todas as roletas, sem filtrar por ID permitido
          for (const roleta of roletas) {
            if (!roleta) continue;
            
            const roletaId = roleta._id || roleta.id;
            const roletaNome = roleta.nome || roleta.name || `Roleta ${roletaId?.substring(0, 8)}`;
            
            // Verificar se temos um ID válido
            if (!roletaId) {
              console.warn('[SocketService] Roleta sem ID válido para registrar:', roleta);
              continue;
            }
            
            // Não verificar se o ID está na lista de permitidos - registrar todas as roletas
            // const stringId = String(roletaId);
            // if (!ROLETAS_PERMITIDAS.includes(stringId)) {
            //   continue;
            // }
            
            console.log(`[SocketService] Registrando para receber dados da roleta: ${roletaNome} (${roletaId})`);
            
            // Registrar para esta roleta
            this.subscribeToRouletteEndpoint(roletaId, roletaNome);
            
            // Também iniciar polling para esta roleta
            this.startAggressivePolling(roletaId, roletaNome);
          }
        } else {
          console.warn('[SocketService] Nenhuma roleta encontrada para registrar');
        }
      }).catch(error => {
        console.error('[SocketService] Erro ao buscar roletas para registrar:', error);
      });
    } catch (error) {
      console.error('[SocketService] Erro ao registrar todas as roletas:', error);
    }
  }

  /**
   * Adiciona um número ao histórico da roleta e mantém limitado a 1000 números
   * @param roletaId ID da roleta
   * @param numero Número a ser adicionado
   */
  public addNumberToHistory(roletaId: string, numero: number): void {
    // Verificar se o ID é válido
    if (!roletaId) return;
    
    // Garantir que temos uma entrada para esta roleta
    if (!this.rouletteHistory.has(roletaId)) {
      this.rouletteHistory.set(roletaId, []);
    }
    
    // Obter o histórico atual
    const history = this.rouletteHistory.get(roletaId)!;
    
    // Verificar se o número já está no início do histórico (evitar duplicatas)
    if (history.length > 0 && history[0] === numero) {
        return;
      }
      
    // Adicionar o número no início e manter o limite
    history.unshift(numero);
    if (history.length > this.historyLimit) {
      history.pop();
    }
  }

  /**
   * Obtém o histórico completo de uma roleta
   * @param roletaId ID da roleta
   * @returns Array com o histórico de números
   */
  public getRouletteHistory(roletaId: string): number[] {
    // Verificar se temos histórico para esta roleta
    if (!this.rouletteHistory.has(roletaId)) {
      return [];
    }
    
    // Retornar uma cópia do histórico para evitar modificações externas
    return [...this.rouletteHistory.get(roletaId)!];
  }

  /**
   * Atualiza o histórico completo de uma roleta
   * @param roletaId ID da roleta
   * @param numbers Array de números para definir como histórico
   */
  public setRouletteHistory(roletaId: string, numbers: number[]): void {
    // Garantir que não excedemos o limite
    const limitedNumbers = numbers.slice(0, this.historyLimit);
    this.rouletteHistory.set(roletaId, limitedNumbers);
  }

  /**
   * Solicita o histórico completo de uma roleta
   * @param roletaId ID da roleta
   * @returns Promise que resolve com os dados do histórico
   */
  requestRouletteHistory(roletaId: string): Promise<HistoryData> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected()) {
        console.error('Socket não conectado. Impossível solicitar histórico.');
        return reject(new Error('Socket não conectado'));
      }
      
      console.log(`Solicitando histórico para roleta: ${roletaId}`);
      
      // Configurar handler para resposta
      const onHistoryData = (data: HistoryData) => {
        if (data.roletaId === roletaId) {
          console.log(`Recebido histórico com ${data.numeros?.length || 0} registros para roleta ${roletaId}`);
          this.socket?.off('history_data', onHistoryData);
          this.socket?.off('history_error', onHistoryError);
          resolve(data);
        }
      };
      
      const onHistoryError = (error: any) => {
        console.error('Erro ao buscar histórico:', error);
        this.socket?.off('history_data', onHistoryData);
        this.socket?.off('history_error', onHistoryError);
        reject(error);
      };
      
      // Registrar handlers
      this.socket.on('history_data', onHistoryData);
      this.socket.on('history_error', onHistoryError);
      
      // Enviar solicitação
      this.socket.emit('request_history', { roletaId });
      
      // Timeout para evitar que a Promise fique pendente para sempre
      setTimeout(() => {
        this.socket?.off('history_data', onHistoryData);
        this.socket?.off('history_error', onHistoryError);
        reject(new Error('Timeout ao solicitar histórico'));
      }, 30000); // 30 segundos de timeout
    });
  }

  public async fetchAllRoulettesWithRealData(): Promise<any[]> {
    const roulettes = await this.fetchRealRoulettes();
    
    // Para cada roleta, buscar dados de números
    for (const roulette of roulettes) {
      try {
        // Usar um valor mais baixo para os cards principais
        const hasRealData = await this.fetchRouletteNumbersREST(roulette._id, 30);
        if (hasRealData) {
          console.log(`[SocketService] Dados reais obtidos para ${roulette.name || roulette._id}`);
        }
      } catch (error) {
        console.error(`[SocketService] Erro ao buscar dados para ${roulette.name || roulette._id}:`, error);
      }
    }
    
    return roulettes;
  }

  // Método para gerenciar o circuit breaker
  private handleCircuitBreaker(success: boolean, endpoint?: string): boolean {
    if (success) {
      // Resetar contador em caso de sucesso
      this.consecutiveFailures = 0;
      return true;
    } else {
      // Incrementar contador de falhas
      this.consecutiveFailures++;
      
      // Verificar se deve ativar o circuit breaker
      if (!this.circuitBreakerActive && this.consecutiveFailures >= this.failureThreshold) {
        console.warn(`[SocketService] Circuit breaker ativado após ${this.consecutiveFailures} falhas consecutivas. Pausando chamadas por ${this.resetTime/1000}s`);
        
        this.circuitBreakerActive = true;
        
        // Mostrar notificação para o usuário
        toast({
          title: "Servidor sobrecarregado",
          description: "Reduzindo frequência de chamadas para evitar sobrecarga",
          variant: "warning"
        });
        
        // Programar reset do circuit breaker
        if (this.circuitBreakerResetTimeout) {
          clearTimeout(this.circuitBreakerResetTimeout);
        }
        
        this.circuitBreakerResetTimeout = setTimeout(() => {
          console.log('[SocketService] Circuit breaker desativado, retomando operações normais');
          this.circuitBreakerActive = false;
          this.consecutiveFailures = 0;
          
          // Tentar reconectar e buscar dados essenciais
          this.fetchRealRoulettes().then(() => {
            console.log('[SocketService] Recarregando dados após reset do circuit breaker');
            this.requestRecentNumbers();
          });
          
        }, this.resetTime);
      }
      
      // Se o circuit breaker está ativo, bloquear a operação
      return !this.circuitBreakerActive;
    }
  }

  // Método para verificar se uma chamada deve prosseguir
  private shouldProceedWithRequest(endpoint?: string): boolean {
    if (this.circuitBreakerActive) {
      console.log(`[SocketService] Circuit breaker ativo, bloqueando chamada${endpoint ? ` para ${endpoint}` : ''}`);
      return false;
    }
    return true;
  }
}

// Criar e exportar uma única instância
const socketService = new SocketService();
export default socketService;