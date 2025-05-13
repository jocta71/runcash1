/**
 * UnifiedRouletteClient
 * 
 * Cliente unificado para dados de roletas que combina:
 * 1. Streaming (SSE) para atualizações em tempo real
 * 2. REST API para acesso a dados estáticos ou como fallback
 * 
 * Este serviço ajuda a evitar chamadas duplicadas garantindo que todas as partes
 * do aplicativo usem a mesma fonte de dados.
 */

import { ENDPOINTS, getFullUrl, SSE_STREAM_URL } from './api/endpoints';
import EventBus from './EventBus';
import cryptoService from '../utils/crypto-service';
import axios from 'axios';

// Tipos para callbacks de eventos
type EventCallback = (data: any) => void;
type Unsubscribe = () => void;

// Interface para opções de configuração
interface RouletteClientOptions {
  // Opções para streaming
  streamingEnabled?: boolean;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  
  // Opções para polling fallback
  enablePolling?: boolean;
  pollingInterval?: number;
  
  // Opções gerais
  enableLogging?: boolean;
  cacheTTL?: number;
}

// Interface para resposta da API
interface ApiResponse<T> {
  error: boolean;
  data?: T;
  message?: string;
  code?: string;
  statusCode?: number;
}

// Interface para dados históricos (adaptar se necessário)
interface RouletteNumber {
  numero: number;
  timestamp: string; // ou Date
}

/**
 * Cliente unificado para dados de roletas
 */
export default class UnifiedRouletteClient {
  private static instance: UnifiedRouletteClient;
  
  // Adicionar controle global de callbacks para evitar duplicação
  private static globalCallbacks: Map<string, Set<EventCallback>> = new Map();
  private static connectionInProgress: boolean = false;
  
  // Estado
  private isInitialized = false;
  private rouletteData: Map<string, any> = new Map();
  private lastUpdateTime = 0;
  private isFetching = false;
  private fetchPromise: Promise<any[]> | null = null;
  
  // Novas propriedades para cache de histórico inicial
  private initialHistoricalDataCache = new Map<string, RouletteNumber[]>();
  private isFetchingInitialHistory = false;
  private initialHistoryFetchPromise: Promise<void> | null = null;
  
  // Flag global para controlar múltiplas instâncias tentando conectar
  private static GLOBAL_CONNECTION_ATTEMPT = false;
  
  // Configuração
  private streamingEnabled = true;
  private pollingEnabled = true;
  private pollingInterval = 100; // 10 segundos
  private cacheTTL = 300; // 30 segundos
  private logEnabled = true;
  
  // Streaming
  private eventSource: EventSource | null = null;
  private isStreamConnected = false;
  private isStreamConnecting = false;
  private streamReconnectAttempts = 0;
  private streamReconnectTimer: number | null = null;
  private readonly streamReconnectInterval: number = 5000; // 5 segundos
  private readonly maxStreamReconnectAttempts: number = 5;
  private lastReceivedAt = 0;
  private lastEventId: string | null = null;
  
  // Polling
  private pollingTimer: number | null = null;
  
  // Callbacks
  private eventCallbacks: Map<string, Set<EventCallback>> = new Map();
  
  // URL do serviço WebSocket
  private webSocketUrl = 'wss://backendapi-production-36b5.up.railway.app';
  private socket: WebSocket | null = null;
  private webSocketConnected = false;
  private webSocketReconnectTimer: number | null = null;
  private webSocketReconnectAttempts = 0;
  private readonly maxWebSocketReconnectAttempts = 5;
  
  // Flags estáticas para gerenciar conexões globalmente 
  private static ACTIVE_SSE_CONNECTION = false;
  private static SSE_CONNECTION_ID: string | null = null;
  
  // Adicionar um registro global estático para todas as conexões SSE ativas
  private static GLOBAL_SSE_CONNECTIONS = new Map<string, EventSource>();
  
  // Adicionar propriedades para controle de logs de erro
  private lastErrorTime: number = 0;
  private errorCount: number = 0;
  private errorSilenced: boolean = false;
  private readonly ERROR_THRESHOLD: number = 3; // Número de erros antes de silenciar
  private readonly ERROR_COOLDOWN: number = 30000; // 30 segundos de cooldown entre logs completos
  
  // Novo sistema de rastreamento de callbacks para evitar duplicações
  private callbackRegistry: { 
    [eventType: string]: { 
      callback: (data: any) => void, 
      componentId?: string,
      registeredAt: Date 
    }[] 
  } = {};
  
  // Controle de requisições em andamento
  private ongoingRequestCounter = 0;
  private maxConcurrentRequests = 3;
  
  /**
   * Construtor privado para garantir singleton
   */
  private constructor(options: RouletteClientOptions = {}) {
    this.log('Inicializando cliente unificado de dados de roletas');
    
    // Aplicar opções
    this.streamingEnabled = options.streamingEnabled !== false;
    this.pollingEnabled = options.enablePolling !== false;
    this.pollingInterval = options.pollingInterval || 100;
    this.cacheTTL = options.cacheTTL || 30000;
    this.logEnabled = options.enableLogging !== false;
    this.streamReconnectInterval = options.reconnectInterval || 5000;
    this.maxStreamReconnectAttempts = options.maxReconnectAttempts || 10;
    
    // Registrar eventos de visibilidade para gerenciar recursos
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      window.addEventListener('focus', this.handleFocus);
      window.addEventListener('blur', this.handleBlur);
    }
    
    // Priorizar conexão SSE (ao invés de WebSocket) 
    if (this.streamingEnabled && options.autoConnect !== false) {
      this.log('Iniciando com conexão SSE (prioridade)');
      this.connectStream();
    } else if (this.pollingEnabled) {
      // Iniciar polling apenas se streaming estiver desabilitado
      this.startPolling();
    }
    
    // Garantir que o histórico inicial seja buscado apenas uma vez
    this.fetchAndCacheInitialHistory();
    
