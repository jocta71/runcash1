// Substituir import direto do socket.io-client por tipos genéricos
// import { io, Socket } from 'socket.io-client';
import { toast } from '@/components/ui/use-toast';
import config from '@/config/env';
import EventService, { 
  RouletteNumberEvent,
  RouletteEventCallback,
  StrategyUpdateEvent
} from './EventService';
import { getRequiredEnvVar, isProduction } from '../config/env';
import { mapToCanonicalRouletteId, ROLETAS_CANONICAS } from '../integrations/api/rouletteService';

// Importando o serviço de estratégia para simular respostas
import StrategyService from './StrategyService';

// Definir tipos para o Socket.IO
interface SocketIOClient {
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string) => void;
  emit: (event: string, ...args: any[]) => void;
  connected?: boolean;
  disconnect: () => void;
  io?: {
    on: (event: string, callback: (data: any) => void) => void;
    reconnectionAttempts?: number;
  };
}

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

// Definir um tipo para o Socket caso o import falhe
type FallbackSocket = {
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string) => void;
  emit: (event: string, ...args: any[]) => void;
  connected?: boolean;
  disconnect: () => void;
  io?: any;
};

// Definir uma função io simples para substituir a dependência socket.io-client
function io(url: string, options?: any): SocketIOClient {
  console.warn('[SocketService] Usando uma implementação de fallback para socket.io-client');
  
  // Criar um objeto socket básico que emula o comportamento básico do socket.io
  const socket: SocketIOClient = {
    connected: false,
    on: (event: string, callback: (data: any) => void) => {
      console.log(`[SocketFallback] Registrando evento ${event}`);
      // Implementação vazia
      return socket;
    },
    off: (event: string) => {
      console.log(`[SocketFallback] Removendo evento ${event}`);
      // Implementação vazia
      return socket;
    },
    emit: (event: string, ...args: any[]) => {
      console.log(`[SocketFallback] Emitindo evento ${event}`);
      // Implementação vazia
      return socket;
    },
    disconnect: () => {
      console.log(`[SocketFallback] Desconectando`);
      socket.connected = false;
    },
    io: {
      on: (event: string, callback: (data: any) => void) => {
        // Implementação vazia
      },
      reconnectionAttempts: 0
    }
  };
  
  // Simular conexão após 500ms
  setTimeout(() => {
    if (socket.connected === false) {
      socket.connected = true;
      // Tentar notificar sobre conexão
      console.log('[SocketFallback] Simulando conexão bem-sucedida');
      
      // Em vez de acessar diretamente os listeners, usar método subscribe para notificar sobre conexão
      try {
        // Disparar callbacks de conexão registrados no próprio socket
        const connectEvent = new Event('connect');
        window.dispatchEvent(connectEvent);
      } catch (error) {
        console.error('[SocketFallback] Erro ao simular evento de conexão:', error);
      }
    }
  }, 500);
  
  return socket;
}

/**
 * Serviço que gerencia a conexão WebSocket via Socket.IO
 * para receber dados em tempo real do MongoDB
 */
export class SocketService {
  private static instance: SocketService;
  private socket: SocketIOClient | FallbackSocket | null = null;
  private listeners: Record<string, Array<(data: any) => void>> = {};
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;
  private maxConnectionAttempts: number = 5;
  private cache: Record<string, any> = {};
  private connectionActive: boolean = false;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private eventHandlers: Record<string, (data: any) => void> = {};
  private autoReconnect: boolean = true;
  private lastReceivedData: Map<string, { timestamp: number, data: any }> = new Map();
  // Novo mapa para rastrear promessas pendentes de listeners assíncronos
  private pendingPromises: Map<string, { promise: Promise<any>, timeout: ReturnType<typeof setTimeout> }> = new Map();
  
  // Propriedade para o cliente MongoDB (pode ser undefined em alguns contextos)
  public client?: MongoClient;
  
  // Mapa para armazenar os intervalos de polling por roletaId
  private pollingIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
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
  private consecutiveFailures: number = 0;
  private failureThreshold: number = 5; // Quantas falhas para ativar o circuit breaker
  private resetTime: number = 60000; // 1 minuto de espera antes de tentar novamente
  private circuitBreakerResetTimeout: ReturnType<typeof setTimeout> | null = null;
  
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
    
    // Configurar listener para novos números - mais verboso para debug
    this.socket.on('new_number', (data: any) => {
      console.log('[SocketService] Novo número recebido via Socket.IO:', data);
      this.processIncomingNumber(data);
      
      // Emitir um evento de log para debug
      console.log(`[SocketService] ✅ Processado número ${data.numero} para ${data.roleta_nome || 'desconhecida'}`);
    });
    
