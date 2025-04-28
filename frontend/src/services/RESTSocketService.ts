import { getRequiredEnvVar, isProduction } from '../config/env';
import globalRouletteDataService from '@/services/GlobalRouletteDataService';
import Cookies from 'js-cookie';
import EventEmitter from 'events';
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
 * Serviço que gerencia o acesso a dados de roletas via API REST
 * Substitui o antigo serviço de WebSocket, mantendo a mesma interface
 */
class RESTSocketService {
  private static instance: RESTSocketService;
  private listeners: Map<string, Set<RouletteEventCallback>> = new Map();
  private rouletteHistory: Map<string, number[]> = new Map();
  private lastProcessedData: Map<string, string> = new Map();
  private lastReceivedData: Map<string, { timestamp: number, data: any }> = new Map();
  private pollingTimer: NodeJSTimeout | null = null;
  private secondEndpointPollingTimer: NodeJSTimeout | null = null;
  private centralServicePollingTimer: NodeJSTimeout | null = null;
  private connectionActive: boolean = false;
  private historyLimit: number = 500;
  private defaultPollingInterval: number = isProduction ? 10000 : 5000; // 10 segundos em produção, 5 em desenvolvimento
  private pollingEndpoint: string = '/api/roulettes/limits';
  private centralServiceEndpoint: string = '/api/central-service/roulettes';
  private centralServicePollingInterval: number = 60000; // 1 minuto = 60000 ms
  private pollingIntervals: Map<string, number> = new Map();
  private _isLoadingHistoricalData: boolean = false;
  private rouletteDataCache: Map<string, {data: any, timestamp: number}> = new Map();
  
  // Propriedade para simular estado de conexão
  public client?: any;
  
  // Propriedade para armazenar o último timer ID criado
  private _lastCreatedTimerId: NodeJSTimeout | null = null;
  
  // Serviço de controle de duplicação
  private rouletteService: RouletteService;
  
  // Propriedade para controlar eventos emitidos
  private emitter: EventEmitter;
  
  // Indica se estamos em modo centralizado
  private isCentralizedMode: boolean = true;
  
  // Habilitar depuração em desenvolvimento
  private debug: boolean = !isProduction;
  
  // Para rastrear origens dos dados processados
  private processedDataSources: Set<string> = new Set();
  
  private constructor() {
    console.log('[RESTSocketService] Inicializando serviço REST API com polling');
    
    // Inicializar o serviço anti-duplicação
    this.rouletteService = RouletteService.getInstance();
    
    // Configurar listener de debug do RouletteService
    if (this.debug) {
      this.rouletteService.onDebug((message: string) => {
        console.debug(`[RESTSocketService] ${message}`);
      });
    }
    
    // Inicializar emitter de eventos
    this.emitter = new EventEmitter();
    
    // Adicionar listener global para logging de todos os eventos
    this.subscribe('*', (event: any) => {
      if (event.type === 'new_number') {
        if (this.debug) {
          console.log(`[RESTSocketService][GLOBAL] Evento recebido para roleta: ${event.roleta_nome}, número: ${event.numero}`);
        }
      } else if (event.type === 'strategy_update') {
        if (this.debug) {
          console.log(`[RESTSocketService][GLOBAL] Atualização de estratégia para roleta: ${event.roleta_nome}, estado: ${event.estado}`);
        }
      }
    });

    // Iniciar polling diretamente
    this.startPolling();
    this.startSecondEndpointPolling();
    
    // Adicionar event listener para quando a janela ficar visível novamente
    window.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Iniciar como conectado
    this.connectionActive = true;
    
    // Carregar dados iniciais do localStorage se existirem
    this.loadCachedData();
    
    // Adicionar verificação de saúde do timer a cada 30 segundos
    setInterval(() => {
      this.checkTimerHealth();
    }, 30000);
  }

