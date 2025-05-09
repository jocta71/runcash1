/**
 * Serviço Unificado de Dados - Versão Simplificada
 * Implementa conexão direta com SSE sem camadas redundantes
 */

// Tipos para eventos de roleta
export interface RouletteNumberEvent {
  type: 'new_number';
  roleta_id: string;
  roleta_nome: string;
  numero: number;
  timestamp: string;
  estado_estrategia?: string;
  sugestao_display?: string;
  terminais_gatilho?: number[];
}

// Tipo para callbacks de eventos
export type EventCallback = (event: any) => void;

/**
 * Serviço que gerencia acesso direto a dados em tempo real via SSE
 * Substitui os serviços redundantes (SocketService, RESTSocketService)
 */
class UnifiedDataService {
  private static instance: UnifiedDataService;
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private isConnected: boolean = false;
  private reconnectTimeout: number | null = null;
  private backupPollingInterval: number | null = null;
  private rouletteHistoryCache: Map<string, number[]> = new Map();
  private lastEventTimestamp: number = 0;
  private connectionAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000;

  /**
   * Construtor privado para garantir singleton
   */
  private constructor() {
    console.log('[UnifiedDataService] Inicializando serviço unificado de dados');
    this.setupConnectionHandlers();
    this.connect();
  }

  /**
   * Obtém a instância única do serviço
   */
  public static getInstance(): UnifiedDataService {
    if (!UnifiedDataService.instance) {
      UnifiedDataService.instance = new UnifiedDataService();
    }
    return UnifiedDataService.instance;
  }

