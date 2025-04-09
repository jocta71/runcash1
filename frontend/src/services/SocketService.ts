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
 * Serviço que gerencia o acesso a dados de roletas via API REST
 * Substitui o antigo serviço de WebSocket, mantendo a mesma interface
 */
class SocketService {
  private static instance: SocketService;
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
    console.log('[SocketService] Inicializando serviço REST API com polling');
    
    // Adicionar listener global para logging de todos os eventos
    this.subscribe('*', (event: RouletteNumberEvent | StrategyUpdateEvent) => {
      if (event.type === 'new_number') {
        console.log(`[SocketService][GLOBAL] Evento recebido para roleta: ${event.roleta_nome}, número: ${event.numero}`);
      } else if (event.type === 'strategy_update') {
        console.log(`[SocketService][GLOBAL] Atualização de estratégia para roleta: ${event.roleta_nome}, estado: ${event.estado}`);
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
      console.log('[SocketService] Página voltou a ficar visível, atualizando dados');
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
    
    console.log(`[SocketService] Polling da API REST iniciado com intervalo de ${this.pollingInterval}ms`);
  }
  
  // Buscar dados da API REST
  private async fetchDataFromREST() {
    try {
      console.log('[SocketService] Buscando dados da API REST');
      
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
      console.error('[SocketService] Erro ao buscar dados da API REST:', error);
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
          console.log('[SocketService] Usando dados em cache para inicialização rápida');
          this.processDataAsEvents(parsed.data);
        }
      }
    } catch (error) {
      console.warn('[SocketService] Erro ao carregar dados do cache:', error);
    }
  }
  
  // Processar dados da API como eventos de WebSocket
  private processDataAsEvents(data: any[]) {
    if (!Array.isArray(data)) {
      console.warn('[SocketService] Dados recebidos não são um array:', data);
      return;
    }
    
    console.log(`[SocketService] Processando ${data.length} roletas da API REST`);
    
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
  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
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
      console.log(`[SocketService] Registrado listener para ${roletaNome}, total: ${listeners.size}`);
    }
  }

  public unsubscribe(roletaNome: string, callback: RouletteEventCallback): void {
    const listeners = this.listeners.get(roletaNome);
    if (listeners) {
      listeners.delete(callback);
      console.log(`[SocketService] Listener removido para ${roletaNome}, restantes: ${listeners.size}`);
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
          console.error(`[SocketService] Erro em listener para ${event.roleta_nome}:`, error);
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
          console.error('[SocketService] Erro em listener global:', error);
        }
      });
    }
  }

  public disconnect(): void {
    console.log('[SocketService] Desconectando serviço de polling');
    
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    
    this.connectionActive = false;
  }

  public reconnect(): void {
    console.log('[SocketService] Reconectando serviço de polling');
    
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
    console.log(`[SocketService] Simulando emissão de evento ${eventName} (não implementado em modo REST)`);
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
    console.log('[SocketService] Destruindo serviço');
    
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
}

