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
  private dataListeners: Map<string, Set<RouletteEventCallback>> = new Map();
  private pollingInterval: ReturnType<typeof setTimeout> | null = null;
  private pollingIntervalMs: number = 4000;
  private isPolling: boolean = false;
  private isCentralizedMode: boolean = true;
  private debug: boolean = !isProduction;
  private rouletteService: any;
  private lastReceivedTimestamp: number = 0;
  private lastProcessedData: Map<string, string> = new Map();
  private rouletteHistory: Map<string, number[]> = new Map();

  constructor() {
    super();
    this.rouletteService = RouletteService.getInstance();
  }

  /**
   * Registrar ouvinte para eventos
   * Sobrescrito para manter compatibilidade com o código antigo,
   * mas modificado para retornar BrowserEventEmitter conforme esperado
   */
  on(event: string, listener: Function): BrowserEventEmitter {
    super.on(event, listener);
    if (this.debug) console.log(`[RESTSocketService] Registrado listener para ${event}, total: ${this.listeners(event).length}`);
    return this;
  }

  /**
   * Método adicional para suporte a unsubscribe com retorno de função
   */
  subscribe(event: string, callback: RouletteEventCallback): () => void {
    this.on(event, callback);
    return () => this.off(event, callback);
  }

  /**
   * Remove um listener específico
   */
  removeListener(event: string, listener: Function): BrowserEventEmitter {
    return this.off(event, listener);
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
        
        // Registrar processamento deste número para evitar duplicação
        this.lastProcessedData.set(rouletteId, JSON.stringify({
          numero: lastNumber,
          timestamp: new Date().toISOString()
        }));
        
        // Atualizar histórico de números desta roleta
        const currentHistory = this.rouletteHistory.get(rouletteId) || [];
        this.rouletteHistory.set(rouletteId, this.mergeNumbersWithoutDuplicates([lastNumber], currentHistory));
        
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

  /**
   * Carrega dados históricos das roletas
   * Implementado para compatibilidade com a interface esperada
   */
  async loadHistoricalRouletteNumbers(): Promise<boolean> {
    try {
      if (this.debug) console.log('[RESTSocketService] Carregando dados históricos das roletas');
      
      // Tentar carregar dados históricos do serviço global
      const data = await globalRouletteDataService.fetchDetailedRouletteData();
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        if (this.debug) console.warn('[RESTSocketService] Nenhum dado histórico disponível');
        return false;
      }
      
      // Processar dados como histórico
      for (const roulette of data) {
        if (!roulette || !roulette.id || !roulette.numeros) continue;
        
        const roletaId = roulette.id;
        const numeros = roulette.numeros.map((n: any) => 
          typeof n.numero === 'number' ? n.numero : 
          typeof n === 'number' ? n : 0
        ).filter((n: number) => n > 0);
        
        if (numeros.length > 0) {
          // Atualizar histórico com novos números
          const currentHistory = this.rouletteHistory.get(roletaId) || [];
          this.rouletteHistory.set(roletaId, this.mergeNumbersWithoutDuplicates(numeros, currentHistory));
          
          if (this.debug) {
            console.log(`[RESTSocketService] Carregados ${numeros.length} números históricos para roleta ${roulette.nome || roletaId}`);
          }
        }
      }
      
      if (this.debug) console.log(`[RESTSocketService] Carregamento de histórico concluído: ${data.length} roletas processadas`);
      return true;
    } catch (error) {
      console.error('[RESTSocketService] Erro ao carregar dados históricos:', error);
      return false;
    }
  }
  
  /**
   * Verifica se o serviço está conectado
   */
  isConnected(): boolean {
    return true; // REST API está sempre "conectada"
  }
  
  /**
   * Função para mesclar arrays de números sem duplicatas
   */
  private mergeNumbersWithoutDuplicates(newNumbers: number[], existingNumbers: number[]): number[] {
    // Criar um conjunto (Set) para eliminar duplicatas
    const uniqueNumbersSet = new Set([...newNumbers, ...existingNumbers]);
    
    // Converter de volta para array e limitar ao tamanho máximo (500 como padrão)
    return Array.from(uniqueNumbersSet).slice(0, 500);
  }
  
  /**
   * Obter histórico de números para uma roleta específica
   */
  getRouletteHistory(roletaId: string): number[] {
    return this.rouletteHistory.get(roletaId) || [];
  }
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