  // Manipular alterações de visibilidade da página
  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      console.log('[RESTSocketService] Página voltou a ficar visível, solicitando atualização via serviço global');
      globalRouletteDataService.forceUpdate();
    }
  }

  // Iniciar polling da API REST
  private startPolling() {
    // Limpar qualquer timer existente
    if (this.pollingTimer) {
      window.clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    this.connectionActive = true;
    
    console.log('[RESTSocketService] Não criando timer próprio - usando serviço global centralizado');
    
    // Registrar para receber atualizações do serviço global
    try {
      globalRouletteDataService.subscribe('RESTSocketService-main', () => {
        if (this.debug) {
          console.log('[RESTSocketService] Recebendo atualização do serviço global centralizado');
        }
        // Reprocessar dados do serviço global quando houver atualização
        try {
          const data = globalRouletteDataService.getAllRoulettes();
          if (data && Array.isArray(data)) {
            this.processDataAsEvents(data, 'global-service');
          } else {
            console.warn('[RESTSocketService] Dados inválidos recebidos do serviço global:', data);
          }
        } catch (error) {
          console.error('[RESTSocketService] Erro ao processar dados do serviço global:', error);
        }
      });
    } catch (error) {
      console.error('[RESTSocketService] Erro ao se inscrever no serviço global:', error);
    }
    
    // Processar dados iniciais se disponíveis
    try {
      const initialData = globalRouletteDataService.getAllRoulettes();
      if (initialData && Array.isArray(initialData) && initialData.length > 0) {
        console.log('[RESTSocketService] Processando dados iniciais do serviço global');
        this.processDataAsEvents(initialData, 'initial-load');
      } else {
        console.log('[RESTSocketService] Não há dados iniciais para carregar do serviço global');
      }
    } catch (error) {
      console.error('[RESTSocketService] Erro ao carregar dados iniciais do serviço global:', error);
    }
    
    // Criar um timer de verificação para garantir que o serviço global está funcionando
    try {
      this.pollingTimer = window.setInterval(() => {
        // Verificação simples para manter o timer ativo
        this.lastReceivedData.set('heartbeat', { timestamp: Date.now(), data: null });
      }, this.defaultPollingInterval) as unknown as NodeJSTimeout;
    } catch (error) {
      console.error('[RESTSocketService] Erro ao configurar timer de verificação:', error);
    }
  }
  
  // Buscar dados da API REST
  private async fetchDataFromREST() {
    try {
      const startTime = Date.now();
      if (this.debug) {
        console.log('[RESTSocketService] Obtendo dados através do serviço global centralizado');
      }
      
      // Usar o serviço global centralizado em vez de fazer chamada direta à API
      const data = await globalRouletteDataService.fetchRouletteData();
      
      if (!data || !Array.isArray(data)) {
        throw new Error('Dados recebidos do serviço global não são válidos');
      }
      
      const endTime = Date.now();
      if (this.debug) {
        console.log(`[RESTSocketService] Dados obtidos do serviço global em ${endTime - startTime}ms`);
      }
      
      // Processar os dados como eventos
      this.processDataAsEvents(data, 'rest-api');
      
      return true;
    } catch (error) {
      console.error('[RESTSocketService] Erro ao obter dados do serviço global:', error);
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
          this.processDataAsEvents(parsed.data, 'cache');
        }
      }
    } catch (error) {
      console.warn('[RESTSocketService] Erro ao carregar dados do cache:', error);
    }
  }
  
  // Processar dados da API como eventos de WebSocket
  private processDataAsEvents(data: any[], source: string = 'unknown') {
    if (!Array.isArray(data)) {
      console.warn('[RESTSocketService] Dados recebidos não são um array:', data);
      return;
    }
    
    // Verificar se há dados para processar
    if (data.length === 0) {
      console.log('[RESTSocketService] Array de dados vazio recebido da fonte:', source);
      // Ainda registramos a chamada como bem-sucedida para evitar reconexões desnecessárias
      this.lastReceivedData.set(source, { 
        timestamp: Date.now(), 
        data: { count: 0, isEmpty: true } 
      });
      return;
    }
    
    if (this.debug) {
      console.log(`[RESTSocketService] Processando ${data.length} roletas da fonte: ${source}`);
    }
    
    // Registrar esta chamada como bem-sucedida
    const now = Date.now();
    this.lastReceivedData.set(source, { timestamp: now, data: { count: data.length } });
    
    // Adicionar fonte aos processados
    this.processedDataSources.add(source);
    
    // Usar o RouletteService para filtrar dados duplicados
    const uniqueItems = this.rouletteService.processRouletteData(data, source);
    
    if (this.debug) {
      console.log(`[RESTSocketService] Após filtragem anti-duplicação: ${uniqueItems.length} roletas únicas de ${data.length} originais`);
    }
    
    // Se não há itens únicos para processar, não continuar
    if (uniqueItems.length === 0) {
      return;
    }
    
    // Atualizar o cache apenas se não for uma fonte de cache
    if (source !== 'cache') {
      try {
        localStorage.setItem('roulettes_data_cache', JSON.stringify({
          data: uniqueItems,
          timestamp: now
        }));
      } catch (error) {
        console.warn('[RESTSocketService] Erro ao salvar cache:', error);
      }
    }
    
    // Para cada roleta no array
    for (const roleta of uniqueItems) {
      // Verificar se o objeto roleta é válido
      if (!roleta || !roleta.id) {
        console.warn('[RESTSocketService] Objeto de roleta inválido:', roleta);
        continue;
      }
      
      const roletaId = roleta.id;
      const roletaNome = roleta.nome || roleta.id;
      
      // Verificar se há novos números para a roleta
      if (roleta.numero && Array.isArray(roleta.numero) && roleta.numero.length > 0) {
        // Obter histórico atual ou inicializar array vazio
        const currentHistory = this.rouletteHistory.get(roletaId) || [];
        
        // Extrair todos os novos números (max 20 dos mais recentes)
        const newNumbers = roleta.numero
          .slice(0, 20)
          .filter((n: any) => n && (typeof n.numero === 'number' || typeof n === 'number'))
          .map((n: any) => typeof n.numero === 'number' ? n.numero : n);
        
        // Verificar se há novos números após filtragem
        if (newNumbers.length === 0) {
          continue;
        }
        
        // Verificar se há novos números comparando com o histórico
        if (newNumbers.length > 0) {
          const lastProcessedJson = this.lastProcessedData.get(roletaId);
          const lastProcessed = lastProcessedJson ? JSON.parse(lastProcessedJson) : null;
          
          // Verificar se é realmente um novo número (não processado anteriormente)
          const ultimoNumero = newNumbers[0];
          const isNewNumber = !lastProcessed || 
                              lastProcessed.numero !== ultimoNumero || 
                              (lastProcessed.timestamp && now - new Date(lastProcessed.timestamp).getTime() > 60000);
          
          if (isNewNumber) {
            // Novo número detectado - atualizar histórico
            // Mesclar sem duplicatas
            const mergedHistory = this.mergeNumbersWithoutDuplicates(newNumbers, currentHistory);
            this.rouletteHistory.set(roletaId, mergedHistory);
            
            // Registrar processamento deste número
            this.lastProcessedData.set(roletaId, JSON.stringify({
              numero: ultimoNumero,
              timestamp: new Date().toISOString()
            }));
            
            if (this.debug) {
              console.log(`[RESTSocketService] Novos números detectados para roleta ${roletaNome}: ${ultimoNumero} (fonte: ${source})`);
            }
            
            // Emitir evento de novo número
            const event = {
              type: 'new_number',
              numero: ultimoNumero,
              cor: this.determinarCorNumero(ultimoNumero),
              roleta_id: roletaId,
              roleta_nome: roletaNome,
              timestamp: new Date(),
              source: source
            };
            
            this.notifyListeners(event);
            
            // Atualizar cache desta roleta específica
            this.rouletteDataCache.set(roletaId, {
              data: roleta,
              timestamp: now
            });
          }
        }
        
        // Verificar se há uma estratégia ativa
        if (roleta.estrategias && Array.isArray(roleta.estrategias) && roleta.estrategias.length > 0) {
          const estrategia = roleta.estrategias[0];
          
          if (estrategia && estrategia.id) {
            // Emitir evento de atualização de estratégia
            const estrategiaEvent = {
              type: 'strategy_update',
              roleta_id: roletaId,
              roleta_nome: roletaNome,
              estrategia_id: estrategia.id,
              estado: estrategia.estado || 'desconhecido',
              timestamp: new Date(),
              detalhes: estrategia,
              source: source
            };
            
            // Notificar ouvintes sobre a atualização de estratégia
            this.notifyListeners(estrategiaEvent);
          }
        }
      }
    }
  }
  
  // Determinar cor de um número da roleta
  private determinarCorNumero(numero: number): string {
    if (numero === 0) return 'verde';
    
    const numeros_vermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    
    return numeros_vermelhos.includes(numero) ? 'vermelho' : 'preto';
  }

  // Método para obtenção da instância singleton
  public static getInstance(): RESTSocketService {
    if (!RESTSocketService.instance) {
      RESTSocketService.instance = new RESTSocketService();
    }
    
    return RESTSocketService.instance;
  }
  
  // Obter base URL da API
  private getApiBaseUrl(): string {
    try {
      return getRequiredEnvVar('NEXT_PUBLIC_API_URL') || '';
    } catch (error) {
      // Fallback para URL relativa se não encontrar no env
      console.warn('[RESTSocketService] Variável de ambiente API URL não encontrada, usando relativa');
      return '';
    }
  }
  
  // Adicionar um listener para eventos de roleta
  public subscribe(roletaNome: string, callback: RouletteEventCallback): void {
    if (!this.listeners.has(roletaNome)) {
      this.listeners.set(roletaNome, new Set());
    }
    
    const callbacks = this.listeners.get(roletaNome);
    if (callbacks) {
      callbacks.add(callback);
    }
  }
  
  // Remover um listener para eventos de roleta
  public unsubscribe(roletaNome: string, callback: RouletteEventCallback): void {
    const callbacks = this.listeners.get(roletaNome);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }
  
  // Notificar todos os listeners relevantes sobre um evento
  private notifyListeners(event: any): void {
    // Listener específico para a roleta
    const roletaCallbacks = this.listeners.get(event.roleta_nome);
    if (roletaCallbacks) {
      roletaCallbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error(`[RESTSocketService] Erro ao executar callback para ${event.roleta_nome}:`, error);
        }
      });
    }
    
    // Listener global (*)
    const globalCallbacks = this.listeners.get('*');
    if (globalCallbacks) {
      globalCallbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('[RESTSocketService] Erro ao executar callback global:', error);
        }
      });
    }
  }
  
  // Método para emitir informações sobre dados processados
  public getDataSourceInfo(): {sources: string[], activeTimers: number} {
    return {
      sources: Array.from(this.processedDataSources),
      activeTimers: [this.pollingTimer, this.secondEndpointPollingTimer, this.centralServicePollingTimer]
                     .filter(timer => timer !== null).length
    };
  }

  // Métodos públicos que mantém compatibilidade com a versão WebSocket

  public disconnect(): void {
    console.log('[RESTSocketService] Desconectando serviço de polling');
    
    if (this.pollingTimer) {
      console.log('[RESTSocketService] Limpando timer:', this.pollingTimer);
      try {
        window.clearInterval(this.pollingTimer);
      } catch (e) {
        console.error('[RESTSocketService] Erro ao limpar timer:', e);
      }
      this.pollingTimer = null;
    }
    
    this.connectionActive = false;
    console.log('[RESTSocketService] Serviço de polling desconectado');
  }

  public reconnect(): void {
    console.log('[RESTSocketService] Reconectando serviço de polling');
    
    // Limpar intervalo existente para garantir
    if (this.pollingTimer) {
      console.log('[RESTSocketService] Limpando timer existente antes de reconectar');
      try {
        window.clearInterval(this.pollingTimer);
      } catch (e) {
        console.error('[RESTSocketService] Erro ao limpar timer existente:', e);
      }
      this.pollingTimer = null;
    }
    
    // Reiniciar polling com certeza de intervalo fixo
    setTimeout(() => {
      this.startPolling();
      
      // Verificar se o timer foi realmente criado
      if (!this.pollingTimer) {
        console.warn('[RESTSocketService] Timer não foi criado na reconexão. Criando manualmente...');
        this.pollingTimer = window.setInterval(() => {
          this.lastReceivedData.set('heartbeat', { timestamp: Date.now(), data: null });
        }, this.defaultPollingInterval) as unknown as NodeJSTimeout;
      }
    }, 100); // Pequeno atraso para garantir que o timer anterior foi limpo
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
    try {
      console.log('[RESTSocketService] Forçando atualização de dados via serviço global');
      await globalRouletteDataService.forceUpdate();
      
      // Processar os dados atualizados
      try {
        const data = globalRouletteDataService.getAllRoulettes();
        if (data && Array.isArray(data)) {
          this.processDataAsEvents(data, 'request-recent');
          return true;
        } else {
          console.warn('[RESTSocketService] Dados inválidos recebidos do forceUpdate:', data);
          return false;
        }
      } catch (innerError) {
        console.error('[RESTSocketService] Erro ao processar dados após forceUpdate:', innerError);
        return false;
      }
    } catch (error) {
      console.error('[RESTSocketService] Erro ao atualizar dados:', error);
      return false;
    }
  }

  public getRouletteHistory(roletaId: string): number[] {
    return this.rouletteHistory.get(roletaId) || [];
  }

  public setRouletteHistory(roletaId: string, numbers: number[]): void {
    this.rouletteHistory.set(roletaId, numbers.slice(0, this.historyLimit));
  }

  public async requestRouletteNumbers(roletaId: string): Promise<boolean> {
    if (!roletaId) {
      console.error('[RESTSocketService] ID de roleta inválido fornecido para requestRouletteNumbers');
      return false;
    }
    
    try {
      console.log(`[RESTSocketService] Buscando números para roleta ${roletaId} via serviço global`);
      await globalRouletteDataService.forceUpdate();
      
      // Processar os dados atualizados
      try {
        const data = globalRouletteDataService.getAllRoulettes();
        if (!data || !Array.isArray(data)) {
          console.warn('[RESTSocketService] Dados inválidos recebidos do serviço global após forceUpdate');
          return false;
        }
        
        const roleta = data.find(r => r && r.id === roletaId);
        if (!roleta) {
          console.warn(`[RESTSocketService] Roleta com ID ${roletaId} não encontrada nos dados atualizados`);
          return false;
        }
        
        if (!roleta.numero || !Array.isArray(roleta.numero)) {
          console.warn(`[RESTSocketService] Roleta ${roletaId} não tem números válidos`);
          return false;
        }
        
        // Extrair apenas os números
        const numeros = roleta.numero
          .filter(n => n && (n.numero !== undefined || n.number !== undefined))
          .map(n => n.numero || n.number || 0);
        
        if (numeros.length === 0) {
          console.warn(`[RESTSocketService] Nenhum número válido encontrado para roleta ${roletaId}`);
          return false;
        }
        
        // Atualizar o histórico
        this.setRouletteHistory(roletaId, numeros);
        console.log(`[RESTSocketService] Atualizados ${numeros.length} números para roleta ${roletaId}`);
        
        return true;
      } catch (innerError) {
        console.error(`[RESTSocketService] Erro ao processar dados da roleta ${roletaId}:`, innerError);
        return false;
      }
    } catch (error) {
      console.error(`[RESTSocketService] Erro ao buscar números para roleta ${roletaId}:`, error);
      return false;
    }
  }

  public isConnected(): boolean {
    return this.connectionActive;
  }

  public async loadHistoricalRouletteNumbers(): Promise<void> {
    console.log('[RESTSocketService] Carregando dados históricos de todas as roletas');
    
    try {
      this._isLoadingHistoricalData = true;
      
      // Buscar dados detalhados pelo serviço global
      const data = await globalRouletteDataService.fetchDetailedRouletteData();
      
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

  public destroy(): void {
    console.log('[RESTSocketService] Destruindo serviço');
    
    // Limpar intervalos
    if (this.pollingTimer) {
      window.clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    // Remover event listeners
    window.removeEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Limpar todos os listeners
    this.listeners.clear();
    
    // Desativar conexão
    this.connectionActive = false;
  }

  // Verificar a saúde do timer de polling e corrigir se necessário
  private checkTimerHealth(): void {
    console.log('[RESTSocketService] Verificando saúde do timer de polling');
    
    if (this.connectionActive && !this.pollingTimer) {
      console.warn('[RESTSocketService] Timer ativo mas variável pollingTimer nula. Corrigindo...');
      
      // Primeiro limpar qualquer timer que possa existir mas não está referenciado
      try {
        if (this._lastCreatedTimerId) {
          window.clearInterval(this._lastCreatedTimerId);
        }
      } catch (e) {}
      
      // Criar um novo timer
      this.pollingTimer = window.setInterval(() => {
        this.lastReceivedData.set('heartbeat', { timestamp: Date.now(), data: null });
      }, this.defaultPollingInterval) as unknown as NodeJSTimeout;
      
      // Não chamar reconnect() para evitar loop
      return;
    }
    
    // Verificar se faz muito tempo desde a última chamada bem-sucedida
    const now = Date.now();
    const lastReceivedData = Array.from(this.lastReceivedData.values());
    if (lastReceivedData.length > 0) {
      const mostRecent = Math.max(...lastReceivedData.map(data => data.timestamp));
      const timeSinceLastData = now - mostRecent;
      
      if (timeSinceLastData > 20000) { // Mais de 20 segundos sem dados
        console.warn(`[RESTSocketService] Possível timer travado. Último dado recebido há ${timeSinceLastData}ms. Reiniciando...`);
        this.reconnect();
      }
    }
  }

  // Método para iniciar o polling do segundo endpoint (/api/ROULETTES sem parâmetro)
  private startSecondEndpointPolling() {
    // Verificar se o segundo endpoint está habilitado
    if (!this.secondEndpointPollingTimer) {
      console.log('[RESTSocketService] Não inicializando segundo endpoint de polling - usando apenas dados do serviço global');
      
      // Assinar atualizações do serviço global centralizado em vez de fazer polling diretamente
      try {
        globalRouletteDataService.subscribe('RESTSocketService-secondary', () => {
          if (this.debug) {
            console.log('[RESTSocketService] Recebendo dados secundários do serviço global centralizado');
          }
          
          try {
            // Apenas notificar sobre a atualização, sem processar novamente os dados
            // Isso evita a duplicação de eventos, já que os dados já foram processados pelo serviço principal
            const roulettes = globalRouletteDataService.getAllRoulettes();
            this.emitter.emit('data_update', {
              source: 'global-service-secondary',
              count: roulettes && Array.isArray(roulettes) ? roulettes.length : 0,
              timestamp: new Date()
            });
            
            // Não chamamos this.processDataAsEvents aqui para evitar duplicação
          } catch (error) {
            console.error('[RESTSocketService] Erro ao processar dados secundários:', error);
          }
        });
      } catch (error) {
        console.error('[RESTSocketService] Erro ao registrar no serviço global secundário:', error);
      }
    }
  }
  
  // Função utilitária para determinar a cor de um número de roleta
  private determinarCorNumero(numero: number): string {
    if (numero === 0) return 'verde';
    
    // Lista de números vermelhos em roletas européias padrão
    const numerosVermelhos = [
      1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
    ];
    
    return numerosVermelhos.includes(numero) ? 'vermelho' : 'preto';
  }
  
  // Função para mesclar arrays de números sem duplicatas
  private mergeNumbersWithoutDuplicates(newNumbers: number[], existingNumbers: number[]): number[] {
    // Criar um conjunto (Set) para eliminar duplicatas
    const uniqueNumbersSet = new Set([...newNumbers, ...existingNumbers]);
    
    // Converter de volta para array e limitar ao tamanho máximo
    return Array.from(uniqueNumbersSet).slice(0, this.historyLimit);
  }
  
  // Verificar "saúde" do timer para garantir que o polling ainda está funcionando
  private checkTimerHealth() {
    // Se estamos conectados mas o último dado é muito antigo
    const now = Date.now();
    let needsReconnect = false;
    
    // Verificar se há alguma fonte de dados ativa
    for (const [source, data] of this.lastReceivedData.entries()) {
      const age = now - data.timestamp;
      
      // Se o último dado tem mais de 5 minutos (300000ms)
      if (age > 300000) {
        console.warn(`[RESTSocketService] Fonte de dados ${source} está inativa há ${Math.floor(age/1000)}s`);
        needsReconnect = true;
        this.lastReceivedData.delete(source);
      }
    }
    
    // Se todas as fontes estão inativas ou não há dados, reconectar
    if (needsReconnect || this.lastReceivedData.size === 0) {
      console.warn('[RESTSocketService] Timer de dados parece inativo. Forçando atualização...');
      globalRouletteDataService.forceUpdate();
    } else {
      if (this.debug) {
        console.log('[RESTSocketService] Timer de verificação ok, dados sendo recebidos normalmente');
      }
    }
  }
  
  // Notificar todos os listeners inscritos para um evento
  private notifyListeners(event: any) {
    // Obter ouvintes para este tipo de roleta específica
    const roletaId = event.roleta_id;
    
    if (this.listeners.has(roletaId)) {
      const callbacks = this.listeners.get(roletaId)!;
      callbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('[RESTSocketService] Erro ao notificar listener:', error);
        }
      });
    }
    
    // Notificar ouvintes globais (asterisco)
    if (this.listeners.has('*')) {
      const globalCallbacks = this.listeners.get('*')!;
      globalCallbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('[RESTSocketService] Erro ao notificar listener global:', error);
        }
      });
    }
    
    // Emitir via EventEmitter para compatibilidade
    this.emitter.emit(event.type, event);
  }
  
  // Retorna a instância singleton
  public static getInstance(config?: RESTSocketServiceConfig): RESTSocketService {
    if (!RESTSocketService.instance) {
      RESTSocketService.instance = new RESTSocketService();
      
      // Aplicar configurações se fornecidas
      if (config) {
        if (config.pollingInterval) {
          RESTSocketService.instance.defaultPollingInterval = config.pollingInterval;
        }
        
        if (config.httpEndpoint) {
          RESTSocketService.instance.pollingEndpoint = config.httpEndpoint;
        }
        
        if (config.centralServiceEndpoint) {
          RESTSocketService.instance.centralServiceEndpoint = config.centralServiceEndpoint;
        }
      }
    }
    
    return RESTSocketService.instance;
  }

  // Inscrever uma função callback para receber eventos de uma roleta específica
  public subscribe(roletaId: string, callback: RouletteEventCallback): () => void {
    // Garantir que temos um conjunto para este ID de roleta
    if (!this.listeners.has(roletaId)) {
      this.listeners.set(roletaId, new Set());
    }
    
    // Adicionar o callback ao conjunto
    this.listeners.get(roletaId)!.add(callback);
    
    // Retornar função para cancelar a inscrição
    return () => {
      if (this.listeners.has(roletaId)) {
        this.listeners.get(roletaId)!.delete(callback);
      }
    };
  }
  
  // Cancelar a inscrição de todos os callbacks para uma roleta
  public unsubscribe(roletaId: string): void {
    this.listeners.delete(roletaId);
  }
  
  // Obter todos os IDs de roletas atualmente monitoradas
  public getRoulettesIds(): string[] {
    return Array.from(this.rouletteHistory.keys());
  }
  
  // Obter histórico de números para uma roleta específica
  public getRouletteHistory(roletaId: string): number[] {
    return this.rouletteHistory.get(roletaId) || [];
  }
}

export default RESTSocketService; 