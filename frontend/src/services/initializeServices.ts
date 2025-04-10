import { getLogger } from './utils/logger';
import RouletteFeedService from './RouletteFeedService';
import RouletteStreamService from './RouletteStreamService';
import SocketService from './SocketService';
import EventService from './EventService';

const logger = getLogger('ServicesInitializer');

/**
 * Função de inicialização dos serviços principais do sistema
 * Inicializa o RouletteFeedService e RouletteStreamService de forma sincronizada
 */
export const initializeServices = async () => {
  logger.info('🚀 Iniciando serviços do sistema...');
  
  try {
    // 1. Obter instâncias dos serviços
    const feedService = RouletteFeedService.getInstance();
    const streamService = RouletteStreamService.getInstance();
    const socketService = SocketService.getInstance();
    
    // 2. Registro de integração entre serviços
    // Antes feito em main.tsx, agora centralizado aqui
    if (feedService && socketService) {
      feedService.registerSocketService(socketService);
      logger.info('✅ SocketService registrado no RouletteFeedService');
    }
    
    // 3. Inicializar o serviço de feed tradicional
    logger.info('⏳ Inicializando RouletteFeedService...');
    await feedService.initialize();
    
    // 4. Inicializar o serviço de streaming 
    logger.info('⏳ Conectando ao serviço de streaming...');
    streamService.connect();
    
    // 5. Emitir evento de inicialização finalizada
    EventService.emit('services:initialized', {
      timestamp: new Date().toISOString()
    });
    
    logger.success('✅ Todos os serviços inicializados com sucesso!');
    
    return { feedService, streamService, socketService };
  } catch (error) {
    logger.error('❌ Erro ao inicializar serviços:', error);
    
    // Notificar sobre o erro de inicialização
    EventService.emit('services:initialization-error', {
      timestamp: new Date().toISOString(),
      error: error.message || 'Erro desconhecido'
    });
    
    // Retornar o FeedService mesmo em caso de erro, pois ele é mais resiliente
    return { feedService: RouletteFeedService.getInstance() };
  }
};

export default initializeServices;