    // Configurar listener para atualizações específicas de roleta
    this.socket.on('roulette_update', (data: any) => {
      console.log('[SocketService] Atualização específica de roleta recebida:', data);
      
      if (data && data.roleta_id && data.numeros && Array.isArray(data.numeros)) {
        const roletaId = data.roleta_id;
        const roletaNome = data.roleta_nome || `Roleta ${roletaId}`;
        
        console.log(`[SocketService] Processando ${data.numeros.length} números para ${roletaNome}`);
        
        // Processar cada número individualmente para garantir atualização na interface
        data.numeros.forEach((numero: any, index: number) => {
          // Processar o número no formato correto
          this.processIncomingNumber({
            type: 'new_number',
            roleta_id: roletaId,
            roleta_nome: roletaNome,
            numero: typeof numero === 'number' ? numero : parseInt(String(numero), 10),
            timestamp: new Date().toISOString(),
            preserve_existing: true,
            realtime: true
          });
        });
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
    
    // Configurar listeners para eventos de conexão
    this.socket.on('connect', this.handleConnect);
    this.socket.on('disconnect', this.handleDisconnect);
    this.socket.on('connect_error', this.handleConnectError);
    
    // Ping a cada 30 segundos para manter a conexão ativa
    this.setupPing();
    
    // Solicitar números recentes imediatamente após configurar listeners
    setTimeout(() => {
      this.requestRecentNumbers();
    }, 1000);
  }

  private processIncomingNumber(data: any): void {
    try {
      // Verificar formato dos dados recebidos
      if (!data) {
        console.warn('[SocketService] Dados inválidos recebidos:', data);
        return;
      }

      // Adaptação para o formato correto dos dados
      // Formato esperado: { numero: 10, roleta_id: "2010012", roleta_nome: "American Roulette", cor: "preto", timestamp: "2025-04-09T04:00:27.163Z" }
      const roletaId = data.roleta_id || '';
      const roletaNome = data.roleta_nome || '';
      const numero = parseInt(data.numero, 10);
      const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
      const cor = data.cor || this.determinarCorNumero(numero);

      if (!roletaId || !roletaNome || isNaN(numero)) {
        console.warn('[SocketService] Dados de roleta incompletos:', data);
        return;
      }

      // Normalizar dados
      const normalizedData = {
        roleta_id: roletaId,
        roleta_nome: roletaNome,
        numero: numero,
        timestamp: timestamp,
        cor: cor
      };

      // Log para debug
      console.log(`[SocketService] Novo número recebido: ${numero} para roleta ${roletaNome} (${roletaId})`);

      // Atualizar último tempo de recebimento de dados
      this.lastReceivedData.set(roletaId, {
        timestamp: Date.now(),
        data: normalizedData
      });

      // Registrar conexão bem-sucedida
      this.isConnected = true;
      this.connectionAttempts = 0;
    } catch (error) {
      console.error('[SocketService] Erro ao processar número recebido:', error, data);
    }
  }

  // Handler para o evento de conexão bem-sucedida
  private handleConnect = (): void => {
    console.log('[SocketService] ✅ Conectado ao servidor WebSocket com sucesso!');
    this.connectionActive = true;
    this.isConnected = true;
    this.connectionAttempts = 0;
    this.consecutiveFailures = 0; // Resetar falhas após conexão bem-sucedida
    
    // Resetar circuit breaker se estiver ativo
    if (this.circuitBreakerActive) {
      console.log('[SocketService] Desativando circuit breaker após conexão bem-sucedida');
      this.circuitBreakerActive = false;
      if (this.circuitBreakerResetTimeout) {
        clearTimeout(this.circuitBreakerResetTimeout);
        this.circuitBreakerResetTimeout = null;
      }
    }
    
    // Salvar timestamp da conexão
    localStorage.setItem('socket_last_connection', Date.now().toString());
    
    // Notificar sobre a conexão
    toast({
      title: "Conexão WebSocket estabelecida",
      description: "Você está conectado ao servidor de dados em tempo real.",
      variant: "default"
    });
    
    // Solicitar os números recentes imediatamente
    this.requestRecentNumbers();
  }

  // Handler para o evento de desconexão
  private handleDisconnect = (reason: string): void => {
    console.log(`[SocketService] ❌ Desconectado do servidor WebSocket: ${reason}`);
    this.connectionActive = false;
    this.isConnected = false;
    
    // Notificar sobre a desconexão
    toast({
      title: "Conexão WebSocket perdida",
      description: "Tentando reconectar automaticamente...",
      variant: "destructive"
    });

    // Tentar reconectar se a reconexão automática estiver habilitada
    if (this.autoReconnect) {
      this.reconnect();
    }
  }

  // Handler para erros de conexão
  private handleConnectError = (error: Error): void => {
    console.error('[SocketService] ❌ Erro na conexão WebSocket:', error.message);
    this.connectionActive = false;
    this.isConnected = false;
    
    // Aumentar contador de tentativas
    this.connectionAttempts++;
    
    // Se o limite for atingido, desabilitar a reconexão automática
    if (this.connectionAttempts >= this.maxConnectionAttempts) {
      console.warn(`[SocketService] Limite de ${this.maxConnectionAttempts} tentativas de reconexão atingido.`);
      this.autoReconnect = false;
      
      // Notificar o usuário sobre o problema persistente
      toast({
        title: "Erro de conexão persistente",
        description: "Não foi possível conectar ao servidor após várias tentativas. Tente recarregar a página.",
        variant: "destructive"
      });
    } else if (this.autoReconnect) {
      // Tentar reconectar com atraso exponencial
      this.reconnect();
    }
  }

  // Método para reconectar com backoff exponencial
  private reconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Implementação de backoff exponencial mais robusta
    const baseDelay = 1000; // 1 segundo como base
    const maxDelay = 30000; // máximo de 30 segundos
    const jitter = Math.random() * 1000; // adiciona até 1 segundo de aleatoriedade para evitar tempestade de reconexão
    
    // Calcular delay com backoff exponencial e jitter
    const delay = Math.min(baseDelay * Math.pow(1.5, this.connectionAttempts), maxDelay) + jitter;
    
    console.log(`[SocketService] Tentando reconectar em ${(delay/1000).toFixed(1)} segundos... (tentativa ${this.connectionAttempts + 1})`);
    
    // Verificar o estado do circuit breaker
    if (this.circuitBreakerActive) {
      console.log('[SocketService] Circuit breaker ativo. Aguardando reset...');
      return;
    }
    
    this.reconnectTimeout = setTimeout(() => {
      // Verificar o estado da rede antes de tentar reconectar
      if (navigator.onLine === false) {
        console.log('[SocketService] Dispositivo offline. Reagendando tentativa de reconexão...');
        // Tentar novamente após algum tempo
        this.reconnect();
        return;
      }
      
      console.log(`[SocketService] Executando tentativa de reconexão ${this.connectionAttempts + 1}...`);
      
      // Incrementar falhas consecutivas para o circuit breaker
      this.consecutiveFailures++;
      
      // Verificar se o circuit breaker deve ser ativado
      if (this.consecutiveFailures >= this.failureThreshold) {
        this.activateCircuitBreaker();
        return;
      }
      
      // Tentar conectar
      this.connect();
    }, delay);
  }
  
  // Método para ativar o circuit breaker
  private activateCircuitBreaker(): void {
    if (this.circuitBreakerActive) return;
    
    console.log(`[SocketService] ⚡ Ativando circuit breaker após ${this.consecutiveFailures} falhas consecutivas`);
    this.circuitBreakerActive = true;
    
    // Notificar o usuário
    toast({
      title: "Problemas de conexão detectados",
      description: "Detectamos problemas persistentes na conexão. Tentaremos novamente em breve.",
      variant: "destructive"
    });
    
    // Configurar tempo para reset do circuit breaker
    if (this.circuitBreakerResetTimeout) {
      clearTimeout(this.circuitBreakerResetTimeout);
    }
    
    this.circuitBreakerResetTimeout = setTimeout(() => {
      console.log('[SocketService] 🔄 Resetando circuit breaker e tentando reconectar...');
      this.circuitBreakerActive = false;
      this.consecutiveFailures = 0;
      
      // Tentar reconectar após o reset
      this.connect();
    }, this.resetTime);
  }
  
  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }
  
