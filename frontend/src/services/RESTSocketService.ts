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

// Adicionar tipagem para NodeJS.Timeout para evitar erro de tipo
declare global {
  namespace NodeJS {
    interface Timeout {}
  }
}

// Estender a interface RouletteNumberEvent para incluir propriedade cor
interface RouletteNumberEvent extends EventService.RouletteNumberEvent {
  cor?: string;
}

// Estender StrategyUpdateEvent para tornar terminais_gatilho opcional
interface StrategyUpdateEvent extends StrategyUpdateEvent {
  terminais_gatilho?: number[];
}

/**
 * Serviço que gerencia o acesso a dados de roletas via API REST
 * Substitui o antigo serviço de WebSocket, mantendo a mesma interface
 */
class RESTSocketService {
  private static instance: RESTSocketService;
  private listeners: Map<string, Set<RouletteEventCallback>> = new Map();
  private connectionActive: boolean = false;
  private timerId: NodeJS.Timeout | null = null;
  private pollingInterval: number = 5000; // Intervalo de 5 segundos para polling
  private lastReceivedData: Map<string, { timestamp: number, data: any }> = new Map();
  
  // Propriedade para simular estado de conexão
  public client?: MongoClient;
  
  // Mapa para armazenar os intervalos de polling por roletaId
  private pollingIntervals: Map<string, any> = new Map();
  
  private _isLoadingHistoricalData: boolean = false;
  
  // Adicionar uma propriedade para armazenar o histórico completo por roleta  
  private rouletteHistory: Map<string, number[]> = new Map();
  private historyLimit: number = 1000;
  
  // Adicionar propriedade para armazenar cache de dados das roletas
  private rouletteDataCache: Map<string, {data: any, timestamp: number}> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutos em milissegundos
  
  private constructor() {
    console.log('[RESTSocketService] Inicializando serviço REST API com polling');
    
    // Adicionar listener global para logging de todos os eventos
    this.subscribe('*', (event: RouletteNumberEvent | StrategyUpdateEvent) => {
      if (event.type === 'new_number') {
        console.log(`[RESTSocketService][GLOBAL] Evento recebido para roleta: ${event.roleta_nome}, número: ${event.numero}`);
      } else if (event.type === 'strategy_update') {
        console.log(`[RESTSocketService][GLOBAL] Atualização de estratégia para roleta: ${event.roleta_nome}, estado: ${event.estado}`);
      }
    });

    // Iniciar o polling da API REST
    this.startPolling();
    
    // Adicionar event listener para quando a janela ficar visível novamente
    window.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Iniciar como conectado
    this.connectionActive = true;
    
    // Carregar dados iniciais do localStorage se existirem
    this.loadCachedData();
  }

