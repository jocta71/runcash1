/**
 * Serviço para gerenciar a alimentação de dados das roletas
 * Responsável por centralizar as requisições e reduzir chamadas desnecessárias
 * 
 * MODIFICADO PARA UTILIZAR APENAS WEBSOCKET EM VEZ DE REST
 */

import { getLogger } from './utils/logger';
import SocketService from './SocketService';
import EventService from './EventService';
import config from '@/config/env';
import { toast } from '@/components/ui/use-toast';

const logger = getLogger('RouletteFeedService');

interface FetchOptions {
  forceRefresh?: boolean;
  silent?: boolean;
}

class RouletteFeedService {
  private static instance: RouletteFeedService;
  private isInitialized: boolean = false;
  private isInitializing: boolean = false;
  private isFetching: boolean = false;
  private pollingInterval: number = 8000; // 8 segundos entre cada verificação
  private pollingIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastResponse: any = null;
  private socket: SocketService;
  private fetchQueue: Map<string, {timestamp: number, callback?: Function}> = new Map();
  private lastFetchTimestamp: number = 0;
  private consecutiveErrors: number = 0;
  private errorBackoffFactor: number = 1.5;
  private currentRequestId: string | null = null;
  
  private constructor() {
    logger.debug('Criando nova instância do RouletteFeedService');
    this.socket = SocketService.getInstance();
  }
  
  public static getInstance(): RouletteFeedService {
    if (!RouletteFeedService.instance) {
      RouletteFeedService.instance = new RouletteFeedService();
    }
    return RouletteFeedService.instance;
  }
  
  /**
   * Inicializa o serviço e busca dados iniciais
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.info('Serviço já inicializado, ignorando requisição');
      return;
    }
    
    if (this.isInitializing) {
      logger.warn('Serviço já está sendo inicializado, aguardando...');
      return;
    }
    
    this.isInitializing = true;
    logger.info('Iniciando inicialização');
    
    try {
      // Registrar o SocketService para receber eventos
      this.socket = SocketService.getInstance();
      logger.debug('SocketService registrado no RouletteFeedService');
      
      // Buscar dados iniciais via WebSocket
      await this.fetchInitialData();
      
      // Configurar webhook para eventos via SocketService
      this.setupSocketEvents();
      
      this.isInitialized = true;
      this.isInitializing = false;
      
      // Iniciar polling automático
          this.startPolling();
      
      logger.info('Dados iniciais obtidos com sucesso');
    } catch (error) {
      logger.error('Erro ao inicializar serviço:', error);
      this.isInitializing = false;
      throw error;
    }
  }
  
  /**
   * Configura eventos do WebSocket para receber atualizações em tempo real
   */
  private setupSocketEvents(): void {
    // Registrar callback para receber eventos de roleta
    this.socket.subscribe('*', (event) => {
      if (event.type === 'new_number') {
        logger.debug(`Evento de roleta recebido via WebSocket: ${event.roleta_nome}, número: ${event.numero}`);
        
        // Enviar notificação de novo evento
        EventService.emitGlobalEvent('roulette:data-updated', {
          roleta_id: event.roleta_id,
          roleta_nome: event.roleta_nome,
          numero: event.numero,
          timestamp: event.timestamp,
          source: 'websocket'
        });
      }
    });
    
    // Registrar para eventos de sistema do Socket
    EventService.subscribe('system_error', (event) => {
      logger.warn(`Erro de sistema recebido: ${event.type} - ${event.message}`);
      
      // Se for erro de conexão, tentar busca alternativa
      if (event.type === 'falha_conexao_websocket') {
        logger.info('Falha na conexão WebSocket detectada, agendando nova tentativa');
        // Agendar nova busca em 2 segundos
        setTimeout(() => this.fetchLatestData(), 2000);
      }
    });
  }
  
