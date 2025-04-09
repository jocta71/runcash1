import { io, Socket } from 'socket.io-client';
import { toast } from '@/components/ui/use-toast';
import config from '@/config/env';
import EventService, { 
  RouletteEvent,
  RouletteNumberEvent,
  RouletteEventCallback,
  StrategyUpdateEvent,
  RouletteHistoryEvent
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

// Definir interfaces estendidas para os tipos de eventos
export interface ExtendedStrategyUpdateEvent extends StrategyUpdateEvent {
  vitorias?: number;
  derrotas?: number;
  terminais_gatilho?: number[];
  numero_gatilho?: number;
  sugestao_display?: string;
}

export interface ExtendedRouletteNumberEvent extends RouletteNumberEvent {
  preserve_existing?: boolean;
  realtime_update?: boolean;
}

// Importar a lista de roletas permitidas da configuração
import { ROLETAS_PERMITIDAS } from '@/config/allowedRoulettes';

/**
 * Serviço que gerencia a conexão WebSocket via Socket.IO
 * para receber dados em tempo real do MongoDB
 */
export class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private listeners: Map<string, Set<RouletteEventCallback>> = new Map();
  private connectionActive: boolean = false;
  private connectionAttempts: number = 0;
  private reconnectTimeout: number | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private eventHandlers: Record<string, (data: any) => void> = {};
  private autoReconnect: boolean = true;
  private lastReceivedData: Map<string, { timestamp: number, data: any }> = new Map();
  private pendingPromises: Map<string, { promise: Promise<any>, timeout: ReturnType<typeof setTimeout> }> = new Map();
  
  // Propriedade para o cliente MongoDB (pode ser undefined em alguns contextos)
  public client?: MongoClient;
  
  // Mapa para armazenar os intervalos de polling por roletaId
  private pollingIntervals: Map<string, any> = new Map();
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
    this.subscribe('*', (event: RouletteEvent) => {
      if (event.type === 'new_number' && 'numero' in event && 'roleta_nome' in event) {
        console.log(`[SocketService][GLOBAL] Evento recebido para roleta: ${event.roleta_nome}, número: ${event.numero}`);
      } else if (event.type === 'strategy_update' && 'estado' in event && 'roleta_nome' in event) {
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

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  // Método único para verificar a conexão do socket
  private checkSocketConnection(): boolean {
    return this.connectionActive && !!this.socket;
  }

  // Método único para obter o histórico de uma roleta
  public getRouletteHistory(roletaId: string): number[] {
    if (!this.rouletteHistory.has(roletaId)) {
      return [];
    }
    return this.rouletteHistory.get(roletaId) || [];
  }

  private notifyHistoryUpdate(roletaId: string): void {
    const historico = this.getRouletteHistory(roletaId);
    
    const event: RouletteHistoryEvent = {
      type: 'history_update',
      roleta_id: roletaId,
      numeros: historico,
      timestamp: new Date().toISOString()
    };
    
    this.notifyListeners(event);
  }

  // Resto do código mantido como está
  
  // Método para iniciar monitoramento de ping
  private setupPing(): void {
    // Enviar ping a cada 30 segundos para manter a conexão ativa
    if (this.timerId) {
      clearInterval(this.timerId);
    }
    
    this.timerId = setInterval(() => {
      if (this.socket && this.socket.connected) {
        this.socket.emit('ping', { timestamp: Date.now() });
      }
    }, 30000);
  }
}

// Exportação padrão da classe SocketService
export default SocketService;