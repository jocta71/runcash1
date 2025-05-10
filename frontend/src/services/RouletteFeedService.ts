/**
 * Serviço para gerenciar feeds de dados de roletas
 * Integra com EventService e FetchService para fornecer dados agregados
 */

import EventService from './EventService';
import FetchService from './FetchService';
import { getLogger } from './utils/logger';
import { ROLETAS_PERMITIDAS } from '@/config/allowedRoulettes';
import { RouletteNumberEvent } from './EventService';

const logger = getLogger('RouletteFeedService');
const POLLING_INTERVAL = 10000; // 10 segundos

interface RouletteData {
  id: string;
  nome: string;
  numeros?: number[];
  estrategia?: {
    estado?: string;
    sugestao?: string;
    terminais_gatilho?: number[];
  };
  ultima_atualizacao?: string;
}

class RouletteFeedService {
  private static instance: RouletteFeedService;
  private roulettes: Map<string, RouletteData> = new Map();
  private pollingIntervalId: number | null = null;
  private isInitialized: boolean = false;
  private socketService: any = null;
  private fetchService: FetchService;
  private eventService: EventService;

  private constructor() {
    this.fetchService = FetchService.getInstance();
    this.eventService = EventService.getInstance();
    logger.info('RouletteFeedService inicializado');

    // Subscrever para eventos de novos números e estratégias
    this.eventService.subscribeToGlobalEvents(this.handleRouletteEvent);
  }

  /**
   * Obtém a única instância do serviço (padrão Singleton)
   */
  public static getInstance(): RouletteFeedService {
    if (!RouletteFeedService.instance) {
      RouletteFeedService.instance = new RouletteFeedService();
    }
    return RouletteFeedService.instance;
  }

  /**
   * Inicializa o serviço carregando dados iniciais
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.info('RouletteFeedService já está inicializado');
      return;
    }

    logger.info('Inicializando RouletteFeedService e carregando dados iniciais');
    
    try {
      // Carregar dados de todas as roletas
      const roulettes = await this.fetchService.getAllRoulettes();
      
      if (roulettes && Array.isArray(roulettes)) {
        logger.info(`Carregados dados de ${roulettes.length} roletas`);
        
        // Filtrar apenas roletas permitidas
        roulettes.forEach(roulette => {
          if (ROLETAS_PERMITIDAS.includes(roulette.id)) {
            this.roulettes.set(roulette.id, {
              id: roulette.id,
              nome: roulette.nome || 'Roleta sem nome',
              numeros: Array.isArray(roulette.numeros) ? roulette.numeros : [],
              ultima_atualizacao: new Date().toISOString()
            });
          }
        });
        
        logger.info(`${this.roulettes.size} roletas registradas após filtragem`);
      } else {
        logger.warn('Nenhuma roleta carregada ou formato de dados inválido');
      }
      
      this.isInitialized = true;
      
    } catch (error) {
      logger.error('Erro ao inicializar RouletteFeedService:', error);
      throw error;
    }
    
    return Promise.resolve();
  }

  /**
   * Registra um serviço de socket para integração
   */
  public registerSocketService(service: any): void {
    if (!service) {
      logger.warn('Tentativa de registrar serviço socket nulo ou indefinido');
      return;
    }
    
    this.socketService = service;
    logger.info('Serviço socket registrado com sucesso');
    
    // Tentar iniciar a conexão se o serviço tiver o método
    if (typeof this.socketService.connectStream === 'function') {
      this.socketService.connectStream();
    }
  }

  /**
   * Inicia o polling para atualizações regulares de dados
   */
  public startPolling(): void {
    if (this.pollingIntervalId !== null) {
      logger.info('Polling já está ativo, ignorando chamada');
      return;
    }
    
    logger.info('Iniciando polling de dados de roletas');
    
    // Executar imediatamente e depois em intervalos
    this.updateAllRouletteData();
    
    this.pollingIntervalId = window.setInterval(() => {
      this.updateAllRouletteData();
    }, POLLING_INTERVAL);
  }

