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

import { ENDPOINTS } from './api/endpoints';
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

/**
 * Cliente unificado para dados de roletas (SSE FOCUSED)
 */
class UnifiedRouletteClient {
  private static instance: UnifiedRouletteClient;
  
  // Estado
  private isInitialized = false;
  private rouletteData: Map<string, any> = new Map();
  private lastUpdateTime = 0;
  private isFetching = false;
  private fetchPromise: Promise<any[]> | null = null;
  
  // Flag global para controlar múltiplas instâncias tentando conectar
  private static GLOBAL_CONNECTION_ATTEMPT = false;
  
  // Configuração
  private streamingEnabled = true;
  private pollingEnabled = true;
  private pollingInterval = 10000; // 10 segundos
  private cacheTTL = 30000; // 30 segundos
  private logEnabled = true;
  
  // Streaming SSE
  private eventSource: EventSource | null = null;
  private isStreamConnected = false;
  private isStreamConnecting = false;
  private streamReconnectAttempts = 0;
  private streamReconnectTimer: number | null = null;
  private streamReconnectInterval = 5000;
  private maxStreamReconnectAttempts = 10;
  private lastEventId: string | null = null;
  private lastReceivedAt = 0;
  
  // Polling
  private pollingTimer: number | null = null;
  
  // Callbacks
  private eventCallbacks: Map<string, Set<EventCallback>> = new Map();
  
  /**
   * Construtor privado para garantir singleton
   */
  private constructor(options: RouletteClientOptions = {}) {
    this.log('Inicializando cliente unificado de dados de roletas (SSE FOCUSED)');
    
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
    
    // Priorizar conexão SSE
    if (this.streamingEnabled && options.autoConnect !== false) {
      this.log('Iniciando com conexão SSE (prioridade)');
      this.connectStream();
    } else if (this.pollingEnabled) {
      // Iniciar polling apenas se streaming estiver desabilitado
      this.startPolling();
    }
    
    // Buscar dados iniciais imediatamente
    this.fetchRouletteData();
    
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
    
    if (UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT) {
      this.log('Outra instância já está tentando conectar ao stream, aguardando...');
      setTimeout(() => {
        UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT = false;
        this.connectStream();
      }, 1000);
      return;
    }
    
    UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT = true;
    this.isStreamConnecting = true;
    this.log(`Conectando ao stream SSE: ${ENDPOINTS.STREAM.ROULETTES}`);
    
    try {
      this.stopPolling();
      let streamUrl = ENDPOINTS.STREAM.ROULETTES;
      if (cryptoService.hasAccessKey()) {
        const accessKey = cryptoService.getAccessKey();
        if (accessKey) {
          streamUrl += `?key=${encodeURIComponent(accessKey)}`;
        }
      }
      
      this.eventSource = new EventSource(streamUrl);
      this.eventSource.onopen = this.handleStreamOpen.bind(this);
      this.eventSource.onerror = this.handleStreamError.bind(this);
      this.eventSource.addEventListener('update', this.handleStreamUpdate.bind(this));
      this.eventSource.addEventListener('connected', this.handleStreamConnected.bind(this));
      // Adicionar um listener genérico para capturar todos os eventos
      this.eventSource.onmessage = this.handleGenericStreamMessage.bind(this);

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
    if (!this.isStreamConnected && !this.isStreamConnecting) return;
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
    this.emit('disconnect', { timestamp: Date.now() });
    EventBus.emit('roulette:stream-disconnected', { timestamp: new Date().toISOString() });
    if (this.pollingEnabled && !this.pollingTimer) {
      this.log('Iniciando polling após desconexão do stream');
      this.startPolling();
    }
  }
  
  /**
   * Reconecta ao stream de eventos após uma desconexão
   */
  private reconnectStream(): void {
    if (this.streamReconnectTimer) window.clearTimeout(this.streamReconnectTimer);
    this.streamReconnectAttempts++;
    if (this.streamReconnectAttempts > this.maxStreamReconnectAttempts) {
      this.error(`Máximo de tentativas de reconexão (${this.maxStreamReconnectAttempts}) atingido`);
      this.emit('max-reconnect', { attempts: this.streamReconnectAttempts });
      EventBus.emit('roulette:stream-max-reconnect', { attempts: this.streamReconnectAttempts, timestamp: new Date().toISOString() });
      if (this.pollingEnabled && !this.pollingTimer) {
        this.log('Iniciando polling como fallback após falha nas reconexões');
        this.startPolling();
      }
      return;
    }
    const delay = this.streamReconnectInterval * Math.min(this.streamReconnectAttempts, 5);
    this.log(`Tentando reconectar em ${delay}ms (tentativa ${this.streamReconnectAttempts})`);
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
    this.emit('connect', { timestamp: Date.now() });
    EventBus.emit('roulette:stream-connected', { timestamp: new Date().toISOString() });
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
    this.emit('error', { event, timestamp: Date.now() });
    this.reconnectStream();
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
      try { data = JSON.parse(event.data); } catch (error) {
        this.error('Erro ao fazer parse JSON do evento connected:', error); return;
      }
      // Tentar extrair chave de acesso (se enviada no connected)
      if (!cryptoService.hasAccessKey()) {
         cryptoService.extractAndSetAccessKeyFromEvent(data);
      }
      this.emit('connected', data);
      EventBus.emit('roulette:stream-ready', { timestamp: new Date().toISOString(), data });
      this.log('Evento connected recebido, solicitando dados atualizados');
      this.forceUpdate();
    } catch (error) {
      this.error('Erro ao processar evento connected:', error, event.data);
    }
  }