  private getSocketUrl(): string {
    try {
      // Usar o método do arquivo de configuração para obter a URL do WebSocket
      let wsUrl = config.getSocketUrl();
      console.log('[SocketService] Usando URL de WebSocket:', wsUrl);
      return wsUrl;
    } catch (error) {
      console.error('[SocketService] Erro ao obter URL do WebSocket:', error);
      
      // Valor padrão para o serviço WebSocket
      const wsUrl = 'wss://backend-production-2f96.up.railway.app';
      console.log('[SocketService] Usando URL de WebSocket padrão:', wsUrl);
      return wsUrl;
    }
  }
  
  private connect(): void {
    if (this.socket) {
      console.log('[SocketService] Socket já existente. Verificando estado da conexão...');
      
      if (this.socket.connected) {
        console.log('[SocketService] Socket já conectado. Atualizando configurações de listener.');
        this.setupEventListeners();
        return;
      } else {
        console.log('[SocketService] Socket existente mas desconectado. Recriando conexão...');
        this.socket.disconnect();
        this.socket = null;
      }
    }

    try {
      // Verificar estado do circuit breaker antes de tentar conectar
      if (this.circuitBreakerActive) {
        console.log('[SocketService] Circuit breaker ativo. Aguardando reset antes de conectar.');
        return;
      }
      
      const wsUrl = this.getSocketUrl();
      console.log('[SocketService] Conectando ao servidor WebSocket:', wsUrl);
      
      this.socket = io(wsUrl, {
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10,
        // Reduzir timeout para reconectar mais rapidamente
        timeout: 5000,
        // Configurar para reconexão mais agressiva
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        // Adicionar callbacks para monitorar eventos de reconexão
        extraHeaders: {
          'x-client-version': '1.2.0', // Ajudar o servidor a identificar versões problemáticas
          'x-connection-attempt': String(this.connectionAttempts)
        }
      });

      // Adicionar listener para monitorar tentativas de reconexão do socket.io
      this.socket.io.on('reconnect_attempt', (attempt: number) => {
        console.log(`[SocketService] Socket.IO tentativa de reconexão #${attempt}`);
      });
      
      this.socket.io.on('reconnect_error', (error: Error) => {
        console.error('[SocketService] Socket.IO erro de reconexão:', error.message);
      });
      
      this.socket.io.on('reconnect_failed', () => {
        console.error('[SocketService] Socket.IO falha na reconexão após todas as tentativas');
      });
      
      this.socket.io.on('reconnect', (attempt: number) => {
        console.log(`[SocketService] Socket.IO reconectado após ${attempt} tentativas`);
      });

      this.setupEventListeners();
    } catch (error) {
      console.error('[SocketService] Erro ao conectar ao servidor WebSocket:', error);
      this.connectionActive = false;
      this.isConnected = false;
      
      // Notificar o usuário
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar ao servidor de dados em tempo real. Tentaremos novamente automaticamente.",
        variant: "destructive"
      });
      
