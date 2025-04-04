import { io, Socket } from 'socket.io-client';
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
import { StrategyService } from './StrategyService';

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

/**
 * Serviço que gerencia a conexão WebSocket via Socket.IO
 * para receber dados em tempo real do MongoDB
 */
class SocketService {
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
  
  // Propriedade para o cliente MongoDB (pode ser undefined em alguns contextos)
  public client?: MongoClient;
  
  // Mapa para armazenar os intervalos de polling por roletaId
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  private _isLoadingHistoricalData: boolean = false;
  
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
    
    // Tentar recarregar dados a cada 1 minuto
    setInterval(() => this.requestRecentNumbers(), 60000);
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
    
    // Ping a cada 30 segundos para manter a conexão ativa
    this.setupPing();
    
    // Solicitar números recentes imediatamente após configurar listeners
    setTimeout(() => {
      this.requestRecentNumbers();
    }, 1000);
  }

  private processIncomingNumber(data: any): void {
    // Verificar se dados são válidos
    if (!data || !data.roleta_nome) {
      console.warn('[SocketService] Dados de número inválidos:', data);
      return;
    }
    
    // Verificar se este número é mais recente que o último recebido para esta roleta
    const roletaId = data.roleta_id || '';
    const roletaNome = data.roleta_nome;
    const combinedKey = `${roletaId}|${roletaNome}`;
    const lastReceived = this.lastReceivedData.get(combinedKey);
    
    // Se temos um número recente desta roleta, verificar se o atual é mais novo
    if (lastReceived) {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastReceived.timestamp;
      
      // Se recebemos este número há menos de 1 segundo, verificar número e timestamp
      // para evitar duplicações
      if (timeDiff < 1000) {
        const lastNumber = lastReceived.data.numero;
        const newNumber = data.numero;
        
        if (lastNumber === newNumber) {
          console.log(`[SocketService] Ignorando número duplicado ${newNumber} para ${roletaNome}`);
          return;
        }
      }
    }
    
    // Armazenar este número como o mais recente
    this.lastReceivedData.set(combinedKey, {
      timestamp: Date.now(),
      data
    });
    
    // Transformar em formato de evento para notificar
    const event: RouletteNumberEvent = {
      type: 'new_number',
      roleta_id: data.roleta_id || '',
      roleta_nome: data.roleta_nome,
      numero: typeof data.numero === 'number' ? data.numero : 
              typeof data.numero === 'string' ? parseInt(data.numero, 10) : 0,
      timestamp: data.timestamp || new Date().toISOString(),
      // Adicionar flag para preservar dados existentes
      preserve_existing: !!data.preserve_existing,
      // Adicionar flag para indicar se é atualização em tempo real
      realtime_update: !!data.realtime
    };
    
    if (isNaN(event.numero)) {
      console.warn(`[SocketService] Número inválido (NaN) recebido para ${roletaNome}, usando 0`);
      event.numero = 0;
    }
    
    console.log(`[SocketService] Processando número ${event.numero} para roleta ${event.roleta_nome}`);
    
    // Notificar os listeners
    this.notifyListeners(event);
    
    // Também notificar via EventService
    const eventService = EventService.getInstance();
    eventService.dispatchEvent(event);
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
        reconnectionDelayMax: 5000
      });

      this.socket.on('connect', () => {
        console.log('[SocketService] Conectado ao servidor WebSocket com sucesso!');
        this.connectionActive = true;
        this.connectionAttempts = 0;
        
        // Solicitar números recentes imediatamente após a conexão
        this.requestRecentNumbers();
        
        // Configurar os listeners de eventos
        this.setupEventListeners();
        
        // Registrar para todos os canais ativos de roleta
        this.registerToAllRoulettes();
        
        toast({
          title: "Conexão em tempo real estabelecida",
          description: "Recebendo atualizações instantâneas das roletas",
          variant: "default"
        });
      });

      this.socket.on('reconnect', (attempt) => {
        console.log(`[SocketService] Reconectado ao servidor WebSocket após ${attempt} tentativas`);
        this.connectionActive = true;
        this.connectionAttempts = 0;
        this.setupPing();
        
        // Solicitar dados novamente após reconexão
        this.requestRecentNumbers();
        
        toast({
          title: "Conexão restabelecida",
          description: "Voltando a receber atualizações em tempo real",
          variant: "default"
        });
      });

      this.socket.on('disconnect', (reason) => {
        console.log(`[SocketService] Desconectado do servidor WebSocket: ${reason}`);
        this.connectionActive = false;
        if (this.timerId) {
          clearInterval(this.timerId);
          this.timerId = null;
        }
        
        // Mostrar toast apenas se for desconexão inesperada
        if (reason !== 'io client disconnect') {
          toast({
            title: "Conexão em tempo real perdida",
            description: "Tentando reconectar...",
            variant: "destructive"
          });
        }
      });

      this.socket.on('error', (error) => {
        console.error('[SocketService] Erro na conexão WebSocket:', error);
      });

      // Configurar handler genérico de eventos
      this.socket.onAny((event, ...args) => {
        console.log(`[SocketService] Evento recebido: ${event}`, args);
        
        if (this.eventHandlers[event]) {
          this.eventHandlers[event](args[0]);
        }
      });

    } catch (error) {
      console.error('[SocketService] Erro ao conectar ao servidor WebSocket:', error);
      
      // Tentar reconectar após um atraso
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
  
  /**
   * Notifica os listeners sobre um evento de roleta
   * 
   * @param event Evento a ser notificado
   */
  private notifyListeners(event: RouletteNumberEvent | StrategyUpdateEvent): void {
    try {
      if (!event) {
        console.warn('[SocketService] Tentativa de notificar com evento nulo ou indefinido');
        return;
      }
      
      const roletaNome = event.roleta_nome;
      const roletaId = event.roleta_id;
      
      // Log detalhado para debug
      console.log(`[SocketService] NOTIFICANDO listeners de evento para roleta: ${roletaNome} (${roletaId}), tipo: ${event.type}`);
      
      // 1. Notificar listeners específicos desta roleta
      if (roletaNome && this.listeners.has(roletaNome)) {
        const specificListeners = this.listeners.get(roletaNome);
        
        console.log(`[SocketService] Notificando ${specificListeners?.size || 0} listeners específicos para ${roletaNome}`);
        
        if (specificListeners && specificListeners.size > 0) {
          specificListeners.forEach(callback => {
            try {
              callback(event);
            } catch (error) {
              console.error(`[SocketService] Erro ao chamar callback para ${roletaNome}:`, error);
            }
          });
        }
      }
      
      // 2. Notificar listeners globais (apenas se houver algum)
      if (this.listeners.has('*')) {
        const globalListeners = this.listeners.get('*');
        
        console.log(`[SocketService] Notificando ${globalListeners?.size || 0} listeners globais (*)`);
        
        if (globalListeners && globalListeners.size > 0) {
          globalListeners.forEach(callback => {
            try {
              callback(event);
            } catch (error) {
              console.error(`[SocketService] Erro ao chamar callback global:`, error);
            }
          });
        }
      }
      
      // 3. Log com estatísticas de notificação
      console.log(`[SocketService] Total de listeners notificados: ${
        (this.listeners.get(roletaNome)?.size || 0) + 
        (this.listeners.get('*')?.size || 0)
      }`);
            } catch (error) {
      console.error('[SocketService] Erro na notificação de listeners:', error);
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

  private setupPing() {
    if (this.timerId) {
      clearInterval(this.timerId);
    }

    this.timerId = setInterval(() => {
      if (this.socket && this.connectionActive) {
        this.socket.emit('ping');
      }
    }, 30000);
  }

  // Método para solicitar números recentes de todas as roletas
  public requestRecentNumbers(): void {
    // Verificar se já estamos carregando dados
    if (this._isLoadingHistoricalData) {
      console.log('[SocketService] Já existe um carregamento em andamento, ignorando solicitação');
      return;
    }
    
    console.log('[SocketService] Solicitando números recentes de todas as roletas');
    
    // Carregar os dados históricos via REST API apenas uma vez
    this.loadHistoricalRouletteNumbers();
    
    // Emitir evento para solicitar números recentes via WebSocket
    // apenas se já estivermos conectados
    if (this.socket && this.connectionActive) {
      this.socket.emit('get_recent_numbers', { count: 50 });
    } else {
      console.log('[SocketService] Socket não conectado, carregando dados apenas via REST');
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
    
    // Lista de IDs permitidos - apenas estas roletas serão processadas
    const ALLOWED_ROULETTES = [
      "2010016",  // Immersive Roulette
      "2380335",  // Brazilian Mega Roulette
      "2010065",  // Bucharest Auto-Roulette
      "2010096",  // Speed Auto Roulette
      "2010017",  // Auto-Roulette
      "2010098"   // Auto-Roulette VIP
    ];
    
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
          if (!ALLOWED_ROULETTES.includes(stringId)) {
            console.log(`[SocketService] Roleta não permitida: ${roulette.nome || roulette.name || 'Sem Nome'} (ID: ${stringId})`);
            continue;
          }
          
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
    console.log('[SocketService] Buscando lista de roletas reais...');
    
    try {
      // Define a URL base para as APIs
      const baseUrl = this.getApiBaseUrl();
      
      // Usar apenas o endpoint /api/ROULETTES
      const endpoint = `${baseUrl}/ROULETTES`;
      
      try {
        console.log(`[SocketService] Buscando roletas em: ${endpoint}`);
          const response = await fetch(endpoint);
          
          if (response.ok) {
      const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
            console.log(`[SocketService] ✅ Recebidas ${data.length} roletas da API`);
            
            // Mapear os UUIDs para IDs canônicos para uso posterior
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
              roletasComIdsCanonicos.map(r => `${r.nome}: ${r.uuid} → ${r._id}`));
            
            return roletasComIdsCanonicos;
          }
        }
        
        console.warn(`[SocketService] Falha ao buscar roletas ou resposta inválida do endpoint ${endpoint}`);
        
        // Se falhou, usar a lista local de roletas canônicas como fallback
        const roletasFallback = ROLETAS_CANONICAS.map(roleta => ({
          _id: roleta.id,
          nome: roleta.nome,
          ativa: true
        }));
        
        console.log(`[SocketService] Usando ${roletasFallback.length} roletas canônicas locais como fallback`);
        return roletasFallback;
        } catch (e) {
        console.warn(`[SocketService] Erro ao acessar endpoint ${endpoint}:`, e);
        
        // Se ocorrer erro, usar a lista local como fallback
        const roletasFallback = ROLETAS_CANONICAS.map(roleta => ({
          _id: roleta.id,
          nome: roleta.nome,
          ativa: true
        }));
        
        console.log(`[SocketService] Usando ${roletasFallback.length} roletas canônicas locais como fallback após erro`);
        return roletasFallback;
      }
    } catch (error) {
      console.error('[SocketService] Erro ao buscar roletas:', error);
      return [];
    }
  }
  
  // Método para buscar dados via REST como alternativa/complemento
  private async fetchRouletteNumbersREST(roletaId: string): Promise<boolean> {
    try {
      if (!roletaId) {
        return false;
      }
      
      // Construir URL com chave de timestamp para evitar cache
      const timestamp = Date.now();
      const apiBaseUrl = this.getApiBaseUrl();
      const url = `${apiBaseUrl}/ROULETTES?t=${timestamp}`;
      
      console.log(`[SocketService] Buscando dados REST para ${roletaId} em ${url}`);
      
      const response = await fetch(url, {
        // Forçar atualização com cabeçalhos de cache
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
      }
      
            const data = await response.json();
      
      if (!Array.isArray(data)) {
        console.warn(`[SocketService] Resposta inválida da API para ${roletaId}:`, data);
        return false;
      }
      
      // Log para debug
      console.log(`[SocketService] Recebidos dados de ${data.length} roletas`);
      
      // Encontrar a roleta específica
      let foundRoulette = data.find(r => r._id === roletaId || r.id === roletaId);
      
      if (!foundRoulette) {
        console.log(`[SocketService] Roleta ${roletaId} não encontrada. Tentando mapear por ID canônico...`);
        // Tentar encontrar pelo ID canônico
        const canonicalId = mapToCanonicalRouletteId(roletaId);
        foundRoulette = data.find(r => r._id === canonicalId || r.id === canonicalId);
      }
      
      if (!foundRoulette) {
        console.warn(`[SocketService] Roleta ${roletaId} não encontrada nos dados.`);
        return false;
      }
      
      console.log(`[SocketService] ✅ Roleta encontrada: ${foundRoulette.nome || foundRoulette.name || roletaId}`);
      
      const roletaNome = foundRoulette.nome || foundRoulette.name || `Roleta ${roletaId}`;
      const numeros = foundRoulette.numero || foundRoulette.numeros || [];
      
      // Verificar se temos dados válidos
      if (!Array.isArray(numeros) || numeros.length === 0) {
        console.warn(`[SocketService] Roleta ${roletaNome} não tem números válidos`);
      return false;
      }
      
      // Usar o identificador da roleta como chave para buscar dados anteriores
      const cacheKey = `roleta_${roletaId}`;
      const cachedData = this.lastReceivedData.get(cacheKey);
      
      // Processo especial para detecção de números em tempo real
      let hasNewNumbers = false;
      
      // Extrair o número mais recente do conjunto de dados
      const lastNumber = this.extractNumberValue(numeros[0]);
      
      // Se temos cache anterior, comparar para ver se há novos números
      if (cachedData && cachedData.data && Array.isArray(cachedData.data)) {
        const oldNumeros = cachedData.data;
        
        // Extrair o último número que tínhamos anteriormente
        const oldLastNumber = oldNumeros.length > 0 ? this.extractNumberValue(oldNumeros[0]) : null;
        
        // Verificar se o número mais recente é diferente (indica um número novo)
        if (lastNumber !== null && oldLastNumber !== null && lastNumber !== oldLastNumber) {
          hasNewNumbers = true;
          console.log(`[SocketService] ⚡⚡ DETECÇÃO EM TEMPO REAL: Novo número ${lastNumber} para ${roletaNome} (anterior: ${oldLastNumber})`);
          
          // Emitir evento IMEDIATAMENTE para o número mais recente
          this.emitRealtimeNumber(roletaId, roletaNome, lastNumber);
          
          // Exibir toast de notificação para alertar sobre número em tempo real
          toast({
            title: `Novo número detectado: ${lastNumber}`,
            description: `${roletaNome}`,
            variant: "default",
            duration: 3000
          });
        }
      }
      
      // Atualizar cache com os novos dados
      this.lastReceivedData.set(cacheKey, {
        timestamp: Date.now(),
        data: numeros
      });
      
      // Se não detectamos números novos, mas é a primeira vez, emitir histórico
      if (!hasNewNumbers && !cachedData) {
        console.log(`[SocketService] Emitindo histórico inicial para ${roletaNome} (${numeros.length} números)`);
        
        // Emitir até 5 números históricos com um pequeno delay entre eles
        const recentNumbers = numeros.slice(0, 5);
        
        recentNumbers.forEach((num, index) => {
          // Extrair o número
          const numero = this.extractNumberValue(num);
          
          // Ignorar números inválidos
          if (numero === null || isNaN(numero)) {
            return;
          }
          
          // Determinar se é o número mais recente (apenas o primeiro)
          const isLatest = index === 0;
          
          // Enviar com pequeno delay para garantir ordem correta
          setTimeout(() => {
            // Criar objeto de evento
            const event: RouletteNumberEvent = {
              type: 'new_number',
              roleta_id: roletaId,
              roleta_nome: roletaNome,
              numero: numero,
              timestamp: new Date().toISOString(),
              isLatest: isLatest,
              preserve_existing: true,
              // Não é uma atualização em tempo real, apenas carregamento histórico
              realtime_update: false
            };
            
            // Log específico para o primeiro número (mais recente)
            if (isLatest) {
              console.log(`[SocketService] ⚡️ Emitindo número mais recente para ${roletaNome}: ${numero}`);
            }
            
            // Emitir para os listeners
            EventService.getInstance().receiveRealtimeUpdate(event);
            
            // Emitir evento global
            EventService.emitGlobalEvent('new_number', event);
          }, index * 50); // Pequeno delay escalonado para manter ordem
        });
      }
      
      // Emitir evento de roleta existente sempre
      EventService.emitGlobalEvent('roleta_exists', {
        id: roletaId,
        nome: roletaNome,
        updated_at: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      console.error(`[SocketService] Erro ao buscar números da roleta ${roletaId}:`, error);
      return false;
    }
  }
  
  // Método auxiliar para emitir evento de número em tempo real
  private emitRealtimeNumber(roletaId: string, roletaNome: string, numero: number): void {
    // Criar evento especificamente para o número mais recente
    const event: RouletteNumberEvent = {
      type: 'new_number',
      roleta_id: roletaId,
      roleta_nome: roletaNome,
      numero: numero,
      timestamp: new Date().toISOString(),
      isLatest: true,
      preserve_existing: true,
      realtime_update: true // Importante marcar como atualização em tempo real
    };
    
    // Emitir diretamente para o EventService como tendo alta prioridade
    EventService.getInstance().receiveRealtimeUpdate(event);
    
    // Também emitir como evento global
    EventService.emitGlobalEvent('realtime_number', event);
    
    // Emitir notificação de que recebemos um número em tempo real
    EventService.emitGlobalEvent('realtime_update', {
      success: true,
      roleta_id: roletaId,
      roleta_nome: roletaNome,
      numero: numero,
      timestamp: new Date().toISOString()
    });
  }
  
  // Método auxiliar para extrair valor numérico de diferentes formatos
  private extractNumberValue(input: any): number | null {
    if (input === undefined || input === null) {
      return null;
    }
    
    // Se for um número diretamente
    if (typeof input === 'number') {
      return input;
    }
    
    // Se for uma string que pode ser convertida para número
    if (typeof input === 'string') {
      const parsed = parseInt(input, 10);
      return isNaN(parsed) ? null : parsed;
    }
    
    // Se for um objeto que tem uma propriedade 'numero' ou 'number'
    if (typeof input === 'object') {
      if (typeof input.numero !== 'undefined') {
        return this.extractNumberValue(input.numero);
      }
      if (typeof input.number !== 'undefined') {
        return this.extractNumberValue(input.number);
      }
    }
    
    return null;
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
    try {
      if (!data || (!data.roleta_id && !data.roleta_nome)) {
        console.warn('[SocketService] Evento de estratégia recebido sem identificador de roleta');
        return;
      }

      // Garantir que os valores de vitórias e derrotas sejam números válidos
      const vitorias = data.vitorias !== undefined ? parseInt(data.vitorias) : 0;
      const derrotas = data.derrotas !== undefined ? parseInt(data.derrotas) : 0;

      // Criar objeto de evento padronizado
      const event: StrategyUpdateEvent = {
        type: 'strategy_update',
        roleta_id: data.roleta_id || 'unknown-id',
        roleta_nome: data.roleta_nome || data.roleta_id || 'unknown',
        estado: data.estado || 'NEUTRAL',
        numero_gatilho: data.numero_gatilho || 0,
        terminais_gatilho: data.terminais_gatilho || [],
        vitorias: vitorias,
        derrotas: derrotas,
        sugestao_display: data.sugestao_display || '',
        timestamp: data.timestamp || new Date().toISOString()
      };

      console.log(`[SocketService] Processando evento de estratégia:`, {
        roleta: event.roleta_nome,
        vitorias: event.vitorias,
        derrotas: event.derrotas,
        timestamp: event.timestamp
      });

      // Notificar diretamente os callbacks específicos para esta roleta
      this.notifyListeners(event);
      
      // Notificar também via EventService
      const eventService = EventService.getInstance();
      eventService.emitStrategyUpdate(event);
    } catch (error) {
      console.error('[SocketService] Erro ao processar evento de estratégia:', error);
    }
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
  public reconnect(): Promise<boolean> {
    return new Promise((resolve) => {
      console.log("[SocketService] Forçando reconexão...");
      
      // Desconectar se estiver conectado
      if (this.socket) {
        if (this.socket.connected) {
          this.socket.disconnect();
        }
        this.socket = null;
      }
      
      // Reconectar
      this.connect();
      
      // Verificar status após um tempo
      setTimeout(() => {
        const isConnected = this.isSocketConnected();
        console.log(`[SocketService] Status após reconexão forçada: ${isConnected ? 'Conectado' : 'Desconectado'}`);
        
        // Se conectado, solicitar dados recentes
        if (isConnected) {
          this.requestRecentNumbers();
          this.broadcastConnectionState();
        }
        
        resolve(isConnected);
      }, 1500);
    });
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

  // Adicionar um método específico para assinar roletaId específico
  public subscribeToRouletteEndpoint(roletaId: string, roletaNome: string): void {
    if (!roletaId) {
      console.warn('[SocketService] ID da roleta não especificado para assinatura de endpoint');
      return;
    }

    // Garantir que estamos usando o ID canônico
    const canonicalId = mapToCanonicalRouletteId(roletaId, roletaNome);
    console.log(`[SocketService] Conectando ao endpoint específico de roleta: ${roletaId} (${roletaNome}) -> ID canônico: ${canonicalId}`);
    
    // Verificar se a conexão está ativa
    if (!this.socket || !this.socket.connected) {
      console.log('[SocketService] Reconectando socket antes de assinar endpoint específico');
      this.connect();
      
      // Programar nova tentativa após conexão
      setTimeout(() => {
        if (this.socket && this.socket.connected) {
          this.subscribeToRouletteEndpoint(roletaId, roletaNome);
        }
      }, 1000);
      return;
    }
    
    try {
      // Enviar inscrição para canal específico desta roleta usando ID canônico
      console.log(`[SocketService] Enviando solicitação para assinar canal da roleta: ${canonicalId} (originalmente: ${roletaId})`);
    this.socket.emit('subscribe_roulette', {
        roletaId: canonicalId,
        originalId: roletaId,
      roletaNome: roletaNome,
        channel: `roulette:${canonicalId}`
    });
    
      // Solicitar dados iniciais para esta roleta usando ID canônico
      this.requestRouletteNumbers(canonicalId);
    
    // Configurar um ouvinte específico para esta roleta, se ainda não existir
      const channelName = `roulette:${canonicalId}`;
    
    // Remover listener existente para evitar duplicação
    this.socket.off(channelName);
    
    // Adicionar novo listener
    console.log(`[SocketService] Configurando listener específico para canal ${channelName}`);
    
    this.socket.on(channelName, (data: any) => {
      console.log(`[SocketService] Dados recebidos no canal ${channelName}:`, data);
      
      if (data && data.numeros && Array.isArray(data.numeros)) {
        // Processar números recebidos
          this.processNumbersData(data.numeros, { _id: canonicalId, nome: roletaNome });
      } else if (data && data.numero !== undefined) {
        // Processar número único
        this.processIncomingNumber({
          type: 'new_number',
            roleta_id: canonicalId,
          roleta_nome: roletaNome,
          numero: data.numero,
          timestamp: data.timestamp || new Date().toISOString(),
          realtime: true
        });
      }
    });
    } catch (error) {
      console.error(`[SocketService] Erro ao configurar assinatura para ${roletaNome}:`, error);
    }
  }

  /**
   * Solicita números para uma roleta específica
   */
  public requestRouletteNumbers(roletaId: string): void {
    if (!roletaId) {
      console.warn(`[SocketService] requestRouletteNumbers: ID inválido fornecido`);
      return;
    }
    
    console.log(`[SocketService] Solicitando números para roleta ${roletaId}`);
    
    if (this.socket && this.connectionActive) {
      // Adicionar timestamp para evitar cache
      this.socket.emit('request_numbers', { 
        roleta_id: roletaId,
        timestamp: Date.now() 
      });
      
      console.log(`[SocketService] ✅ Solicitação enviada para ${roletaId}`);
              } else {
      console.log(`[SocketService] ⚠️ Socket não conectado, usando REST como fallback`);
      
      // Usar abordagem REST como fallback
      this.fetchRouletteNumbersREST(roletaId).then(success => {
        if (success) {
          console.log(`[SocketService] ✅ Números obtidos via REST para ${roletaId}`);
          } else {
          console.warn(`[SocketService] ❌ Falha ao obter números via REST para ${roletaId}`);
        }
      });
    }
    
    // Sempre atualizar via REST para garantir consistência com dados mais recentes
    // Este segundo fetch garante que peguemos os dados mais recentes mesmo se o socket estiver lento
    setTimeout(() => {
      this.fetchRouletteNumbersREST(roletaId);
    }, 300);
  }

  // Método para iniciar polling agressivo para uma roleta específica
  public startAggressivePolling(roletaId: string, roletaNome: string): void {
    if (!roletaId) {
      console.warn('[SocketService] ID da roleta não especificado para polling');
      return;
    }

    // Primeiro, cancelar qualquer intervalo existente para este ID
    this.stopPollingForRoulette(roletaId);

    console.log(`[SocketService] Iniciando polling agressivo para roleta ${roletaId} (${roletaNome})`);

    // Função que será executada em cada intervalo
    const pollFunction = () => {
      console.log(`[SocketService] Executando polling para ${roletaNome} (${roletaId})`);
      
      // Verificar se estamos conectados
      if (!this.isSocketConnected()) {
        console.log(`[SocketService] Socket desconectado durante polling. Reconectando...`);
        this.reconnect();
      }

      // Buscar dados via REST para garantir resultados imediatos
      this.fetchRouletteNumbersREST(roletaId)
        .then(success => {
          if (success) {
            console.log(`[SocketService] Polling REST bem-sucedido para ${roletaNome}`);
          } else {
            console.log(`[SocketService] Polling REST falhou, tentando via Socket para ${roletaNome}`);
            // Se REST falhar, tentar via Socket
            if (this.socket && this.socket.connected) {
              this.socket.emit('get_roulette_numbers', {
                roletaId: roletaId,
                endpoint: `/api/ROULETTES`,
                count: 20
              });
            }
          }
        })
        .catch(error => {
          console.error(`[SocketService] Erro no polling para ${roletaNome}:`, error);
        });
    };

    // Executar imediatamente pela primeira vez
    pollFunction();

    // Definir intervalo para execução regular (a cada 5 segundos)
    const intervalId = setInterval(pollFunction, 5000);
    
    // Armazenar referência ao intervalo para poder cancelar depois
    this.pollingIntervals.set(roletaId, intervalId);
  }

  // Método para parar o polling para uma roleta específica
  public stopPollingForRoulette(roletaId: string): void {
    const intervalId = this.pollingIntervals.get(roletaId);
    if (intervalId) {
      clearInterval(intervalId);
      this.pollingIntervals.delete(roletaId);
    }
  }

  // Novo método para registrar em todos os canais de roleta conhecidos
  private registerToAllRoulettes(): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('[SocketService] Impossível registrar em canais: socket não conectado');
      return;
    }
    
    console.log('[SocketService] Registrando em canais de atualização em tempo real');
    
    // Emitir um evento para informar o servidor que queremos receber todas as atualizações
    this.socket.emit('subscribe_all_roulettes', { subscribe: true });
    
    // Recuperar lista conhecida de roletas e subscrever individualmente
    this.fetchRealRoulettes().then(roulettes => {
      if (Array.isArray(roulettes) && roulettes.length > 0) {
        console.log(`[SocketService] Registrando em ${roulettes.length} canais de roleta individuais`);
        
        roulettes.forEach(roulette => {
          const roletaId = roulette._id || roulette.id;
          const roletaNome = roulette.nome || roulette.name || `Roleta ${roletaId}`;
          
          if (roletaId) {
            this.subscribeToRouletteEndpoint(roletaId, roletaNome);
          }
        });
      }
    });
  }

  // Método para testar uma roleta específica
  public testRouletteData(roletaUuid: string, roletaNome: string): void {
    if (!roletaUuid || !roletaNome) {
      console.warn(`[SocketService] testRouletteData chamado com parâmetros inválidos: ${roletaUuid}, ${roletaNome}`);
      return;
    }
    
    console.log(`[SocketService] Testando dados para roleta ${roletaNome} (${roletaUuid})`);
    
    // Converter o UUID para ID canônico (se necessário)
    const canonicalId = mapToCanonicalRouletteId(roletaUuid);
    
    // Simular evento de número ou buscar número real
    this.fetchRouletteNumbersREST(canonicalId);
  }

  private addRouletteToQueue(roletaId: string, roletaNome: string, shouldStartPolling = true): void {
    try {
      // Verificar se os parâmetros são válidos
      if (!roletaId) {
        console.warn(`[SocketService] addRouletteToQueue: ID da roleta inválido: ${roletaId}`);
        return;
      }
      
      // Converter o ID para canônico se necessário
      // Se tivermos apenas o nome, tentar mapear pelo nome
      let canonicalId = roletaId;
      if (roletaNome) {
        const roleta = ROLETAS_CANONICAS.find(r => r.nome === roletaNome);
        if (roleta) {
          canonicalId = roleta.id;
        } else {
          canonicalId = mapToCanonicalRouletteId(roletaId);
        }
      } else {
        canonicalId = mapToCanonicalRouletteId(roletaId);
      }
      
      // Log para debug
      console.log(`[SocketService] Adicionando roleta à fila: ${roletaNome || 'Sem Nome'} (${canonicalId})`);
      
      // Se já estivermos monitorando esta roleta, não adicionar novamente
      if (this.pollingIntervals.has(canonicalId)) {
        console.log(`[SocketService] Roleta ${canonicalId} já está na fila de monitoramento`);
        return;
      }
      
      // Adicionar à lista de roletas para polling
      this.pollingIntervals.set(canonicalId, setInterval(() => {
        console.log(`[SocketService] Executando polling para ${roletaNome} (${canonicalId})`);
        this.fetchRouletteNumbersREST(canonicalId);
      }, 5000));
      
      // Emitir evento para sinalizar adição da roleta
      EventService.emitGlobalEvent('roulette_added_to_queue', {
        roleta_id: canonicalId,
        roleta_nome: roletaNome || `Roleta ${canonicalId}`
      });
      
    } catch (error) {
      console.error(`[SocketService] Erro ao adicionar roleta à fila: ${error}`);
    }
  }

  /**
   * Registra uma roleta para receber atualizações em tempo real
   * 
   * @param roletaNome Nome da roleta para registrar
   */
  private registerRouletteForRealTimeUpdates(roletaNome: string): void {
    if (!roletaNome) return;
    
    console.log(`[SocketService] Registrando roleta ${roletaNome} para updates em tempo real`);
    
    // Buscar o ID canônico pelo nome
    const roleta = ROLETAS_CANONICAS.find(r => r.nome === roletaNome);
    
    if (roleta) {
      const roletaId = roleta.id;
      console.log(`[SocketService] Roleta encontrada com ID: ${roletaId}`);
      
      // Emitir evento para o servidor registrar esta roleta para atualizações em tempo real
      if (this.socket && this.connectionActive) {
        this.socket.emit('subscribe_roulette', { 
          roleta_id: roletaId, 
          roleta_nome: roletaNome 
        });
        
        console.log(`[SocketService] ✅ Enviado pedido de subscrição para ${roletaNome} (${roletaId})`);
      } else {
        console.log(`[SocketService] ⚠️ Socket não conectado, subscrição será feita quando reconectar`);
      }
      
      // Buscar dados iniciais via REST
      this.fetchRouletteNumbersREST(roletaId)
        .then(success => {
          if (success) {
            console.log(`[SocketService] ✅ Dados iniciais obtidos com sucesso para ${roletaNome}`);
          } else {
            console.warn(`[SocketService] ⚠️ Falha ao obter dados iniciais para ${roletaNome}`);
          }
        });
    } else {
      console.warn(`[SocketService] ⚠️ Roleta não encontrada pelo nome: ${roletaNome}`);
    }
  }

}

export default SocketService; 