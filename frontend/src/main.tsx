import { createRoot } from 'react-dom/client'
import React from 'react'
import App from './App'
import './index.css'
import SocketService from './services/SocketService'
import { initializeLogging } from './services/utils/initLogger'
import { getLogger } from './services/utils/logger'
import { setupGlobalErrorHandlers } from './utils/error-handlers'
import RouletteFeedService from './services/RouletteFeedService'
import EventService from './services/EventService'
import globalRouletteDataService from './services/GlobalRouletteDataService'
import { markPerformance, runAsync } from './utils/performance-optimizer'

// Declaração global para estender o objeto Window com nossas propriedades
declare global {
  interface Window {
    ROULETTE_SYSTEM_INITIALIZED: boolean;
    isRouletteSystemInitialized: () => boolean;
    getRouletteSystem: () => any;
    authContextInstance?: {
      checkAuth: () => Promise<boolean>;
    };
  }
}

// Marcar início da aplicação
markPerformance('app_init_start');

// Inicializar o sistema de log
initializeLogging();

// Obter logger para o componente principal
const logger = getLogger('Main');
logger.info('Inicialização da aplicação iniciada');

// Configurar manipuladores globais de erro
setupGlobalErrorHandlers();
logger.info('Manipuladores globais de erro configurados');

// Flag global para controlar a inicialização do sistema de roletas
window.ROULETTE_SYSTEM_INITIALIZED = false;

// Inicializar o sistema de roletas com carregamento otimizado
function initializeRoulettesSystem() {
  logger.info('Inicializando sistema de roletas com otimizações');
  
  // Inicializar serviços principais imediatamente
  const socketService = SocketService.getInstance();
  const eventService = EventService.getInstance();
  
  // Variáveis para armazenar instâncias de serviços não-críticos
  let rouletteFeedService: any = null;
  
  // Inicializar serviços não-críticos após a renderização
  const initializeNonCriticalServices = () => {
    logger.info('Iniciando inicialização de serviços não-críticos...');
    
    return runAsync(() => {
      // Criar serviço de feed de roletas
      rouletteFeedService = RouletteFeedService.getInstance();
      
      // Registrar socketService no feed
      if (rouletteFeedService) {
        rouletteFeedService.registerSocketService(socketService);
        logger.info('RouletteFeedService registrado com SocketService');
      }
      
      // Sinalizar que o sistema está inicializado
      window.ROULETTE_SYSTEM_INITIALIZED = true;
      markPerformance('roulette_services_initialized');
      
      return { rouletteFeedService };
    }, 2000); // Atraso para permitir que a interface seja renderizada primeiro
  };
  
  // Buscar dados apenas após a renderização
  const fetchData = async () => {
    try {
      logger.info('Buscando dados de roletas...');
      const data = await globalRouletteDataService.fetchRouletteData();
      logger.info(`Dados obtidos: ${data.length} roletas`);
      markPerformance('roulette_data_loaded');
      
      return data;
    } catch (error) {
      logger.error('Erro ao buscar dados de roletas:', error);
      return [];
    }
  };
  
  // Inicializar RouletteFeedService com os dados
  const initializeFeed = async (data: any[]) => {
    if (!rouletteFeedService) {
      logger.warn('RouletteFeedService não inicializado, pulando inicialização de feed');
      return;
    }
    
    try {
      logger.info('Inicializando feed de roletas...');
      await rouletteFeedService.initialize();
      
      // Disparar evento para atualização
      eventService.dispatchEvent({
        type: 'roulette:data-updated',
        data: {
          source: 'initial-load',
          timestamp: new Date().toISOString()
        }
      });
      
      // Iniciar polling com delay para melhorar desempenho
      setTimeout(() => {
        if (rouletteFeedService) {
          rouletteFeedService.startPolling();
          logger.info('Polling de roletas iniciado');
          markPerformance('roulette_polling_started');
        }
      }, 5000);
    } catch (error) {
      logger.error('Erro ao inicializar feed de roletas:', error);
    }
  };
  
  // Sequência de inicialização otimizada
  const startInitSequence = async () => {
    // Primeiro inicializar serviços não-críticos
    const services = await initializeNonCriticalServices();
    logger.info('Serviços não-críticos inicializados');
    
    // Em seguida, buscar dados com um pequeno delay
    setTimeout(async () => {
      const data = await fetchData();
      
      // Por fim, inicializar feed com os dados obtidos
      setTimeout(() => {
        initializeFeed(data);
      }, 2000);
    }, 3000);
  };
  
  // Iniciar sequência de inicialização
  startInitSequence();
  
  // Limpeza ao fechar página
  window.addEventListener('beforeunload', () => {
    if (rouletteFeedService) {
      rouletteFeedService.stop();
    }
    window.ROULETTE_SYSTEM_INITIALIZED = false;
    logger.info('Sistema de roletas finalizado');
  });
  
  // Retornar objeto com serviços inicializados
  return {
    socketService,
    eventService,
    getRouletteFeedService: () => rouletteFeedService,
    globalRouletteDataService
  };
}

