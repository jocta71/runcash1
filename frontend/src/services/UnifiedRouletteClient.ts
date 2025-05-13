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
import EventEmitter from 'eventemitter3';
import { getLogger } from './utils/logger';
import RouletteStreamClient from '../utils/RouletteStreamClient';

// Criar uma única instância do logger
const logger = getLogger('UnifiedRouletteClient');

// URL do servidor API
const API_URL = import.meta.env.VITE_API_URL || 'https://starfish-app-fubxw.ondigitalocean.app';

// URL do stream SSE
const STREAM_URL = `${API_URL}/stream/roulettes`;

// URL para obter histórico de todas as roletas
const HISTORICAL_URL = `${API_URL}/historical/all-roulettes`;

// Intervalo de polling em ms (10 segundos)
const pollingInterval = 10000;

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
 * Versão otimizada para evitar duplicações e requisições simultâneas
 */
export default class UnifiedRouletteClient {
  private static instance: UnifiedRouletteClient | null = null;
  private cache: Map<string, any> = new Map();
  private historicalCache: Map<string, any[]> = new Map();
  private emitter: EventEmitter = new EventEmitter();
  private streamClient: RouletteStreamClient | null = null;
  private pollingTimeout: NodeJS.Timeout | null = null;
  private isPollingActive: boolean = false;
  private isStreamConnected: boolean = false;
  private isStreamConnecting: boolean = false;
  private lastUpdateTime: number = 0;
  private isCacheValid: boolean = false;
  private requestInProgress: boolean = false;
  private isInitialized: boolean = false;
  
  // Registro de componentes que se inscreveram para cada evento
  private subscriberRegistry: Map<string, Set<string>> = new Map();
  
  // Flag para forçar reconexão durante próxima tentativa
  private forceReconnectFlag: boolean = false;
  
  // Contador para limitação de reconexões
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectBackoff: number = 1000; // ms
  
