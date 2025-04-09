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
import StrategyService from './StrategyService';

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

/**
 * Serviço que gerencia a conexão WebSocket via Socket.IO
 * para receber dados em tempo real do MongoDB
 */
class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
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
  private circuitBreakerResetTimeout: any = null;
  private consecutiveFailures: number = 0;
  private failureThreshold: number = 5; // Quantas falhas para ativar o circuit breaker
  private resetTime: number = 60000; // 1 minuto de espera antes de tentar novamente
  
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
    }
    
    // Calcular delay baseado em backoff exponencial
    const delay = Math.min(1000 * Math.pow(2, this.connectionAttempts), 30000);
    console.log(`[SocketService] Tentando reconectar em ${delay/1000} segundos...`);
    
    this.reconnectTimeout = setTimeout(() => {
      console.log(`[SocketService] Tentando reconectar (tentativa ${this.connectionAttempts + 1})...`);
      this.connect();
    }, delay);
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

      this.setupEventListeners();
    } catch (error) {
      console.error('[SocketService] Erro ao conectar ao servidor WebSocket:', error);
      this.connectionActive = false;
      this.isConnected = false;
      
      // Notificar o usuário
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar ao servidor de dados em tempo real. Algumas funcionalidades podem não estar disponíveis.",
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

  // Outros métodos existentes...
// ... existing code ...
}

export default SocketService; 