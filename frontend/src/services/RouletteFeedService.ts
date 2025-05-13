import UnifiedRouletteClient from './UnifiedRouletteClient';
import { EventEmitter } from 'events';

/**
 * RouletteFeedService - Serviço simplificado que delega todas as operações ao UnifiedRouletteClient
 * 
 * Esta versão otimizada do serviço evita duplicidade de conexões e callbacks, funcionando
 * como um proxy transparente para o UnifiedRouletteClient, garantindo o uso de uma única
 * instância para a aplicação inteira.
 */
export default class RouletteFeedService {
  private static instance: RouletteFeedService;
  private unifiedClient: UnifiedRouletteClient;
  private events: EventEmitter;
  private serviceName: string;
  private componentId: string;
  
  /**
   * Construtor privado para implementar o padrão singleton
   */
  private constructor() {
    console.log('[RouletteFeedService] Criando instância simplificada do RouletteFeedService');
    
    // Obter a instância única do UnifiedRouletteClient
    this.unifiedClient = UnifiedRouletteClient.getInstance();
    
    // Criar um ID único para este serviço
    this.serviceName = 'RouletteFeedService';
    this.componentId = `service-roulette-feed-${Date.now()}`;
    
    // Inicializar o emissor de eventos
    this.events = new EventEmitter();
    
    // Registrar no cliente unificado para eventos relevantes
    this.unifiedClient.subscribe('update', this.handleUpdate.bind(this), this.componentId);
    this.unifiedClient.subscribe('historical-data-ready', this.handleHistoricalDataReady.bind(this), this.componentId);
    
    console.log('[RouletteFeedService] SocketService registrado no RouletteFeedService');
  }
  
  /**
   * Obtém a instância única do serviço
   */
  public static getInstance(): RouletteFeedService {
    if (!RouletteFeedService.instance) {
      RouletteFeedService.instance = new RouletteFeedService();
    }
    return RouletteFeedService.instance;
  }
  
  /**
   * Inicializa o serviço
   */
  public init(): void {
    console.log('[RouletteFeedService] Inicializando RouletteFeedService (proxy para UnifiedClient)');
    
    // Não fazemos mais nada aqui, apenas delegamos ao UnifiedClient
    this.fetchInitialData();
  }
  
  /**
   * Inicia o polling
   */
  public startPolling(): void {
    console.log('[RouletteFeedService] Iniciando polling via UnifiedClient');
    this.unifiedClient.forceUpdate();
  }
  
  /**
   * Busca dados iniciais
   */
  public async fetchInitialData(): Promise<any> {
    console.log('[RouletteFeedService] Busca inicial de dados via UnifiedClient');
    return this.unifiedClient.forceUpdate();
  }
  
  /**
   * Busca os dados mais recentes
   */
  public async fetchLatestData(): Promise<any> {
    console.log('[RouletteFeedService] Busca de dados recentes via UnifiedClient');
    return this.unifiedClient.forceUpdate();
  }
  
  /**
   * Registra callback para novos eventos
   */
  public on(event: string, callback: (data: any) => void): () => void {
    // Adicionamos ao nosso emissor de eventos
    this.events.on(event, callback);
    
    // Retornamos uma função para remover o listener
    return () => {
      this.events.removeListener(event, callback);
    };
  }
  
  /**
   * Handler para eventos de atualização
   */
  private handleUpdate(data: any): void {
    console.log(`[RouletteFeedService] Recebida atualização via UnifiedClient (${this.componentId})`);
    this.events.emit('update', data);
  }
  
  /**
   * Handler para eventos de dados históricos
   */
  private handleHistoricalDataReady(data: any): void {
    console.log(`[RouletteFeedService] Recebidos dados históricos via UnifiedClient (${this.componentId})`);
    this.events.emit('historical-data-ready', data);
  }
  
  /**
   * Obtém todas as roletas
   */
  public getAllRoulettes(): any[] {
    console.log('[RouletteFeedService] Obtendo todas as roletas via UnifiedClient');
    return this.unifiedClient.getAllRoulettes();
  }
  
  /**
   * Obtém uma roleta pelo ID
   */
  public getRouletteById(id: string): any {
    return this.unifiedClient.getRouletteById(id);
  }
  
  /**
   * Libera recursos
   */
  public dispose(): void {
    console.log(`[RouletteFeedService] Liberando recursos (${this.componentId})`);
    this.unifiedClient.unregisterComponent(this.componentId);
    this.events.removeAllListeners();
  }
} 