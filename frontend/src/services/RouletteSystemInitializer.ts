import RouletteFeedService from './RouletteFeedService';
import RouletteStreamService from './RouletteStreamService';
import EventService from './EventService';
import { getLogger } from './utils/logger';

const logger = getLogger('RouletteSystemInitializer');

/**
 * Classe responsável por inicializar todos os serviços de roleta
 * e garantir que eles estejam conectados.
 */
export default class RouletteSystemInitializer {
  private static isInitialized: boolean = false;
  private static feedService: RouletteFeedService;
  private static streamService: RouletteStreamService;

  /**
   * Inicializa o sistema de dados de roleta
   */
  public static initialize(): boolean {
    if (RouletteSystemInitializer.isInitialized) {
      logger.info('Sistema de roletas já foi inicializado');
      return true;
    }

    logger.info('Inicializando sistema de roletas');

    try {
      // Inicializar o serviço de feed (cache)
      RouletteSystemInitializer.feedService = RouletteFeedService.getInstance();
      
      // Inicializar o serviço de streaming (API REST)
      RouletteSystemInitializer.streamService = RouletteStreamService.getInstance();
      RouletteSystemInitializer.streamService.connect();
      
      // Registrar evento para conectar automaticamente quando o usuário voltar à página
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            RouletteSystemInitializer.streamService.connect();
          }
        });
      }
      
      // Emitir evento indicando que o sistema foi inicializado
      EventService.emit('roulette-system:initialized', {
        timestamp: new Date().toISOString()
      });
      
      RouletteSystemInitializer.isInitialized = true;
      logger.success('Sistema de roletas inicializado com sucesso');
      
      return true;
    } catch (error) {
      logger.error(`Erro ao inicializar sistema de roletas: ${error.message}`);
      return false;
    }
  }

  /**
   * Verifica se o sistema já foi inicializado
   */
  public static isSystemInitialized(): boolean {
    return RouletteSystemInitializer.isInitialized;
  }

  /**
   * Desliga o sistema de roletas
   */
  public static shutdown(): void {
    if (!RouletteSystemInitializer.isInitialized) {
      return;
    }

    logger.info('Desligando sistema de roletas');

    // Desconectar serviço de streaming
    if (RouletteSystemInitializer.streamService) {
      RouletteSystemInitializer.streamService.disconnect();
    }

    // Parar serviço de feed
    if (RouletteSystemInitializer.feedService) {
      RouletteSystemInitializer.feedService.stop();
    }

    // Limpar evento de visibilidade
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', () => {});
    }

    RouletteSystemInitializer.isInitialized = false;
    logger.info('Sistema de roletas desligado');

    // Emitir evento indicando que o sistema foi desligado
    EventService.emit('roulette-system:shutdown', {
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Obtém o serviço de feed
   */
  public static getFeedService(): RouletteFeedService {
    if (!RouletteSystemInitializer.isInitialized) {
      RouletteSystemInitializer.initialize();
    }
    return RouletteSystemInitializer.feedService;
  }

  /**
   * Obtém o serviço de streaming
   */
  public static getStreamService(): RouletteStreamService {
    if (!RouletteSystemInitializer.isInitialized) {
      RouletteSystemInitializer.initialize();
    }
    return RouletteSystemInitializer.streamService;
  }
}
