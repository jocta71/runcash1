import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import SocketService from './services/SocketService';
import { initializeLogging } from './services/utils/initLogger';
import { getLogger } from './services/utils/logger';
import { setupGlobalErrorHandlers } from './utils/error-handlers';
import RouletteFeedService from './services/RouletteFeedService';
import EventService from './services/EventService';

// Declaração global para estender o objeto Window com nossas propriedades
declare global {
  interface Window {
    ROULETTE_SYSTEM_INITIALIZED: boolean;
    isRouletteSystemInitialized: () => boolean;
    getRouletteSystem: () => any;
  }
}

// Inicializar o sistema de log
initializeLogging();

// Obter logger para o componente principal
const logger = getLogger('Main');

// Configurar manipuladores globais de erro
setupGlobalErrorHandlers();
logger.info('Manipuladores globais de erro configurados');

// Flag global para controlar a inicialização do sistema de roletas
window.ROULETTE_SYSTEM_INITIALIZED = false;

// Função para inicializar o sistema de roletas de forma centralizada
function initializeRoulettesSystem() {
  if (window.ROULETTE_SYSTEM_INITIALIZED) {
    logger.info('Sistema de roletas já inicializado, ignorando');
    return;
  }
  
  logger.info('Inicializando sistema centralizado de roletas');
  
  // Inicializar os serviços em ordem com tratamento de erros
  let socketService, eventService, rouletteFeedService;
  
  try {
    // Verificar se SocketService existe e tem o método getInstance
    if (typeof SocketService === 'undefined') {
      throw new Error('SocketService não definido');
    }
    
    if (typeof SocketService.getInstance !== 'function') {
      logger.error('SocketService não tem método getInstance, tentando usar diretamente');
      socketService = SocketService;
    } else {
      socketService = SocketService.getInstance();
    }
    
    // Verificar EventService
    if (typeof EventService === 'undefined') {
      throw new Error('EventService não definido');
    }
    
    if (typeof EventService.getInstance !== 'function') {
      logger.error('EventService não tem método getInstance, tentando usar diretamente');
      eventService = EventService;
    } else {
      eventService = EventService.getInstance();
    }
    
    // Verificar RouletteFeedService
    if (typeof RouletteFeedService === 'undefined') {
      throw new Error('RouletteFeedService não definido');
    }
    
    if (typeof RouletteFeedService.getInstance !== 'function') {
      logger.error('RouletteFeedService não tem método getInstance, tentando usar diretamente');
      rouletteFeedService = RouletteFeedService;
    } else {
      rouletteFeedService = RouletteFeedService.getInstance();
    }
    
    // Registrar o SocketService no RouletteFeedService se ambos existirem
    if (rouletteFeedService && socketService && typeof rouletteFeedService.registerSocketService === 'function') {
      rouletteFeedService.registerSocketService(socketService);
    } else {
      logger.warn('Não foi possível registrar SocketService no RouletteFeedService');
    }
  } catch (error) {
    logger.error('Erro ao inicializar serviços:', error);
    
    // Criar serviços de fallback para permitir que a aplicação carregue mesmo com erros
    socketService = socketService || {
      getInstance: () => ({}),
      loadHistoricalRouletteNumbers: () => Promise.resolve([])
    };
    
    eventService = eventService || {
      getInstance: () => ({}),
      dispatchEvent: () => {}
    };
    
    rouletteFeedService = rouletteFeedService || {
      getInstance: () => ({}),
      fetchInitialData: () => Promise.resolve([]),
      startPolling: () => {},
      stop: () => {}
    };
  }
  
  // Buscar dados iniciais uma única vez
  logger.info('Realizando busca inicial única de dados de roletas...');
  
  // Verificar se rouletteFeedService existe e tem o método necessário
  if (rouletteFeedService && typeof rouletteFeedService.fetchInitialData === 'function') {
    rouletteFeedService.fetchInitialData().then(data => {
      logger.info(`Dados iniciais obtidos: ${Array.isArray(data) ? data.length : 0} roletas`);
      
      // Verificar se eventService existe e tem o método dispatchEvent
      if (eventService && typeof eventService.dispatchEvent === 'function') {
        eventService.dispatchEvent({
          type: 'roulette:data-updated',
          data: {
            source: 'initial-load',
            timestamp: new Date().toISOString()
          }
        });
      }
      
      // Verificar se rouletteFeedService tem o método startPolling
      if (rouletteFeedService && typeof rouletteFeedService.startPolling === 'function') {
        rouletteFeedService.startPolling();
        logger.info('Polling de roletas iniciado (intervalo de 10s)');
      }
    }).catch(error => {
      logger.error('Erro ao carregar dados iniciais:', error);
    });
  } else {
    logger.error('Não foi possível iniciar carregamento de dados: rouletteFeedService não disponível ou mal configurado');
  }
  
  // Marcar como inicializado
  window.ROULETTE_SYSTEM_INITIALIZED = true;
  
  // Adicionar função para limpar recursos quando a página for fechada
  window.addEventListener('beforeunload', () => {
    if (rouletteFeedService && typeof rouletteFeedService.stop === 'function') {
      rouletteFeedService.stop();
    }
    window.ROULETTE_SYSTEM_INITIALIZED = false;
    logger.info('Sistema de roletas finalizado');
  });
  
  return {
    socketService,
    rouletteFeedService,
    eventService
  };
}