  // Manipular alterações de visibilidade da página
  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      console.log('[RESTSocketService] Página voltou a ficar visível, atualizando dados');
      this.fetchDataFromREST();
    }
  }

  // Iniciar polling da API REST
  private startPolling() {
    this.connectionActive = true;
    
    // Executar imediatamente na inicialização
    this.fetchDataFromREST();
    
    // Configurar intervalo de polling
    this.timerId = setInterval(() => {
      this.fetchDataFromREST();
    }, this.pollingInterval);
    
    console.log(`[RESTSocketService] Polling da API REST iniciado com intervalo de ${this.pollingInterval}ms`);
  }
  
  // Buscar dados da API REST
  private async fetchDataFromREST() {
    try {
      console.log('[RESTSocketService] Buscando dados da API REST');
      
      const apiBaseUrl = this.getApiBaseUrl();
      const url = `${apiBaseUrl}/ROULETTES?limit=100`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar dados: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Salvar no cache
      localStorage.setItem('roulettes_data_cache', JSON.stringify({
        timestamp: Date.now(),
        data: data
      }));
      
      // Processar os dados como eventos
      this.processDataAsEvents(data);
      
      return true;
    } catch (error) {
      console.error('[RESTSocketService] Erro ao buscar dados da API REST:', error);
      return false;
    }
  }
  
  // Carregar dados do cache
  private loadCachedData() {
    try {
      const cachedData = localStorage.getItem('roulettes_data_cache');
      
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        
        // Verificar se o cache não está muito antigo (máx 10 minutos)
        const now = Date.now();
        if (now - parsed.timestamp < 10 * 60 * 1000) {
          console.log('[RESTSocketService] Usando dados em cache para inicialização rápida');
          this.processDataAsEvents(parsed.data);
        }
      }
    } catch (error) {
      console.warn('[RESTSocketService] Erro ao carregar dados do cache:', error);
    }
  }
  
  // Processar dados da API como eventos de WebSocket
  private processDataAsEvents(data: any[]) {
    if (!Array.isArray(data)) {
      console.warn('[RESTSocketService] Dados recebidos não são um array:', data);
      return;
    }
    
    console.log(`[RESTSocketService] Processando ${data.length} roletas da API REST`);
    
    // Para cada roleta, emitir eventos
    data.forEach(roulette => {
      if (!roulette || !roulette.id) return;
      
      // Atualizar o historical da roleta se houver números
      if (roulette.numero && Array.isArray(roulette.numero) && roulette.numero.length > 0) {
        // Mapear apenas os números para um array simples
        const numbers = roulette.numero.map((n: any) => n.numero || n.number || 0);
        
        // Atualizar o histórico
        this.setRouletteHistory(roulette.id, numbers);
        
        // Emitir evento com o número mais recente
        const lastNumber = roulette.numero[0];
        
        const event: RouletteNumberEvent = {
          type: 'new_number',
          roleta_id: roulette.id,
          roleta_nome: roulette.nome,
          numero: lastNumber.numero || lastNumber.number || 0,
          cor: lastNumber.cor || this.determinarCorNumero(lastNumber.numero),
          timestamp: lastNumber.timestamp || new Date().toISOString()
        };
        
        // Notificar os listeners sobre o novo número
        this.notifyListeners(event);
      }
      
      // Emitir evento de estratégia se houver
      if (roulette.estado_estrategia) {
        const strategyEvent: StrategyUpdateEvent = {
          type: 'strategy_update',
          roleta_id: roulette.id,
          roleta_nome: roulette.nome,
          estado: roulette.estado_estrategia,
          numero_gatilho: roulette.numero_gatilho || 0,
          vitorias: roulette.vitorias || 0,
          derrotas: roulette.derrotas || 0
        };
        
        // Notificar os listeners sobre a atualização de estratégia
        this.notifyListeners(strategyEvent);
      }
    });
  }

  private determinarCorNumero(numero: number): string {
    if (numero === 0) return 'verde';
    if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(numero)) {
      return 'vermelho';
    }
    return 'preto';
  }

  // Singleton
  public static getInstance(): RESTSocketService {
    if (!RESTSocketService.instance) {
      RESTSocketService.instance = new RESTSocketService();
    }
    return RESTSocketService.instance;
  }

  private getApiBaseUrl(): string {
    const apiBaseUrl = getRequiredEnvVar('VITE_API_BASE_URL');
    return apiBaseUrl;
  }

  // Métodos públicos que mantém compatibilidade com a versão WebSocket

  public subscribe(roletaNome: string, callback: RouletteEventCallback): void {
    if (!this.listeners.has(roletaNome)) {
      this.listeners.set(roletaNome, new Set());
    }
    
    const listeners = this.listeners.get(roletaNome);
    if (listeners) {
      listeners.add(callback);
      console.log(`[RESTSocketService] Registrado listener para ${roletaNome}, total: ${listeners.size}`);
    }
  }

  public unsubscribe(roletaNome: string, callback: RouletteEventCallback): void {
    const listeners = this.listeners.get(roletaNome);
    if (listeners) {
      listeners.delete(callback);
      console.log(`[RESTSocketService] Listener removido para ${roletaNome}, restantes: ${listeners.size}`);
    }
  }

  private notifyListeners(event: RouletteNumberEvent | StrategyUpdateEvent): void {
    // Notificar listeners específicos para esta roleta
    const listeners = this.listeners.get(event.roleta_nome);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error(`[RESTSocketService] Erro em listener para ${event.roleta_nome}:`, error);
        }
      });
    }
    
    // Notificar listeners globais (marcados com "*")
    const globalListeners = this.listeners.get('*');
    if (globalListeners) {
      globalListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('[RESTSocketService] Erro em listener global:', error);
        }
      });
    }
  }

  public disconnect(): void {
    console.log('[RESTSocketService] Desconectando serviço de polling');
    
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    
    this.connectionActive = false;
  }

  public reconnect(): void {
    console.log('[RESTSocketService] Reconectando serviço de polling');
    
    // Limpar intervalo existente
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    
    // Reiniciar polling
    this.startPolling();
  }

  public isSocketConnected(): boolean {
    return this.connectionActive;
  }

  public getConnectionStatus(): boolean {
    return this.connectionActive;
  }

  public emit(eventName: string, data: any): void {
    console.log(`[RESTSocketService] Simulando emissão de evento ${eventName} (não implementado em modo REST)`);
  }

  public hasRealData(): boolean {
    return this.rouletteDataCache.size > 0 || this.lastReceivedData.size > 0;
  }

  public async requestRecentNumbers(): Promise<boolean> {
    return this.fetchDataFromREST();
  }

  public getRouletteHistory(roletaId: string): number[] {
    return this.rouletteHistory.get(roletaId) || [];
  }

  public setRouletteHistory(roletaId: string, numbers: number[]): void {
    this.rouletteHistory.set(roletaId, numbers.slice(0, this.historyLimit));
  }

  public async requestRouletteNumbers(roletaId: string): Promise<boolean> {
    return this.fetchDataFromREST();
  }

  public isConnected(): boolean {
    return this.connectionActive;
  }

  public destroy(): void {
    console.log('[RESTSocketService] Destruindo serviço');
    
    // Limpar intervalos
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    
    // Remover event listeners
    window.removeEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Limpar todos os listeners
    this.listeners.clear();
    
    // Desativar conexão
    this.connectionActive = false;
  }

  public async loadHistoricalRouletteNumbers(): Promise<void> {
    console.log('[RESTSocketService] Carregando dados históricos de todas as roletas');
    
    try {
      this._isLoadingHistoricalData = true;
      
      // Buscar todas as roletas com dados históricos
      const apiBaseUrl = this.getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/ROULETTES?limit=1000`);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar dados históricos: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (Array.isArray(data)) {
        // Processar os dados recebidos
        data.forEach(roleta => {
          if (roleta.id && roleta.numero && Array.isArray(roleta.numero)) {
            // Extrair apenas os números
            const numeros = roleta.numero.map((n: any) => n.numero || n.number || 0);
            
            // Armazenar no histórico
            this.setRouletteHistory(roleta.id, numeros);
            
            console.log(`[RESTSocketService] Carregados ${numeros.length} números históricos para ${roleta.nome || 'roleta desconhecida'}`);
          }
        });
        
        console.log(`[RESTSocketService] Dados históricos carregados para ${data.length} roletas`);
      }
    } catch (error) {
      console.error('[RESTSocketService] Erro ao carregar dados históricos:', error);
    } finally {
      this._isLoadingHistoricalData = false;
    }
  }
}

export default RESTSocketService; 