// Inicializar connection socket em background
logger.info('Iniciando conexão socket em background...');
const socketService = SocketService.getInstance();

// Inicializar sistema de roletas de forma não-bloqueante
logger.info('Inicializando sistema de roletas em background...');
const rouletteSystem = initializeRoulettesSystem();

// Otimização para requisições fetch
const originalFetch = window.fetch;
window.fetch = function(input, init) {
  const headers = init?.headers ? new Headers(init.headers) : new Headers();
  
  // Adicionar header para ignorar lembrete do túnel
  if (!headers.has('bypass-tunnel-reminder')) {
    headers.append('bypass-tunnel-reminder', 'true');
  }
  
  const newInit = {
    ...init,
    headers
  };
  
  return originalFetch(input, newInit);
};

// Funções públicas para verificação do sistema
window.isRouletteSystemInitialized = () => window.ROULETTE_SYSTEM_INITIALIZED;
window.getRouletteSystem = () => rouletteSystem;

// Carregar dados históricos com delay para priorizar renderização
const preloadHistoricalData = () => {
  setTimeout(() => {
    logger.info('Iniciando carregamento de dados históricos...');
    socketService.loadHistoricalRouletteNumbers()
      .then(() => {
        logger.info('Dados históricos carregados com sucesso');
        markPerformance('historical_data_loaded');
      })
      .catch(err => {
        logger.error('Erro ao carregar dados históricos:', err);
      });
  }, 8000); // Delay significativo para priorizar UI
};

// Agendar carregamento de dados históricos
preloadHistoricalData();

// Renderizar a aplicação com otimizações
const rootElement = document.getElementById("root");
if (rootElement) {
  markPerformance('render_loading_screen');
  
  // Tela de carregamento otimizada
  rootElement.innerHTML = `
    <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #1a1a1a; color: #f0f0f0;">
      <div style="text-align: center;">
        <h2>Carregando RunCash</h2>
        <p>Preparando a melhor experiência para você</p>
        <div style="width: 50px; height: 50px; border: 5px solid #ccc; border-top-color: #888; border-radius: 50%; margin: 20px auto; animation: spinner 1s linear infinite;"></div>
      </div>
    </div>
    <style>
      @keyframes spinner {
        to {transform: rotate(360deg);}
      }
    </style>
  `;
  
  // Renderizar mais rapidamente
  markPerformance('before_app_render');
  
  // Reduzir tempo de espera inicial para melhorar experiência
  setTimeout(() => {
    createRoot(rootElement).render(<App />);
    markPerformance('after_app_render');
    
    // Verificar autenticação em background após renderização
    setTimeout(() => {
      if (window.authContextInstance?.checkAuth) {
        logger.info('Verificando autenticação em background');
        window.authContextInstance.checkAuth()
          .then(result => {
            logger.info('Status de autenticação:', result ? 'autenticado' : 'não autenticado');
            markPerformance('auth_check_complete');
          })
          .catch(err => {
            logger.error('Erro ao verificar autenticação:', err);
          });
      }
    }, 500);
  }, 600); // Tempo reduzido para carregamento
} else {
  logger.error('Elemento root não encontrado!');
}

// Marcar conclusão da inicialização
markPerformance('main_initialization_complete');
