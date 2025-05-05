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
    console.log('[UnifiedRouletteClient] Inicializando...');
    
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
    
    // Priorizar conexão WebSocket
    if (options.autoConnect !== false) {
      console.log('[UnifiedRouletteClient] Iniciando com conexão WebSocket (prioridade)');
      this.connectToWebSocket();
    } else if (this.pollingEnabled) {
      // Iniciar polling apenas se WebSocket não conectar
      // this.startPolling(); // Polling desativado por enquanto
      console.log('[UnifiedRouletteClient] Polling desativado, conexão WS é primária.');
    }
    
    // Buscar dados iniciais imediatamente via API REST (fallback inicial)
    this.fetchInitialRouletteDataViaApi(); 
    
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
   * Busca dados iniciais via API REST - usado no arranque
   */
  private async fetchInitialRouletteDataViaApi(): Promise<void> {
    try {
      // Usar endpoint REST /api/roletas que não exige autenticação
      const response = await axios.get('/api/roletas'); // ou getFullUrl(ENDPOINTS.REST.ROULETTES_PUBLIC)
      if (response.data && Array.isArray(response.data)) {
        console.log(`[UnifiedRouletteClient] Dados iniciais de roletas (${response.data.length}) obtidos via API REST`);
        this.updateCache(response.data);
        this.emit('update', response.data);
      } else {
        console.log('[UnifiedRouletteClient] Resposta da API REST inicial vazia ou inválida');
      }
    } catch (error) {
      console.error('[UnifiedRouletteClient] Erro ao buscar dados iniciais via API REST:', error);
    }
  }
  
  /**
   * Obtém dados simulados ou reais das roletas
   */
  public async fetchRouletteData(): Promise<any[]> {
    // Evitar requisições simultâneas
    if (this.isFetching) {
      console.log('[UnifiedRouletteClient] Requisição já em andamento, aguardando...');
      if (this.fetchPromise) {
        return this.fetchPromise;
      }
      return Array.from(this.rouletteData.values());
    }
    
    // Verificar se o WebSocket está conectado
    if (this.webSocketConnected) {
      console.log('[UnifiedRouletteClient] WebSocket está conectado, solicitando dados atualizados...');
      this.requestLatestRouletteData(); // Solicita atualização via WS
      return Array.from(this.rouletteData.values()); // Retorna cache atual
    }
    
    // Tentar conectar ao WebSocket se não estiver conectado
    if (!this.webSocketConnected && !this.socket) {
      console.log('[UnifiedRouletteClient] Tentando conectar ao WebSocket para obter dados reais...');
      this.connectToWebSocket();
      
      // Esperar um pouco para dar tempo da conexão se estabelecer
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Verificar se o cache ainda é válido (mesmo sem WS)
    if (this.isCacheValid()) {
      console.log('[UnifiedRouletteClient] Usando dados em cache (ainda válidos)');
      return Array.from(this.rouletteData.values());
    }
    
    // Tentar buscar via API REST como fallback final se WS falhar e cache expirar
    console.log('[UnifiedRouletteClient] WebSocket não conectado e cache expirado. Tentando API REST como fallback...');
    this.isFetching = true;
    this.fetchPromise = axios.get('/api/roletas') // Endpoint público
      .then(response => {
        if (response.data && Array.isArray(response.data)) {
          console.log(`[UnifiedRouletteClient] Dados obtidos via API REST fallback (${response.data.length})`);
          this.updateCache(response.data);
          this.emit('update', response.data);
          return Array.from(this.rouletteData.values());
        }
        return Array.from(this.rouletteData.values()); // Retorna cache antigo se API falhar
      })
      .catch(error => {
        console.error('[UnifiedRouletteClient] Erro ao buscar dados via API REST fallback:', error);
        return Array.from(this.rouletteData.values()); // Retorna cache antigo em caso de erro
      })
      .finally(() => {
        this.isFetching = false;
        this.fetchPromise = null;
      });
      
    return this.fetchPromise;
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
      
      console.log(`[UnifiedRouletteClient] Cache atualizado com ${data.length} roletas`);
    } else if (data && data.id) {
      // Atualizar uma única roleta
      this.rouletteData.set(data.id, data);
      console.log(`[UnifiedRouletteClient] Cache atualizado para roleta ${data.id}`);
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
        console.error(`[UnifiedRouletteClient] Erro em callback para evento ${event}:`, error);
      }
    }
  }
  
  /**
   * Manipulador para mudança de visibilidade da página
   */
  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      console.log('[UnifiedRouletteClient] Página não visível, pausando serviços');
      
      // Pausar polling se ativo
      // if (this.pollingTimer) {
      //   window.clearInterval(this.pollingTimer);
      //   this.pollingTimer = null;
      // }
    } else {
      console.log('[UnifiedRouletteClient] Página visível, retomando serviços');
      
      // Tentar reconectar WebSocket se não estiver conectado
      if (!this.webSocketConnected && !this.socket) {
        this.connectToWebSocket();
      }
      // Usar polling apenas se WebSocket falhar - DESATIVADO POR ENQUANTO
      // else if (this.pollingEnabled && !this.pollingTimer && !this.webSocketConnected) {
      //   this.startPolling();
      // }
    }
  }
  
  /**
   * Manipulador para evento de foco na janela
   */
  private handleFocus = (): void => {
    console.log('[UnifiedRouletteClient] Janela ganhou foco');
    
    // Atualizar dados imediatamente apenas se WebSocket não estiver conectado
    if (!this.webSocketConnected && !this.socket) {
      this.fetchRouletteData();
    }
  }
  
  /**
   * Manipulador para evento de perda de foco
   */
  private handleBlur = (): void => {
    console.log('[UnifiedRouletteClient] Janela perdeu foco');
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
      isStreamConnected: false, // SSE removido
      isStreamConnecting: false, // SSE removido
      streamReconnectAttempts: 0, // SSE removido
      isPollingActive: false, // Polling desativado
      lastEventId: null, // SSE removido
      lastReceivedAt: this.lastUpdateTime, // Usar último update do cache
      lastUpdateTime: this.lastUpdateTime,
      cacheSize: this.rouletteData.size,
      isCacheValid: this.isCacheValid(),
      isWebSocketConnected: this.webSocketConnected,
      webSocketReconnectAttempts: this.webSocketReconnectAttempts
    };
  }
  
  /**
   * Força uma atualização imediata dos dados
   */
  public forceUpdate(): Promise<any[]> {
    console.log('[UnifiedRouletteClient] Forçando atualização de dados...');
    // Tenta reconectar WebSocket se não estiver conectado
    if (!this.webSocketConnected && !this.socket) {
      this.connectToWebSocket();
    }
    // Sempre chama fetchRouletteData que tem a lógica de fallback para REST
    return this.fetchRouletteData();
  }
  
  /**
   * Limpa recursos ao desmontar
   */
  public dispose(): void {
    console.log('[UnifiedRouletteClient] Limpando recursos...');
    // Limpar timers
    // if (this.pollingTimer) { ... } // Polling removido
    // if (this.streamReconnectTimer) { ... } // SSE removido
    
    if (this.webSocketReconnectTimer) {
      window.clearTimeout(this.webSocketReconnectTimer);
      this.webSocketReconnectTimer = null;
    }
    
    // Fechar WebSocket
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    // Fechar stream SSE - Removido
    // if (this.eventSource) { ... }
    
    // Reset da flag de conexão global - Removido
    // UnifiedRouletteClient.GLOBAL_CONNECTION_ATTEMPT = false;
    
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
        // Se data.data.roletas existe, é o formato simulado - REMOVIDO
        // if (data.data.roletas && Array.isArray(data.data.roletas)) { ... }
        
        // Se data.data é um array, é o formato padrão
        if (Array.isArray(data.data)) {
          console.log(`[UnifiedRouletteClient] Encontrado formato padrão com ${data.data.length} roletas`);
          rouletteData = data.data;
          validStructure = true;
        }
        // Se data.data é outro formato, usar diretamente
        else {
          console.log('[UnifiedRouletteClient] Usando data.data diretamente');
          rouletteData = data.data;
          validStructure = true; // Assumir válido se tiver `data`
        }
      }
      // Verificar formato alternativo: { roletas: [...] }
      else if (data && data.roletas && Array.isArray(data.roletas)) {
        console.log(`[UnifiedRouletteClient] Encontrado formato alternativo com ${data.roletas.length} roletas`);
        rouletteData = data.roletas;
        validStructure = true;
      }
      // Verificar se os dados são diretamente um array de roletas
      else if (Array.isArray(data)) {
        console.log(`[UnifiedRouletteClient] Dados são um array direto com ${data.length} roletas`);
        rouletteData = data;
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
          source: 'decrypted-data' // Fonte agora é sempre descriptografada ou API
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
        
        // Tentar conectar ao WebSocket diretamente 
        console.log('[UnifiedRouletteClient] Estrutura inválida, tentando reconectar WebSocket...');
        this.connectToWebSocket();
      }
    } catch (error) {
      console.error('[UnifiedRouletteClient] Erro ao processar dados descriptografados:', error);
      // Tentar conectar ao WebSocket diretamente 
      this.connectToWebSocket();
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
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('[UnifiedRouletteClient] WebSocket já está conectado.');
      return;
    }
    if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
      console.log('[UnifiedRouletteClient] Conexão WebSocket já está em andamento.');
      return;
    }
    
    // Fechar socket existente se houver e não estiver fechado
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      console.log('[UnifiedRouletteClient] Fechando conexão WebSocket anterior...');
      this.socket.close();
    }
    
    this.socket = null; // Limpar referência
    this.webSocketConnected = false;
    
    try {
      console.log('[UnifiedRouletteClient] Tentando conectar ao WebSocket...');
      
      // Usar a URL configurada na propriedade webSocketUrl
      const wsUrl = this.webSocketUrl;
      
      // Incluir token na query string para autenticação inicial
      const accessKey = cryptoService.getAccessKey();
      const connectionUrl = accessKey ? `${wsUrl}?token=${encodeURIComponent(accessKey)}` : wsUrl;
      console.log(`[UnifiedRouletteClient] Conectando a: ${connectionUrl.replace(/token=.*?(&|$)/, 'token=******$1')}`);
      
      // Criar nova conexão WebSocket
      this.socket = new WebSocket(connectionUrl);
      
      // Configurar handlers de eventos
      this.socket.onopen = this.handleWebSocketOpen.bind(this);
      this.socket.onmessage = this.handleWebSocketMessage.bind(this);
      this.socket.onerror = this.handleWebSocketError.bind(this);
      this.socket.onclose = this.handleWebSocketClose.bind(this);
      
      // Incrementar tentativas apenas se não estiver já conectando
      if (!this.webSocketConnected) {
         this.webSocketReconnectAttempts++;
      }
      
    } catch (error) {
      console.error('[UnifiedRouletteClient] Erro ao iniciar conexão WebSocket:', error);
      this.scheduleWebSocketReconnect();
    }
  }
  
  /**
   * Handler para evento de abertura da conexão WebSocket
   */
  private handleWebSocketOpen(event: Event): void {
    console.log('[UnifiedRouletteClient] Conexão WebSocket estabelecida com sucesso');
    this.webSocketConnected = true;
    this.webSocketReconnectAttempts = 0; // Resetar tentativas ao conectar
    
    // Enviar autenticação se necessário (embora já tenhamos enviado via query)
    // if (cryptoService.hasAccessKey()) { ... } // Removido pois token vai na query
    
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
      console.log('[UnifiedRouletteClient] Mensagem WebSocket recebida:', message.type || 'sem tipo');
      
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
        console.log(`[UnifiedRouletteClient] Recebido número ${rouletteData.ultimoNumero} para roleta ${rouletteData.nome} (${rouletteData.id})`);
        
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
          console.log(`[UnifiedRouletteClient] Recebida lista com ${message.data.length} roletas do WebSocket`);
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
          console.log('[UnifiedRouletteClient] Autenticação no WebSocket bem-sucedida');
          // Solicitar dados após autenticação
          this.requestLatestRouletteData();
        } else {
          console.error('[UnifiedRouletteClient] Falha na autenticação no WebSocket:', message.message || 'Motivo desconhecido');
        }
      } else if (message.type === 'log' || message.type === 'info') {
        // Mensagem de log do servidor
        console.log(`[UnifiedRouletteClient] Mensagem de log do servidor: ${message.message || JSON.stringify(message)}`);
      } else {
        // Tipo desconhecido - tentar processar mesmo assim se tiver dados relevantes
        console.log(`[UnifiedRouletteClient] Tipo de mensagem desconhecido: ${message.type || 'undefined'}`);
        
        // Verificar se podemos extrair dados de roleta mesmo assim
        if (message.roleta_id || message.roleta || message.id || message.data) {
          if (message.data && Array.isArray(message.data)) {
            // Provavelmente é uma lista de roletas
            console.log(`[UnifiedRouletteClient] Processando lista de ${message.data.length} roletas de mensagem não tipada`);
            this.updateCache(message.data);
          } else if (message.numero !== undefined || message.ultimoNumero !== undefined) {
            // Provavelmente é uma atualização de número
            console.log(`[UnifiedRouletteClient] Processando atualização de número de mensagem não tipada: ${message.numero || message.ultimoNumero}`);
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
      console.error('[UnifiedRouletteClient] Erro ao processar mensagem WebSocket:', error);
    }
  }
  
  /**
   * Handler para erros na conexão WebSocket
   */
  private handleWebSocketError(event: Event): void {
    console.error('[UnifiedRouletteClient] Erro na conexão WebSocket:', event);
    this.webSocketConnected = false;
    this.scheduleWebSocketReconnect();
  }
  
  /**
   * Handler para fechamento da conexão WebSocket
   */
  private handleWebSocketClose(event: CloseEvent): void {
    console.log(`[UnifiedRouletteClient] Conexão WebSocket fechada: Código ${event.code}, Razão: ${event.reason}`);
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
      console.error(`[UnifiedRouletteClient] Número máximo de tentativas de reconexão WebSocket (${this.maxWebSocketReconnectAttempts}) atingido, desistindo...`);
      
      // Tentar o fallback SSE em vez de simulação - Lógica SSE removida
      // if (!this.isStreamConnected && !this.isStreamConnecting) { ... }
      console.log('[UnifiedRouletteClient] Falha na conexão WebSocket. Tente recarregar a página ou verifique a conexão do backend.');
      
      return;
    }
    
    // Calcular tempo de espera (backoff exponencial)
    const reconnectDelay = Math.min(1000 * Math.pow(2, this.webSocketReconnectAttempts), 30000);
    console.log(`[UnifiedRouletteClient] Agendando reconexão WebSocket em ${reconnectDelay}ms (tentativa ${this.webSocketReconnectAttempts})`);
    
    // Agendar reconexão
    this.webSocketReconnectTimer = window.setTimeout(() => {
      console.log('[UnifiedRouletteClient] Tentando reconectar ao WebSocket...');
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
      console.log('[UnifiedRouletteClient] Solicitação de dados recentes enviada via WebSocket');
    } catch (error) {
      console.error('[UnifiedRouletteClient] Erro ao solicitar dados via WebSocket:', error);
    }
  }
}

// Exportar singleton
export default UnifiedRouletteClient; 