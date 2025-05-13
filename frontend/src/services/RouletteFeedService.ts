import UnifiedRouletteClient from './UnifiedRouletteClient';
import { getLogger } from './utils/logger';

// Criar uma única instância do logger
const logger = getLogger('RouletteFeedService');

/**
 * Versão simplificada do RouletteFeedService que delega todas as operações
 * para o UnifiedRouletteClient para evitar duplicação de conexões e chamadas
 */
export default class RouletteFeedService {
  private static instance: RouletteFeedService | null = null;
  private unifiedClient: UnifiedRouletteClient;
  private initialized: boolean = false;

  /**
   * Construtor privado para garantir padrão singleton
   */
  private constructor() {
    console.log('[RouletteFeedService] Criando instância simplificada do RouletteFeedService');
    this.unifiedClient = UnifiedRouletteClient.getInstance();
  }

  /**
   * Obtém a instância única do serviço
   */
  public static getInstance(): RouletteFeedService {
    if (!RouletteFeedService.instance) {
      console.log('[RouletteFeedService] Criando nova instância do RouletteFeedService (proxy)');
      RouletteFeedService.instance = new RouletteFeedService();
    }
    return RouletteFeedService.instance;
  }

  /**
   * Inicializa o serviço - apenas proxy para o UnifiedRouletteClient
   */
  public initialize(): Promise<any> {
    if (this.initialized) {
      console.log('[RouletteFeedService] Serviço já inicializado');
      return Promise.resolve(this.getAllRoulettes());
    }

    console.log('[RouletteFeedService] Inicializando RouletteFeedService (proxy para UnifiedClient)');
    
    // Forçar inicialização do UnifiedClient
    this.unifiedClient.forceUpdate();
    
    this.initialized = true;
    return Promise.resolve(this.getAllRoulettes());
  }

  /**
   * Registra serviço Socket - mantido para compatibilidade
   */
  public registerSocketService(socketService: any): void {
    console.log('[RouletteFeedService] SocketService registrado no RouletteFeedService');
    // Não faz nada, mantido para compatibilidade
  }

  /**
   * Inicia polling - redireciona para UnifiedClient
   */
  public startPolling(): void {
    console.log('[RouletteFeedService] Iniciando polling via UnifiedClient');
    this.unifiedClient.forceUpdate();
  }

  /**
   * Busca dados iniciais - redireciona para UnifiedClient
   */
  public async fetchInitialData(): Promise<{ [key: string]: any }> {
    console.log('[RouletteFeedService] Buscando dados iniciais via UnifiedClient');
    const data = await this.unifiedClient.forceUpdate();
    
    // Transformar array em objeto por ID para compatibilidade
    const result: { [key: string]: any } = {};
    data.forEach(item => {
      if (item && (item.id || item.roleta_id)) {
        const id = item.id || item.roleta_id;
        result[id] = item;
      }
    });
    
    return result;
  }

  /**
   * Busca dados mais recentes - redireciona para UnifiedClient
   */
  public async fetchLatestData(): Promise<any> {
    return this.unifiedClient.forceUpdate();
  }

  /**
   * Obtém dados de uma roleta específica
   */
  public getRouletteData(roletaId: string): any {
    return this.unifiedClient.getRouletteById(roletaId);
  }

  /**
   * Obtém todas as roletas
   */
  public getAllRoulettes(): any[] {
    return this.unifiedClient.getAllRoulettes();
  }

  /**
   * Verifica se o cache é válido
   */
  public isCacheValid(): boolean {
    return this.unifiedClient.getStatus().isCacheValid;
  }

  /**
   * Atualiza cache forçadamente
   */
  public async refreshCache(): Promise<any> {
    return this.unifiedClient.forceUpdate();
  }

  /**
   * Obtém estatísticas de requisições
   */
  public getRequestStats(): any {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastMinuteRequests: [],
      avgResponseTime: 0,
      lastResponseTime: 0
    };
  }

  /**
   * Força atualização de dados
   */
  public forceUpdate(): Promise<any> {
    return this.unifiedClient.forceUpdate();
  }

  /**
   * Para o serviço
   */
  public stop(): void {
    console.log('[RouletteFeedService] Parando RouletteFeedService');
    // Não para o UnifiedClient para não afetar outros componentes
  }

  /**
   * Registra callback para atualizações
   */
  public subscribe(callback: (data: any) => void): void {
    this.unifiedClient.subscribe('update', callback);
  }

  /**
   * Remove registro de callback
   */
  public unsubscribe(callback: (data: any) => void): void {
    this.unifiedClient.unsubscribe('update', callback);
  }

  /**
   * Verifica saúde da API - apenas compatibilidade
   */
  public async checkAPIHealth(): Promise<boolean> {
    const status = this.unifiedClient.diagnoseConnectionState();
    return status.isStreamConnected || status.isPollingActive;
  }
} 