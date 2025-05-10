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
  public connectStream(): void {
    if (!this.streamingEnabled) {
      this.log('Streaming está desabilitado');
      return;
    }
    
    if (this.isStreamConnected || this.isStreamConnecting) {
      this.log('Stream já está conectado ou conectando');
      return;
    }
    
    // Verificar se já existe uma tentativa de conexão global
    if (UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT) {
      this.log('Outra instância já está tentando conectar ao stream, aguardando...');
      return;
    }
    
    // Marcar que estamos tentando conectar
    UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT = true;
    this.isStreamConnecting = true;
    
    try {
      const streamUrl = SSE_STREAM_URL;
      this.log(`Conectando ao stream SSE: ${streamUrl}`);
      
      // Parar polling se estiver ativo
      this.stopPolling();
      
      // Construir URL com query params para autenticação
      let fullStreamUrl = streamUrl;
      if (cryptoService.hasAccessKey()) {
        const accessKey = cryptoService.getAccessKey();
        if (accessKey) {
          fullStreamUrl += `?key=${encodeURIComponent(accessKey)}`;
        }
      }
      
      // Criar conexão SSE
      this.eventSource = new EventSource(fullStreamUrl);
      
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
            lastReceived: this.lastReceivedAt ? new Date(this.lastReceivedAt).toISOString() : 'nunca'
          });
        }
      }, 3000);
    } catch (error) {
      this.error('Erro ao conectar ao stream:', error);
      this.isStreamConnecting = false;
      UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT = false;
      this.reconnectStream();
    }
  }
  
  /**
   * Desconecta do stream SSE
   */
  public disconnectStream(): void {
    if (!this.isStreamConnected && !this.isStreamConnecting) {
      return;
    }
    
    this.log('Desconectando do stream SSE');
    
    if (this.eventSource) {
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
    this.log('Conexão SSE estabelecida');
    this.isStreamConnected = true;
    this.isStreamConnecting = false;
    this.streamReconnectAttempts = 0;
    UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT = false;
    
    // Notificar sobre conexão
    this.emit('connect', { timestamp: Date.now() });
    EventBus.emit('roulette:stream-connected', { timestamp: new Date().toISOString() });
    
    // Se polling estiver ativo como fallback, parar
    if (this.pollingTimer) {
      this.log('Stream conectado, desativando polling fallback');
      this.stopPolling();
    }
  }
  
  /**
   * Handler para erros na conexão do stream
   */
  private handleStreamError(event: Event): void {
    this.error('Erro na conexão SSE:', event);
    
    this.isStreamConnected = false;
    this.isStreamConnecting = false;
    UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT = false;
    
    // Notificar erro
    this.emit('error', { event, timestamp: Date.now() });
    
    // Reconectar com backoff exponencial
    const delay = Math.min(1000 * Math.pow(2, this.streamReconnectAttempts), 30000);
    this.log(`Agendando reconexão em ${delay}ms (tentativa ${this.streamReconnectAttempts + 1})`);
    
    setTimeout(() => {
      this.reconnectStream();
    }, delay);
    
    // Iniciar polling como fallback
    if (this.pollingEnabled && !this.pollingTimer) {
      this.log('Iniciando polling como fallback após erro no stream');
      this.startPolling();
    }
  }
  
  /**
   * Handler para evento inicial 'connected'
   */
  private handleStreamConnected(event: MessageEvent): void {
    try {
      this.log(`Evento 'connected' recebido: ${event.data.substring(0, 100)}...`);
      
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (error) {
        this.error('Erro ao fazer parse JSON do evento connected:', error);
        return;
      }
      
      // Tentar extrair a chave de acesso do evento connected
      try {
        const keyExtracted = cryptoService.extractAndSetAccessKeyFromEvent(data);
        if (keyExtracted) {
          this.log('✅ Chave de acesso extraída e configurada a partir do evento connected');
        } else {
          this.log('⚠️ Nenhuma chave de acesso encontrada no evento connected');
        }
      } catch (error) {
        this.error('Erro ao extrair chave de acesso do evento connected:', error);
      }
      
      // Notificar
      this.emit('connected', data);
      EventBus.emit('roulette:stream-ready', { 
        timestamp: new Date().toISOString(),
        data
      });
      
      // Se recebemos o evento connected, solicitar dados imediatamente
      // para garantir que temos os dados mais recentes
      this.log('Evento connected recebido, solicitando dados atualizados');
      this.forceUpdate();
    } catch (error) {
      this.error('Erro ao processar evento connected:', error, event.data);
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
   * Remove um callback de eventos
   */
  public unsubscribe(event: string, callback: (data: any) => void): void {
    if (typeof callback !== 'function') {
      this.error('❌ Tentativa de remover callback inválido');
      return;
    }

    try {
      if (this.eventCallbacks.has(event)) {
        const initialSize = this.eventCallbacks.get(event)!.size;
        this.eventCallbacks.get(event)!.delete(callback);
        
        if (this.eventCallbacks.get(event)!.size < initialSize) {
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
   * Limpa recursos ao desmontar
   */
  public dispose(): void {
    // Limpar timers
    if (this.pollingTimer) {
      window.clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    if (this.streamReconnectTimer) {
      window.clearTimeout(this.streamReconnectTimer);
      this.streamReconnectTimer = null;
    }
    
    if (this.webSocketReconnectTimer) {
      window.clearTimeout(this.webSocketReconnectTimer);
      this.webSocketReconnectTimer = null;
    }
    
    // Fechar WebSocket
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    // Fechar stream
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    // Reset da flag de conexão global
    UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT = false;
    
    // Remover event listeners
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('focus', this.handleFocus);
      window.removeEventListener('blur', this.handleBlur);
    }
    
    // Limpar callbacks
    this.eventCallbacks.clear();
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
    console.error('[UnifiedRouletteClient]', ...args);
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
    // Evitar múltiplas buscas simultâneas ou repetidas
    if (this.isFetchingInitialHistory || this.initialHistoricalDataCache.size > 0) {
      this.log('Busca de histórico inicial já em andamento ou concluída.');
      // Se já estiver buscando, retorna a promise existente
      if (this.initialHistoryFetchPromise) {
        return this.initialHistoryFetchPromise;
      }
      return Promise.resolve();
    }

    this.isFetchingInitialHistory = true;
    this.log('Iniciando busca do histórico inicial para todas as roletas...');

    this.initialHistoryFetchPromise = (async () => {
      let apiUrl = ''; // Declarar fora para estar acessível no catch/finally
      try {
        // <<< Usar getFullUrl para construir a URL completa >>>
        apiUrl = getFullUrl(ENDPOINTS.HISTORICAL.ALL_ROULETTES);
        this.log(`Buscando histórico inicial de: ${apiUrl}`); // Log para depuração
        const response = await axios.get<{ success: boolean; data: Record<string, RouletteNumber[]>; message?: string }>(apiUrl);

        if (response.data && response.data.success && response.data.data) {
          const historicalData = response.data.data;
          const rouletteNames = Object.keys(historicalData);

          // Limpar cache antigo antes de popular
          this.initialHistoricalDataCache.clear();

          // Popular o cache
          rouletteNames.forEach(name => {
            if (Array.isArray(historicalData[name])) {
              this.initialHistoricalDataCache.set(name, historicalData[name]);
            }
          });

          this.log(`Histórico inicial carregado e cacheado para ${rouletteNames.length} roletas.`);
          
          // Emitir evento (opcional)
          this.emit('initialHistoryLoaded', this.initialHistoricalDataCache);

        } else {
          throw new Error(response.data?.message || 'Falha ao buscar dados históricos iniciais: resposta inválida');
        }

      } catch (error: any) {
         // Usar apiUrl se disponível, senão o endpoint relativo
         const endpointDesc = apiUrl || ENDPOINTS.HISTORICAL.ALL_ROULETTES;
         this.error(`Erro ao buscar histórico de ${endpointDesc}:`, error.message || error);
        // Limpar cache em caso de erro para permitir nova tentativa
        this.initialHistoricalDataCache.clear();
        // Emitir evento de erro (opcional)
        this.emit('initialHistoryError', error);
        // Rejeitar a promise para que quem estiver aguardando saiba do erro
        throw error;
      } finally {
        this.isFetchingInitialHistory = false;
        // Não limpar initialHistoryFetchPromise aqui, para que futuras chamadas saibam que já foi tentado
      }
    })();

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
      isConnected: this.isStreamConnected,
      isConnecting: this.isStreamConnecting,
      lastReceivedAt: this.lastReceivedAt ? new Date(this.lastReceivedAt).toISOString() : null,
      timeSinceLastEvent: this.lastReceivedAt ? `${Math.round((Date.now() - this.lastReceivedAt) / 1000)}s atrás` : 'Nunca',
      reconnectAttempts: this.streamReconnectAttempts,
      eventSourceActive: !!this.eventSource,
      webSocketActive: !!this.socket && this.webSocketConnected,
      dataCount: this.rouletteData.size,
      streamingEnabled: this.streamingEnabled,
      pollingEnabled: this.pollingEnabled,
      pollingActive: !!this.pollingTimer
    };
    
    console.log('📊 Diagnóstico de conexão UnifiedRouletteClient:', diagnosticInfo);
    return diagnosticInfo;
  }
  
  /**
   * Força a reconexão do stream e registro do status
   */
  public forceReconnectStream(): void {
    // Registrar estado atual
    console.log('Estado antes da reconexão:');
    this.diagnoseConnectionState();
    
    // Desconectar stream existente
    this.disconnectStream();
    
    // Pequeno delay antes de reconectar
    setTimeout(() => {
      console.log('Tentando reconectar stream...');
      this.connectStream();
      
      // Verificar estado após tentativa
      setTimeout(() => {
        console.log('Estado após tentativa de reconexão:');
        this.diagnoseConnectionState();
      }, 1000);
    }, 500);
  }

  /**
   * Inicializa a conexão SSE
   */
  private initializeSSE(): void {
    if (this.eventSource) {
      this.log('🔄 Reconectando stream SSE...');
      this.eventSource.close();
    }

    try {
      const sseUrl = 'https://starfish-app-fubxw.ondigitalocean.app/api/stream/roulettes';
      this.eventSource = new EventSource(sseUrl);
      
      this.eventSource.onopen = () => {
        this.log('✅ Conexão SSE estabelecida');
        this.streamReconnectAttempts = 0;
        this.isStreamConnected = true;
        
        // Emitir evento de conexão bem-sucedida
        this.emit('connected', {
          timestamp: Date.now(),
          url: sseUrl
        });
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleRouletteData(data);
          
          // Atualizar timestamp do último recebimento
          this.lastReceivedAt = Date.now();
        } catch (error) {
          this.error('❌ Erro ao processar mensagem SSE:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        this.error('❌ Erro na conexão SSE:', error);
        this.isStreamConnected = false;
        
        if (this.streamReconnectAttempts < this.maxStreamReconnectAttempts) {
          this.streamReconnectAttempts++;
          const delay = this.streamReconnectInterval * Math.pow(2, this.streamReconnectAttempts - 1);
          this.log(`🔄 Tentativa de reconexão ${this.streamReconnectAttempts}/${this.maxStreamReconnectAttempts} em ${delay}ms`);
          
          setTimeout(() => this.initializeSSE(), delay);
        } else {
          this.error('❌ Máximo de tentativas de reconexão atingido');
          this.emit('sse-connection-failed', {
            attempts: this.streamReconnectAttempts,
            lastError: error,
            url: sseUrl
          });
          
          // Tentar reconexão após um tempo maior
          setTimeout(() => {
            this.streamReconnectAttempts = 0;
            this.initializeSSE();
          }, 30000); // 30 segundos
        }
      };

    } catch (error) {
      this.error('❌ Erro ao inicializar conexão SSE:', error);
      this.isStreamConnected = false;
      
      // Tentar reconexão após erro
      setTimeout(() => this.initializeSSE(), this.streamReconnectInterval);
    }
  }

  /**
   * Registra um aviso no console
   */
  private warn(message: string, ...args: any[]): void {
    console.warn(`[UnifiedRouletteClient] ${message}`, ...args);
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
}

// Exportar singleton
export default UnifiedRouletteClient; 