// Inicializar o SocketService logo no início para estabelecer conexão antecipada
logger.info('Inicializando SocketService antes do render...');
let socketServiceInstance;

try {
  // Verificar se o SocketService existe e tem o método getInstance
  if (typeof SocketService === 'undefined') {
    throw new Error('SocketService não definido');
  }
  
  if (typeof SocketService.getInstance !== 'function') {
    logger.warn('SocketService não tem método getInstance, tentando usar diretamente');
    socketServiceInstance = SocketService;
  } else {
    socketServiceInstance = SocketService.getInstance(); // Inicia a conexão
  }
} catch (error) {
  logger.error('Erro ao inicializar SocketService:', error);
  socketServiceInstance = {
    loadHistoricalRouletteNumbers: () => Promise.resolve([])
  };
}

// Informa ao usuário que a conexão está sendo estabelecida
logger.info('Conexão com o servidor sendo estabelecida em background...');

// Inicializar o sistema de roletas como parte do carregamento da aplicação
logger.info('Inicializando sistema de roletas de forma centralizada...');
const rouletteSystem = initializeRoulettesSystem();

// Configuração global para requisições fetch
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

// Iniciar pré-carregamento de dados históricos
logger.info('Iniciando pré-carregamento de dados históricos...');
try {
  // Verificar se o método existe antes de chamá-lo
  if (socketServiceInstance && typeof socketServiceInstance.loadHistoricalRouletteNumbers === 'function') {
    socketServiceInstance.loadHistoricalRouletteNumbers().catch(err => {
      logger.error('Erro ao pré-carregar dados históricos:', err);
    });
  } else {
    logger.warn('Método loadHistoricalRouletteNumbers não disponível, ignorando pré-carregamento');
  }
} catch (error) {
  logger.error('Erro ao tentar pré-carregar dados históricos:', error);
}

// Expor globalmente a função para verificar se o sistema foi inicializado
window.isRouletteSystemInitialized = () => window.ROULETTE_SYSTEM_INITIALIZED;
window.getRouletteSystem = () => rouletteSystem;

const rootElement = document.getElementById("root");
if (rootElement) {
  // Adicionar elemento visual para indicar carregamento inicial
  rootElement.innerHTML = `
    <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #1a1a1a; color: #f0f0f0;">
      <div style="text-align: center;">
        <h2>Carregando RunCash...</h2>
        <p>Estabelecendo conexão com servidores</p>
        <div style="width: 50px; height: 50px; border: 5px solid #ccc; border-top-color: #888; border-radius: 50%; margin: 20px auto; animation: spinner 1s linear infinite;"></div>
      </div>
    </div>
    <style>
      @keyframes spinner {
        to {transform: rotate(360deg);}
      }
    </style>
  `;
  
  // Aguardar um pequeno intervalo para dar tempo à conexão de ser estabelecida
  setTimeout(() => {
    createRoot(rootElement).render(<App />);
  }, 1500);
} else {
  logger.error('Elemento root não encontrado!');
}