  // ID único para esta instância do cliente
  private readonly instanceId: string = `roulette-client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  /**
   * Construtor privado para garantir singleton
   */
  private constructor() {
    logger.debug('Nova instância criada');
    this.isInitialized = false;

    // Registrar para eventos de foco da janela
    window.addEventListener('focus', this.handleWindowFocus.bind(this));
    window.addEventListener('blur', this.handleWindowBlur.bind(this));
    
    // Iniciar cliente SSE na criação
    this.initializeClient();
  }

  /**
   * Obtém a instância singleton do cliente
   */
  public static getInstance(): UnifiedRouletteClient {
    if (!UnifiedRouletteClient.instance) {
      logger.info('Inicializando cliente unificado de dados de roletas');
      UnifiedRouletteClient.instance = new UnifiedRouletteClient();
    }
    return UnifiedRouletteClient.instance;
  }

  /**
   * Inicializa o cliente e inicia conexões
   */
  private async initializeClient(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('Cliente já inicializado, pulando.');
      return;
    }
    
    try {
      // Iniciar polling como fallback
      this.startPolling();
      
      // Iniciar stream SSE
      this.connectStream();
      
      // Buscar histórico inicial
      this.fetchAndCacheInitialHistory();
      
      this.isInitialized = true;
    } catch (error) {
      logger.error('Erro ao inicializar cliente:', error);
    }
  }

  /**
   * Conecta ao stream SSE
   */
  public connectStream(): void {
    if (this.isStreamConnected || this.isStreamConnecting) {
      logger.debug('Conexão já em andamento, aguardando...');
      return;
    }
    
    this.isStreamConnecting = true;
    
    // Verificar se o cliente já existe
    if (!this.streamClient) {
      logger.debug('Inicializando cliente SSE para dados de roletas...');
      this.streamClient = RouletteStreamClient.getInstance();
      
      // Registrar handlers para eventos do stream
      this.streamClient.onConnect(() => {
        logger.info('✅ Cliente SSE centralizado conectado com sucesso');
        this.isStreamConnected = true;
        this.isStreamConnecting = false;
        this.reconnectAttempts = 0;
        
        // Se temos streaming, podemos parar o polling
        this.stopPolling();
      });
      
      this.streamClient.onDisconnect(() => {
        logger.warn('❌ Cliente SSE centralizado desconectado');
        this.isStreamConnected = false;
        this.isStreamConnecting = false;
        
        // Se o stream caiu, reiniciar polling como fallback
        this.startPolling();
      });
      
      this.streamClient.onData((data) => {
        if (Array.isArray(data) && data.length > 0) {
          logger.info(`📡 Recebidos dados de ${data.length} roletas via stream`);
          this.updateCache(data);
          this.emitUpdate(data);
        } else if (data && data.type === 'update' && Array.isArray(data.data)) {
          logger.info(`📡 Recebidos dados de ${data.data.length} roletas via stream (formato evento)`);
          this.updateCache(data.data);
          this.emitUpdate(data.data);
        }
      });
      
      this.streamClient.onReconnect(() => {
        logger.info('🔄 Cliente SSE tentando reconectar...');
        this.isStreamConnecting = true;
      });
    }
    
    // Cache vazio, conectar ao stream
    if (this.cache.size === 0) {
      logger.debug('Cache vazio, conectando ao stream SSE...');
    }
    
    // Conectar ao stream
    if (!this.isStreamConnected && !this.isStreamConnecting) {
      this.streamClient.connect().then((success) => {
        if (success) {
          logger.debug('Conexão SSE estabelecida com sucesso');
        } else {
          logger.warn('Falha ao estabelecer conexão SSE, usando polling como fallback');
          this.startPolling();
        }
      });
    }
  }

  /**
   * Força reconexão do stream SSE
   */
  public forceReconnectStream(): void {
    logger.info('Forçando reconexão do stream SSE...');
    
    // Definir flag para forçar reconexão
    this.forceReconnectFlag = true;
    
    // Reiniciar contador de tentativas
    this.reconnectAttempts = 0;
    
    // Desconectar cliente atual
    if (this.streamClient) {
      this.streamClient.disconnect();
    }
    
    // Resetar estados
    this.isStreamConnected = false;
    this.isStreamConnecting = false;
    
    // Reconectar após breve delay
    setTimeout(() => {
      this.connectStream();
    }, 500);
  }

  /**
   * Inicia polling para obter dados periodicamente
   */
  private startPolling(): void {
    if (this.isPollingActive) return;
    
    logger.debug(`Iniciando polling como fallback (intervalo: ${pollingInterval/1000}s)`);
    this.isPollingActive = true;
    
    // Executar imediatamente
    this.pollData();
    
    // Agendar próxima execução
    this.pollingTimeout = setInterval(() => {
      this.pollData();
    }, pollingInterval);
  }

  /**
   * Para o polling
   */
  private stopPolling(): void {
    if (!this.isPollingActive) return;
    
    logger.debug('Polling parado');
    
    if (this.pollingTimeout) {
      clearInterval(this.pollingTimeout);
      this.pollingTimeout = null;
    }
    
    this.isPollingActive = false;
  }

  /**
   * Executa polling de dados
   */
  private async pollData(): Promise<void> {
    if (this.requestInProgress) {
      logger.debug('Polling ignorado - requisição em andamento');
      return;
    }
    
    try {
      this.requestInProgress = true;
      
      // Verificar se o stream está conectado
      if (this.isStreamConnected) {
        logger.debug('Streaming conectado, parando polling');
        this.stopPolling();
        this.requestInProgress = false;
        return;
      }
      
      // Buscar dados da API
      const response = await axios.get(`${API_URL}/api/roulettes`);
      
      if (response.data && Array.isArray(response.data)) {
        logger.debug(`Dados obtidos via polling: ${response.data.length} roletas`);
        this.updateCache(response.data);
        this.emitUpdate(response.data);
      }
    } catch (error) {
      logger.error('Erro durante polling:', error);
    } finally {
      this.requestInProgress = false;
    }
  }

  /**
   * Manipulador de evento de foco da janela
   */
  private handleWindowFocus(): void {
    logger.debug('Janela recebeu foco');
    
    // Verificar status do stream quando a janela recebe foco
    if (!this.isStreamConnected && !this.isStreamConnecting) {
      this.connectStream();
    }
    
    // Forçar atualização de dados apenas se o cache estiver desatualizado
    if (!this.isCacheValid) {
      this.forceUpdate();
    }
  }

  /**
   * Manipulador de evento de perda de foco da janela
   */
  private handleWindowBlur(): void {
    logger.debug('Janela perdeu foco');
    // Nenhuma ação necessária quando a janela perde o foco
  }

  /**
   * Atualiza o cache com novos dados
   */
  private updateCache(data: any[]): void {
    if (!Array.isArray(data)) {
      logger.warn('Tentativa de atualizar cache com dados não-array:', typeof data);
      return;
    }
    
    console.debug('DEBUG: updateCache chamado com:', data);
    
    try {
      // Filtrar itens nulos ou indefinidos
      const validItems = data.filter(item => item && (item.id || item.roleta_id));
      
      console.debug(`DEBUG: Atualizando cache com array de dados. Items válidos: ${validItems.length}`);
      
      if (validItems.length === 0) {
        logger.warn('Nenhum item válido para atualizar o cache');
        return;
      }
      
      // Limpar cache existente se estamos recebendo um conjunto completo
      if (validItems.length > 10) {
        this.cache.clear();
      }
      
      // Atualizar cache
      validItems.forEach(item => {
        const id = item.id || item.roleta_id;
        this.cache.set(id, item);
      });
      
      console.debug(`DEBUG: ${validItems.length} roletas adicionadas ao cache`);
      
      // Atualizar timestamp e status de cache
      this.lastUpdateTime = Date.now();
      this.isCacheValid = true;
    } catch (error) {
      logger.error('Erro ao atualizar cache:', error);
    }
  }

  /**
   * Emite evento de atualização com os novos dados
   */
  private emitUpdate(data: any[]): void {
    // Emitir evento update
    this.emitter.emit('update', data);
    
    // Emitir evento genérico
    this.emitter.emit('*', { type: 'update', data });
  }

  /**
   * Busca e armazena o histórico inicial de todas as roletas
   * Implementa timeout e processamento em lotes
   */
  private async fetchAndCacheInitialHistory(): Promise<void> {
    if (this.historicalCache.size > 0) {
      logger.debug('Histórico já em cache, pulando busca inicial');
      this.emitter.emit('historical-data-ready', this.historicalCache);
      return;
    }
    
    logger.info('Iniciando busca do histórico inicial para todas as roletas...');
    
    try {
      // Definir um timeout para a requisição
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout ao buscar histórico')), 15000);
      });
      
      logger.info(`Buscando histórico inicial de: ${HISTORICAL_URL}`);
      
      // Competição entre a requisição real e o timeout
      const response = await Promise.race([
        axios.get(HISTORICAL_URL, {
          timeout: 15000, // 15 segundos
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }),
        timeoutPromise
      ]);
      
      if (!response || !response.data) {
        logger.warn('Formato de resposta de histórico inválido');
        return;
      }
      
      // Processar dados em lotes para evitar bloqueio da UI
      setTimeout(() => {
        this.processHistoricalData(response.data);
      }, 100);
    } catch (error) {
      logger.error('Erro ao buscar histórico inicial:', error);
      // Emitir evento de erro
      this.emitter.emit('historical-data-error', error);
    }
  }
  
  /**
   * Processa dados históricos em lotes
   */
  private processHistoricalData(data: any): void {
    try {
      // Verificar formato dos dados
      if (data.historical && typeof data.historical === 'object') {
        // Criar cache temporário
        const tempCache = new Map<string, any[]>();
        
        // Processar em lotes de 5 roletas por vez
        const roletaIds = Object.keys(data.historical);
        const batchSize = 5;
        
        // Função para processar um lote
        const processBatch = (startIndex: number) => {
          // Se processamos todos, emitir evento e finalizar
          if (startIndex >= roletaIds.length) {
            this.historicalCache = tempCache;
            logger.info(`Processamento de histórico concluído: ${tempCache.size} roletas`);
            this.emitter.emit('historical-data-ready', tempCache);
            return;
          }
          
          // Processar lote atual
          const endIndex = Math.min(startIndex + batchSize, roletaIds.length);
          for (let i = startIndex; i < endIndex; i++) {
            const roletaId = roletaIds[i];
            const historico = data.historical[roletaId];
            
            if (Array.isArray(historico)) {
              tempCache.set(roletaId, historico);
            }
          }
          
          // Processar próximo lote após pequeno delay para não bloquear a UI
          setTimeout(() => {
            processBatch(endIndex);
          }, 50);
        };
        
        // Iniciar processamento com o primeiro lote
        processBatch(0);
      } else {
        logger.warn('Formato inválido de dados históricos');
      }
    } catch (error) {
      logger.error('Erro ao processar dados históricos:', error);
    }
  }

  /**
   * Força uma atualização dos dados
   */
  public async forceUpdate(): Promise<any[]> {
    if (this.requestInProgress) {
      logger.warn('Já existe uma atualização forçada em andamento...');
      return this.getAllRoulettes();
    }
    
    try {
      this.requestInProgress = true;
      
      // Verificar se o stream está conectado
      if (this.isStreamConnected) {
        logger.debug('Stream conectado, apenas retornando cache');
        return this.getAllRoulettes();
      }
      
      // Buscar dados da API
      const response = await axios.get(`${API_URL}/api/roulettes`);
      
      if (response.data && Array.isArray(response.data)) {
        logger.info(`📡 Dados recebidos após reconexão: ${response.data.length} roletas`);
        this.updateCache(response.data);
        this.emitUpdate(response.data);
        return response.data;
      }
      
      return this.getAllRoulettes();
    } catch (error) {
      logger.error('Erro durante atualização forçada:', error);
      return this.getAllRoulettes();
    } finally {
      this.requestInProgress = false;
    }
  }

  /**
   * Fecha conexões e limpa recursos
   */
  public dispose(): void {
    logger.debug('Desconectando e limpando recursos');
    
    // Parar polling
    this.stopPolling();
    
    // Desconectar do stream
    if (this.streamClient) {
      this.streamClient.disconnect();
    }
    
    // Remover event listeners
    window.removeEventListener('focus', this.handleWindowFocus);
    window.removeEventListener('blur', this.handleWindowBlur);
    
    // Limpar caches
    this.cache.clear();
    this.historicalCache.clear();
    
    // Limpar emitter
    this.emitter.removeAllListeners();
    
    // Resetar estados
    this.isInitialized = false;
    this.isStreamConnected = false;
    this.isStreamConnecting = false;
    this.isPollingActive = false;
    this.isCacheValid = false;
    this.requestInProgress = false;
  }

  /**
   * Gera ID único para um componente inscrito
   */
  private generateSubscriberId(callback: Function): string {
    return `sub_${callback.toString().slice(0, 20)}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Subscreve para receber atualizações
   * Versão otimizada com sistema anti-duplicação
   */
  public subscribe(event: string, callback: (data: any) => void): string {
    // Gerar ID único para este inscrito
    const subscriberId = this.generateSubscriberId(callback);
    
    // Verificar se já existe este conjunto de inscritos
    if (!this.subscriberRegistry.has(event)) {
      this.subscriberRegistry.set(event, new Set<string>());
    }
    
    // Verificar se este callback específico já está registrado
    const subscribers = this.subscriberRegistry.get(event)!;
    
    // Limite de 10 inscritos por evento para evitar problemas de desempenho
    if (subscribers.size >= 10) {
      logger.warn(`Limite de inscritos (10) atingido para evento ${event}, ignorando nova inscrição`);
      return subscriberId;
    }
    
    // Adicionar à lista de inscritos
    subscribers.add(subscriberId);
    
    // Registrar callback real
    logger.debug(`➕ Novo callback registrado para evento: ${event} (Total: ${subscribers.size})`);
    this.emitter.on(event, callback);
    
    return subscriberId;
  }