    this.isInitialized = true;
  }
  
  /**
   * Obtém instância singleton do serviço
   */
  public static getInstance(options: RouletteClientOptions = {}): UnifiedRouletteClient {
    if (!UnifiedRouletteClient.instance) {
      // Garantir que apenas uma instância é criada, mesmo com chamadas concorrentes
      UnifiedRouletteClient.instance = new UnifiedRouletteClient(options);
      console.log('[UnifiedRouletteClient] Nova instância criada');
    }
    return UnifiedRouletteClient.instance;
  }
  
  /**
   * Conecta ao stream de dados evitando múltiplas conexões simultâneas
   */
  public connectStream(): void {
    // Evitar múltiplas tentativas de conexão simultâneas
    if (UnifiedRouletteClient.connectionInProgress) {
      this.log('Conexão já em andamento, aguardando...');
      return;
    }
    
    UnifiedRouletteClient.connectionInProgress = true;
    
    try {
      // Importar o módulo RouletteStreamClient e usar a instância centralizada
      import('../utils/RouletteStreamClient').then(async (module) => {
        const RouletteStreamClient = module.default;
        
        this.log('🔄 Verificando cliente SSE centralizado...');
        
        if (RouletteStreamClient.isConnectionActive()) {
          this.log('✅ Cliente SSE centralizado já está ativo, conectando aos eventos');
      this.isStreamConnected = true;
          
          // Se já estiver conectado, apenas registrar para eventos
          const client = RouletteStreamClient.getInstance();
          
          // Registrar para receber eventos
          client.on('update', this.handleStreamUpdate.bind(this));
          client.on('connect', this.handleStreamConnected.bind(this));
          client.on('error', this.handleStreamError.bind(this));
          
      return;
    }
    
        this.log('🔄 Aguardando inicialização do cliente SSE centralizado...');
        
        // Aguardar pela conexão ou iniciar se necessário
        const isConnected = await RouletteStreamClient.waitForConnection();
        
        if (isConnected) {
          this.log('✅ Cliente SSE centralizado conectado com sucesso');
          this.isStreamConnected = true;
          
          // Registrar para receber eventos
          const client = RouletteStreamClient.getInstance();
          client.on('update', this.handleStreamUpdate.bind(this));
          client.on('connect', this.handleStreamConnected.bind(this));
          client.on('error', this.handleStreamError.bind(this));
        } else {
          this.log('⚠️ Falha na inicialização do cliente SSE centralizado, tentando conexão direta');
          
          // Obter a instância e tentar conectar diretamente
          const client = RouletteStreamClient.getInstance();
          const success = await client.connect();
          
          if (success) {
            this.log('✅ Conexão direta bem-sucedida');
            this.isStreamConnected = true;
            
            // Registrar para receber eventos
            client.on('update', this.handleStreamUpdate.bind(this));
            client.on('connect', this.handleStreamConnected.bind(this));
            client.on('error', this.handleStreamError.bind(this));
          } else {
            this.error('❌ Falha na conexão direta');
            this.isStreamConnected = false;
          }
        }
      }).catch(error => {
        this.error('❌ Erro ao importar RouletteStreamClient:', error);
        UnifiedRouletteClient.connectionInProgress = false;
      });
    } catch (error) {
      this.error('❌ Erro ao conectar ao stream:', error);
      UnifiedRouletteClient.connectionInProgress = false;
    }
  }
  
  /**
   * Desconecta do stream SSE de forma segura
   */
  public disconnectStream(): void {
    if (!this.isStreamConnected && !this.isStreamConnecting) {
      return;
    }
    
    this.log(`Desconectando do stream SSE (ID: ${UnifiedRouletteClient.SSE_CONNECTION_ID})`);
    
    if (this.eventSource) {
      // Remover do registro global
      UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.forEach((eventSource, url) => {
        if (eventSource === this.eventSource) {
          UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.delete(url);
          this.log(`Removida conexão SSE do registro para ${url}`);
        }
      });
      
      this.eventSource.close();
      this.eventSource = null;
      this.isStreamConnected = false;
      this.isStreamConnecting = false;
      UnifiedRouletteClient.ACTIVE_SSE_CONNECTION = false;
      UnifiedRouletteClient.connectionInProgress = false;
    }
    
    if (this.streamReconnectTimer) {
      clearTimeout(this.streamReconnectTimer);
      this.streamReconnectTimer = null;
    }
  }
  
  /**
   * Reconecta ao stream de eventos após uma desconexão
   */
  private reconnectStream(): void {
    if (this.streamReconnectTimer) {
      window.clearTimeout(this.streamReconnectTimer);
    }
    
    this.streamReconnectAttempts++;
    
    if (this.streamReconnectAttempts > this.maxStreamReconnectAttempts) {
      this.error(`Máximo de tentativas de reconexão (${this.maxStreamReconnectAttempts}) atingido`);
      
      // Emitir evento
      this.emit('max-reconnect', { attempts: this.streamReconnectAttempts });
      EventBus.emit('roulette:stream-max-reconnect', { 
        attempts: this.streamReconnectAttempts,
        timestamp: new Date().toISOString()
      });
      
      // Iniciar polling como fallback se não estiver ativo
      if (this.pollingEnabled && !this.pollingTimer) {
        this.log('Iniciando polling como fallback após falha nas reconexões');
        this.startPolling();
      }
      
      return;
    }
    
    const delay = this.streamReconnectInterval * Math.min(this.streamReconnectAttempts, 5);
    this.log(`Tentando reconectar em ${delay}ms (tentativa ${this.streamReconnectAttempts})`);
    
    // Notificar sobre tentativa de reconexão
    this.emit('reconnecting', { attempt: this.streamReconnectAttempts, delay });
    
    this.streamReconnectTimer = window.setTimeout(() => {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      
      this.isStreamConnected = false;
      this.isStreamConnecting = false;
      UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT = false;
      this.connectStream();
    }, delay);
  }
  
  /**
   * Handler para abertura de conexão do stream
   */
  private handleStreamOpen(): void {
    this.log(`Conexão SSE aberta com sucesso (ID: ${UnifiedRouletteClient.SSE_CONNECTION_ID})`);
    this.isStreamConnecting = false;
    this.isStreamConnected = true;
    this.streamReconnectAttempts = 0;
    UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT = false;
    UnifiedRouletteClient.ACTIVE_SSE_CONNECTION = true;
    
    // Verificar se a conexão está registrada globalmente
    let isRegistered = false;
    UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.forEach((eventSource) => {
      if (eventSource === this.eventSource) {
        isRegistered = true;
      }
    });
    
    // Se não estiver registrada, registrar agora (caso raro)
    if (!isRegistered && this.eventSource) {
      const baseUrl = SSE_STREAM_URL.split('?')[0];
      this.log(`Registrando conexão SSE recém-aberta para ${baseUrl}`);
      UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.set(baseUrl, this.eventSource);
    }
    
    // Log do estado atual de conexões
    this.log(`Estado atual: ${UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.size} conexões SSE ativas`);
    
    // Emitir evento de conexão
    this.emit('connect', { 
      timestamp: Date.now(),
      connectionId: UnifiedRouletteClient.SSE_CONNECTION_ID,
      connectionsCount: UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.size
    });
    
    EventBus.emit('roulette:stream-connected', { 
      timestamp: new Date().toISOString(),
      connectionId: UnifiedRouletteClient.SSE_CONNECTION_ID
    });
  }
  
  /**
   * Handler para erros na conexão do stream
   */
  private handleStreamError(event: Event): void {
    const now = Date.now();
    const timeSinceLastError = now - this.lastErrorTime;
    
    // Detectar erros repetitivos
    if (timeSinceLastError < 5000) { // Erros em menos de 5 segundos são considerados repetitivos
      this.errorCount++;
      
      // Se atingimos o limite, silenciar logs detalhados
      if (this.errorCount >= this.ERROR_THRESHOLD && !this.errorSilenced) {
        this.warn('Múltiplos erros de conexão SSE detectados. Logs detalhados serão reduzidos temporariamente.');
        this.errorSilenced = true;
      }
    } else {
      // Resetar contador se passou tempo suficiente
      if (timeSinceLastError > this.ERROR_COOLDOWN) {
        this.errorCount = 1;
        this.errorSilenced = false;
      }
    }
    
    this.lastErrorTime = now;
    
    // Verificar se o erro é devido a uma mudança de rede
    const isNetworkChange = navigator.onLine === false;
    
    // Decidir o nível de log com base no estado de silenciamento
    if (!this.errorSilenced) {
      this.error('Erro na conexão SSE:', event, isNetworkChange ? '(offline)' : '');
    } else if (timeSinceLastError > this.ERROR_COOLDOWN) {
      // Log resumido periódico mesmo no modo silenciado
      this.warn(`Conexão SSE continua instável. ${this.errorCount} erros desde a última notificação.`);
    }
    
    // Remover esta conexão do registro global se ocorrer um erro
    if (this.eventSource) {
      UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.forEach((eventSource, url) => {
        if (eventSource === this.eventSource) {
          if (!this.errorSilenced) {
            this.log(`Removendo conexão com erro para ${url} do registro global`);
          }
          UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.delete(url);
        }
      });
    }
    
    // Se a conexão estava previamente estabelecida, tentar reconectar
    if (this.isStreamConnected) {
      this.isStreamConnected = false;
      
      // Atualizar flag global apenas se não houver mais conexões ativas
      if (UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.size === 0) {
        UnifiedRouletteClient.ACTIVE_SSE_CONNECTION = false;
      }
      
      this.emit('error', { 
        type: 'stream', 
        message: 'Conexão perdida', 
        timestamp: now,
        connectionsCount: UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.size,
        silenced: this.errorSilenced,
        errorCount: this.errorCount
      });
      
      // Tentar reconectar automaticamente
      this.reconnectStream();
    } else if (this.isStreamConnecting) {
      // Falha ao conectar pela primeira vez
      this.isStreamConnecting = false;
      UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT = false;
      
      // Tentar reconectar se não for o último limite
      if (this.streamReconnectAttempts < this.maxStreamReconnectAttempts) {
        this.reconnectStream();
      } else {
        // Desistir e usar polling
        if (!this.errorSilenced) {
          this.warn('Número máximo de tentativas de conexão atingido. Usando polling como fallback.');
        }
        
        // Atualizar flag global apenas se não houver mais conexões ativas
        if (UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.size === 0) {
          UnifiedRouletteClient.ACTIVE_SSE_CONNECTION = false;
          UnifiedRouletteClient.SSE_CONNECTION_ID = null;
        }
        
        if (this.pollingEnabled && !this.pollingTimer) {
          this.startPolling();
        }
      }
    }
  }
  
  /**
   * Handler para evento inicial 'connected'
   */
  private handleStreamConnected(event: MessageEvent): void {
    try {
      // Verificar se event.data está definido antes de tentar parsear
      if (!event.data) {
        this.log(`Conexão SSE estabelecida (ID: ${UnifiedRouletteClient.SSE_CONNECTION_ID}), sem dados`);
        
        this.isStreamConnected = true;
        this.isStreamConnecting = false;
        UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT = false;
        UnifiedRouletteClient.ACTIVE_SSE_CONNECTION = true;
        this.lastReceivedAt = Date.now();
        
        // Parar polling se estiver ativo
        this.stopPolling();
        
        // Emitir evento para notificar outros componentes
        this.emit('connected', {});
        EventBus.emit('roulette:connected', {
          timestamp: new Date().toISOString(),
          connectionId: UnifiedRouletteClient.SSE_CONNECTION_ID
        });
        
        // Tentar buscar dados iniciais (caso não tenhamos)
        if (this.rouletteData.size === 0) {
          this.fetchRouletteData().catch(err => {
            this.error('Erro ao buscar dados iniciais após conexão:', err);
          });
        }
        return;
      }
      
      // Processar mensagem de conexão
      const data = JSON.parse(event.data);
      
      this.log(`Conexão SSE estabelecida (ID: ${UnifiedRouletteClient.SSE_CONNECTION_ID}):`, data);
      
      this.isStreamConnected = true;
      this.isStreamConnecting = false;
      UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT = false;
      UnifiedRouletteClient.ACTIVE_SSE_CONNECTION = true;
      this.lastReceivedAt = Date.now();
      
      // Parar polling se estiver ativo
      this.stopPolling();
      
      // Emitir evento para notificar outros componentes
      this.emit('connected', data);
      EventBus.emit('roulette:connected', {
        data,
        timestamp: new Date().toISOString(),
        connectionId: UnifiedRouletteClient.SSE_CONNECTION_ID
      });
      
      // Tentar buscar dados iniciais (caso não tenhamos)
      if (this.rouletteData.size === 0) {
        this.fetchRouletteData().catch(err => {
          this.error('Erro ao buscar dados iniciais após conexão:', err);
        });
      }
    } catch (err) {
      this.error('Erro ao processar evento connected:', err, event.data);
    }
  }
  
  /**
   * Manipula atualizações recebidas via SSE
   */
  private handleStreamUpdate(data: any): void {
    try {
      // Verificar tipo de dados e processar de acordo
      let jsonData: any;
      
      // Se data for string, tentar parsear como JSON
      if (typeof data === 'string') {
        try {
          jsonData = JSON.parse(data);
        } catch (error) {
          this.error('Erro ao analisar dados JSON do stream:', error);
        return;
      }
      } else {
        // Se não for string, usar diretamente
        jsonData = data;
      }
      
      // Processar diferentes formatos de dados
      if (jsonData.type === 'all_roulettes_update' && Array.isArray(jsonData.data)) {
        // Formato com tipo e array de dados
        this.log(`📡 Recebidos dados de ${jsonData.data.length} roletas via stream`);
        this.updateCache(jsonData.data);
        this.emit('update', jsonData.data);
      } else if (jsonData.type === 'single_roulette_update' && jsonData.data) {
        // Formato com tipo e dados de uma roleta
        this.log(`📡 Recebidos dados da roleta ${jsonData.data.id || 'desconhecida'} via stream`);
        if (jsonData.data.id) {
          this.updateCache([jsonData.data]);
          this.emit('update', jsonData.data);
        }
      } else if (Array.isArray(jsonData)) {
        // Formato de array direto
        this.log(`📡 Recebidos dados de ${jsonData.length} roletas via stream`);
        this.updateCache(jsonData);
        this.emit('update', jsonData);
      } else if (jsonData.id) {
        // Formato de objeto único com ID
        this.log(`📡 Recebidos dados da roleta ${jsonData.id} via stream`);
        this.updateCache([jsonData]);
        this.emit('update', jsonData);
      } else if (jsonData.type === 'heartbeat') {
        // Heartbeat do servidor - apenas registrar
        this.lastReceivedAt = Date.now();
      } else {
        // Formato desconhecido
        this.error('Dados de atualização inválidos recebidos do stream');
      }
      
      // Atualizar timestamp de recepção
      this.lastReceivedAt = Date.now();
      
    } catch (error) {
      this.error('Erro ao processar atualização do stream:', error);
    }
  }
  
  /**
   * Gera e utiliza dados simulados como fallback quando a descriptografia falha
   */
  private useSimulatedData(): void {
    this.log('Usando dados simulados do crypto-service como fallback');
    
    // Usar os dados simulados do crypto-service em vez de criar manualmente
    cryptoService.decryptData('dummy')
      .then(simulatedResponse => {
        if (simulatedResponse && simulatedResponse.data && simulatedResponse.data.roletas) {
          const simulatedData = simulatedResponse.data.roletas;
          this.log(`Usando ${simulatedData.length} roletas simuladas do crypto-service`);
          
          // Atualizar cache com dados simulados e notificar
          this.updateCache(simulatedData);
          this.emit('update', simulatedData);
          EventBus.emit('roulette:data-updated', {
            timestamp: new Date().toISOString(),
            data: simulatedData,
            source: 'simulation-from-crypto-service'
          });
        } else {
          this.error('Formato de dados simulados inesperado do crypto-service');
          
          // Criar roletas simuladas manualmente como fallback
          const manualSimulatedData = [{
            id: 'simulated_recovery_' + Date.now(),
            nome: 'Roleta Simulada Fallback',
            provider: 'Fallback de Simulação',
            status: 'online',
            numeros: Array.from({length: 20}, () => Math.floor(Math.random() * 37)),
            ultimoNumero: Math.floor(Math.random() * 37),
            horarioUltimaAtualizacao: new Date().toISOString()
          }];
          
          // Atualizar cache com dados simulados e notificar
          this.updateCache(manualSimulatedData);
          this.emit('update', manualSimulatedData);
          EventBus.emit('roulette:data-updated', {
            timestamp: new Date().toISOString(),
            data: manualSimulatedData,
            source: 'manual-simulation-fallback'
          });
        }
      })
      .catch(error => {
        this.error('Erro ao obter dados simulados do crypto-service:', error);
        
        // Fallback para dados simulados manualmente em caso de erro
        const fallbackData = [{
          id: 'fallback_' + Date.now(),
          nome: 'Roleta Fallback',
          provider: 'Erro de Simulação',
          status: 'online',
          numeros: Array.from({length: 20}, () => Math.floor(Math.random() * 37)),
          ultimoNumero: Math.floor(Math.random() * 37),
          horarioUltimaAtualizacao: new Date().toISOString()
        }];
        
        // Atualizar cache com dados simulados e notificar
        this.updateCache(fallbackData);
        this.emit('update', fallbackData);
        EventBus.emit('roulette:data-updated', {
          timestamp: new Date().toISOString(),
          data: fallbackData,
          source: 'fallback-after-simulation-error'
        });
      });
  }
  
  /**
   * Inicia o polling como fallback
   * Só deve ser usado quando o streaming não está disponível
   */
  private startPolling(): void {
    if (!this.pollingEnabled) {
      return;
    }
    
    // Não iniciar polling se o streaming estiver conectado ou conectando
    if (this.isStreamConnected || this.isStreamConnecting) {
      this.log('Streaming conectado ou conectando, não iniciando polling');
      return;
    }
    
    if (this.pollingTimer) {
      window.clearInterval(this.pollingTimer);
    }
    
    this.log(`Iniciando polling como fallback (intervalo: ${this.pollingInterval}ms)`);
    
    // Buscar dados imediatamente
    this.fetchRouletteData();
    
    // Configurar intervalo
    this.pollingTimer = window.setInterval(() => {
      // Verificar novamente se o streaming não foi conectado
      if (this.isStreamConnected || this.isStreamConnecting) {
        this.log('Streaming conectado, parando polling');
        this.stopPolling();
        return;
      }
      
      this.fetchRouletteData();
    }, this.pollingInterval) as unknown as number;
  }
  
  /**
   * Para o polling
   */
  private stopPolling(): void {
    if (this.pollingTimer) {
      window.clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      this.log('Polling parado');
    }
  }
  
  /**
   * Busca os dados mais recentes das roletas
   */
  public async fetchRouletteData(): Promise<any[]> {
    try {
    if (this.isFetching) {
        this.log('⚠️ Já existe uma requisição em andamento, aguardando...');
        return this.rouletteData ? Array.from(this.rouletteData.values()) : [];
      }
      
      this.isFetching = true;
      
      // Tentar obter dados via RouletteStreamClient primeiro
      try {
        // Importar dinamicamente para evitar dependência circular
        const { default: RouletteStreamClient } = await import('../utils/RouletteStreamClient');
        const streamClient = RouletteStreamClient.getInstance();
        
        // Verificar se o cliente está conectado
        const status = streamClient.getStatus();
        if (status.isConnected && status.cacheSize > 0) {
          this.log('📡 Obtendo dados do RouletteStreamClient');
          const data = streamClient.getAllRouletteData();
          
          // Atualizar cache local
          this.updateCache(data);
          this.isFetching = false;
          
          return data;
        } else {
          // Se o cliente SSE estiver conectado mas sem dados, aguardar
          this.log('🔄 Cliente SSE conectado mas sem dados, aguardando...');
          // Tentar reconectar o cliente SSE
          try {
            this.log('🔄 Tentando reconectar cliente SSE...');
            await streamClient.connect();
            
            // Aguardar um momento para receber dados
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Verificar novamente se temos dados
            const freshData = streamClient.getAllRouletteData();
            if (freshData && freshData.length > 0) {
              this.log(`📡 Dados recebidos após reconexão: ${freshData.length} roletas`);
              this.updateCache(freshData);
              this.isFetching = false;
              return freshData;
            }
          } catch (reconnectError) {
            this.warn('⚠️ Falha ao reconectar cliente SSE:', reconnectError);
          }
          
          // Se ainda não temos dados, retornar cache atual
          this.isFetching = false;
          return this.rouletteData ? Array.from(this.rouletteData.values()) : [];
        }
      } catch (error) {
        this.warn('⚠️ Não foi possível obter dados do RouletteStreamClient:', error);
        // Retornar cache atual
        this.isFetching = false;
        return this.rouletteData ? Array.from(this.rouletteData.values()) : [];
      }
    } catch (error) {
      this.error('❌ Erro ao buscar dados das roletas:', error);
      this.isFetching = false;
      return this.rouletteData ? Array.from(this.rouletteData.values()) : [];
    }
  }
  
  /**
   * Verifica se o cache ainda é válido
   */
  private isCacheValid(): boolean {
    return (
      this.rouletteData.size > 0 && 
      Date.now() - this.lastUpdateTime < this.cacheTTL
    );
  }
  
  /**
   * Atualiza o cache com novos dados
   */
  private updateCache(data: any | any[]): void {
    if (!data) {
      console.log('DEBUG: updateCache chamado com dados inválidos');
      return;
    }
    
    console.log('DEBUG: updateCache chamado com:', Array.isArray(data) ? `Array[${data.length}]` : 'Objeto individual');
    
    if (Array.isArray(data)) {
      // Verificar se há mudanças antes de atualizar o cache
      if (data.length === 0) {
        console.log('DEBUG: Array vazio recebido, cache não atualizado');
        return;
      }
      
      // Contar itens válidos
      const validItems = data.filter(item => item && (item.id || item.roleta_id));
      console.log('DEBUG: Atualizando cache com array de dados. Items válidos:', validItems.length);
      
      // Verificar se o conteúdo é idêntico ao cache atual
      if (this.rouletteData.size === validItems.length) {
        let allEqual = true;
        for (const item of validItems) {
          const id = item.id || item.roleta_id;
          const currentItem = this.rouletteData.get(id);
          
          // Se o item não existe no cache ou é diferente, marcar como não igual
          if (!currentItem || JSON.stringify(currentItem) !== JSON.stringify(item)) {
            allEqual = false;
            break;
          }
        }
        
        // Se todos os itens são idênticos, não atualizar o cache
        if (allEqual) {
          console.log('DEBUG: Cache já contém os mesmos dados, ignorando atualização');
          return;
        }
      }
      
      // Limpar dados anteriores apenas se os novos dados são completos
      this.rouletteData.clear();
        
        // Processar cada item
        let validItemsCount = 0;
        data.forEach(item => {
          if (item && (item.id || item.roleta_id)) {
            // Usar id prioritariamente, ou roleta_id como fallback
            const id = item.id || item.roleta_id;
            this.rouletteData.set(id, item);
            validItemsCount++;
          }
        });
        
        console.log(`DEBUG: ${validItemsCount} roletas adicionadas ao cache`);
        this.lastUpdateTime = Date.now();
    } else if (data && (data.id || data.roleta_id)) {
      // Atualizar uma única roleta
      const id = data.id || data.roleta_id;
      const currentItem = this.rouletteData.get(id);
      
      // Verificar se o item já existe e é idêntico
      if (currentItem && JSON.stringify(currentItem) === JSON.stringify(data)) {
        console.log(`DEBUG: Item ${id} idêntico no cache, ignorando atualização`);
        return;
      }
      
      this.rouletteData.set(id, data);
      console.log(`DEBUG: Cache atualizado para roleta individual ${id}`);
      this.lastUpdateTime = Date.now();
    } else {
      console.log('DEBUG: Dados inválidos recebidos em updateCache, nada atualizado');
    }
  }
  
  /**
   * Adiciona um callback para eventos (alias para subscribe)
   */
  public on(event: string, callback: (data: any) => void): Unsubscribe {
    this.subscribe(event, callback);
    
    // Retornar função de limpeza
    return () => {
      this.unsubscribe(event, callback);
    };
  }
  
  /**
   * Remove um callback para um tipo de evento específico
   */
  public unsubscribe(eventType: string, callback?: (data: any) => void, componentId?: string): void {
    if (!this.callbackRegistry[eventType]) {
      return;
    }

    if (callback && !componentId) {
      // Remover por função de callback
      this.callbackRegistry[eventType] = this.callbackRegistry[eventType].filter(
        entry => entry.callback.toString() !== callback.toString()
      );
    } else if (componentId) {
      // Remover todos os callbacks deste componente
      this.callbackRegistry[eventType] = this.callbackRegistry[eventType].filter(
        entry => entry.componentId !== componentId
      );
      console.log(`[UnifiedRouletteClient] 🗑️ Removidos callbacks do componente ${componentId} para evento ${eventType}`);
    }
    
    // Manter compatibilidade com sistema antigo de callbacks
    if (callback) {
      // Remover do registro global
      if (UnifiedRouletteClient.globalCallbacks.has(eventType)) {
        const callbacks = UnifiedRouletteClient.globalCallbacks.get(eventType);
        callbacks?.delete(callback);
      }
      
      // Remover do registro local
      if (this.eventCallbacks.has(eventType)) {
        this.eventCallbacks.get(eventType)?.delete(callback);
      }
    }
  }
  
  /**
   * Adiciona um callback para eventos
   */
  public subscribe(event: string, callback: (data: any) => void, componentId?: string): void {
    if (!this.callbackRegistry[event]) {
      this.callbackRegistry[event] = [];
    }

    // Verificar se esse callback já está registrado para este componente
    const isDuplicate = this.callbackRegistry[event].some(entry => {
      if (componentId && entry.componentId === componentId) {
        console.log(`[UnifiedRouletteClient] 🔄 Callback já registrado para componente ${componentId}, ignorando`);
        return true;
      }
      
      // Também verificar se é a mesma função (modo rigoroso)
      return entry.callback.toString() === callback.toString();
    });

    if (isDuplicate) {
      return;
    }

    // Verificar se há muitos callbacks do mesmo tipo (mais de 3 para o mesmo evento é suspeito)
    if (this.callbackRegistry[event].length >= 3 && !componentId) {
      console.warn(`[UnifiedRouletteClient] ⚠️ Muitos callbacks (${this.callbackRegistry[event].length}) registrados para evento ${event}`);
    }

    // Registrar novo callback com metadados
    this.callbackRegistry[event].push({
      callback,
      componentId,
      registeredAt: new Date()
    });

    console.log(`[UnifiedRouletteClient] ➕ Novo callback registrado para evento: ${event}${componentId ? ` (componente: ${componentId})` : ''}`);
  }
  
  /**
   * Calcula um hash simples para uma função callback
   */
  private getCallbackHash(callback: Function): string {
    // Uma abordagem simples para identificar funções similares
    return callback.toString().substring(0, 50);
  }
  
  /**
   * Emite um evento para todos os callbacks registrados
   */
  private emit(event: string, data: any): void {
    if (!this.eventCallbacks.has(event)) {
      return;
    }
    
    // Criar uma cópia dos callbacks para evitar problemas se a coleção for modificada durante a iteração
    const callbacks = Array.from(this.eventCallbacks.get(event)!);
    
    for (const callback of callbacks) {
      try {
        // Verificar se o callback é realmente uma função
        if (typeof callback === 'function') {
          callback(data);
        } else {
          // Registrar erro e remover o callback inválido
          this.error(`Callback inválido encontrado para evento ${event}. Removendo...`);
          this.eventCallbacks.get(event)!.delete(callback);
        }
      } catch (error) {
        this.error(`Erro em callback para evento ${event}:`, error);
      }
    }
  }
  
  /**
   * Manipulador para mudança de visibilidade da página
   */
  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.log('Página não visível, pausando serviços');
      
      // Pausar polling se ativo
      if (this.pollingTimer) {
        window.clearInterval(this.pollingTimer);
        this.pollingTimer = null;
      }
    } else {
      this.log('Página visível, retomando serviços');
      
      // Priorizar streaming
      if (this.streamingEnabled && !this.isStreamConnected && !this.isStreamConnecting) {
        this.connectStream();
      }
      // Usar polling apenas se streaming falhar
      else if (this.pollingEnabled && !this.pollingTimer && !this.isStreamConnected) {
        this.startPolling();
      }
    }
  }
  
  /**
   * Manipulador para evento de foco na janela
   */
  private handleFocus = (): void => {
    this.log('Janela ganhou foco');
    
    // Atualizar dados imediatamente apenas se não estiver usando streaming
    if (!this.isStreamConnected && !this.isStreamConnecting) {
      this.fetchRouletteData();
    }
  }
  
  /**
   * Manipulador para evento de perda de foco
   */
  private handleBlur = (): void => {
    this.log('Janela perdeu foco');
  }
  
  /**
   * Obtém dados de uma roleta específica
   */
  public getRouletteById(id: string): any {
    return this.rouletteData.get(id) || null;
  }
  
  /**
   * Obtém dados de uma roleta pelo nome
   */
  public getRouletteByName(name: string): any {
    for (const roulette of this.rouletteData.values()) {
      const rouletteName = roulette.nome || roulette.name || '';
      if (rouletteName.toLowerCase() === name.toLowerCase()) {
        return roulette;
      }
    }
    return null;
  }
  
  /**
   * Obtém todos os dados de roletas
   */
  public getAllRoulettes(): any[] {
    return Array.from(this.rouletteData.values());
  }
  
  /**
   * Obtém o status atual do serviço
   */
  public getStatus(): any {
    return {
      isStreamConnected: this.isStreamConnected,
      isStreamConnecting: this.isStreamConnecting,
      streamReconnectAttempts: this.streamReconnectAttempts,
      isPollingActive: !!this.pollingTimer,
      lastEventId: this.lastEventId,
      lastReceivedAt: this.lastReceivedAt,
      lastUpdateTime: this.lastUpdateTime,
      cacheSize: this.rouletteData.size,
      isCacheValid: this.isCacheValid()
    };
  }
  
  /**
   * Força uma atualização dos dados de todas as roletas, com gerenciamento de concorrência
   */
  public async forceUpdate(): Promise<any[]> {
    // Se já estamos fazendo uma atualização, retornar imediatamente dados em cache
    if (this.isFetching) {
      console.log('[UnifiedRouletteClient] Já existe uma atualização forçada em andamento, retornando dados em cache');
      return this.getAllRoulettes();
    }
    
    return this.manageRequest(async () => {
      this.isFetching = true;
      console.log('[UnifiedRouletteClient] Forçando atualização de dados...');

      try {
        const data = await this.fetchRouletteData();
        
        // Evitar múltiplas emissões de eventos para os mesmos dados
        if (data && data.length > 0) {
          // Disparar o evento usando emitEvent em vez de chamar callbacks diretamente
          console.log(`[UnifiedRouletteClient] Dados atualizados: ${data.length} roletas`);
          this.emitEvent('update', data);
        } else {
          console.log('[UnifiedRouletteClient] Sem dados novos para atualizar');
        }
        
        return data;
      } finally {
        this.isFetching = false;
      }
    }, 'high');
  }
  
  /**
   * Limpa todos os recursos usados pelo cliente
   */
  public dispose(): void {
    // Desconectar qualquer EventSource ativo
    this.disconnectStream();
    
    // Limpar timers
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    if (this.streamReconnectTimer) {
      clearTimeout(this.streamReconnectTimer);
      this.streamReconnectTimer = null;
    }
    
    // Limpar callbacks
    this.eventCallbacks.clear();
    
    // Desconectar WebSocket
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    // Limpar o estado da instância
    this.isInitialized = false;
    this.isFetching = false;
    this.isStreamConnected = false;
    this.isStreamConnecting = false;
    this.webSocketConnected = false;
    
    // Remover ouvintes de eventos
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('focus', this.handleFocus);
      window.removeEventListener('blur', this.handleBlur);
    }
    
    // Resetar configurações estáticas
        UnifiedRouletteClient.ACTIVE_SSE_CONNECTION = false;
        UnifiedRouletteClient.SSE_CONNECTION_ID = null;
    UnifiedRouletteClient.connectionInProgress = false;
  }
  
  /**
   * Registra mensagem de log
   */
  private log(...args: any[]): void {
    if (this.logEnabled) {
      console.log('[UnifiedRouletteClient]', ...args);
    }
  }
  
  /**
   * Registra mensagem de erro
   */
  private error(...args: any[]): void {
    // Evitar logs de erro se estiver no modo silenciado
    if (!this.errorSilenced) {
      console.error('[UnifiedRouletteClient]', ...args);
    }
  }
  
  /**
   * Manipula mensagens de erro ou notificação especial
   */
  private handleErrorMessage(data: any): void {
    this.log('Recebida mensagem de erro ou notificação:', JSON.stringify(data).substring(0, 100));
    
    // Emitir evento de erro
    EventBus.emit('roulette:api-message', {
      timestamp: new Date().toISOString(),
      type: data.error ? 'error' : 'notification',
      message: data.message || 'Mensagem sem detalhes',
      code: data.code,
      data
    });
    
    // Notificar assinantes
    this.emit('message', data);
  }
  
  /**
   * Processa dados descriptografados
   */
  private handleDecryptedData(data: any): void {
    console.log('[UnifiedRouletteClient] Processando dados descriptografados', JSON.stringify(data).substring(0, 200));
    
    try {
      // Verificar a estrutura dos dados descriptografados
      let rouletteData = data;
      let validStructure = false;
      
      // Verificar formato padrão: { data: [...] } 
      if (data && data.data) {
        // Se data.data.roletas existe, é o formato simulado
        if (data.data.roletas && Array.isArray(data.data.roletas)) {
          console.log(`[UnifiedRouletteClient] Encontrado formato simulado com ${data.data.roletas.length} roletas`);
          rouletteData = data.data.roletas;
          validStructure = true;
        } 
        // Se data.data é um array, é o formato padrão
        else if (Array.isArray(data.data)) {
          console.log(`[UnifiedRouletteClient] Encontrado formato padrão com ${data.data.length} roletas`);
          rouletteData = data.data;
          validStructure = true;
        }
        // Se data.data é outro formato, usar diretamente
        else {
          console.log('[UnifiedRouletteClient] Usando data.data diretamente');
          rouletteData = data.data;
        }
      }
      // Verificar formato alternativo: { roletas: [...] }
      else if (data && data.roletas && Array.isArray(data.roletas)) {
        console.log(`[UnifiedRouletteClient] Encontrado formato alternativo com ${data.roletas.length} roletas`);
        rouletteData = data.roletas;
        validStructure = true;
      }
      
      // Verificar se temos um array válido para processar
      if (Array.isArray(rouletteData)) {
        console.log(`[UnifiedRouletteClient] Processando array com ${rouletteData.length} roletas`);
        validStructure = true;
        
        // Atualizar cache com os dados
        this.updateCache(rouletteData);
        
        // Emitir evento de atualização
        this.emit('update', Array.from(this.rouletteData.values()));
        EventBus.emit('roulette:data-updated', {
          timestamp: new Date().toISOString(),
          data: Array.from(this.rouletteData.values()),
          source: 'decrypted-data'
        });
      } else {
        console.warn('[UnifiedRouletteClient] Dados descriptografados não contêm array de roletas');
      }
      
      if (!validStructure) {
        console.warn('[UnifiedRouletteClient] Dados descriptografados sem estrutura esperada');
        // Tentar extrair metadados ou outras informações úteis
        if (data && typeof data === 'object') {
          EventBus.emit('roulette:metadata', {
            timestamp: new Date().toISOString(),
            data
          });
        }
        
        // Tentar reconectar via SSE 
        this.log('Tentando reconectar via SSE para obter dados reais...');
        this.connectStream();
      }
    } catch (error) {
      this.error('Erro ao processar dados descriptografados:', error);
      // Tentar reconectar via SSE
      this.log('Tentando reconectar via SSE após erro de processamento...');
      this.connectStream();
    }
  }
  
  /**
   * Mostra uma notificação para o usuário
   */
  private notify(type: string, message: string): void {
    console.log(`[UnifiedRouletteClient] Notificação (${type}): ${message}`);
    
    // Emitir evento de notificação
    EventBus.emit('notification', {
      type,
      message,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Conecta ao servidor WebSocket para receber dados reais do scraper
   */
  private connectToWebSocket(): void {
    if (this.socket) {
      // Já existe uma conexão, fechá-la antes de criar nova
      this.socket.close();
      this.socket = null;
    }
    
    try {
      this.log('Tentando conectar ao WebSocket para dados do scraper...');
      
      // Usar a URL configurada na propriedade webSocketUrl
      const wsUrl = this.webSocketUrl;
      
      // Criar nova conexão WebSocket
      this.socket = new WebSocket(wsUrl);
      
      // Configurar handlers de eventos
      this.socket.onopen = this.handleWebSocketOpen.bind(this);
      this.socket.onmessage = this.handleWebSocketMessage.bind(this);
      this.socket.onerror = this.handleWebSocketError.bind(this);
      this.socket.onclose = this.handleWebSocketClose.bind(this);
      
      this.webSocketReconnectAttempts++;
      
    } catch (error) {
      this.error('Erro ao conectar ao WebSocket:', error);
      this.scheduleWebSocketReconnect();
    }
  }
  
  /**
   * Handler para evento de abertura da conexão WebSocket
   */
  private handleWebSocketOpen(event: Event): void {
    this.log('Conexão WebSocket estabelecida com sucesso');
    this.webSocketConnected = true;
    this.webSocketReconnectAttempts = 0;
    
    // Enviar autenticação se necessário
    if (cryptoService.hasAccessKey()) {
      const accessKey = cryptoService.getAccessKey();
      const authMessage = JSON.stringify({
        type: 'auth',
        token: accessKey,
        client: 'runcash-frontend'
      });
      this.socket?.send(authMessage);
      this.log('Enviada mensagem de autenticação para o WebSocket');
    }
    
    // Solicitar dados imediatamente após a conexão
    this.requestLatestRouletteData();
    
    // Notificar sobre a conexão
    this.emit('websocket-connected', { timestamp: new Date().toISOString() });
    EventBus.emit('roulette:websocket-connected', {
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Handler para mensagens recebidas do WebSocket
   * Importante: Este método não deve retornar Promise para evitar erros de "channel closed"
   */
  private handleWebSocketMessage(event: MessageEvent): void {
    if (!event.data) {
      this.log('Mensagem WebSocket vazia recebida, ignorando');
      return;
    }
    
    // Encapsular todo o processamento em try/catch para evitar erros não tratados
    try {
      // Processar a mensagem recebida de forma síncrona
      const message = JSON.parse(event.data);
      this.log('Mensagem WebSocket recebida:', message.type || 'sem tipo');
      
      // Usar um processamento em segundo plano para operações assíncronas
      // Isso evita que este handler retorne uma Promise
      setTimeout(() => {
        this.processWebSocketMessage(message).catch(error => {
          this.error('Erro ao processar mensagem WebSocket em segundo plano:', error);
        });
      }, 0);
      
    } catch (error) {
      // Capturar erros síncronos (como parse de JSON inválido)
      this.error('Erro ao processar mensagem WebSocket:', error);
    }
  }
  
  /**
   * Método interno que processa as mensagens WebSocket de forma assíncrona
   * Este método pode retornar uma Promise sem problemas
   */
  private async processWebSocketMessage(message: any): Promise<void> {
    try {
      // Verificar tipo de mensagem
      if (message.type === 'numero' || message.type === 'update' || message.type === 'event' || message.type === 'new_number') {
        // Atualização de número de roleta - formato compatível com o scraper
        const rouletteData = {
          id: message.roleta_id || message.id,
          nome: message.roleta_nome || message.nome || message.roleta,
          provider: message.provider || 'Desconhecido',
          status: message.status || 'online',
          numeros: message.numeros || message.sequencia || [],
          ultimoNumero: message.numero || message.ultimoNumero || (message.numeros && message.numeros[0]),
          horarioUltimaAtualizacao: message.timestamp 
            ? (typeof message.timestamp === 'number' ? new Date(message.timestamp).toISOString() : message.timestamp)
            : new Date().toISOString()
        };
        
        // Log detalhado para depuração
        this.log(`Recebido número ${rouletteData.ultimoNumero} para roleta ${rouletteData.nome} (${rouletteData.id})`);
        
        // Atualizar a roleta específica no cache
        this.updateCache(rouletteData);
        
        // Emitir evento de novo número
        EventBus.emit('roulette:new-number', {
          timestamp: new Date().toISOString(),
          roleta_id: rouletteData.id,
          roleta_nome: rouletteData.nome,
          numero: rouletteData.ultimoNumero,
          source: 'websocket'
        });
        
      } else if (message.type === 'roulettes' || message.type === 'roletas' || message.type === 'list') {
        // Lista completa de roletas
        if (Array.isArray(message.data)) {
          this.log(`Recebida lista com ${message.data.length} roletas do WebSocket`);
          this.updateCache(message.data);
          this.emit('update', message.data);
          EventBus.emit('roulette:all-data-updated', {
            timestamp: new Date().toISOString(),
            data: message.data,
            source: 'websocket'
          });
        }
      } else if (message.type === 'auth-result') {
        // Resultado de autenticação
        if (message.success) {
          this.log('Autenticação no WebSocket bem-sucedida');
          // Solicitar dados após autenticação
          this.requestLatestRouletteData();
        } else {
          this.error('Falha na autenticação no WebSocket:', message.message || 'Motivo desconhecido');
        }
      } else if (message.type === 'log' || message.type === 'message') {
        // Mensagem de log do servidor
        this.log(`Mensagem de log do servidor: ${message.message || JSON.stringify(message)}`);
      } else {
        // Tipo desconhecido - tentar processar mesmo assim se tiver dados relevantes
        this.log(`Tipo de mensagem desconhecido: ${message.type || 'undefined'}`);
        
        // Verificar se podemos extrair dados de roleta mesmo assim
        if (message.roleta_id || message.roleta || message.id || message.data) {
          if (message.data && Array.isArray(message.data)) {
            // Provavelmente é uma lista de roletas
            this.log(`Processando lista de ${message.data.length} roletas de mensagem não tipada`);
            this.updateCache(message.data);
          } else if (message.numero !== undefined || message.ultimoNumero !== undefined) {
            // Provavelmente é uma atualização de número
            this.log(`Processando atualização de número de mensagem não tipada: ${message.numero || message.ultimoNumero}`);
            const rouletteData = {
              id: message.roleta_id || message.id || 'unknown',
              nome: message.roleta_nome || message.nome || message.roleta || 'Roleta Desconhecida',
              provider: message.provider || 'Desconhecido',
              status: message.status || 'online',
              numeros: message.numeros || message.sequencia || [],
              ultimoNumero: message.numero || message.ultimoNumero,
              horarioUltimaAtualizacao: message.timestamp || new Date().toISOString()
            };
            this.updateCache(rouletteData);
          }
        }
      }
    } catch (error) {
      // Log do erro, mas não propaga para evitar interrupção do processamento
      this.error('Erro no processamento assíncrono de mensagem WebSocket:', error);
    }
  }
  
  /**
   * Handler para erros na conexão WebSocket
   */
  private handleWebSocketError(event: Event): void {
    this.error('Erro na conexão WebSocket:', event);
    this.webSocketConnected = false;
    this.scheduleWebSocketReconnect();
  }
  
  /**
   * Handler para fechamento da conexão WebSocket
   */
  private handleWebSocketClose(event: CloseEvent): void {
    this.log(`Conexão WebSocket fechada: Código ${event.code}, Razão: ${event.reason}`);
    this.webSocketConnected = false;
    
    // Verificar se devemos tentar reconectar
    if (event.code !== 1000) { // 1000 é fechamento normal
      this.scheduleWebSocketReconnect();
    }
  }
  
  /**
   * Agenda uma tentativa de reconexão ao WebSocket
   */
  private scheduleWebSocketReconnect(): void {
    // Limpar timer existente
    if (this.webSocketReconnectTimer !== null) {
      window.clearTimeout(this.webSocketReconnectTimer);
      this.webSocketReconnectTimer = null;
    }
    
    // Verificar se excedemos o número máximo de tentativas
    if (this.webSocketReconnectAttempts >= this.maxWebSocketReconnectAttempts) {
      this.error(`Número máximo de tentativas de reconexão WebSocket (${this.maxWebSocketReconnectAttempts}) atingido, desistindo...`);
      
      // Tentar o fallback SSE em vez de simulação
      if (!this.isStreamConnected && !this.isStreamConnecting) {
        this.log('Tentando conexão SSE como alternativa após falha no WebSocket');
        this.connectStream();
      }
      
      return;
    }
    
    // Calcular tempo de espera (backoff exponencial)
    const reconnectDelay = Math.min(1000 * Math.pow(2, this.webSocketReconnectAttempts), 30000);
    this.log(`Agendando reconexão WebSocket em ${reconnectDelay}ms (tentativa ${this.webSocketReconnectAttempts})`);
    
    // Agendar reconexão
    this.webSocketReconnectTimer = window.setTimeout(() => {
      this.log('Tentando reconectar ao WebSocket...');
      this.connectToWebSocket();
    }, reconnectDelay) as unknown as number;
  }
  
  /**
   * Envia solicitação ao WebSocket para obter dados mais recentes
   */
  private requestLatestRouletteData(): void {
    if (!this.webSocketConnected || !this.socket) {
      return;
    }
    
    try {
      // Formato compatível com o backend API
      const requestMessage = JSON.stringify({
        type: 'request',
        action: 'get_data',
        target: 'roulettes',
        timestamp: Date.now(),
        accessKey: cryptoService.getAccessKey() || ''
      });
      
      this.socket.send(requestMessage);
      this.log('Solicitação de dados recentes enviada via WebSocket');
    } catch (error) {
      this.error('Erro ao solicitar dados via WebSocket:', error);
    }
  }

  // --- Função para Buscar e Cachear Histórico Inicial ---
  private async fetchAndCacheInitialHistory(): Promise<void> {
    if (this.isFetchingInitialHistory || this.initialHistoryFetchPromise) {
      this.log('Já existe uma busca de histórico em andamento, aguardando...');
        return this.initialHistoryFetchPromise;
    }

    this.log('Iniciando busca do histórico inicial para todas as roletas...');
    this.isFetchingInitialHistory = true;
    
    const historicalApiUrl = getFullUrl(ENDPOINTS.HISTORICAL.ALL_ROULETTES);
    
    this.initialHistoryFetchPromise = new Promise<void>(async (resolve) => {
      // Adicionar timeout para evitar bloqueio prolongado
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout ao buscar histórico inicial')), 15000);
      });
      
      try {
        this.log(`Buscando histórico inicial de: ${historicalApiUrl}`);
        
        // Usar Promise.race para evitar bloqueio prolongado
        const response = await Promise.race([
          axios.get(historicalApiUrl),
          timeoutPromise
        ]) as any; // Usar any temporariamente para evitar erro de tipo
        
        const data = response.data;
        
        if (!data || !Array.isArray(data)) {
          this.warn('Formato de resposta de histórico inválido');
          this.isFetchingInitialHistory = false;
          this.initialHistoryFetchPromise = null;
          resolve();
          return;
        }
        
        // Processamento progressivo para evitar bloqueio da UI
        await new Promise(r => setTimeout(r, 0)); // Liberar thread principal
        
        let count = 0;
        // Processar em lotes para não bloquear UI
        for (let i = 0; i < data.length; i++) {
          const roulette = data[i];
          if (roulette && roulette.nome && Array.isArray(roulette.numeros)) {
            this.initialHistoricalDataCache.set(roulette.nome, roulette.numeros);
            count++;
            
            // A cada 10 roletas, liberar thread principal
            if (i % 10 === 0 && i > 0) {
              await new Promise(r => setTimeout(r, 0));
            }
          }
        }
        
        this.log(`Histórico inicial carregado e cacheado para ${count} roletas.`);
        
        // Notificar que os dados históricos estão disponíveis
        this.emit('historical-data-ready', Array.from(this.initialHistoricalDataCache.keys()));
        
      } catch (error: any) {
        if (error.message === 'Timeout ao buscar histórico inicial') {
          this.warn('Timeout ao buscar histórico inicial, continuando com dados parciais');
          
          // Mesmo com timeout, emitir evento com dados parciais disponíveis
          if (this.initialHistoricalDataCache.size > 0) {
            this.emit('historical-data-ready', Array.from(this.initialHistoricalDataCache.keys()));
          }
        } else {
          this.error('Erro ao buscar histórico inicial:', error);
        }
      } finally {
        this.isFetchingInitialHistory = false;
        this.initialHistoryFetchPromise = null;
        resolve();
      }
    });

    return this.initialHistoryFetchPromise;
  }

  // --- Novo Método Público para Acessar o Cache ---
  public getPreloadedHistory(rouletteName: string): RouletteNumber[] | undefined {
    return this.initialHistoricalDataCache.get(rouletteName);
  }

  // --- Garantir que ENDPOINTS.HISTORICAL.ALL_ROULETTES exista ---
  // (Precisa verificar ou adicionar em frontend/src/services/api/endpoints.ts)
  // Exemplo de como poderia ser em endpoints.ts:
  // export const ENDPOINTS = {
  //   ...
  //   HISTORICAL: {
  //     ALL_ROULETTES: '/api/historical/all-roulettes',
  //   },
  //   ...
  // };

  /**
   * Verifica e registra o estado atual da conexão e dados
   * Útil para diagnosticar problemas de streaming
   */
  public diagnoseConnectionState(): any {
    const diagnosticInfo = {
      // Flags estáticas para controle global de conexões
      ACTIVE_SSE_CONNECTION: UnifiedRouletteClient.ACTIVE_SSE_CONNECTION,
      GLOBAL_CONNECTION_ATTEMPT: UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT,
      SSE_CONNECTION_ID: UnifiedRouletteClient.SSE_CONNECTION_ID,
      GLOBAL_SSE_CONNECTIONS: Array.from(UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.keys()),
      GLOBAL_SSE_CONNECTIONS_COUNT: UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.size,
      
      // Estado da instância atual
      instanceId: `instance-${Math.random().toString(36).substring(2, 9)}`,
      isConnected: this.isStreamConnected,
      isConnecting: this.isStreamConnecting,
      lastReceivedAt: this.lastReceivedAt ? new Date(this.lastReceivedAt).toISOString() : null,
      timeSinceLastEvent: this.lastReceivedAt ? `${Math.round((Date.now() - this.lastReceivedAt) / 1000)}s atrás` : 'Nunca',
      reconnectAttempts: this.streamReconnectAttempts,
      eventSourceActive: !!this.eventSource,
      eventSourceReadyState: this.eventSource ? ['CONNECTING', 'OPEN', 'CLOSED'][this.eventSource.readyState] : 'N/A',
      webSocketActive: !!this.socket && this.webSocketConnected,
      dataCount: this.rouletteData.size,
      streamingEnabled: this.streamingEnabled,
      pollingEnabled: this.pollingEnabled,
      pollingActive: !!this.pollingTimer,
      
      // Informações de ambiente
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
      onLine: typeof navigator !== 'undefined' ? navigator.onLine : 'N/A',
      timestamp: new Date().toISOString()
    };
    
    console.log('📊 Diagnóstico de conexão UnifiedRouletteClient:', diagnosticInfo);
    return diagnosticInfo;
  }
  
  /**
   * Força a reconexão do stream SSE
   */
  public forceReconnectStream(): void {
    try {
      // Aguardar a inicialização do RouletteStreamClient e então usar
      import('../utils/RouletteStreamClient').then(async (module) => {
        const RouletteStreamClient = module.default;
        
        this.log('🔄 Aguardando inicialização do cliente SSE centralizado...');
        
        // Aguardar a conexão ou inicializar se necessário
        const isConnected = await RouletteStreamClient.waitForConnection();
        
        if (isConnected) {
          this.log('✅ Cliente SSE centralizado já está conectado');
          this.isStreamConnected = true;
        } else {
          this.log('🔄 Forçando reconexão do cliente SSE centralizado');
          // Obter a instância e conectar
          const client = RouletteStreamClient.getInstance();
          const success = await client.connect();
          
          this.isStreamConnected = success;
          
          if (success) {
            this.log('✅ Reconexão bem-sucedida');
          } else {
            this.error('❌ Falha ao reconectar');
          }
        }
      }).catch(error => {
        this.error('❌ Erro ao importar RouletteStreamClient:', error);
      });
    } catch (error) {
      this.error('❌ Erro ao forçar reconexão:', error);
    }
  }

  /**
   * Inicializa a conexão SSE
   */
  private initializeSSE(): void {
    try {
      // Importar e usar o RouletteStreamClient como cliente centralizado
      import('../utils/RouletteStreamClient').then(async (module) => {
        const RouletteStreamClient = module.default;
        
        this.log('🔄 Inicializando conexão SSE via RouletteStreamClient');
        
        // Aguardar pela conexão ou iniciar se necessário
        const isConnected = await RouletteStreamClient.waitForConnection();
        
        if (isConnected) {
          this.log('✅ Cliente SSE centralizado já está conectado');
          this.isStreamConnected = true;
          this.streamReconnectAttempts = 0;
          
          // Registrar para receber eventos
          const client = RouletteStreamClient.getInstance();
          
          // Registrar handlers para eventos
          client.on('update', (data) => {
            this.handleRouletteData(data);
            this.lastReceivedAt = Date.now();
          });
          
          client.on('connect', () => {
            this.log('✅ Conexão SSE estabelecida via RouletteStreamClient');
        this.streamReconnectAttempts = 0;
        this.isStreamConnected = true;
        
        // Emitir evento de conexão bem-sucedida
        this.emit('connected', {
          timestamp: Date.now(),
              source: 'RouletteStreamClient'
            });
          });
          
          client.on('error', (error) => {
        this.error('❌ Erro na conexão SSE:', error);
        this.isStreamConnected = false;
          });
        } else {
          this.log('⚠️ Falha na inicialização do cliente SSE centralizado, tentando conexão direta');
          
          // Obter a instância e tentar conectar diretamente
          const client = RouletteStreamClient.getInstance();
          await client.connect();
        }
      }).catch(error => {
        this.error('❌ Erro ao importar RouletteStreamClient:', error);
        this.isStreamConnected = false;
      });
    } catch (error) {
      this.error('❌ Erro ao inicializar conexão SSE:', error);
      this.isStreamConnected = false;
    }
  }

  /**
   * Registra um aviso no console
   */
  private warn(message: string, ...args: any[]): void {
    console.warn('[UnifiedRouletteClient]', message, ...args);
  }

  /**
   * Processa os dados da roleta recebidos via SSE
   */
  private handleRouletteData(data: any): void {
    try {
      // Processar e validar os dados
      if (!data || typeof data !== 'object') {
        this.warn('Dados inválidos recebidos:', data);
        return;
      }

      // Atualizar o estado com os novos dados
      this.rouletteData = {
        ...this.rouletteData,
        ...data
      };

      // Notificar os subscribers
      this.notifySubscribers();
    } catch (error) {
      this.error('Erro ao processar dados da roleta:', error);
    }
  }

  /**
   * Notifica todos os subscribers sobre mudanças nos dados
   */
  private notifySubscribers(): void {
    try {
      this.eventCallbacks.forEach((callbacks, event) => {
        callbacks.forEach(callback => {
          try {
            callback(this.rouletteData);
          } catch (error) {
            this.error('Erro ao notificar subscriber:', error);
          }
        });
      });
    } catch (error) {
      this.error('Erro ao notificar subscribers:', error);
    }
  }

  /**
   * Gerencia requisições concorrentes para evitar bloqueios
   */
  private async manageRequest<T>(requestFn: () => Promise<T>, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<T> {
    // Para requisições de alta prioridade, executar imediatamente
    if (priority === 'high') {
      console.log('[UnifiedRouletteClient] ⚡ Requisição de alta prioridade sendo executada imediatamente');
      return requestFn();
    }
    
    // Se já temos muitas requisições, verificar o tipo de prioridade
    if (this.ongoingRequestCounter >= this.maxConcurrentRequests) {
      // Para requisições de baixa prioridade, aguardar mais tempo
      if (priority === 'low') {
        console.log(`[UnifiedRouletteClient] ⏳ Requisição de baixa prioridade aguardando (${this.ongoingRequestCounter}/${this.maxConcurrentRequests})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        // Para requisições normais, aguardar menos tempo
        console.log(`[UnifiedRouletteClient] ⏳ Requisição normal aguardando (${this.ongoingRequestCounter}/${this.maxConcurrentRequests})`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Se ainda temos muitas requisições após aguardar, retornar dados em cache
      if (this.ongoingRequestCounter >= this.maxConcurrentRequests) {
        console.log('[UnifiedRouletteClient] 🔄 Usando dados em cache, muitas requisições em andamento');
        // @ts-ignore - ignoramos o tipo aqui pois estamos retornando dados de cache
        return this.getAllRoulettes() as T;
      }
    }

    // Executar requisição
    this.ongoingRequestCounter++;
    try {
      return await requestFn();
    } finally {
      this.ongoingRequestCounter--;
    }
  }

  /**
   * Limpa todos os callbacks registrados para um componente específico
   */
  public unregisterComponent(componentId: string): void {
    Object.keys(this.callbackRegistry).forEach(eventType => {
      this.unsubscribe(eventType, undefined, componentId);
    });
    console.log(`[UnifiedRouletteClient] 🧹 Componente ${componentId} completamente desregistrado`);
  }

  /**
   * Diagnóstico do estado dos callbacks registrados
   */
  public getRegisteredCallbacksStats(): any {
    const stats: any = {};
    Object.keys(this.callbackRegistry).forEach(eventType => {
      stats[eventType] = {
        total: this.callbackRegistry[eventType].length,
        byComponent: {}
      };
      
      this.callbackRegistry[eventType].forEach(entry => {
        const componentId = entry.componentId || 'anonymous';
        if (!stats[eventType].byComponent[componentId]) {
          stats[eventType].byComponent[componentId] = 0;
        }
        stats[eventType].byComponent[componentId]++;
      });
    });
    
    return stats;
  }

  /**
   * Dispara um evento para todos os callbacks registrados
   */
  private emitEvent(eventType: string, data: any): void {
    if (!this.callbackRegistry[eventType] || this.callbackRegistry[eventType].length === 0) {
      return;
    }

    // Criamos uma cópia para evitar problemas se um callback modificar a lista durante a iteração
    const callbacks = [...this.callbackRegistry[eventType]];
    
    console.log(`[UnifiedRouletteClient] 📣 Disparando evento ${eventType} para ${callbacks.length} callbacks`);
    
    // Agrupar callbacks por componente para evitar duplicações por componente
    const componentGroups = new Map<string, Array<{ callback: (data: any) => void, componentId?: string }>>(); 
    
    callbacks.forEach(entry => {
      const groupKey = entry.componentId || 'anonymous';
      if (!componentGroups.has(groupKey)) {
        componentGroups.set(groupKey, []);
      }
      componentGroups.get(groupKey)!.push(entry);
    });
    
    // Executar callbacks agrupados por componente
    componentGroups.forEach((entries, componentId) => {
      try {
        // Para cada componente, executar apenas o callback mais recente
        // (para eventos que devem ter apenas um handler por componente)
        if (eventType === 'update' || eventType === 'historical-data-ready') {
          const mostRecentEntry = entries[entries.length - 1];
          mostRecentEntry.callback(data);
        } 
        // Para outros eventos, executar todos os callbacks
        else {
          entries.forEach(entry => {
            try {
              entry.callback(data);
            } catch (error) {
              console.error(`[UnifiedRouletteClient] Erro ao executar callback para evento ${eventType}:`, error);
            }
          });
        }
      } catch (error) {
        console.error(`[UnifiedRouletteClient] Erro ao executar callbacks para componente ${componentId}:`, error);
      }
    });
    
    // Manter compatibilidade com o sistema antigo
    this.notifyCallbacks(eventType, data);
  }

  /**
   * Notifica os callbacks registrados (sistema antigo)
   */
  private notifyCallbacks(event: string, data: any): void {
    // Notificar callbacks globais
    if (UnifiedRouletteClient.globalCallbacks.has(event)) {
      const callbacks = UnifiedRouletteClient.globalCallbacks.get(event);
      callbacks?.forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`[UnifiedRouletteClient] Erro ao executar callback global:`, err);
        }
      });
    }
    
    // Notificar callbacks locais
    if (this.eventCallbacks.has(event)) {
      const callbacks = this.eventCallbacks.get(event);
      callbacks?.forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`[UnifiedRouletteClient] Erro ao executar callback local:`, err);
        }
      });
    }
  }
} 