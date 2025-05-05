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
  private streamReconnectInterval = 5000;
  private maxStreamReconnectAttempts = 10;
  private lastEventId: string | null = null;
  private lastReceivedAt = 0;
  
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
      
      // Aguardar 1 segundo e tentar novamente
      setTimeout(() => {
        UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT = false;
        this.connectStream();
      }, 1000);
      return;
    }
    
    // Marcar que estamos tentando conectar (flag global)
    UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT = true;
    this.isStreamConnecting = true;
    this.log(`Conectando ao stream SSE: ${ENDPOINTS.STREAM.ROULETTES}`);
    
    try {
      // Parar polling se estiver ativo, já que vamos usar o streaming
      this.stopPolling();
      
      // Construir URL com query params para autenticação, se necessário
      let streamUrl = ENDPOINTS.STREAM.ROULETTES;
      if (cryptoService.hasAccessKey()) {
        const accessKey = cryptoService.getAccessKey();
        if (accessKey) {
          streamUrl += `?key=${encodeURIComponent(accessKey)}`;
        }
      }
      
      // Criar conexão SSE
      this.eventSource = new EventSource(streamUrl);
      
      // Configurar handlers de eventos
      this.eventSource.onopen = this.handleStreamOpen.bind(this);
      this.eventSource.onerror = this.handleStreamError.bind(this);
      
      // Eventos específicos
      this.eventSource.addEventListener('update', this.handleStreamUpdate.bind(this));
      this.eventSource.addEventListener('connected', this.handleStreamConnected.bind(this));
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
    
    // Reconectar
    this.reconnectStream();
    
    // Iniciar polling como fallback se não estiver ativo
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
    this.lastEventId = event.lastEventId;
    
    try {
      const rawData = event.data;
      this.log(`Evento SSE recebido: ID=${event.lastEventId}, Tipo=${event.type}, Dados (início): ${rawData.substring(0, 100)}`);
      
      let parsedData;
      try {
        parsedData = JSON.parse(rawData);
        this.log('Dados JSON parseados com sucesso');
      } catch (error) {
        this.error('Falha ao parsear dados JSON do SSE:', error, rawData);
        return;
      }
      
      if (!parsedData || typeof parsedData !== 'object') {
        this.error('Dados parseados não são um objeto válido:', parsedData);
        return;
      }
      
      // Verificar tipo do evento vindo do backend
      if (parsedData.type === 'batch_update' && Array.isArray(parsedData.data)) {
        // Recebemos um lote de atualizações
        const batchData = parsedData.data;
        this.log(`Recebido lote com ${batchData.length} atualizações.`);
        let processedCount = 0;
        
        // Iterar sobre cada atualização no lote
        batchData.forEach(rouletteEvent => {
            // O backend formata cada item como { type: 'update', data: { ... } }
            if (rouletteEvent && rouletteEvent.type === 'update' && rouletteEvent.data) {
                const rouletteUpdate = rouletteEvent.data;
                // Atualizar cache com os dados da roleta específica
                this.updateCache(rouletteUpdate);
                processedCount++;
            } else {
                this.log('Item inválido no lote de atualização:', rouletteEvent);
            }
        });
        
        // Notificar UMA VEZ após processar todo o lote
        if (processedCount > 0) {
            this.emit('update', Array.from(this.rouletteData.values())); // Emitir todos os dados atualizados
            EventBus.emit('roulette:data-updated', {
                timestamp: new Date().toISOString(),
                data: Array.from(this.rouletteData.values()), // Enviar o estado completo atualizado
                source: 'sse-batch' // Indicar que veio do SSE em lote
            });
            this.log(`Lote processado, ${processedCount} roletas atualizadas no cache.`);
        }

      } else if (parsedData.type === 'heartbeat') {
        // Ignorar eventos de heartbeat para atualização de dados
        this.log('Recebido heartbeat, ignorando para atualização de cache.');
      } else if (parsedData.type === 'update' && parsedData.data) {
          // Lidar com eventos individuais (caso o backend envie assim em alguma situação)
          const rouletteUpdate = parsedData.data;
          this.log(`Atualização individual recebida: Roleta ${rouletteUpdate.roleta_nome || rouletteUpdate.roleta_id}`);
          this.updateCache(rouletteUpdate);
          this.emit('update', Array.from(this.rouletteData.values())); 
           EventBus.emit('roulette:data-updated', {
                timestamp: new Date().toISOString(),
                data: Array.from(this.rouletteData.values()),
                source: 'sse-single'
            });
      } else if (parsedData.error || parsedData.status) {
        this.log('Recebido evento de erro/status do servidor SSE:', parsedData);
      } else {
        this.log('Formato de dados JSON não esperado no evento SSE:', parsedData);
      }
      
    } catch (error) {
      this.error('Erro GERAL ao processar evento SSE:', error);
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
    this.lastUpdateTime = Date.now();
    
    if (Array.isArray(data)) {
      // Atualizar múltiplas roletas
      data.forEach(roulette => {
        if (roulette && roulette.id) {
          this.rouletteData.set(roulette.id, roulette);
        }
      });
      
      this.log(`Cache atualizado com ${data.length} roletas`);
    } else if (data && data.id) {
      // Atualizar uma única roleta
      this.rouletteData.set(data.id, data);
      this.log(`Cache atualizado para roleta ${data.id}`);
    }
  }
  
  /**
   * Registra um callback para um evento
   */
  public on(event: string, callback: EventCallback): Unsubscribe {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, new Set());
    }
    
    this.eventCallbacks.get(event)!.add(callback);
    
    // Retornar função para cancelar inscrição
    return () => {
      this.off(event, callback);
    };
  }
  
  /**
   * Remove um callback para um evento
   */
  public off(event: string, callback: EventCallback): void {
    if (!this.eventCallbacks.has(event)) {
      return;
    }
    
    this.eventCallbacks.get(event)!.delete(callback);
  }
  
  /**
   * Emite um evento para todos os callbacks registrados
   */
  private emit(event: string, data: any): void {
    if (!this.eventCallbacks.has(event)) {
      return;
    }
    
    for (const callback of this.eventCallbacks.get(event)!) {
      try {
        callback(data);
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
   */
  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      // Processar a mensagem recebida
      const message = JSON.parse(event.data);
      this.log('Mensagem WebSocket recebida:', message.type || 'sem tipo');
      
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
        
        // Se recebemos apenas um número, adicioná-lo à sequência
        if (!rouletteData.numeros.length && rouletteData.ultimoNumero !== undefined) {
          // Buscar roleta existente para obter a sequência atual
          const existingRoulette = this.rouletteData.get(rouletteData.id);
          if (existingRoulette && existingRoulette.numeros && existingRoulette.numeros.length) {
            // Criar nova sequência com o número mais recente no início
            rouletteData.numeros = [rouletteData.ultimoNumero, ...existingRoulette.numeros.slice(0, 14)];
          } else {
            // Se não temos sequência existente, inicializar com o número atual
            rouletteData.numeros = [rouletteData.ultimoNumero];
          }
        }
        
        // Atualizar o cache
        this.updateCache(rouletteData);
        
        // Emitir evento de atualização
        this.emit('update', rouletteData);
        EventBus.emit('roulette:data-updated', {
          timestamp: new Date().toISOString(),
          data: rouletteData,
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
      } else if (message.type === 'log' || message.type === 'info') {
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
      this.error('Erro ao processar mensagem WebSocket:', error);
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
}

// Exportar singleton
export default UnifiedRouletteClient; 