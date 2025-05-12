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
class UnifiedRouletteClient {
  /**
   * Registra uma mensagem de log no console
   */
  private log(message: string, ...args: any[]): void {
    if (this.logEnabled) {
      console.log(`[UnifiedRouletteClient] ${message}`, ...args);
    }
  }

  /**
   * Registra um erro no console
   */
  private error(message: string, ...args: any[]): void {
    console.error(`[UnifiedRouletteClient] ${message}`, ...args);
  }

  /**
   * Registra um aviso no console
   */
  private warn(message: string, ...args: any[]): void {
    console.warn(`[UnifiedRouletteClient] ${message}`, ...args);
  }
  
  private static instance: UnifiedRouletteClient;
  
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
  private pollingInterval = 10000; // 10 segundos
  private cacheTTL = 30000; // 30 segundos
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
  
  // Armazenar a última URL com parâmetros usada
  private static LAST_FULL_URL: string | null = null;
  
  /**
   * Construtor privado para garantir singleton
   */
  private constructor(options: RouletteClientOptions = {}) {
    this.log('Inicializando cliente unificado de dados de roletas');
    
    // Aplicar opções
    this.streamingEnabled = options.streamingEnabled !== false;
    this.pollingEnabled = options.enablePolling !== false;
    this.pollingInterval = options.pollingInterval || 10000;
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
      UnifiedRouletteClient.instance = new UnifiedRouletteClient(options);
    }
    return UnifiedRouletteClient.instance;
  }
  
  /**
   * Conecta ao stream de eventos SSE
   * Garante que apenas uma conexão SSE seja estabelecida por vez
   */
  public async connectStream(): Promise<void> {
    if (!this.streamingEnabled) {
      this.log('Streaming está desabilitado');
      return;
    }
    
    // Verificar se já existe uma tentativa de conexão global
    if (UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT) {
      this.log('Outra instância já está tentando conectar ao stream, aguardando...');
      
      // Aguardar um pouco e verificar novamente se uma conexão foi estabelecida
      await new Promise<void>(resolve => setTimeout(resolve, 500));
      if (UnifiedRouletteClient.ACTIVE_SSE_CONNECTION) {
        this.log('Uma conexão foi estabelecida enquanto aguardávamos.');
        return;
      }
      
      // Se ainda estiver em tentativa após o tempo de espera, continuar com uma nova tentativa
      this.log('Nenhuma conexão foi estabelecida durante a espera. Continuando com uma nova tentativa.');
    }
    
    // Marcar que estamos tentando conectar
    UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT = true;
    this.isStreamConnecting = true;
    
    try {
      const streamUrl = SSE_STREAM_URL;
      const connectionId = `sse-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      UnifiedRouletteClient.SSE_CONNECTION_ID = connectionId;
      
      // Construir URL com query params para autenticação
      let fullStreamUrl = streamUrl;
      if (cryptoService.hasAccessKey()) {
        const accessKey = cryptoService.getAccessKey();
        if (accessKey) {
          fullStreamUrl += `?key=${encodeURIComponent(accessKey)}`;
        }
      }
      
      // Armazenar a URL completa para referência
      UnifiedRouletteClient.LAST_FULL_URL = fullStreamUrl;
      
      // Extrair a URL base (sem parâmetros de consulta) para identificação única
      const baseUrl = streamUrl.split('?')[0];
      
      // Verificar e fechar qualquer conexão existente com a mesma URL base
      await this.checkAndCloseExistingConnection(baseUrl);
      
      this.log(`Conectando ao stream SSE: ${fullStreamUrl} (ID: ${connectionId})`);
      
      // Parar polling se estiver ativo
      this.stopPolling();
      
      // Criar conexão SSE
      this.eventSource = new EventSource(fullStreamUrl);
      
      // Registrar a nova conexão no mapa global usando a URL base como chave
      UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.set(baseUrl, this.eventSource);
      
      // Configurar handlers de eventos
      this.eventSource.onopen = this.handleStreamOpen.bind(this);
      this.eventSource.onerror = this.handleStreamError.bind(this);
      
      // Eventos específicos
      this.eventSource.addEventListener('message', this.handleStreamUpdate.bind(this));
      this.eventSource.addEventListener('update', this.handleStreamUpdate.bind(this));
      this.eventSource.addEventListener('connected', this.handleStreamConnected.bind(this));
      
      // Timeout de segurança para diagnóstico
      setTimeout(() => {
        if (this.eventSource) {
          console.log('📊 Status da conexão SSE após tentativa:', {
            readyState: this.eventSource.readyState,
            status: ['CONNECTING', 'OPEN', 'CLOSED'][this.eventSource.readyState] || 'UNKNOWN',
            isConnected: this.isStreamConnected,
            isConnecting: this.isStreamConnecting,
            connectionId: UnifiedRouletteClient.SSE_CONNECTION_ID,
            url: fullStreamUrl,
            lastFullUrl: UnifiedRouletteClient.LAST_FULL_URL,
            baseUrl: baseUrl,
            registeredConnections: Array.from(UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.keys()),
            totalConnections: UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.size,
            lastReceived: this.lastReceivedAt ? new Date(this.lastReceivedAt).toISOString() : 'nunca'
          });
        }
      }, 3000);
    } catch (error) {
      this.error('Erro ao conectar ao stream:', error);
      this.isStreamConnecting = false;
      UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT = false;
      UnifiedRouletteClient.ACTIVE_SSE_CONNECTION = false;
      UnifiedRouletteClient.SSE_CONNECTION_ID = null;
      this.reconnectStream();
    }
  }
  
  /**
   * Fecha todas as conexões SSE ativas
   */
  private closeAllSSEConnections(): void {
    this.log(`Fechando todas as ${UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.size} conexões SSE ativas...`);
    
    // Fechar cada conexão registrada
    UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.forEach((eventSource, url) => {
      try {
        this.log(`Fechando conexão SSE para ${url}`);
        eventSource.close();
      } catch (error) {
        this.error(`Erro ao fechar conexão SSE para ${url}:`, error);
      }
    });
    
    // Limpar o registro
    UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.clear();
    
    // Resetar flags
    UnifiedRouletteClient.ACTIVE_SSE_CONNECTION = false;
    UnifiedRouletteClient.SSE_CONNECTION_ID = null;
    UnifiedRouletteClient.LAST_FULL_URL = null;
    
    // Registrar a limpeza
    console.log('🧹 Todas as conexões SSE foram fechadas e flags resetadas');
  }
  
  /**
   * Desconecta do stream SSE
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
      
      // Fechar a conexão
      this.eventSource.close();
      this.eventSource = null;
    }
    
    if (this.streamReconnectTimer) {
      window.clearTimeout(this.streamReconnectTimer);
      this.streamReconnectTimer = null;
    }
    
    this.isStreamConnected = false;
    this.isStreamConnecting = false;
    this.streamReconnectAttempts = 0;
    UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT = false;
    UnifiedRouletteClient.ACTIVE_SSE_CONNECTION = false;
    UnifiedRouletteClient.SSE_CONNECTION_ID = null;
    
    // Notificar sobre a desconexão
    this.emit('disconnect', { timestamp: Date.now() });
    EventBus.emit('roulette:stream-disconnected', { timestamp: new Date().toISOString() });
    
    // Iniciar polling como fallback se estiver habilitado
    if (this.pollingEnabled && !this.pollingTimer) {
      this.log('Iniciando polling após desconexão do stream');
      this.startPolling();
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
    
    this.streamReconnectTimer = window.setTimeout(async () => {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      
      this.isStreamConnected = false;
      this.isStreamConnecting = false;
      UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT = false;
      await this.connectStream();
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
    // Verificar se o erro é devido a uma mudança de rede
    const isNetworkChange = navigator.onLine === false;
    
    this.error('Erro na conexão SSE:', event, isNetworkChange ? '(offline)' : '');
    
    // Remover esta conexão do registro global se ocorrer um erro
    if (this.eventSource) {
      UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.forEach((eventSource, url) => {
        if (eventSource === this.eventSource) {
          this.log(`Removendo conexão com erro para ${url} do registro global`);
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
        timestamp: Date.now(),
        connectionsCount: UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.size
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
        this.error('Número máximo de tentativas de conexão atingido. Usando polling como fallback.');
        
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
   * Handler para eventos de atualização do stream
   */
  private async handleStreamUpdate(event: MessageEvent): Promise<void> {
    this.lastReceivedAt = Date.now();
    
    try {
      // Log detalhado do evento recebido para diagnóstico
      console.log(`🔄 Evento SSE recebido:`, {
        type: event.type,
        id: event.lastEventId,
        data: event.data ? event.data.substring(0, 100) + '...' : 'vazio'
      });
      
      // Tentar extrair dados do evento
      let data = null;
      
      try {
        if (typeof event.data === 'string') {
          data = JSON.parse(event.data);
          this.log(`Dados SSE parseados: ${typeof data} - ${data.type || 'sem tipo'}`);
        } else if (event.data && typeof event.data === 'object') {
          data = event.data;
        }
      } catch (parseError) {
        this.error('Erro ao analisar dados do evento SSE:', parseError);
        return;
      }
      
      // Verificação de segurança
      if (!data) {
        this.error('Dados de atualização inválidos recebidos do stream');
        return;
      }
      
      // Tratamento de dados criptografados
      if (data.encrypted === true && data.payload) {
        try {
          const decryptedData = cryptoService.decryptData(data.payload);
          this.handleDecryptedData(decryptedData);
          return;
        } catch (decryptError) {
          this.error('Erro ao descriptografar dados:', decryptError);
        return;
        }
      }
      
      // Processo específico para dados de tipo all_roulettes_update
      if (data.type === 'all_roulettes_update' && data.data && Array.isArray(data.data)) {
        this.log(`Atualizando cache com ${data.data.length} roletas do stream SSE (evento all_roulettes_update)`);
        console.log(`📊 Recebido all_roulettes_update com ${data.data.length} roletas`);
        
        // Processar diretamente os dados do formato do SSE
        const processedData = data.data.map((roleta: any) => {
          // Converter o formato de numeros para o formato esperado pelos componentes
          if (Array.isArray(roleta.numeros)) {
            roleta.numero = roleta.numeros.map((num: number) => {
              return { numero: Number(num) };
            });
          } else if (!roleta.numero || !Array.isArray(roleta.numero)) {
            roleta.numero = [];
          }
          
          return roleta;
        });
        
        // Atualizar o cache com dados processados
        this.updateCache(processedData);
        
        // Notificar sobre a atualização dos dados
        this.emit('update', { roulettes: processedData, timestamp: new Date().toISOString() });
        EventBus.emit('roulette:data-updated', {
          roulettes: processedData, 
          source: 'stream-sse', 
          timestamp: new Date().toISOString() 
        });
        
        return;
      }
      
      // Processo específico para heartbeat
      if (data.type === 'heartbeat') {
        this.log(`Heartbeat recebido: ${data.message || 'Conexão ativa'}`);
        // Emitir evento de heartbeat para indicar que a conexão está viva
        this.emit('heartbeat', { timestamp: new Date().toISOString() });
        EventBus.emit('roulette:heartbeat', {
          timestamp: new Date().toISOString(),
          message: data.message || 'Conexão ativa'
        });
        return;
      }
      
      // Atualizar cache com novos dados, garantindo o formato correto
      console.log('[UnifiedRouletteClient] Recebendo atualização de stream:', data);
      
      // Se é um array de roletas (atualização completa)
      if (Array.isArray(data)) {
        // Processar cada roleta para garantir o formato consistente
        const processedData = data.map(roleta => {
          // Garantir que número seja um array, mesmo que vazio
          if (!roleta.numero || !Array.isArray(roleta.numero)) {
            roleta.numero = [];
          }
          
          // Garantir que cada número esteja no formato esperado pelos cards
          roleta.numero = roleta.numero.map((num: any) => {
            // Se for um objeto com propriedade numero, manter
            if (num && typeof num === 'object' && 'numero' in num) {
              return num;
            }
            
            // Se for um número diretamente, converter para o formato esperado
            if (typeof num === 'number' || (typeof num === 'string' && !isNaN(Number(num)))) {
              return { numero: Number(num) };
            }
            
            // Caso não seja possível determinar, retornar um objeto vazio
            return { numero: 0 };
          });
          
          return roleta;
        });
        
        // Atualizar o cache com dados processados
        this.updateCache(processedData);
        
        // Notificar sobre a atualização dos dados
        this.emit('update', { roulettes: processedData, timestamp: new Date().toISOString() });
        EventBus.emit('roulette:data-updated', { roulettes: processedData, source: 'stream' });
        
        // Log para depuração
        console.log(`[UnifiedRouletteClient] Cache atualizado com ${processedData.length} roletas do stream`);
      }
      // Se é um objeto de roleta única (atualização parcial)
      else if (data && typeof data === 'object' && (data.id || data._id || data.nome)) {
        // Processar para garantir o formato consistente
        if (!data.numero || !Array.isArray(data.numero)) {
          data.numero = [];
        }
        
        // Garantir que cada número esteja no formato esperado pelos cards
        data.numero = data.numero.map((num: any) => {
          // Se for um objeto com propriedade numero, manter
          if (num && typeof num === 'object' && 'numero' in num) {
            return num;
          }
          
          // Se for um número diretamente, converter para o formato esperado
          if (typeof num === 'number' || (typeof num === 'string' && !isNaN(Number(num)))) {
            return { numero: Number(num) };
          }
          
          // Caso não seja possível determinar, retornar um objeto vazio
          return { numero: 0 };
        });
        
        // Obter dados existentes
        const currentRoulettes = this.getAllRoulettes();
        
        // Encontrar e atualizar apenas a roleta específica
        const updatedRoulettes = currentRoulettes.map(existingRoulette => {
          // Verificar se é a mesma roleta por id ou nome
          if (
            existingRoulette.id === data.id || 
            existingRoulette._id === data._id || 
            existingRoulette.nome === data.nome
          ) {
            return { ...existingRoulette, ...data };
          }
          return existingRoulette;
        });
        
        // Atualizar cache
        this.updateCache(updatedRoulettes);
        
        // Notificar sobre a atualização
        this.emit('update', { roulette: data, roulettes: updatedRoulettes, timestamp: new Date().toISOString() });
        EventBus.emit('roulette:data-updated', { roulette: data, roulettes: updatedRoulettes, source: 'stream' });
        
        console.log(`[UnifiedRouletteClient] Cache atualizado com dados da roleta ${data.nome || data.id}`);
      }
      // Evento específico (como novo número)
      else if (data && typeof data === 'object' && data.type === 'new_number') {
        // Processar novo número
        console.log(`[UnifiedRouletteClient] Recebido novo número para roleta ${data.roleta_nome || data.roleta_id}:`, data.numero);
        
        // Aqui podemos atualizar a roleta específica com o novo número
        const currentRoulettes = this.getAllRoulettes();
        const updatedRoulettes = currentRoulettes.map(existingRoulette => {
          // Verificar se é a mesma roleta
          if (
            existingRoulette.id === data.roleta_id || 
            existingRoulette._id === data.roleta_id || 
            existingRoulette.nome === data.roleta_nome
          ) {
            // Adicionar o novo número ao início do array
            const newNumero = { numero: Number(data.numero) };
            return {
              ...existingRoulette,
              numero: [newNumero, ...(existingRoulette.numero || [])]
            };
          }
          return existingRoulette;
        });
        
        // Atualizar cache
        this.updateCache(updatedRoulettes);
        
        // Notificar sobre o novo número
        this.emit('new_number', { ...data, timestamp: new Date().toISOString() });
        EventBus.emit('roulette:new-number', { ...data, timestamp: new Date().toISOString() });
        EventBus.emit('roulette:data-updated', { roulettes: updatedRoulettes, source: 'new-number' });
      }
      
    } catch (e) {
      this.error('Erro ao processar atualização do stream:', e);
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
   * Obtém dados simulados ou reais das roletas
   */
  public async fetchRouletteData(): Promise<any[]> {
    // Evitar requisições simultâneas
    if (this.isFetching) {
      this.log('Requisição já em andamento, aguardando...');
      if (this.fetchPromise) {
        return this.fetchPromise;
      }
      return Array.from(this.rouletteData.values());
    }
    
    // Verificar se o SSE já está conectado
    if (this.isStreamConnected) {
      this.log('Stream SSE já está conectado, usando dados em cache');
      return Array.from(this.rouletteData.values());
    }
    
    // Tentar conectar ao SSE se não estiver conectado
    if (!this.isStreamConnected && !this.isStreamConnecting) {
      this.log('Tentando conectar ao SSE para obter dados reais...');
      this.connectStream();
      
      // Esperar um pouco para dar tempo da conexão se estabelecer
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Verificar se o cache ainda é válido
    if (this.isCacheValid()) {
      this.log('Usando dados em cache (ainda válidos)');
      return Array.from(this.rouletteData.values());
    }
    
    // Se já tivermos alguns dados, retorná-los mesmo que não sejam recentes
    if (this.rouletteData.size > 0) {
      this.log('Retornando dados existentes em cache enquanto aguarda conexão SSE');
      return Array.from(this.rouletteData.values());
    }
    
    // Avisar o usuário que não temos dados disponíveis ainda
    console.warn('[UnifiedRouletteClient] Tentando obter dados reais via SSE, aguarde. Se não aparecer, verifique sua conexão.');
    
    // Se não tivermos absolutamente nenhum dado, retornar array vazio
    // O componente que chamou este método receberá atualizações via eventos quando os dados chegarem
    this.log('Nenhum dado disponível ainda, retornando array vazio');
    return [];
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
    console.log('DEBUG: updateCache chamado com:', Array.isArray(data) ? `Array[${data.length}]` : 'Objeto individual');
    
    if (Array.isArray(data)) {
      // Com array de roletas - atualização completa
      // Limpar o cache existente para dados atualizados
      if (data.length > 0) {
        console.log('DEBUG: Atualizando cache com array de dados. Items válidos:', 
          data.filter(item => item && item.id).length);
        
        this.rouletteData.clear(); // Limpar dados antigos
        
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
      } else {
        console.log('DEBUG: Array vazio recebido, cache não atualizado');
      }
    } else if (data && (data.id || data.roleta_id)) {
      // Atualizar uma única roleta
      const id = data.id || data.roleta_id;
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
   * Remove um callback de eventos (alias para unsubscribe)
   */
  public off(event: string, callback: (data: any) => void): void {
    this.unsubscribe(event, callback);
  }
  
  /**
   * Remove um callback de eventos
   */
  public unsubscribe(event: string, callback: (data: any) => void): void {
    if (typeof callback !== 'function') {
      this.error('❌ Tentativa de remover callback inválido');
      return;
    }
    
    try {
      if (this.eventCallbacks.has(event)) {
        const callbacks = this.eventCallbacks.get(event)!;
        const initialSize = callbacks.size;
        
        // Problema: O callback passado pode não ser a mesma referência que foi usada no subscribe
        // Solução: Procurar pelo callback inspecionando o código fonte das funções
        let removed = false;
        
        // Primeiro tentar remover diretamente (caso seja a mesma referência)
        callbacks.delete(callback);
        
        // Se não conseguir remover diretamente, comparar o código fonte das funções
        if (callbacks.size === initialSize) {
          // Obter a string do callback original
          const originalCallbackString = callback.toString();
          
          // Criar uma nova coleção para não modificar a original durante a iteração
          const callbacksArray = Array.from(callbacks);
          
          for (const registeredCallback of callbacksArray) {
            // Verificar se é uma função anônima com o mesmo corpo
            if (registeredCallback.toString() === originalCallbackString) {
              callbacks.delete(registeredCallback);
              removed = true;
              this.log(`➖ Callback removido do evento ${event} por comparação de string`);
              break;
            }
          }
        } else {
          removed = true;
        }
        
        if (removed || callbacks.size < initialSize) {
          this.log(`➖ Callback removido do evento: ${event}`);
        } else {
          this.warn('⚠️ Callback não encontrado para remoção');
        }
      }
    } catch (error) {
      this.error('❌ Erro ao remover callback:', error);
    }
  }
  
  /**
   * Adiciona um callback para eventos
   */
  public subscribe(event: string, callback: (data: any) => void): void {
    if (typeof callback !== 'function') {
      this.error('❌ Tentativa de adicionar callback inválido:', {
        type: typeof callback,
        value: callback,
        stack: new Error().stack
      });
      return;
    }

    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, new Set());
    }
    
    // Verificar se o callback já está registrado
    if (this.eventCallbacks.get(event)!.has(callback)) {
      this.warn('⚠️ Callback já registrado para evento:', event);
      return;
    }

    try {
      // Adicionar callback com validação adicional
      const validatedCallback = (data: any) => {
        try {
          if (typeof callback === 'function') {
            callback(data);
          } else {
            this.error('⚠️ Callback se tornou inválido durante execução');
            this.unsubscribe(event, callback);
          }
        } catch (error) {
          this.error('❌ Erro ao executar callback:', error);
          this.unsubscribe(event, callback);
        }
      };

      this.eventCallbacks.get(event)!.add(validatedCallback);
      this.log(`➕ Novo callback registrado para evento: ${event}`);
    } catch (error) {
      this.error('❌ Erro ao registrar callback:', error);
    }
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
    // Coletar informações sobre todas as conexões EventSource ativas
    const activeConnections: Array<{url: string, state: string, readyState: number}> = [];
    UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.forEach((eventSource, url) => {
      activeConnections.push({
        url,
        state: ['CONNECTING', 'OPEN', 'CLOSED'][eventSource.readyState] || 'UNKNOWN',
        readyState: eventSource.readyState
      });
    });
    
    return {
      isStreamConnected: this.isStreamConnected,
      isStreamConnecting: this.isStreamConnecting,
      activeSSEConnection: UnifiedRouletteClient.ACTIVE_SSE_CONNECTION,
      globalConnectionAttempt: UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT,
      sseConnectionId: UnifiedRouletteClient.SSE_CONNECTION_ID,
      lastFullUrl: UnifiedRouletteClient.LAST_FULL_URL,
      globalSSEConnectionsCount: UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.size,
      globalSSEConnectionsUrls: Array.from(UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.keys()),
      activeConnections,
      streamReconnectAttempts: this.streamReconnectAttempts,
      lastEventId: this.lastEventId,
      lastReceivedAt: this.lastReceivedAt,
      lastUpdateTime: this.lastUpdateTime,
      cacheSize: this.rouletteData.size,
      isCacheValid: this.isCacheValid(),
      isPollingActive: !!this.pollingTimer,
      streamingEnabled: this.streamingEnabled,
      pollingEnabled: this.pollingEnabled
    };
  }
  
  /**
   * Força uma atualização imediata dos dados
   * Tenta reconectar o streaming se não estiver conectado
   */
  public forceUpdate(): Promise<any[]> {
    // Se streaming não estiver conectado, tenta reconectar
    if (this.streamingEnabled && !this.isStreamConnected && !this.isStreamConnecting) {
      this.log('Forçando reconexão do stream');
      this.connectStream();
      return Promise.resolve(Array.from(this.rouletteData.values()));
    }
    
    // Caso contrário, busca dados via REST
    return this.fetchRouletteData();
  }
  
  /**
   * Força a reconexão do stream e registro do status
   */
  public forceReconnectStream(): void {
    // Registrar estado atual
    console.log('Estado antes da reconexão:');
    this.diagnoseConnectionState();
    
    // Fechar todas as conexões SSE existentes para garantir uma reconexão limpa
    this.closeAllSSEConnections();
    
    // Resetar flags
    UnifiedRouletteClient.ACTIVE_SSE_CONNECTION = false;
    UnifiedRouletteClient.SSE_CONNECTION_ID = null;
    UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT = false;
    this.isStreamConnected = false;
    this.isStreamConnecting = false;
    
    // Pequeno delay antes de reconectar para garantir que o navegador tenha tempo
    // suficiente para fechar completamente as conexões existentes
    setTimeout(async () => {
      console.log('Tentando reconectar stream com estado limpo...');
      
      // Forçar novo ID de conexão
      UnifiedRouletteClient.SSE_CONNECTION_ID = `sse-force-reconnect-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Tentar criar uma nova conexão única
      await this.connectStream();
      
      // Verificar estado após tentativa
      setTimeout(() => {
        console.log('Estado após tentativa de reconexão:');
        this.diagnoseConnectionState();
      }, 2000);
    }, 1000);
  }

  /**
   * Inicializa a conexão SSE
   */
  private async initializeSSE(): Promise<void> {
    if (this.eventSource) {
      this.log('🔄 Reconectando stream SSE...');
      this.eventSource.close();
    }

    try {
      await this.connectStream();
    } catch (error) {
      this.error('❌ Erro ao inicializar conexão SSE:', error);
      this.isStreamConnected = false;
      
      // Tentar reconexão após erro
      setTimeout(() => this.initializeSSE(), this.streamReconnectInterval);
    }
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
   * Verifica se uma conexão SSE para a URL base já existe.
   * Se existir, a fecha antes de criar uma nova conexão.
   * @param {string} urlBase - A URL base para verificar (sem parâmetros de consulta)
   * @returns {Promise<void>}
   */
  private async checkAndCloseExistingConnection(urlBase: string): Promise<void> {
    const existingConnection = UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.get(urlBase);
    
    if (existingConnection) {
      this.log(`Encontrada conexão existente para ${urlBase}. Fechando para evitar conexões duplicadas.`);
      
      try {
        existingConnection.close();
        UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.delete(urlBase);
        
        // Detectar se há outras conexões ativas
        if (UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.size === 0) {
          UnifiedRouletteClient.ACTIVE_SSE_CONNECTION = false;
          UnifiedRouletteClient.SSE_CONNECTION_ID = null;
        }
        
        // Adicionar um pequeno atraso para garantir que o navegador reconheça o fechamento
        await new Promise<void>(resolve => setTimeout(resolve, 300));
        
        this.log(`Conexão anterior para ${urlBase} fechada com sucesso.`);
      } catch (error) {
        this.error(`Erro ao fechar conexão existente para ${urlBase}:`, error);
      }
    }
  }

  /**
   * Diagnóstica o estado atual da conexão
   */
  public diagnoseConnectionState(): any {
    const state = {
      isStreamConnected: this.isStreamConnected,
      isStreamConnecting: this.isStreamConnecting,
      ACTIVE_SSE_CONNECTION: UnifiedRouletteClient.ACTIVE_SSE_CONNECTION,
      GLOBAL_CONNECTION_ATTEMPT: UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT,
      SSE_CONNECTION_ID: UnifiedRouletteClient.SSE_CONNECTION_ID,
      lastFullUrl: UnifiedRouletteClient.LAST_FULL_URL,
      GLOBAL_SSE_CONNECTIONS_COUNT: UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.size,
      GLOBAL_SSE_CONNECTIONS_URLS: Array.from(UnifiedRouletteClient.GLOBAL_SSE_CONNECTIONS.keys()),
      streamReconnectAttempts: this.streamReconnectAttempts,
      lastEventId: this.lastEventId,
      lastReceivedAt: this.lastReceivedAt ? new Date(this.lastReceivedAt).toISOString() : null,
      eventSourceReadyState: this.eventSource ? this.eventSource.readyState : null,
      eventSourceReadyStateText: this.eventSource 
        ? ['CONNECTING', 'OPEN', 'CLOSED'][this.eventSource.readyState] || 'UNKNOWN' 
        : 'NO_EVENTSOURCE',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      isOnline: navigator.onLine
    };
    
    console.log('📊 Diagnóstico da conexão SSE:', state);
    return state;
  }

  /**
   * Busca e armazena em cache o histórico inicial de roletas
   */
  private async fetchAndCacheInitialHistory(): Promise<void> {
    if (this.isFetchingInitialHistory) {
      return this.initialHistoryFetchPromise;
    }
    
    this.isFetchingInitialHistory = true;
    this.initialHistoryFetchPromise = new Promise<void>(async (resolve) => {
      try {
        this.log('Buscando histórico inicial de roletas...');
        // Implementação real depende da API disponível
        resolve();
      } catch (error) {
        this.error('Erro ao buscar histórico inicial:', error);
        resolve();
      } finally {
        this.isFetchingInitialHistory = false;
      }
    });
    
    return this.initialHistoryFetchPromise;
  }
  
  /**
   * Processa dados descriptografados
   */
  private handleDecryptedData(data: any): void {
    if (!data) {
      this.error('Dados descriptografados inválidos');
      return;
    }
    
    try {
      if (data.roletas && Array.isArray(data.roletas)) {
        this.log(`Processando ${data.roletas.length} roletas de dados descriptografados`);
        this.updateCache(data.roletas);
        this.emit('update', { roulettes: data.roletas, timestamp: new Date().toISOString() });
        EventBus.emit('roulette:data-updated', { roulettes: data.roletas, source: 'decrypted-data' });
      } else {
        this.error('Formato de dados descriptografados inválido');
      }
    } catch (error) {
      this.error('Erro ao processar dados descriptografados:', error);
    }
  }

  /**
   * Disponibiliza os recursos quando a instância é descartada
   */
  public dispose(): void {
    this.log('Descartando instância e liberando recursos');
    
    // Limpar timers
    if (this.pollingTimer) {
      window.clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    if (this.streamReconnectTimer) {
      window.clearTimeout(this.streamReconnectTimer);
      this.streamReconnectTimer = null;
    }
    
    // Fechar conexão SSE
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    // Remover event listeners
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('focus', this.handleFocus);
      window.removeEventListener('blur', this.handleBlur);
    }
    
    // Limpar caches
    this.rouletteData.clear();
    this.initialHistoricalDataCache.clear();
    this.eventCallbacks.clear();
    
    // Resetar singleton se esta for a instância atual
    if (UnifiedRouletteClient.instance === this) {
      UnifiedRouletteClient.instance = null as any;
    }
  }
}

// Exportar singleton
export default UnifiedRouletteClient; 