export default SocketService;
  
  // Método para registrar uma roleta para receber atualizações em tempo real
  private registerRouletteForRealTimeUpdates(roletaNome: string, roletaId?: string): void {
    if (!roletaNome) return;
    
    console.log(`[SocketService] Registrando roleta ${roletaNome} para updates em tempo real`);
    
    // Se temos o ID diretamente, usá-lo (não buscar em ROLETAS_CANONICAS)
    if (roletaId) {
      console.log(`[SocketService] Usando ID fornecido: ${roletaId}`);
      this.subscribeToRouletteEndpoint(roletaId, roletaNome);
      return;
    }
    
    // Se não temos o ID, tentar buscar nos dados recentes
    this.fetchRealRoulettes().then(roletas => {
      const roleta = roletas.find(r => r.nome === roletaNome || r.name === roletaNome);
      
      if (roleta) {
        const id = roleta._id || roleta.id;
        console.log(`[SocketService] Roleta encontrada com ID: ${id}`);
        this.subscribeToRouletteEndpoint(id, roletaNome);
    } else {
      console.warn(`[SocketService] Roleta não encontrada pelo nome: ${roletaNome}`);
    }
    }).catch(error => {
      console.error(`[SocketService] Erro ao buscar dados para roleta ${roletaNome}:`, error);
    });
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
  
  // Melhorar o método notifyListeners para lidar com retornos assíncronos dos callbacks
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
        const listeners = this.listeners.get(roletaNome);
        if (listeners && listeners.size > 0) {
          console.log(`[SocketService] Notificando ${listeners.size} listeners específicos para ${roletaNome}`);
          
          // Chamar cada callback com tratamento de erros por callback
          listeners.forEach((callback, index) => {
            try {
              // Verificar se o callback retorna uma promise
              const result = callback(event);
              // Remover verificação de resultado === true que causa erro de tipo
              // Criar uma promise que nunca será resolvida, apenas para rastrear o timeout
              const dummyPromise = new Promise(resolve => {
                // Este resolve nunca será chamado, mas o timeout irá limpar esta entrada
              });
              this.trackPromise(`${roletaNome}_${index}_${Date.now()}`, dummyPromise);
            } catch (error) {
              console.error(`[SocketService] Erro ao chamar callback para ${roletaNome}:`, error);
            }
          });
        }
      }
      
      // 2. Notificar listeners globais ('*')
      if (this.listeners.has('*')) {
        const globalListeners = this.listeners.get('*');
        if (globalListeners && globalListeners.size > 0) {
          console.log(`[SocketService] Notificando ${globalListeners.size} listeners globais`);
          
          globalListeners.forEach((callback, index) => {
            try {
              const result = callback(event);
              // Remover verificação de resultado === true que causa erro de tipo
              // O callback indicou resposta assíncrona
              const dummyPromise = new Promise(resolve => {});
              this.trackPromise(`global_${index}_${Date.now()}`, dummyPromise);
            } catch (error) {
              console.error('[SocketService] Erro ao chamar callback global:', error);
            }
          });
        }
      }
      
      // 3. Também emitir o evento via serviço de eventos
      try {
        EventService.getInstance().dispatchEvent(event);
            } catch (error) {
        console.error('[SocketService] Erro ao despachar evento via EventService:', error);
      }
      
    } catch (error) {
      console.error('[SocketService] Erro ao notificar listeners:', error);
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

  /**
   * Solicita números recentes para todas as roletas
   */
  public requestRecentNumbers(): void {
    try {
    console.log('[SocketService] Solicitando números recentes de todas as roletas');
    
      // Buscar todas as roletas reais (sem filtro)
      this.fetchRealRoulettes().then(roletas => {
        if (roletas && roletas.length > 0) {
          console.log(`[SocketService] Encontradas ${roletas.length} roletas para solicitar números`);
          
          // Solicitar números para todas as roletas sem filtrar
          roletas.forEach(roleta => {
            const roletaId = roleta._id || roleta.id;
            const roletaNome = roleta.nome || roleta.name || `Roleta ${roletaId?.substring(0, 8)}`;
            
            if (roletaId) {
              console.log(`[SocketService] Solicitando dados para ${roletaNome} (${roletaId})`);
              
              // Usar REST API para buscar números
              this.fetchRouletteNumbersREST(roletaId);
            }
          });
    } else {
          console.warn('[SocketService] Nenhuma roleta disponível para solicitar números');
        }
      }).catch(error => {
        console.error('[SocketService] Erro ao buscar roletas para solicitar números:', error);
      });
    } catch (error) {
      console.error('[SocketService] Erro ao solicitar números recentes:', error);
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
    
    // Lista de IDs permitidos - usa os valores da configuração
    // Forçar uma lista vazia, para não filtrar roletas (todas serão permitidas)
    const ALLOWED_ROULETTES: string[] = [];
    
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
          // Removendo a verificação que bloqueia roletas não permitidas - permitir todas as roletas
          /*
          if (!ALLOWED_ROULETTES.includes(stringId)) {
            console.log(`[SocketService] Roleta não permitida: ${roulette.nome || roulette.name || 'Sem Nome'} (ID: ${stringId})`);
            continue;
          }
          */
          
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
    console.log('[SocketService] ⛔ DESATIVADO: Busca de roletas reais bloqueada para diagnóstico');
    
    // Usar a lista local como fallback
    const roletasFallback = ROLETAS_CANONICAS.map(roleta => ({
      _id: roleta.id,
      nome: roleta.nome,
      ativa: true
    }));
    
    return roletasFallback;
    
    /* CÓDIGO ORIGINAL DESATIVADO
    console.log('[SocketService] Buscando lista de roletas reais...');
    
    // Verificar se o circuit breaker está ativo
    if (!this.shouldProceedWithRequest('/api/ROULETTES')) {
      console.log('[SocketService] Circuit breaker ativo, usando dados de fallback');
      
      // Usar a lista local como fallback
      const roletasFallback = ROLETAS_CANONICAS.map(roleta => ({
        _id: roleta.id,
        nome: roleta.nome,
        ativa: true
      }));
      
      return roletasFallback;
    }
    
    try {
      // Define a URL base para as APIs
      const baseUrl = this.getApiBaseUrl();
      
      // Usar apenas o endpoint /api/ROULETTES
      const endpoint = `${baseUrl}/ROULETTES`;
      
      // Usar sistema de retry para lidar com erros 502
      let attempt = 0;
      const maxAttempts = 3;
      let response = null;
      
      while (attempt < maxAttempts) {
        try {
          console.log(`[SocketService] Buscando roletas em: ${endpoint} (tentativa ${attempt + 1}/${maxAttempts})`);
          response = await fetch(endpoint);
          
          // Se tiver sucesso, processar os dados
          if (response.ok) {
      const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
            console.log(`[SocketService] ✅ Recebidas ${data.length} roletas da API`);
            
              // Sinalizar sucesso para o circuit breaker
              this.handleCircuitBreaker(true, endpoint);
              
              // Armazenar no cache global para uso futuro
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
                roletasComIdsCanonicos.length);
            
            return roletasComIdsCanonicos;
          }
            break; // Se chegou aqui mas não tem dados, sair do loop
          }
          
          // Se for erro 502, tentar novamente
          if (response.status === 502) {
            attempt++;
            console.warn(`[SocketService] Erro 502 ao buscar roletas. Tentativa ${attempt}/${maxAttempts}`);
            
            // Marcar falha para o circuit breaker
            this.handleCircuitBreaker(false, endpoint);
            
            // Esperar antes de tentar novamente (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
          } else {
            // Se for outro erro, sair do loop
            console.warn(`[SocketService] Erro ${response.status} ao buscar roletas.`);
            break;
          }
        } catch (error) {
          attempt++;
          console.error(`[SocketService] Erro de rede na tentativa ${attempt}/${maxAttempts}:`, error);
          
          // Marcar falha para o circuit breaker
          this.handleCircuitBreaker(false, endpoint);
          
          // Esperar antes de tentar novamente
          await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
          
          // Se for a última tentativa, sair do loop
          if (attempt >= maxAttempts) {
            break;
          }
        }
      }
      
      // Se chegamos aqui, todas as tentativas falharam
      console.warn(`[SocketService] Falha ao buscar roletas após ${maxAttempts} tentativas`);
      
      // Usar a lista local de roletas canônicas como fallback
        const roletasFallback = ROLETAS_CANONICAS.map(roleta => ({
          _id: roleta.id,
          nome: roleta.nome,
          ativa: true
        }));
        
        console.log(`[SocketService] Usando ${roletasFallback.length} roletas canônicas locais como fallback`);
        return roletasFallback;
        
    } catch (error) {
      console.error('[SocketService] Erro ao buscar roletas:', error);
      
      // Marcar falha para o circuit breaker
      this.handleCircuitBreaker(false, 'fetchRealRoulettes');
      
      // Fallback para lista local
        const roletasFallback = ROLETAS_CANONICAS.map(roleta => ({
          _id: roleta.id,
          nome: roleta.nome,
          ativa: true
        }));
        
        return roletasFallback;
    }
    */
  }
  
  // Método para buscar dados via REST como alternativa/complemento
  public async fetchRouletteNumbersREST(roletaId: string, limit: number = 1000): Promise<boolean> {
    console.log(`[SocketService] ⛔ DESATIVADO: Busca de números REST para roleta ${roletaId} bloqueada para diagnóstico`);
    
    // Tentar usar o cache mesmo que antigo
    const cachedData = this.rouletteDataCache.get(roletaId);
    if (cachedData) {
      const roleta = cachedData.data;
      const numeros = roleta.numero || roleta.numeros || roleta.historico || [];
      
      if (Array.isArray(numeros) && numeros.length > 0) {
        this.processNumbersData(numeros, roleta);
        return true;
      }
    }
    
    // Se não tem cache, usar fallback
    return this.useFallbackData(roletaId);
    
    /* CÓDIGO ORIGINAL DESATIVADO
    if (!roletaId) {
      console.error('[SocketService] ID de roleta inválido para buscar números:', roletaId);
      return false;
    }
    
    // Verificar se o circuit breaker está ativo
    if (!this.shouldProceedWithRequest(`/api/ROULETTES/${roletaId}`)) {
      console.log(`[SocketService] Circuit breaker ativo, usando cache ou fallback para ${roletaId}`);
      
      // Tentar usar o cache mesmo que antigo
      const cachedData = this.rouletteDataCache.get(roletaId);
      if (cachedData) {
        const roleta = cachedData.data;
        const numeros = roleta.numero || roleta.numeros || roleta.historico || [];
        
        if (Array.isArray(numeros) && numeros.length > 0) {
          this.processNumbersData(numeros, roleta);
          return true;
        }
      }
      
      // Se não tem cache, usar fallback
      return this.useFallbackData(roletaId);
    }
    
    try {
      // Verificar se temos dados no cache que ainda são válidos
      const cachedData = this.rouletteDataCache.get(roletaId);
      const now = Date.now();
      
      if (cachedData && (now - cachedData.timestamp) < this.cacheTTL) {
        console.log(`[SocketService] Usando dados em cache para roleta ${roletaId} (${Math.round((now - cachedData.timestamp)/1000)}s atrás)`);
        
        // Usar os dados do cache
        const roleta = cachedData.data;
        const numeros = roleta.numero || roleta.numeros || roleta.historico || [];
        
        if (Array.isArray(numeros) && numeros.length > 0) {
          // Notificar que temos dados para esta roleta
          this.processNumbersData(numeros, roleta);
          
          // Também armazenar os números no histórico local
          const numerosSimples = numeros
            .filter(n => n !== null && n !== undefined)
            .map(n => {
              if (n && typeof n === 'object' && 'numero' in n) {
                return n.numero;
              }
              return n;
            })
            .filter(n => n !== null && !isNaN(n));
          
          this.setRouletteHistory(roletaId, numerosSimples);
          return true;
        }
      }
      
      // Continuar com a busca na API
      // Tentar buscar dados da API REST (/api/ROULETTE/:id/numbers)
      console.log(`[SocketService] Buscando números para roleta ${roletaId} via REST API`);
      
      const baseUrl = this.getApiBaseUrl();
      const endpoint = `${baseUrl}/ROULETTES`;
      
      console.log(`[SocketService] Buscando em: ${endpoint}`);
      
      // Usar sistema de retry para lidar com erros 502
        let attempt = 0;
        const maxAttempts = 3;
        let response = null;
        
        while (attempt < maxAttempts) {
          try {
            response = await fetch(endpoint);
          
            if (response.ok) {
            const allRoulettes = await response.json();
            
            if (!Array.isArray(allRoulettes)) {
              console.error(`[SocketService] Resposta inválida da API de roletas. Esperado um array, recebido:`, typeof allRoulettes);
              break;
            }
            
            // Encontrar a roleta específica pelo ID
            const roleta = allRoulettes.find(r => {
              // Tentar diferentes propriedades que podem ser o ID
              const roletaId_original = r.id || r._id;
              const canonical_id = mapToCanonicalRouletteId(roletaId_original);
              return canonical_id === roletaId || roletaId_original === roletaId;
            });
            
            if (!roleta) {
              console.warn(`[SocketService] Roleta ${roletaId} não encontrada na lista de roletas`);
              break;
            }
            
            // Verificar se temos números
            const numeros = roleta.numero || roleta.numeros || roleta.historico || [];
            
            if (!Array.isArray(numeros) || numeros.length === 0) {
              console.warn(`[SocketService] Roleta ${roletaId} não tem números`);
              break;
            }
            
            console.log(`[SocketService] ✅ Recebidos ${numeros.length} números para roleta ${roletaId}`);
            
            // Armazenar no cache para uso futuro
              this.rouletteDataCache.set(roletaId, {
                data: roleta,
              timestamp: now
            });
            
            // Processar os números recebidos
                this.processNumbersData(numeros, roleta);
                
                // Também armazenar os números no histórico local
                const numerosSimples = numeros
                  .filter(n => n !== null && n !== undefined)
                  .map(n => {
                    if (n && typeof n === 'object' && 'numero' in n) {
                      return n.numero;
                    }
                    return n;
                  })
                  .filter(n => n !== null && !isNaN(n));
                
                this.setRouletteHistory(roletaId, numerosSimples);
            
            // Sinalizar sucesso para o circuit breaker
            this.handleCircuitBreaker(true, endpoint);
                
                return true;
          }
          
          // Se for erro 502, tentar novamente
          if (response.status === 502) {
            attempt++;
            console.warn(`[SocketService] Erro 502 ao buscar números. Tentativa ${attempt}/${maxAttempts}`);
            
            // Marcar falha para o circuit breaker
          this.handleCircuitBreaker(false, endpoint);
            
            // Esperar antes de tentar novamente (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
          } else {
            // Se for outro erro, sair do loop
            console.warn(`[SocketService] Erro ${response.status} ao buscar números.`);
            break;
          }
      } catch (error) {
          attempt++;
          console.error(`[SocketService] Erro de rede na tentativa ${attempt}/${maxAttempts}:`, error);
          
          // Marcar falha para o circuit breaker
          this.handleCircuitBreaker(false, endpoint);
          
          // Esperar antes de tentar novamente
          await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
          
          // Se for a última tentativa, sair do loop
          if (attempt >= maxAttempts) {
            break;
          }
        }
      }
      
      // Se chegamos aqui, todas as tentativas falharam
      console.warn(`[SocketService] Falha ao buscar números após ${maxAttempts} tentativas`);
      
      // Usar fallback
        return this.useFallbackData(roletaId);
    } catch (error) {
      console.error(`[SocketService] Erro ao buscar números para roleta ${roletaId}:`, error);
      
      // Marcar falha para o circuit breaker
      this.handleCircuitBreaker(false, `fetchRouletteNumbersREST_${roletaId}`);
      
      // Usar fallback
      return this.useFallbackData(roletaId);
    }
    */
  }

  // Métodos públicos que mantém compatibilidade com a versão WebSocket

  public subscribe(roletaNome: string, callback: RouletteEventCallback): void {
    if (!this.listeners.has(roletaNome)) {
      this.listeners.set(roletaNome, new Set());
    }
    
    const listeners = this.listeners.get(roletaNome);
    if (listeners) {
      listeners.add(callback);
      console.log(`[SocketService] Registrado listener para ${roletaNome}, total: ${listeners.size}`);
    }
  }

  public unsubscribe(roletaNome: string, callback: RouletteEventCallback): void {
    const listeners = this.listeners.get(roletaNome);
    if (listeners) {
      listeners.delete(callback);
      console.log(`[SocketService] Listener removido para ${roletaNome}, restantes: ${listeners.size}`);
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
          console.error(`[SocketService] Erro em listener para ${event.roleta_nome}:`, error);
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
          console.error('[SocketService] Erro em listener global:', error);
        }
      });
    }
  }

  public disconnect(): void {
    console.log('[SocketService] Desconectando serviço de polling');
    
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    
    this.connectionActive = false;
  }

  public reconnect(): void {
    console.log('[SocketService] Reconectando serviço de polling');
    
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
    console.log(`[SocketService] Simulando emissão de evento ${eventName} (não implementado em modo REST)`);
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
    console.log('[SocketService] Destruindo serviço');
    
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
}