  /**
   * Busca dados iniciais via WebSocket
   */
  private async fetchInitialData(): Promise<void> {
    if (this.isFetching) {
      logger.warn('🔒 Outra instância já está buscando dados, aguardando...');
      return;
    }
    
    this.isFetching = true;
    const requestId = `initial_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.currentRequestId = requestId;
    
    logger.info(`🚀 Buscando dados iniciais (ID: ${requestId})`);
    
    try {
      // Solicitar dados via WebSocket
      const socket = SocketService.getInstance();
      
      // Criar promise para esperar resposta do socket
      const socketPromise = new Promise<any>((resolve, reject) => {
        // Timeout para caso o socket não responda
        const timeout = setTimeout(() => {
          logger.warn(`Timeout ao esperar resposta do WebSocket (ID: ${requestId})`);
          reject(new Error('Timeout ao aguardar resposta do WebSocket'));
        }, 10000);
        
        // Registrar listener temporário para receber dados
        const handleRouletteData = (data: any) => {
          clearTimeout(timeout);
          EventService.unsubscribe('roulettes_loaded', handleRouletteData);
          resolve(data);
        };
        
        // Registrar para receber evento de dados carregados
        EventService.subscribe('roulettes_loaded', handleRouletteData);
        
        // Solicitar números recentes via socket
        socket.requestRecentNumbers();
      });
      
      try {
        // Aguardar resposta do socket
        const data = await socketPromise;
        
        // Verificar se temos dados válidos
        if (data && data.count > 0) {
          logger.info(`🔄 Requisição ${requestId} concluída com sucesso: success`);
          logger.info(`✅ Dados iniciais recebidos: ${data.count} roletas`);
          this.lastResponse = data;
          this.lastFetchTimestamp = Date.now();
          this.consecutiveErrors = 0;
          
          // Emitir evento global de dados atualizados
          EventService.emitGlobalEvent('roulette:all-data-updated', {
            count: data.count,
            source: 'websocket',
        timestamp: new Date().toISOString()
      });
        } else {
          logger.error(`❌ Dados inválidos recebidos (ID: ${requestId})`);
          this.handleFetchError(new Error('Dados inválidos recebidos'));
        }
      } catch (socketError) {
        logger.error(`❌ Erro ao obter dados via WebSocket (ID: ${requestId}):`, socketError);
        this.handleFetchError(socketError);
      }
    } catch (error) {
      logger.error(`❌ Erro ao buscar dados iniciais (ID: ${requestId}):`, error);
      this.handleFetchError(error);
    } finally {
      this.isFetching = false;
      this.currentRequestId = null;
    }
  }
  
  /**
   * Inicia polling regular para buscar dados atualizados
   */
  public startPolling(): void {
    if (this.pollingIntervalId) {
      logger.warn('Polling já está ativo, ignorando solicitação');
      return;
    }
    
    logger.info(`Iniciando polling com intervalo de ${this.pollingInterval}ms`);
    
    // Configurar intervalo para verificar dados periodicamente via WebSocket
    this.startPollingTimer();
  }
  
  /**
   * Inicia o timer de polling
   */
  private startPollingTimer(): void {
    logger.debug(`⏱️ Iniciando timer de polling com intervalo de ${this.pollingInterval}ms`);
    
    // Limpar intervalo existente, se houver
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
    }
    
    // Configurar novo intervalo
    this.pollingIntervalId = setInterval(() => {
      this.fetchLatestData();
    }, this.pollingInterval);
  }
  
  /**
   * Busca os dados mais recentes via WebSocket
   */
  private fetchLatestData(options: FetchOptions = {}): void {
    // Não executar múltiplas requisições simultâneas
    if (this.isFetching && !options.forceRefresh) {
      logger.debug('Requisição já em andamento, ignorando nova solicitação');
      return;
    }
    
    // Verificar se temos cache válido (menos de 3 segundos)
    const now = Date.now();
    if (!options.forceRefresh && (now - this.lastFetchTimestamp) < 3000) {
      logger.debug('💾 Cache válido, evitando requisição desnecessária');
      return;
    }
    
    this.isFetching = true;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.currentRequestId = requestId;
    
    try {
      // Usar WebSocket para solicitar dados atualizados
      const socket = SocketService.getInstance();
      socket.requestRecentNumbers();
      
      // Não precisamos esperar pelo resultado, pois receberemos via eventos
      logger.debug(`✅ Solicitação enviada via WebSocket (ID: ${requestId})`);
      
      // Atualizar último timestamp de fetch
      this.lastFetchTimestamp = now;
      this.isFetching = false;
      this.currentRequestId = null;
    } catch (error) {
      logger.error(`❌ Erro ao buscar dados (ID: ${requestId}):`, error);
      this.handleFetchError(error);
    this.isFetching = false;
      this.currentRequestId = null;
    }
  }

  /**
   * Lida com erro ao buscar dados
   */
  private handleFetchError(error: any): void {
    this.consecutiveErrors++;
    
    if (this.consecutiveErrors >= 3) {
      // Se tivermos múltiplos erros consecutivos, aumentar o intervalo de polling
      const newInterval = Math.min(
        this.pollingInterval * this.errorBackoffFactor, 
        30000 // Máximo de 30 segundos
      );
      
      logger.warn(`🔄 Aumentando intervalo de polling após ${this.consecutiveErrors} erros: ${this.pollingInterval}ms -> ${newInterval}ms`);
      this.pollingInterval = newInterval;
      
      // Reiniciar timer com novo intervalo
      this.startPollingTimer();
      
      // Notificar o usuário sobre problemas
      if (this.consecutiveErrors === 3) {
        toast({
          title: "Problemas de conexão",
          description: "Encontramos dificuldades ao atualizar os dados. Tentando novamente...",
          variant: "destructive"
            });
          }
        }
  }
  
  /**
   * Para o polling de dados
   */
  public stopPolling(): void {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    
    logger.info('Serviço RouletteFeedService parado');
  }
  
  /**
   * Destruir o serviço e liberar recursos
   */
  public destroy(): void {
    logger.info('Parando serviço RouletteFeedService');
    
    // Parar polling
    this.stopPolling();
    
    // Remover listeners
    EventService.unsubscribeAll();
    
    logger.info('Serviço RouletteFeedService parado e recursos liberados');
  }

  /**
   * Registra o SocketService para uso no serviço de feed
   * Mantido para compatibilidade com código existente
   */
  public registerSocketService(socketService: any): void {
    if (!socketService) {
      logger.warn('Tentativa de registrar SocketService inválido');
      return;
    }
    
    logger.info('SocketService registrado no RouletteFeedService');
    this.socket = socketService;
  }
}

export default RouletteFeedService; 