  /**
   * Cancela inscrição para atualizações
   */
  public unsubscribe(event: string, callback: (data: any) => void): void {
    // Remover callback
    this.emitter.off(event, callback);
    
    // Atualizar registro
    if (this.subscriberRegistry.has(event)) {
      const subscribers = this.subscriberRegistry.get(event)!;
      
      // Encontrar e remover o id do inscrito
      const subscriberIds = Array.from(subscribers);
      const subscriberId = this.generateSubscriberId(callback);
      
      if (subscribers.has(subscriberId)) {
        subscribers.delete(subscriberId);
        logger.debug(`➖ Callback removido para evento: ${event} (Restantes: ${subscribers.size})`);
      }
      
      // Se não há mais inscritos, limpar conjunto
      if (subscribers.size === 0) {
        this.subscriberRegistry.delete(event);
      }
    }
  }

  /**
   * Retorna todas as roletas do cache
   */
  public getAllRoulettes(): any[] {
    return Array.from(this.cache.values());
  }

  /**
   * Retorna uma roleta específica pelo ID
   */
  public getRouletteById(id: string): any {
    return this.cache.get(id) || null;
  }

  /**
   * Retorna histórico de uma roleta específica
   */
  public getRouletteHistory(id: string): any[] {
    return this.historicalCache.get(id) || [];
  }