  /**
   * Para o polling de dados
   */
  public stop(): void {
    logger.info('Parando serviço de dados de roletas');
    
    if (this.pollingIntervalId !== null) {
      window.clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    
    // Cancelar inscrição em eventos
    this.eventService.unsubscribeFromGlobalEvents(this.handleRouletteEvent);
  }

  /**
   * Atualiza os dados de todas as roletas
   */
  private async updateAllRouletteData(): Promise<void> {
    logger.debug('Atualizando dados de todas as roletas');
    
    try {
      // Atualizar dados via FetchService
      this.fetchService.forceUpdate();
      
      // Se tivermos socket service, tentar atualizar via socket também
      if (this.socketService && typeof this.socketService.requestRecentNumbers === 'function') {
        this.socketService.requestRecentNumbers();
      }
    } catch (error) {
      logger.error('Erro ao atualizar dados das roletas:', error);
    }
  }

  /**
   * Handler para eventos de roleta
   */
  private handleRouletteEvent = (event: RouletteNumberEvent | any): void => {
    // Verificar se temos um evento válido
    if (!event || !event.type) return;
    
    // Tratar eventos de novos números
    if (event.type === 'new_number' && event.roleta_id && event.numero !== undefined) {
      const roletaId = event.roleta_id;
      const roleta = this.roulettes.get(roletaId);
      
      if (roleta) {
        // Atualizar dados da roleta existente
        const numeros = Array.isArray(roleta.numeros) ? roleta.numeros : [];
        
        // Adicionar novo número no início do array
        numeros.unshift(event.numero);
        
        // Limitar a 100 números no máximo
        if (numeros.length > 100) {
          numeros.length = 100;
        }
        
        // Atualizar objeto da roleta
        this.roulettes.set(roletaId, {
          ...roleta,
          numeros,
          ultima_atualizacao: event.timestamp || new Date().toISOString()
        });
        
        logger.debug(`Roleta ${roleta.nome} atualizada com novo número: ${event.numero}`);
      } else {
        // Criar nova entrada para a roleta
        this.roulettes.set(roletaId, {
          id: roletaId,
          nome: event.roleta_nome || 'Roleta sem nome',
          numeros: [event.numero],
          ultima_atualizacao: event.timestamp || new Date().toISOString()
        });
        
        logger.info(`Nova roleta registrada: ${event.roleta_nome} (${roletaId})`);
      }
    }
    // Tratar eventos de atualização de estratégia
    else if (event.type === 'strategy_update' && event.roleta_id) {
      const roletaId = event.roleta_id;
      const roleta = this.roulettes.get(roletaId);
      
      if (roleta) {
        // Atualizar dados de estratégia da roleta
        this.roulettes.set(roletaId, {
          ...roleta,
          estrategia: {
            estado: event.estado,
            sugestao: event.sugestao_display,
            terminais_gatilho: event.terminais_gatilho
          },
          ultima_atualizacao: event.timestamp || new Date().toISOString()
        });
        
        logger.debug(`Estratégia atualizada para roleta ${roleta.nome}: ${event.estado}`);
      }
    }
  }

  /**
   * Obtém todas as roletas registradas
   */
  public getAllRoulettes(): RouletteData[] {
    return Array.from(this.roulettes.values());
  }

  /**
   * Obtém uma roleta específica pelo ID
   */
  public getRouletteById(roletaId: string): RouletteData | undefined {
    return this.roulettes.get(roletaId);
  }

  /**
   * Obtém uma roleta específica pelo nome
   */
  public getRouletteByName(name: string): RouletteData | undefined {
    for (const roleta of this.roulettes.values()) {
      if (roleta.nome === name) {
        return roleta;
      }
    }
    return undefined;
  }
  
  /**
   * Verifica se o serviço está inicializado
   */
  public isReady(): boolean {
    return this.isInitialized;
  }
}

export default RouletteFeedService; 