  /**
   * Handler para eventos de atualização do stream SSE (evento 'update')
   */
  private async handleStreamUpdate(event: MessageEvent): Promise<void> {
    this.processSseData(event, 'update');
  }

  /**
   * Handler genérico para qualquer mensagem SSE (evento 'message')
   * Captura eventos que não têm um tipo específico como 'update' ou 'connected'
   */
  private handleGenericStreamMessage(event: MessageEvent): void {
    this.processSseData(event, 'message');
  }

  /**
   * Função centralizada para processar dados recebidos via SSE
   */
  private processSseData(event: MessageEvent, eventType: string): void {
    this.lastReceivedAt = Date.now();
    this.lastEventId = event.lastEventId;
    
    try {
      const rawData = event.data;
      let parsedData;
      
      this.log(`[${eventType}] Evento SSE recebido: ID=${event.lastEventId || 'N/A'}, Dados: ${rawData.substring(0, 100)}...`);
      
      // Tentar fazer o parse do JSON diretamente
      try {
        parsedData = JSON.parse(rawData);
        this.log(`[${eventType}] Dados SSE parseados como JSON com sucesso.`);
        
        // --- Processamento dos dados JSON --- 

        // Verificar se é um evento de status/erro do servidor
        if (parsedData.type === 'error' || parsedData.type === 'notification') {
          this.handleErrorMessage(parsedData);
          return;
        }

        // Verificar se é um evento de conexão inicial (se o backend enviar)
        // (Normalmente tratado pelo listener 'connected', mas pode vir como 'message')
        if (parsedData.type === 'connected') {
          this.log(`[${eventType}] Evento SSE 'connected' recebido (ignorado aqui).`);
          if (!cryptoService.hasAccessKey()) {
            cryptoService.extractAndSetAccessKeyFromEvent(parsedData); // Tentar extrair chave
          }
          return; 
        }

        // Assumir que são dados de roleta se tiver um campo 'data'
        if (parsedData && typeof parsedData === 'object') {
            let rouletteDataObject = parsedData; // Dados podem estar diretamente no objeto ou em parsedData.data
            let sourceDescription = 'sse-' + eventType;

            // Adaptar ao formato { type: 'update', data: {...} } ou { type: 'list', data: [...] }
            if (parsedData.type && parsedData.data) {
                rouletteDataObject = parsedData.data;
                sourceDescription += '-' + parsedData.type; // Ex: sse-message-update
                this.log(`[${eventType}] Detectado formato com campo 'data'. Usando dados de parsedData.data.`);
            } else {
                this.log(`[${eventType}] Usando o objeto JSON inteiro como dados da roleta.`);
            }

            // Atualizar cache com os dados (seja objeto único ou array)
            this.updateCache(rouletteDataObject);
            
            // Notificar sobre atualização
            this.emit('update', rouletteDataObject);
            EventBus.emit('roulette:data-updated', {
              timestamp: new Date().toISOString(),
              data: rouletteDataObject,
              source: sourceDescription
            });
        } else {
            this.log(`[${eventType}] Objeto JSON recebido não parece conter dados de roleta válidos.`);
        }

      } catch (jsonError) {
        // Se não for JSON, tratar como texto simples (talvez uma mensagem de erro)
        this.error(`[${eventType}] Erro ao fazer parse do JSON dos dados SSE:`, jsonError);
        this.error(`[${eventType}] Dados brutos recebidos:`, rawData);
        this.handleErrorMessage({ 
            error: true, 
            message: `Dados SSE inválidos recebidos: ${rawData.substring(0, 100)}...`, 
            code: 'SSE_PARSE_ERROR' 
        });
        // A reconexão é tratada pelo handleStreamError se a conexão cair.
        return;
      }
      
    } catch (generalError) {
      // Captura erros gerais no processamento do evento
      this.error(`[${eventType}] Erro geral ao processar evento SSE:`, generalError);
    }
  }
  