export default SocketService;

  /**
   * Registra todas as roletas para receber atualizações em tempo real
   */
  public registerToAllRoulettes(): void {
    try {
      console.log('[SocketService] Registrando para receber atualizações de todas as roletas');
  
      // Buscar todas as roletas disponíveis no servidor
      this.fetchRealRoulettes().then(roletas => {
        if (roletas && roletas.length > 0) {
          console.log(`[SocketService] Encontradas ${roletas.length} roletas disponíveis para registrar`);
          
          // Registrar para todas as roletas, sem filtrar por ID permitido
          for (const roleta of roletas) {
            if (!roleta) continue;
            
            const roletaId = roleta._id || roleta.id;
            const roletaNome = roleta.nome || roleta.name || `Roleta ${roletaId?.substring(0, 8)}`;
            
            // Verificar se temos um ID válido
            if (!roletaId) {
              console.warn('[SocketService] Roleta sem ID válido para registrar:', roleta);
              continue;
            }
            
            // Não verificar se o ID está na lista de permitidos - registrar todas as roletas
            // const stringId = String(roletaId);
            // if (!ROLETAS_PERMITIDAS.includes(stringId)) {
            //   continue;
            // }
            
            console.log(`[SocketService] Registrando para receber dados da roleta: ${roletaNome} (${roletaId})`);
            
            // Registrar para esta roleta
            this.subscribeToRouletteEndpoint(roletaId, roletaNome);
            
            // Também iniciar polling para esta roleta
            this.startAggressivePolling(roletaId, roletaNome);
          }
        } else {
          console.warn('[SocketService] Nenhuma roleta encontrada para registrar');
        }
      }).catch(error => {
        console.error('[SocketService] Erro ao buscar roletas para registrar:', error);
      });
    } catch (error) {
      console.error('[SocketService] Erro ao registrar todas as roletas:', error);
    }
  }

  /**
   * Adiciona um número ao histórico da roleta e mantém limitado a 1000 números
   * @param roletaId ID da roleta
   * @param numero Número a ser adicionado
   */
  public addNumberToHistory(roletaId: string, numero: number): void {
    // Verificar se o ID é válido
    if (!roletaId) return;
    
    // Garantir que temos uma entrada para esta roleta
    if (!this.rouletteHistory.has(roletaId)) {
      this.rouletteHistory.set(roletaId, []);
    }
    
    // Obter o histórico atual
    const history = this.rouletteHistory.get(roletaId)!;
    
    // Verificar se o número já está no início do histórico (evitar duplicatas)
    if (history.length > 0 && history[0] === numero) {
        return;
      }
      
    // Adicionar o número no início e manter o limite
    history.unshift(numero);
    if (history.length > this.historyLimit) {
      history.pop();
    }
  }

  /**
   * Obtém o histórico completo de uma roleta
   * @param roletaId ID da roleta
   * @returns Array com o histórico de números
   */
  public getRouletteHistory(roletaId: string): number[] {
    // Verificar se temos histórico para esta roleta
    if (!this.rouletteHistory.has(roletaId)) {
      return [];
    }
    
    // Retornar uma cópia do histórico para evitar modificações externas
    return [...this.rouletteHistory.get(roletaId)!];
  }

  /**
   * Atualiza o histórico completo de uma roleta
   * @param roletaId ID da roleta
   * @param numbers Array de números para definir como histórico
   */
  public setRouletteHistory(roletaId: string, numbers: number[]): void {
    // Garantir que não excedemos o limite
    const limitedNumbers = numbers.slice(0, this.historyLimit);
    this.rouletteHistory.set(roletaId, limitedNumbers);
  }

  /**
   * Solicita o histórico completo de uma roleta
   * @param roletaId ID da roleta
   * @returns Promise que resolve com os dados do histórico
   */
  requestRouletteHistory(roletaId: string): Promise<HistoryData> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected()) {
        console.error('Socket não conectado. Impossível solicitar histórico.');
        return reject(new Error('Socket não conectado'));
      }
      
      console.log(`Solicitando histórico para roleta: ${roletaId}`);
      
      // Configurar handler para resposta
      const onHistoryData = (data: HistoryData) => {
        if (data.roletaId === roletaId) {
          console.log(`Recebido histórico com ${data.numeros?.length || 0} registros para roleta ${roletaId}`);
          this.socket?.off('history_data', onHistoryData);
          this.socket?.off('history_error', onHistoryError);
          resolve(data);
        }
      };
      
      const onHistoryError = (error: any) => {
        console.error('Erro ao buscar histórico:', error);
        this.socket?.off('history_data', onHistoryData);
        this.socket?.off('history_error', onHistoryError);
        reject(error);
      };
      
      // Registrar handlers
      this.socket.on('history_data', onHistoryData);
      this.socket.on('history_error', onHistoryError);
      
      // Enviar solicitação
      this.socket.emit('request_history', { roletaId });
      
      // Timeout para evitar que a Promise fique pendente para sempre
      setTimeout(() => {
        this.socket?.off('history_data', onHistoryData);
        this.socket?.off('history_error', onHistoryError);
        reject(new Error('Timeout ao solicitar histórico'));
      }, 30000); // 30 segundos de timeout
    });
  }

  public async fetchAllRoulettesWithRealData(): Promise<any[]> {
    const roulettes = await this.fetchRealRoulettes();
    
    // Para cada roleta, buscar dados de números
    for (const roulette of roulettes) {
      try {
        // Usar um valor mais baixo para os cards principais
        const hasRealData = await this.fetchRouletteNumbersREST(roulette._id, 30);
        if (hasRealData) {
          console.log(`[SocketService] Dados reais obtidos para ${roulette.name || roulette._id}`);
        }
      } catch (error) {
        console.error(`[SocketService] Erro ao buscar dados para ${roulette.name || roulette._id}:`, error);
      }
    }
    
    return roulettes;
  }

  // Método para gerenciar o circuit breaker
  private handleCircuitBreaker(success: boolean, endpoint?: string): boolean {
    if (success) {
      // Resetar contador em caso de sucesso
      this.consecutiveFailures = 0;
      return true;
    } else {
      // Incrementar contador de falhas
      this.consecutiveFailures++;
      
      // Verificar se deve ativar o circuit breaker
      if (!this.circuitBreakerActive && this.consecutiveFailures >= this.failureThreshold) {
        console.warn(`[SocketService] Circuit breaker ativado após ${this.consecutiveFailures} falhas consecutivas. Pausando chamadas por ${this.resetTime/1000}s`);
        
        this.circuitBreakerActive = true;
        
        // Mostrar notificação para o usuário
        toast({
          title: "Servidor sobrecarregado",
          description: "Reduzindo frequência de chamadas para evitar sobrecarga",
          variant: "warning"
        });
        
        // Programar reset do circuit breaker
        if (this.circuitBreakerResetTimeout) {
          clearTimeout(this.circuitBreakerResetTimeout);
        }
        
        this.circuitBreakerResetTimeout = setTimeout(() => {
          console.log('[SocketService] Circuit breaker desativado, retomando operações normais');
          this.circuitBreakerActive = false;
          this.consecutiveFailures = 0;
          
          // Tentar reconectar e buscar dados essenciais
          this.fetchRealRoulettes().then(() => {
            console.log('[SocketService] Recarregando dados após reset do circuit breaker');
            this.requestRecentNumbers();
          });
          
        }, this.resetTime);
      }
      
      // Se o circuit breaker está ativo, bloquear a operação
      return !this.circuitBreakerActive;
    }
  }

  // Método para verificar se uma chamada deve prosseguir
  private shouldProceedWithRequest(endpoint?: string): boolean {
    if (this.circuitBreakerActive) {
      console.log(`[SocketService] Circuit breaker ativo, bloqueando chamada${endpoint ? ` para ${endpoint}` : ''}`);
      return false;
    }
    return true;
  }
}

export default SocketService; 