  /**
   * Retorna todo o histórico de roletas
   */
  public getAllRouletteHistory(): Map<string, any[]> {
    return this.historicalCache;
  }

  /**
   * Retorna o status atual do cliente
   */
  public getStatus(): any {
    return {
      cacheSize: this.cache.size,
      historicalCacheSize: this.historicalCache.size,
      lastUpdateTime: this.lastUpdateTime,
      isCacheValid: this.isCacheValid,
      isStreamConnected: this.isStreamConnected,
      isStreamConnecting: this.isStreamConnecting,
      isPollingActive: this.isPollingActive,
      reconnectAttempts: this.reconnectAttempts,
      isRequestInProgress: this.requestInProgress,
      subscriberCount: Array.from(this.subscriberRegistry.entries()).reduce((acc, [event, subs]) => {
        acc[event] = subs.size;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  /**
   * Fornece diagnóstico detalhado do estado da conexão
   */
  public diagnoseConnectionState(): any {
    // Diagnóstico básico
    const status = this.getStatus();
    
    // Verificar tempos
    const now = Date.now();
    const lastUpdateAge = now - this.lastUpdateTime;
    
    return {
      ...status,
      lastUpdateAgeMs: lastUpdateAge,
      lastUpdateAgeSeconds: Math.floor(lastUpdateAge / 1000),
      needsReconnect: lastUpdateAge > 60000, // 60 segundos sem atualizações
      healthStatus: this.isStreamConnected ? 'connected' : (this.isPollingActive ? 'polling' : 'disconnected'),
      connectionTime: this.streamClient?.getConnectionTime() || 0,
      instanceId: this.instanceId
    };
  }

  /**
   * Retorna histórico de uma roleta específica pelo nome
   * Necessário para suporte ao RouletteCard
   */
  public getPreloadedHistory(name: string): any[] {
    // Tentar encontrar a roleta por nome
    for (const [id, history] of this.historicalCache.entries()) {
      // Buscar a roleta no cache atual para comparar nomes
      const roulette = this.cache.get(id);
      if (roulette && (roulette.nome === name || roulette.name === name)) {
        return history;
      }
    }
    return [];
  }
} 