  /**
   * Inicia o polling como fallback
   */
  private startPolling(): void {
    if (!this.pollingEnabled) return;
    if (this.isStreamConnected || this.isStreamConnecting) {
      this.log('Streaming conectado ou conectando, não iniciando polling');
      return;
    }
    if (this.pollingTimer) window.clearInterval(this.pollingTimer);
    this.log(`Iniciando polling como fallback (intervalo: ${this.pollingInterval}ms)`);
    this.fetchRouletteData(); // Busca inicial
    this.pollingTimer = window.setInterval(() => {
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
   * Obtém dados das roletas (prioriza SSE, fallback para cache)
   */
  public async fetchRouletteData(): Promise<any[]> {
    if (this.isFetching) {
      this.log('Requisição já em andamento, aguardando...');
      return this.fetchPromise || Array.from(this.rouletteData.values());
    }
    if (this.isStreamConnected) {
      this.log('Stream SSE já está conectado, usando dados em cache');
      return Array.from(this.rouletteData.values());
    }
    if (!this.isStreamConnected && !this.isStreamConnecting) {
      this.log('Tentando conectar ao SSE para obter dados reais...');
      this.connectStream();
      await new Promise(resolve => setTimeout(resolve, 500)); // Pequena pausa
    }
    if (this.isCacheValid()) {
      this.log('Usando dados em cache (ainda válidos)');
      return Array.from(this.rouletteData.values());
    }
    if (this.rouletteData.size > 0) {
      this.log('Retornando dados existentes em cache enquanto aguarda conexão SSE');
      return Array.from(this.rouletteData.values());
    }
    console.warn('[UnifiedRouletteClient] Tentando obter dados reais via SSE, aguarde. Se não aparecer, verifique sua conexão.');
    this.log('Nenhum dado disponível ainda, retornando array vazio');
    return [];
  }
  
  /**
   * Verifica se o cache ainda é válido
   */
  private isCacheValid(): boolean {
    return this.rouletteData.size > 0 && Date.now() - this.lastUpdateTime < this.cacheTTL;
  }
  
  /**
   * Atualiza o cache com novos dados
   */
  private updateCache(data: any | any[]): void {
    if (!data) {
        this.log('updateCache chamado com dados nulos ou indefinidos. Ignorando.');
        return;
    }
    this.lastUpdateTime = Date.now();
    let count = 0;
    if (Array.isArray(data)) {
      data.forEach(roulette => {
        if (roulette && roulette.id) {
          this.rouletteData.set(roulette.id, roulette);
          count++;
        }
      });
      this.log(`Cache atualizado com ${count} roletas de um array de ${data.length}`);
    } else if (typeof data === 'object' && data.id) {
      this.rouletteData.set(data.id, data);
      this.log(`Cache atualizado para roleta ${data.id}`);
      count = 1;
    } else {
      this.log('Formato de dados inválido para updateCache:', data);
    }
  }
  
  /**
   * Registra um callback para um evento
   */
  public on(event: string, callback: EventCallback): Unsubscribe {
    if (!this.eventCallbacks.has(event)) this.eventCallbacks.set(event, new Set());
    this.eventCallbacks.get(event)!.add(callback);
    return () => this.off(event, callback);
  }
  
  /**
   * Remove um callback para um evento
   */
  public off(event: string, callback: EventCallback): void {
    this.eventCallbacks.get(event)?.delete(callback);
  }
  
  /**
   * Emite um evento para todos os callbacks registrados
   */
  private emit(event: string, data: any): void {
    this.eventCallbacks.get(event)?.forEach(callback => {
      try { callback(data); } catch (error) {
        this.error(`Erro em callback para evento ${event}:`, error);
      }
    });
  }
  
  /**
   * Manipulador para mudança de visibilidade da página
   */
  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.log('Página não visível, pausando serviços');
      this.stopPolling(); // Pausa polling
      // Considerar desconectar SSE se inativo por muito tempo?
    } else {
      this.log('Página visível, retomando serviços');
      if (this.streamingEnabled && !this.isStreamConnected && !this.isStreamConnecting) {
        this.connectStream();
      } else if (this.pollingEnabled && !this.pollingTimer && !this.isStreamConnected) {
        this.startPolling();
      }
    }
  }
  
  /**
   * Manipulador para evento de foco na janela
   */
  private handleFocus = (): void => {
    this.log('Janela ganhou foco');
    if (!this.isStreamConnected && !this.isStreamConnecting) {
      this.fetchRouletteData(); // Buscar dados se não houver streaming
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
      if (rouletteName.toLowerCase() === name.toLowerCase()) return roulette;
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
   * Força uma atualização imediata dos dados (tentando reconectar SSE)
   */
  public forceUpdate(): Promise<any[]> {
    if (this.streamingEnabled && !this.isStreamConnected && !this.isStreamConnecting) {
      this.log('Forçando reconexão do stream SSE');
      this.connectStream();
    } else {
      // Se já conectado, talvez enviar um pedido de refresh ao backend?
      // Por enquanto, apenas retorna o cache atual.
       this.log('Stream SSE já conectado ou conectando, retornando cache atual.');
    }
    return Promise.resolve(this.getAllRoulettes());
  }
  
  /**
   * Limpa recursos ao desmontar
   */
  public dispose(): void {
    this.log('Disposing UnifiedRouletteClient...');
    if (this.pollingTimer) window.clearInterval(this.pollingTimer);
    if (this.streamReconnectTimer) window.clearTimeout(this.streamReconnectTimer);
    if (this.eventSource) this.eventSource.close();
    UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT = false;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('focus', this.handleFocus);
      window.removeEventListener('blur', this.handleBlur);
    }
    this.eventCallbacks.clear();
  }
  
  /**
   * Registra mensagem de log
   */
  private log(...args: any[]): void {
    if (this.logEnabled) console.log('[UnifiedRouletteClient]', ...args);
  }
  
  /**
   * Registra mensagem de erro
   */
  private error(...args: any[]): void {
    console.error('[UnifiedRouletteClient]', ...args);
  }
  
  /**
   * Manipula mensagens de erro ou notificação especial do backend
   */
  private handleErrorMessage(data: any): void {
    this.log('Recebida mensagem de erro ou notificação do backend SSE:', data);
    EventBus.emit('roulette:api-message', {
      timestamp: new Date().toISOString(),
      type: data.error ? 'error' : 'notification',
      message: data.message || 'Mensagem sem detalhes',
      code: data.code,
      data
    });
    this.emit('message', data);
  }
  
  // Método mantido como aviso, mas não deve ser chamado
  private handleDecryptedData(data: any): void {
    console.warn('[UnifiedRouletteClient] handleDecryptedData chamado - Isso não deveria acontecer com SSE. Dados:', data);
  }
}

// Exportar a classe diretamente (named export)
export { UnifiedRouletteClient };