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
import { cryptoService, extractAndSetAccessKeyFromEvent, setApiKey } from '../utils/crypto-utils';
import EventBus from './EventBus';
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
    
    // Inicializar streaming se habilitado e autoConnect
    // Polling será iniciado apenas como fallback caso o streaming falhe
    if (this.streamingEnabled && options.autoConnect !== false) {
      this.connectStream();
    } else if (this.pollingEnabled) {
      // Iniciar polling apenas se streaming estiver desabilitado
      this.startPolling();
    }
    
    // Registrar eventos de visibilidade para gerenciar recursos
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      window.addEventListener('focus', this.handleFocus);
      window.addEventListener('blur', this.handleBlur);
    }
    
    // Buscar dados iniciais imediatamente, mas sem iniciar polling
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
        const accessKey = localStorage.getItem('roulette_access_key');
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
        const keyExtracted = extractAndSetAccessKeyFromEvent(data);
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
      // Verificar se os dados estão em formato JSON
      const rawData = event.data;
      let parsedData;
      
      this.log(`Evento SSE recebido: ID=${event.lastEventId}, Tipo=${event.type}`);
      
      // Tentar extrair chave de acesso do evento, se necessário
      if (!cryptoService.hasAccessKey()) {
        this.log('Sem chave de acesso configurada, tentando extrair do evento');
        try {
          extractAndSetAccessKeyFromEvent(rawData);
        } catch (error) {
          this.log('Não foi possível extrair chave de acesso do evento');
        }
      }
      
      // Primeiro tentar fazer o parse do JSON
      try {
        parsedData = JSON.parse(rawData);
        this.log('Dados JSON parseados com sucesso:', JSON.stringify(parsedData).substring(0, 100) + '...');
        
        // Se este evento tem uma chave, salvá-la
        if (!cryptoService.hasAccessKey()) {
          extractAndSetAccessKeyFromEvent(parsedData);
        }
      } catch (error) {
        this.log('Dados não estão em formato JSON válido, verificando outros formatos');
        
        // Se não for JSON, verificar se são dados criptografados no formato Iron
        if (typeof rawData === 'string' && rawData.startsWith('Fe26.2')) {
          this.handleEncryptedData(rawData);
          return;
        } else if (typeof rawData === 'string' && rawData.includes('"encrypted":true')) {
          // Dados podem estar em formato JSON com campo encrypted
          try {
            const encryptedContainer = JSON.parse(rawData);
            
            if (encryptedContainer.encrypted && encryptedContainer.encryptedData) {
              this.log('Dados em container criptografado detectados');
              this.handleEncryptedData(encryptedContainer);
              return;
            }
          } catch (error) {
            this.error('Erro ao processar container criptografado:', error);
          }
        }
        
        this.error('Formato de dados não reconhecido:', rawData.substring(0, 100));
        return;
      }
      
      // Verificar se temos um container JSON com dados criptografados
      if (parsedData && parsedData.encrypted === true) {
        this.log('Container JSON com dados criptografados detectado');
        this.handleEncryptedData(parsedData);
        return;
      }
      
      // Verificar se temos uma mensagem de erro ou notificação especial
      if (parsedData && parsedData.error === true) {
        this.handleErrorMessage(parsedData);
        return;
      }
      
      // Verificar se temos uma mensagem sobre chave de acesso
      if (parsedData && (parsedData.accessKey || parsedData.key || 
         (parsedData.auth && (parsedData.auth.key || parsedData.auth.accessKey)))) {
        // Este evento provavelmente contém uma chave de acesso
        const keyExtracted = extractAndSetAccessKeyFromEvent(parsedData);
        if (keyExtracted) {
          this.log('✅ Chave de acesso extraída e configurada a partir do evento update');
          // Solicitar dados atualizados agora que temos a chave
          this.forceUpdate();
        }
      }
      
      // Se chegamos aqui, os dados são JSON não criptografados
      // Atualizar cache com os dados recebidos
      this.updateCache(parsedData);
      
      // Notificar sobre atualização
      this.emit('update', parsedData);
      EventBus.emit('roulette:data-updated', {
        timestamp: new Date().toISOString(),
        data: parsedData
      });
    } catch (error) {
      this.error('Erro ao processar evento update:', error);
    }
  }
  
  /**
   * Processa dados criptografados recebidos do servidor
   */
  private handleEncryptedData(encryptedData: any): void {
    console.log('[UnifiedRouletteClient] Processando dados criptografados');
    
    try {
      // Tentar extrair a chave de acesso dos dados
      this.extractAccessKey(encryptedData);
      
      // Processar os dados criptografados
      cryptoService.processEncryptedData(encryptedData)
        .then(decryptedData => {
          console.log('[UnifiedRouletteClient] Dados descriptografados com sucesso');
          
          // Se temos dados reais, processar normalmente
          if (decryptedData && decryptedData.data) {
            this.handleDecryptedData(decryptedData.data);
          } else {
            console.warn('[UnifiedRouletteClient] Dados descriptografados sem estrutura esperada');
          }
        })
        .catch(error => {
          console.error('[UnifiedRouletteClient] Erro ao processar dados criptografados:', error);
          this.notify('error', 'Erro ao processar dados criptografados');
        });
    } catch (error) {
      console.error('[UnifiedRouletteClient] Erro ao processar dados criptografados:', error);
      this.notify('error', 'Erro ao processar dados criptografados');
    }
  }
  
  /**
   * Tenta extrair a chave de acesso dos dados recebidos
   * Esta função analisa os dados e procura por campos que possam conter a chave
   */
  private extractAccessKey(data: any): boolean {
    console.log('[UnifiedRouletteClient] Tentando extrair chave de acesso dos dados');
    
    try {
      // Se for uma string, tentar converter para objeto
      let dataObj = data;
      if (typeof data === 'string') {
        // Verificar se é um JSON
        if (data.startsWith('{') || data.startsWith('[')) {
          try {
            dataObj = JSON.parse(data);
          } catch (e) {
            console.log('[UnifiedRouletteClient] Dados não são JSON válido');
          }
        }
      }
      
      // Procurar campos comuns que possam conter a chave
      if (typeof dataObj === 'object' && dataObj !== null) {
        // Campos possíveis para a chave de acesso
        const possibleKeyFields = [
          'accessKey', 'key', 'apiKey', 'token', 'secret', 
          'auth.key', 'auth.token', 'authorization', 'decrypt_key',
          'meta.key', 'metadata.key', 'header.key'
        ];
        
        for (const field of possibleKeyFields) {
          const keys = field.split('.');
          let value = dataObj;
          
          // Navegar na estrutura para encontrar o campo aninhado
          for (const key of keys) {
            value = value?.[key];
            if (value === undefined) break;
          }
          
          // Se encontramos um valor que parece ser uma chave
          if (typeof value === 'string' && value.length > 8) {
            console.log(`[UnifiedRouletteClient] Possível chave encontrada no campo ${field}`);
            const keySet = setApiKey(value);
            
            if (keySet) {
              console.log('[UnifiedRouletteClient] Chave de acesso configurada com sucesso');
              return true;
            }
          }
        }
        
        // Tentar encontrar o hash na própria estrutura do formato Iron
        if (typeof data === 'string' && data.startsWith('Fe26.2*')) {
          const parts = data.split('*');
          if (parts.length >= 2) {
            const hash = parts[1];
            if (hash && hash.length > 8) {
              console.log('[UnifiedRouletteClient] Tentando usar o hash como chave:', hash);
              const keySet = setApiKey(hash);
              if (keySet) {
                console.log('[UnifiedRouletteClient] Hash configurado como chave de acesso');
                return true;
              }
            }
          }
        }
      }
      
      console.log('[UnifiedRouletteClient] Nenhuma chave de acesso encontrada nos dados');
      return false;
    } catch (error) {
      console.error('[UnifiedRouletteClient] Erro ao extrair chave de acesso:', error);
      return false;
    }
  }
  
  /**
   * Gera e utiliza dados simulados como fallback quando a descriptografia falha
   */
  private useSimulatedData(): void {
    this.log('Usando dados simulados como fallback');
    
    // Criar roleta simulada para fins de desenvolvimento quando a descriptografia falha
    const simulatedData = [{
      id: 'simulated_recovery_' + Date.now(),
      nome: 'Roleta Recuperação',
      provider: 'Simulação após falha de descriptografia',
      status: 'online',
      numeros: Array.from({length: 20}, () => Math.floor(Math.random() * 37)),
      ultimoNumero: Math.floor(Math.random() * 37),
      horarioUltimaAtualizacao: new Date().toISOString()
    }];
    
    // Adicionar uma segunda roleta simulada para tornar a interface mais interessante
    simulatedData.push({
      id: 'simulated_recovery_2_' + Date.now(),
      nome: 'Roleta Virtual',
      provider: 'Simulação',
      status: 'online',
      numeros: Array.from({length: 20}, () => Math.floor(Math.random() * 37)),
      ultimoNumero: Math.floor(Math.random() * 37),
      horarioUltimaAtualizacao: new Date().toISOString()
    });
    
    // Atualizar cache com dados simulados e notificar
    this.updateCache(simulatedData);
    this.emit('update', simulatedData);
    EventBus.emit('roulette:data-updated', {
      timestamp: new Date().toISOString(),
      data: simulatedData,
      source: 'simulation-after-error'
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
   * Busca dados das roletas (usa apenas cache e inicia SSE)
   * Não faz mais chamadas HTTP REST para /api/ROULETTES
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
    
    // Verificar se o cache ainda é válido
    if (this.isCacheValid()) {
      this.log('Usando dados em cache (ainda válidos)');
      return Array.from(this.rouletteData.values());
    }
    
    // Se o streaming está conectado, usar dados do cache
    if (this.isStreamConnected) {
      this.log('Stream conectado, usando dados em cache');
      return Array.from(this.rouletteData.values());
    }
    
    // Não há dados válidos no cache e streaming não está conectado
    // Iniciar/reconectar ao stream em vez de fazer chamada REST
    this.log('Sem dados válidos em cache. Iniciando conexão SSE...');
    this.connectStream();
    
    // Se já tivermos alguns dados, retorná-los mesmo que não sejam recentes
    if (this.rouletteData.size > 0) {
      this.log('Retornando dados existentes em cache enquanto aguarda SSE');
      return Array.from(this.rouletteData.values());
    }
    
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
   * Descriptografa dados criptografados
   * @deprecated Use handleEncryptedData em vez deste método
   */
  private async decryptEventData(encryptedData: string): Promise<any> {
    console.warn('[UnifiedRouletteClient] Método depreciado decryptEventData chamado, use handleEncryptedData');
    try {
      return await cryptoService.processEncryptedData({encryptedData});
    } catch (error) {
      this.error('Erro na descriptografia:', error);
      throw error;
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
    console.log('[UnifiedRouletteClient] Processando dados descriptografados');
    
    try {
      // Verificar a estrutura dos dados descriptografados
      let rouletteData = data;
      
      // Verificar se os dados estão no campo .roletas
      if (rouletteData.roletas && Array.isArray(rouletteData.roletas)) {
        console.log(`[UnifiedRouletteClient] Encontrado array de roletas: ${rouletteData.roletas.length} roletas`);
        rouletteData = rouletteData.roletas;
      }
      
      // Se temos um array vazio ou objeto vazio, usar simulação
      if ((Array.isArray(rouletteData) && rouletteData.length === 0) || 
          (typeof rouletteData === 'object' && Object.keys(rouletteData).length === 0)) {
        console.log('[UnifiedRouletteClient] Dados vazios, ignorando');
        return;
      }
      
      // Atualizar cache
      this.updateCache(rouletteData);
      
      // Notificar sobre atualização
      this.emit('update', rouletteData);
      EventBus.emit('roulette:data-updated', {
        timestamp: new Date().toISOString(),
        data: rouletteData,
        source: 'sse-decrypted'
      });
      
      // Log adicional para debug
      if (Array.isArray(rouletteData)) {
        console.log(`[UnifiedRouletteClient] Processados ${rouletteData.length} itens`);
      }
    } catch (error) {
      console.error('[UnifiedRouletteClient] Erro ao processar dados descriptografados:', error);
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
}

// Exportar singleton
export default UnifiedRouletteClient; 