  /**
   * Configura handlers para gerenciar estado de conexão
   */
  private setupConnectionHandlers(): void {
    // Monitorar visibilidade da página
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (!this.isConnected) {
          console.log('[UnifiedDataService] Página visível, reconectando...');
          this.connect();
        }
      }
    });

    // Monitorar conectividade de rede
    window.addEventListener('online', () => {
      console.log('[UnifiedDataService] Rede online, reconectando...');
      this.connect();
    });

    window.addEventListener('offline', () => {
      console.log('[UnifiedDataService] Rede offline, desconectando...');
      this.disconnect();
    });
  }

  /**
   * Conecta à API SSE
   */
  public connect(): void {
    if (this.isConnected || this.eventSource) {
      return;
    }

    if (this.connectionAttempts >= this.maxReconnectAttempts) {
      console.warn('[UnifiedDataService] Máximo de tentativas de conexão atingido, iniciando polling...');
      this.startBackupPolling();
      return;
    }

    try {
      console.log('[UnifiedDataService] Conectando à API SSE...');
      
      const url = '/api/events';
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        console.log('[UnifiedDataService] Conexão SSE estabelecida com sucesso');
        this.isConnected = true;
        this.connectionAttempts = 0;
        this.lastEventTimestamp = Date.now();
        this.stopBackupPolling();
      };

      this.eventSource.onmessage = (event) => {
        this.lastEventTimestamp = Date.now();
        try {
          const data = JSON.parse(event.data);
          this.processEvent(data);
        } catch (error) {
          console.error('[UnifiedDataService] Erro ao processar evento:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('[UnifiedDataService] Erro na conexão SSE:', error);
        this.isConnected = false;
        this.disconnect();
        
        // Tentar reconectar após delay
        this.connectionAttempts++;
        const delay = this.connectionAttempts * this.reconnectDelay;
        
        console.log(`[UnifiedDataService] Tentativa ${this.connectionAttempts}, reconectando em ${delay}ms...`);
        this.reconnectTimeout = window.setTimeout(() => this.connect(), delay);
      };
    } catch (error) {
      console.error('[UnifiedDataService] Erro ao iniciar conexão SSE:', error);
      this.startBackupPolling();
    }
  }

  /**
   * Desconecta da API SSE
   */
  public disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.isConnected = false;
  }

  /**
   * Inicia polling como fallback quando SSE falha
   */
  private startBackupPolling(): void {
    if (this.backupPollingInterval) {
      return;
    }

    console.log('[UnifiedDataService] Iniciando polling de backup');
    this.backupPollingInterval = window.setInterval(() => {
      this.performPolling();
    }, 5000);

    // Fazer uma chamada imediata
    this.performPolling();
  }

  /**
   * Para o polling de backup
   */
  private stopBackupPolling(): void {
    if (this.backupPollingInterval) {
      clearInterval(this.backupPollingInterval);
      this.backupPollingInterval = null;
    }
  }

  /**
   * Executa polling para obter dados recentes
   */
  private async performPolling(): Promise<void> {
    try {
      const response = await fetch('/api/roulettes/limits');
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        data.forEach(roulette => {
          // Criar evento para cada roleta
          if (roulette.numbers && Array.isArray(roulette.numbers) && roulette.numbers.length > 0) {
            const event: RouletteNumberEvent = {
              type: 'new_number',
              roleta_id: roulette.id,
              roleta_nome: roulette.nome || roulette.name || `Roleta ${roulette.id}`,
              numero: typeof roulette.numbers[0] === 'object' ? 
                     roulette.numbers[0].number || roulette.numbers[0].numero : 
                     roulette.numbers[0],
              timestamp: new Date().toISOString()
            };
            
            this.processEvent(event);
          }
        });
      }
    } catch (error) {
      console.error('[UnifiedDataService] Erro no polling:', error);
    }
  }

  /**
   * Processa um evento recebido da API
   */
  private processEvent(event: any): void {
    // Garantir que o evento tenha um tipo
    if (!event || !event.type) {
      if (event && event.roleta_id && (event.numero !== undefined || event.number !== undefined)) {
        // Transformar em tipo 'new_number' se tiver dados suficientes
        event = {
          type: 'new_number',
          roleta_id: event.roleta_id,
          roleta_nome: event.roleta_nome || event.nome || `Roleta ${event.roleta_id}`,
          numero: event.numero !== undefined ? event.numero : event.number,
          timestamp: event.timestamp || new Date().toISOString()
        };
      } else {
        console.warn('[UnifiedDataService] Evento sem tipo ignorado:', event);
        return;
      }
    }

    console.log(`[UnifiedDataService] Processando evento ${event.type} para roleta ${event.roleta_nome || 'desconhecida'}`);
    
    // Atualizar cache de histórico se for novo número
    if (event.type === 'new_number' && event.roleta_id) {
      this.updateRouletteHistory(event.roleta_id, event.numero);
    }

    // Notificar listeners específicos da roleta
    const roletaId = event.roleta_id;
    const roletaNome = event.roleta_nome;
    
    if (roletaId && this.listeners.has(roletaId)) {
      this.notifyListeners(roletaId, event);
    }
    
    if (roletaNome && this.listeners.has(roletaNome)) {
      this.notifyListeners(roletaNome, event);
    }
    
    // Notificar listeners do tipo de evento
    if (event.type && this.listeners.has(event.type)) {
      this.notifyListeners(event.type, event);
    }
    
    // Notificar listeners globais
    if (this.listeners.has('*')) {
      this.notifyListeners('*', event);
    }
  }

  /**
   * Notifica os ouvintes registrados para uma chave específica
   */
  private notifyListeners(key: string, event: any): void {
    const listeners = this.listeners.get(key);
    if (!listeners) return;
    
    listeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error(`[UnifiedDataService] Erro ao executar callback para ${key}:`, error);
      }
    });
  }

  /**
   * Registra um callback para receber eventos
   */
  public subscribe(key: string, callback: EventCallback): void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    
    const listeners = this.listeners.get(key);
    listeners?.add(callback);
    
    console.log(`[UnifiedDataService] Registrado listener para ${key}, total: ${listeners?.size}`);
    
    // Garantir que esteja conectado
    if (!this.isConnected) {
      this.connect();
    }
  }

  /**
   * Remove um callback registrado
   */
  public unsubscribe(key: string, callback: EventCallback): void {
    const listeners = this.listeners.get(key);
    if (listeners) {
      listeners.delete(callback);
      console.log(`[UnifiedDataService] Listener removido para ${key}, restantes: ${listeners.size}`);
      
      if (listeners.size === 0) {
        this.listeners.delete(key);
      }
    }
  }

  /**
   * Verifica se o serviço está conectado
   */
  public isSocketConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Obtém o status da conexão
   */
  public getConnectionStatus(): any {
    return {
      isConnected: this.isConnected,
      lastEventTime: this.lastEventTimestamp ? new Date(this.lastEventTimestamp).toISOString() : null,
      connectionType: this.isConnected ? 'SSE' : (this.backupPollingInterval ? 'POLLING' : 'DISCONNECTED'),
      reconnectAttempts: this.connectionAttempts
    };
  }

  /**
   * Atualiza o histórico de números de uma roleta
   */
  private updateRouletteHistory(roletaId: string, numero: number): void {
    if (!roletaId || numero === undefined) return;
    
    // Obter histórico existente ou criar novo array
    const history = this.rouletteHistoryCache.get(roletaId) || [];
    
    // Adicionar no início (mais recente primeiro)
    history.unshift(numero);
    
    // Limitar o tamanho (manter 50 últimos números)
    if (history.length > 50) {
      history.length = 50;
    }
    
    // Atualizar cache
    this.rouletteHistoryCache.set(roletaId, history);
  }

  /**
   * Obtém o histórico de números de uma roleta
   */
  public getRouletteHistory(roletaId: string): number[] {
    return this.rouletteHistoryCache.get(roletaId) || [];
  }

  /**
   * Define o histórico de números de uma roleta
   */
  public setRouletteHistory(roletaId: string, numbers: number[]): void {
    if (!roletaId || !Array.isArray(numbers)) return;
    this.rouletteHistoryCache.set(roletaId, [...numbers]);
  }

  /**
   * Carrega histórico de números para todas as roletas
   */
  public async loadHistoricalRouletteNumbers(): Promise<void> {
    try {
      console.log('[UnifiedDataService] Carregando histórico de números para todas as roletas');
      
      const response = await fetch('/api/historical/all-roulettes');
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      if (Array.isArray(data)) {
        data.forEach(roulette => {
          if (roulette && roulette.id && Array.isArray(roulette.numbers)) {
            // Extrair apenas os números
            const numbers = roulette.numbers.map((n: any) => 
              typeof n === 'number' ? n : (n.number || n.numero)
            ).filter(Boolean);
            
            // Armazenar no cache
            if (numbers.length > 0) {
              this.setRouletteHistory(roulette.id, numbers);
            }
          }
        });
        
        console.log(`[UnifiedDataService] Carregados dados históricos de ${data.length || 0} roletas`);
      }
    } catch (error) {
      console.error('[UnifiedDataService] Erro ao carregar histórico de números:', error);
    }
  }

  /**
   * Solicita números de uma roleta específica
   */
  public async requestRouletteNumbers(roletaId: string): Promise<boolean> {
    try {
      if (!roletaId) return false;
      
      const response = await fetch(`/api/roulettes/${roletaId}/numbers`);
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      if (data && Array.isArray(data.numbers)) {
        const numbers = data.numbers.map((n: any) => 
          typeof n === 'number' ? n : (n.number || n.numero)
        ).filter(Boolean);
        
        if (numbers.length > 0) {
          this.setRouletteHistory(roletaId, numbers);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error(`[UnifiedDataService] Erro ao buscar números para roleta ${roletaId}:`, error);
      return false;
    }
  }

  /**
   * Solicita dados recentes de todas as roletas
   */
  public async requestRecentNumbers(): Promise<boolean> {
    try {
      await this.performPolling();
      return true;
    } catch (error) {
      console.error('[UnifiedDataService] Erro ao solicitar números recentes:', error);
      return false;
    }
  }

  /**
   * Verifica a saúde do sistema
   */
  public checkHealth(): boolean {
    // Se estamos conectados via SSE ou polling está ativo, consideramos saudável
    const isHealthy = this.isConnected || (this.backupPollingInterval !== null);
    
    // Se último evento foi recebido há muito tempo, pode indicar problemas
    if (this.lastEventTimestamp) {
      const timeSinceLastEvent = Date.now() - this.lastEventTimestamp;
      // Se passou mais de 30 segundos sem eventos, saúde comprometida
      if (timeSinceLastEvent > 30000) {
        console.warn(`[UnifiedDataService] Sem eventos há ${Math.round(timeSinceLastEvent/1000)}s, reconectando...`);
        this.reconnect();
        return false;
      }
    }
    
    return isHealthy;
  }

  /**
   * Reconecta ao serviço
   */
  public reconnect(): void {
    this.disconnect();
    this.connectionAttempts = 0; // Resetar contador de tentativas
    this.connect();
  }

  /**
   * Método compatível para emitir evento (legado)
   */
  public emit(eventName: string, data: any): void {
    console.log(`[UnifiedDataService] Emitindo evento ${eventName}`);
    // Não temos canal de comunicação bidirecional, mas notificamos os listeners locais
    if (this.listeners.has(eventName)) {
      this.notifyListeners(eventName, data);
    }
  }
}

// Exportar instância única
export default UnifiedDataService; 