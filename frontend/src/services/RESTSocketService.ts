import { getRequiredEnvVar, isProduction } from '../config/env';
import globalRouletteDataService from '@/services/GlobalRouletteDataService';
import Cookies from 'js-cookie';
import BrowserEventEmitter from '../utils/BrowserEventEmitter';
import RouletteService from './RouletteService';

// Adicionar tipagem para NodeJS.Timeout para evitar erro de tipo
declare global {
  namespace NodeJS {
    interface Timeout {}
  }
}

// Exportar interfaces para histórico
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

// Adicionar tipagem para NodeJS.Timeout para evitar erro de tipo
type NodeJSTimeout = ReturnType<typeof setTimeout>;

interface RESTSocketServiceConfig {
  pollingInterval?: number;
  httpEndpoint?: string;
  centralServiceEndpoint?: string;
}

// Tipagem para callback de eventos da roleta
export type RouletteEventCallback = (event: any) => void;

/**
 * RESTSocketService
 * 
 * Serviço para lidar com eventos de jogos de roleta
 * Processa os dados recebidos do serviço centralizado e emite eventos
 * com base nos números e estratégias atualizados
 */
interface RouletteData {
  id: string;
  nome?: string;
  numeros?: Array<{numero: number}>;
}

interface RouletteEvent {
  rouletteId: string;
  rouletteName?: string;
  number?: number;
  status?: string;
}

class RESTSocketService extends BrowserEventEmitter {
  private dataListeners: Map<string, Set<(event: any) => void>>;
  private pollingInterval: ReturnType<typeof setTimeout> | null;
  private pollingIntervalMs: number;
  private isPolling: boolean;
  private isCentralizedMode: boolean;
  private debug: boolean;
  private rouletteService: any; // Usando any por compatibilidade, mas idealmente teria um tipo
  private lastReceivedTimestamp: number;

  constructor() {
    super();
    this.dataListeners = new Map();
    this.pollingInterval = null;
    this.pollingIntervalMs = 4000; // 4 segundos
    this.isPolling = false;
    this.isCentralizedMode = true; // Modo centralizado usando GlobalRouletteService
    this.debug = process.env.NODE_ENV !== 'production';
    this.rouletteService = RouletteService.getInstance();
    
    this.lastReceivedTimestamp = 0;
  }

  // Registrar ouvinte para eventos
  on(event: string, callback: (data: any) => void): () => void {
    super.on(event, callback);
    if (this.debug) console.log(`[RESTSocketService] Registrado listener para ${event}, total: ${this.listenerCount(event)}`);
    return () => this.removeListener(event, callback);
  }

  // Processar dados das roletas evitando duplicações
  processRouletteData(data: RouletteData[], source: string = 'api'): void {
    // Usar o serviço centralizado para prevenir duplicações
    const uniqueData = this.rouletteService.processRouletteData(data, source);
    
    if (uniqueData.length === 0) {
      return; // Nenhum dado único para processar
    }
    
    // Processar apenas dados que não foram duplicados
    for (const roulette of uniqueData) {
      if (!roulette || !roulette.id) continue;
      
      const rouletteId = roulette.id;
      const lastNumbers = roulette.numeros || [];
      
      if (lastNumbers.length > 0) {
        if (this.debug) console.log(`[RESTSocketService] Novos números detectados para roleta ${roulette.nome || 'desconhecida'}`);
        
        // Emitir evento para o primeiro número (mais recente)
        const lastNumber = lastNumbers[0].numero;
        this.emit('new_number', {
          rouletteId,
          rouletteName: roulette.nome,
          number: lastNumber
        });
        
        if (this.debug) {
          console.log(`[RESTSocketService][GLOBAL] Evento recebido para roleta: ${roulette.nome}, número: ${lastNumber}`);
        }
        
        // Adicionar lógica para atualização de estratégia
        this.emit('strategy_update', {
          rouletteId,
          rouletteName: roulette.nome,
          status: 'NEUTRAL' // Estado padrão
        });
        
        if (this.debug) {
          console.log(`[RESTSocketService][GLOBAL] Atualização de estratégia para roleta: ${roulette.nome}, estado: NEUTRAL`);
        }
      }
    }
  }

  // Receber atualização de dados do serviço centralizado
  receiveCentralizedUpdate(data: RouletteData[], timestamp: number): void {
    if (!timestamp || timestamp <= this.lastReceivedTimestamp) {
      if (this.debug) console.log(`[RESTSocketService] Ignorando dados com timestamp obsoleto: ${timestamp} <= ${this.lastReceivedTimestamp}`);
      return;
    }
    
    this.lastReceivedTimestamp = timestamp;
    
    if (this.debug) console.log(`[RESTSocketService] Recebendo atualização do serviço global centralizado`);
    
    if (!data || !Array.isArray(data)) {
      if (this.debug) console.log(`[RESTSocketService] Dados inválidos recebidos do serviço centralizado`);
      return;
    }
    
    if (this.debug) console.log(`[RESTSocketService] Processando ${data.length} roletas da API REST`);
    
    const startTime = Date.now();
    this.processRouletteData(data, 'centralized-service');
    
    if (this.debug) {
      const elapsedTime = Date.now() - startTime;
      console.log(`[RESTSocketService] Processamento concluído em ${elapsedTime}ms`);
    }
  }
  
  // Receber dados do serviço centralizado
  receiveCentralData(data: RouletteData[], timestamp: number): void {
    if (this.debug) console.log(`[RESTSocketService] Recebendo dados do serviço centralizado`);
    if (this.debug) console.log(`[RESTSocketService] Processando dados do serviço centralizado: ${timestamp}`);
    
    if (!data || !Array.isArray(data)) {
      if (this.debug) console.log(`[RESTSocketService] Dados inválidos recebidos do serviço centralizado`);
      return;
    }
    
    if (this.debug) console.log(`[RESTSocketService] Processando ${data.length} roletas do serviço centralizado`);
    
    // Processar os dados através do serviço anti-duplicação
    this.processRouletteData(data, 'central-service');
  }

  // Outros métodos do serviço...
}

// Singleton
let instance: RESTSocketService | null = null;

export default {
  getInstance(): RESTSocketService {
    if (!instance) {
      instance = new RESTSocketService();
    }
    return instance;
  }
}; 