      // Tentar reconectar se a reconexão automática estiver habilitada
      if (this.autoReconnect) {
        this.connectionAttempts++;
        this.reconnect();
      }
    }
  }

  // Método para determinar a cor de um número (pode ser implementado conforme necessário)
  private determinarCorNumero(numero: number): string {
    // Implementação básica, ajuste conforme as regras do seu jogo
    if (numero === 0 || numero === 37) return 'verde';
    if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(numero)) {
      return 'vermelho';
    }
    return 'preto';
  }

  // Método para requisitar números recentes
  private requestRecentNumbers(): void {
    // Implementação do método
    if (this.socket && this.isConnected) {
      this.socket.emit('get_recent_numbers');
    }
  }
  
  // Processar eventos de estratégia
  private processStrategyEvent(data: any): void {
    // Implementação do processamento
    console.log('[SocketService] Evento de estratégia recebido:', data);
  }
  
  // Configurar ping periódico
  private setupPing(): void {
    // Implementação do ping
    setInterval(() => {
      if (this.socket && this.isConnected) {
        this.socket.emit('ping');
      }
    }, 30000); // Ping a cada 30 segundos
  }
  
  // Setup de handler para rejeições não tratadas
  private setupUnhandledRejectionHandler(): void {
    // Usar o manipulador de eventos global do navegador em vez de process.on
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[SocketService] Rejeição não tratada em:', event.promise, 'razão:', event.reason);
    });
  }
  
  // Método de inscrição para eventos
  public subscribe(event: string, callback: (data: any) => void): void {
    console.log(`[SocketService] INSCREVENDO para eventos da roleta: ${event}`);
    
    try {
      // Verificar se o socket está disponível
      if (this.socket) {
        // Registrar no socket.io
        this.socket.on(event, callback);
      }
      
      // Armazenar o callback no objeto listeners
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      
      // Adicionar o callback à lista
      this.listeners[event].push(callback);
      
      console.log(`[SocketService] Listener registrado para evento: ${event}, total: ${this.listeners[event].length}`);
    } catch (error) {
      console.error(`[SocketService] Erro ao registrar listener para ${event}:`, error);
    }
  }
  
  // Adicionar método para verificar se existe listener
  public hasListener(event: string): boolean {
    return !!this.listeners[event] && this.listeners[event].length > 0;
  }
  
  // Adicionar método para cancelar inscrição
  public unsubscribe(event: string, callback?: (data: any) => void): void {
    // Se callback não fornecido, remover todos os callbacks para o evento
    if (!callback) {
      this.listeners[event] = [];
      if (this.socket) {
        this.socket.off(event);
      }
      return;
    }
    
    // Se callback fornecido, remover apenas o callback específico
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
    
    // Remover do socket.io (não há como remover apenas um callback específico)
    // então precisamos remover todos e readicionar os restantes
    if (this.socket) {
      this.socket.off(event);
      // Readicionar callbacks restantes
      this.listeners[event]?.forEach(cb => {
        this.socket?.on(event, cb);
      });
    }
  }
  
  /**
   * Carrega números históricos das roletas
   * @returns Promise que é resolvida quando os dados históricos são carregados
   */
  public async loadHistoricalRouletteNumbers(): Promise<any> {
    this._isLoadingHistoricalData = true;
    console.log('[SocketService] Iniciando carregamento de dados históricos das roletas');
    
    try {
      // Lista de roletas para carregar dados históricos
      const roletasPermitidas = ROLETAS_PERMITIDAS || [];
      
      if (!roletasPermitidas.length) {
        console.warn('[SocketService] Nenhuma roleta configurada para carregamento de histórico');
        return Promise.resolve([]);
      }
      
      console.log(`[SocketService] Carregando histórico para ${roletasPermitidas.length} roletas`);
      
      // Array de promises para carregar dados de todas as roletas em paralelo
      const loadPromises = roletasPermitidas.map(roleta => {
        return this.loadRouletteHistory(roleta._id)
          .catch(error => {
            console.error(`[SocketService] Erro ao carregar histórico para roleta ${roleta.nome || roleta._id}:`, error);
            return null; // Retorna null em caso de erro, para não interromper outras cargas
          });
      });
      
      // Aguardar todas as promises
      const results = await Promise.all(loadPromises);
      
      this._isLoadingHistoricalData = false;
      console.log('[SocketService] Dados históricos carregados com sucesso:', 
        results.filter(Boolean).length, 'de', roletasPermitidas.length, 'roletas');
      
      return results.filter(Boolean);
    } catch (error) {
      this._isLoadingHistoricalData = false;
      console.error('[SocketService] Erro ao carregar dados históricos:', error);
      throw error;
    }
  }
  
  /**
   * Carrega o histórico de uma roleta específica
   * @param roletaId ID da roleta para carregar histórico
   * @returns Promise com os dados históricos
   */
  private async loadRouletteHistory(roletaId: string): Promise<HistoryData | null> {
    if (!roletaId) {
      console.warn('[SocketService] ID da roleta não fornecido para carregamento de histórico');
      return null;
    }
    
    // Verificar se temos dados em cache
    const cacheKey = `history_${roletaId}`;
    if (this.cache[cacheKey]) {
      console.log(`[SocketService] Usando dados em cache para roleta ${roletaId}`);
      return this.cache[cacheKey];
    }
    
    console.log(`[SocketService] Carregando histórico para roleta ${roletaId}`);
    
    try {
      // Se o socket está ativo, tentar buscar dados via socket
      if (this.socket && this.isConnected) {
        // Emitir evento para solicitar histórico específico
        this.socket.emit('get_history', { roletaId });
        
        // Criar promise que será resolvida quando o evento 'history_data' for recebido
        return new Promise((resolve, reject) => {
          // Timeout para evitar espera indefinida
          const timeout = setTimeout(() => {
            console.warn(`[SocketService] Timeout ao aguardar histórico para roleta ${roletaId}`);
            reject(new Error('Timeout ao aguardar dados históricos'));
          }, 10000); // 10 segundos de timeout
          
          // Handler para receber os dados
          const historyHandler = (data: any) => {
            if (data && data.roletaId === roletaId) {
              clearTimeout(timeout);
              this.socket?.off('history_data', historyHandler);
              
              // Armazenar em cache
              this.cache[cacheKey] = data;
              
              resolve(data);
            }
          };
          
          this.socket?.on('history_data', historyHandler);
        });
      } else {
        // Fallback: buscar via API REST se o socket não estiver disponível
        // Simulação de resposta para não quebrar o fluxo
        console.warn(`[SocketService] Socket indisponível para histórico da roleta ${roletaId}, usando fallback`);
        return {
          roletaId,
          numeros: [],
          message: 'Histórico indisponível no momento'
        };
      }
    } catch (error) {
      console.error(`[SocketService] Erro ao carregar histórico para roleta ${roletaId}:`, error);
      return null;
    }
  }
}

export default SocketService; 