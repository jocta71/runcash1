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
import { EventEmitter } from 'events'

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

// Inicializar o sistema de roletas como parte do carregamento da aplicação
function initializeRoulettesSystem() {
  logger.info('Inicializando sistema centralizado de roletas');
  
  try {
    // Criar objetos para armazenar os serviços (inicialmente com implementações vazias)
    let socketService: any = {
      loadHistoricalRouletteNumbers: async () => false,
      isConnected: () => false,
      on: () => () => {},
      subscribe: () => () => {},
      unsubscribe: () => {},
      // Métodos mínimos necessários
    };
    
    const eventService = EventService.getInstance();
    
    let rouletteFeedService: any = {
      registerSocketService: () => {},
      initialize: async () => {},
      startPolling: () => {},
      stop: () => {},
      // Métodos mínimos necessários
    };
    
    // Inicializar os serviços com tratamento de erro
    try {
      // Tentar inicializar SocketService
      socketService = SocketService.getInstance();
      logger.info('SocketService inicializado com sucesso');
    } catch (socketError) {
      logger.error('Erro ao inicializar SocketService - usando implementação alternativa:', socketError);
      
      // Tentar alternativa
      try {
        // Importar RESTSocketService como alternativa
        import('./services/RESTSocketService').then(module => {
          try {
            const alternativeSocketService = module.default.getInstance();
            // Substituir a implementação vazia
            socketService = alternativeSocketService;
            logger.info('RESTSocketService inicializado como alternativa ao SocketService');
            
            // Tentar registrar no FeedService se ele já existir
            if (rouletteFeedService && rouletteFeedService.registerSocketService) {
              rouletteFeedService.registerSocketService(socketService);
            }
          } catch (alternativeError) {
            logger.error('Falha também na alternativa RESTSocketService:', alternativeError);
          }
        }).catch(importError => {
          logger.error('Erro ao importar RESTSocketService como alternativa:', importError);
        });
      } catch (alternativeError) {
        logger.error('Erro ao tentar usar serviço de socket alternativo:', alternativeError);
      }
    }
    
    try {
      // Tentar inicializar RouletteFeedService
      rouletteFeedService = RouletteFeedService.getInstance();
      logger.info('RouletteFeedService inicializado com sucesso');
      
      // Registrar o SocketService no RouletteFeedService
      try {
        rouletteFeedService.registerSocketService(socketService);
      } catch (registerError) {
        logger.error('Erro ao registrar SocketService no RouletteFeedService:', registerError);
      }
    } catch (feedError) {
      logger.error('Erro ao inicializar RouletteFeedService - usando implementação básica:', feedError);
    }
  
    // Inicializar o serviço global e buscar dados iniciais uma única vez
    logger.info('Inicializando serviço global e realizando única busca de dados de roletas...');
    
    // Usar a instância importada diretamente, com tratamento de erro
    try {
      globalRouletteDataService.fetchRouletteData().then(data => {
        if (!data || !Array.isArray(data)) {
          logger.warn('Serviço global retornou dados inválidos ou vazios');
          return;
        }
        
        logger.info(`Dados iniciais obtidos pelo serviço global: ${data.length} roletas`);
        
        // Em seguida, inicializar o RouletteFeedService que usará os dados do serviço global
        try {
          rouletteFeedService.initialize().then(() => {
            logger.info('RouletteFeedService inicializado usando dados do serviço global');
            
            // Disparar evento para notificar componentes
            try {
              eventService.dispatchEvent({
                type: 'roulette:data-updated',
                data: {
                  source: 'initial-load',
                  timestamp: new Date().toISOString()
                }
              });
            } catch (eventError) {
              logger.error('Erro ao disparar evento após inicialização:', eventError);
            }
            
            // Iniciar polling com intervalo de 10 segundos
            try {
              rouletteFeedService.startPolling();
              logger.info('Polling de roletas iniciado (intervalo de 10s)');
            } catch (pollingError) {
              logger.error('Erro ao iniciar polling:', pollingError);
            }
          }).catch(initError => {
            logger.error('Erro ao inicializar RouletteFeedService:', initError);
          });
        } catch (initialDataError) {
          logger.error('Erro ao processar dados iniciais:', initialDataError);
        }
      }).catch(error => {
        logger.error('Erro ao buscar dados iniciais pelo serviço global:', error);
      });
    } catch (globalServiceError) {
      logger.error('Erro ao chamar fetchRouletteData do serviço global:', globalServiceError);
    }
    
    // Marcar como inicializado, mesmo com erros para permitir que a aplicação continue
    window.ROULETTE_SYSTEM_INITIALIZED = true;
    
    // Adicionar função para limpar recursos quando a página for fechada
    window.addEventListener('beforeunload', () => {
      try {
        rouletteFeedService.stop();
      } catch (stopError) {
        // Não logar erro no momento de fechamento da página
      }
      window.ROULETTE_SYSTEM_INITIALIZED = false;
      logger.info('Sistema de roletas finalizado');
    });
    
    return {
      socketService,
      rouletteFeedService,
      eventService,
      globalRouletteDataService
    };
  } catch (systemError) {
    logger.error('Erro crítico na inicialização do sistema de roletas:', systemError);
    
    // Criar implementação vazia para permitir que o aplicativo continue funcionando
    const dummyEmitter = new EventEmitter();
    
    // Retornar implementação mínima para evitar erros em cascata
    return {
      socketService: {
        loadHistoricalRouletteNumbers: async () => false,
        isConnected: () => false,
        on: () => () => {},
        subscribe: () => () => {},
        unsubscribe: () => {},
        emitter: dummyEmitter
      },
      rouletteFeedService: {
        registerSocketService: () => {},
        initialize: async () => {},
        startPolling: () => {},
        stop: () => {},
        emitter: dummyEmitter
      },
      eventService: EventService.getInstance(),
      globalRouletteDataService
    };
  }
}

// Inicializar serviços com tratamento de erro
function initializeServices() {
  try {
    console.log('[Main] Inicializando serviços globais...');
    
    // Inicializar o serviço global de dados de roletas
    try {
      globalRouletteDataService.fetchRouletteData().then(data => {
        console.log('[Main] Dados iniciais carregados pelo GlobalRouletteDataService:', 
                    data ? `${data.length} roletas` : 'Nenhum dado disponível');
      }).catch(error => {
        console.error('[Main] Erro ao carregar dados iniciais:', error);
      });
    } catch (routletteServiceError) {
      console.error('[Main] Erro ao inicializar GlobalRouletteDataService:', routletteServiceError);
    }
    
    // Inicializar o SocketService com tratamento de erros
    try {
      console.log('[Main] Inicializando SocketService antes do render...');
      
      // Importação dinâmica para evitar erros de dependência cíclica
      import('./services/RESTSocketService').then(module => {
        try {
          const socketService = module.default.getInstance();
          console.log('[Main] SocketService inicializado com sucesso');
          
          // Verificar se o serviço está operacional
          if (socketService && socketService.isConnected) {
            console.log('[Main] SocketService conectado:', socketService.isConnected());
          } else {
            console.warn('[Main] SocketService inicializado mas não está conectado');
          }
        } catch (socketError) {
          console.error('[Main] Falha ao inicializar o SocketService:', socketError);
          // Não bloquear a inicialização do aplicativo em caso de erro
        }
      }).catch(importError => {
        console.error('[Main] Erro ao importar RESTSocketService:', importError);
      });
    } catch (error) {
      console.error('[Main] Erro fatal ao configurar SocketService:', error);
    }
    
    console.log('[Main] Inicialização dos serviços globais concluída');
  } catch (error) {
    console.error('[Main] Erro crítico na inicialização de serviços:', error);
    // Continuar a execução da aplicação mesmo com erro nos serviços
  }
}

// Chamar inicialização dos serviços
initializeServices();

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

// Iniciar pré-carregamento de dados históricos de forma segura
logger.info('Iniciando pré-carregamento de dados históricos...');
try {
  const loadHistorico = async () => {
    try {
      // Acessar o socketService do sistema de roletas
      const socketServiceInstance = rouletteSystem?.socketService;
      
      // Verificar se socketService está disponível antes de usar
      if (socketServiceInstance && typeof socketServiceInstance.loadHistoricalRouletteNumbers === 'function') {
        try {
          await socketServiceInstance.loadHistoricalRouletteNumbers();
          logger.info('Dados históricos carregados com sucesso');
          return true;
        } catch (loadError) {
          logger.error('Erro ao pré-carregar dados históricos:', loadError);
          return false;
        }
      } else {
        logger.warn('Socket principal não disponível, tentando método alternativo...');
        
        // Tentar importar RESTSocketService e usá-lo diretamente
        try {
          const RESTSocketServiceModule = await import('./services/RESTSocketService');
          const restSocketService = RESTSocketServiceModule.default.getInstance();
          
          if (restSocketService && typeof restSocketService.loadHistoricalRouletteNumbers === 'function') {
            try {
              await restSocketService.loadHistoricalRouletteNumbers();
              logger.info('Dados históricos carregados via serviço REST alternativo');
              return true;
            } catch (restLoadError) {
              logger.error('Erro ao pré-carregar dados históricos via REST:', restLoadError);
              return false;
            }
          } else {
            logger.warn('Serviço REST alternativo não implementa loadHistoricalRouletteNumbers');
            return false;
          }
        } catch (importRestError) {
          logger.error('Erro ao importar RESTSocketService alternativo:', importRestError);
          
          // Última tentativa: usar o serviço global diretamente
          try {
            const data = await globalRouletteDataService.fetchDetailedRouletteData();
            logger.info('Dados históricos obtidos diretamente do serviço global');
            return Boolean(data && Array.isArray(data) && data.length > 0);
          } catch (globalDataError) {
            logger.error('Todas as tentativas de carregar dados históricos falharam');
            return false;
          }
        }
      }
    } catch (outerError) {
      logger.error('Erro crítico no carregamento de histórico:', outerError);
      return false;
    }
  };
  
  // Executar carregamento depois de um pequeno atraso para permitir que outros serviços inicializem
  setTimeout(() => {
    loadHistorico().then(success => {
      logger.info(`Carregamento de dados históricos ${success ? 'bem-sucedido' : 'falhou'}`);
    }).catch(err => {
      logger.error('Erro inesperado durante carregamento de histórico:', err);
    });
  }, 2000);
} catch (globalHistoricoError) {
  logger.error('Erro fatal na inicialização do carregamento de histórico:', globalHistoricoError);
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
        <!-- From Uiverse.io by vikas7754 -->
        <div class="glowing-cube">
          <div class="top"></div>
          <div>
            <span style="--i:0;"></span>
            <span style="--i:1;"></span>
            <span style="--i:2;"></span>
            <span style="--i:3;"></span>
          </div>
        </div>
        <style>
          /* From Uiverse.io by vikas7754 */
          .glowing-cube {
            position: relative;
            width: 150px;
            height: 150px;
            transform-style: preserve-3d;
            animation: cube-rotate 4s linear infinite;
          }

          @keyframes cube-rotate {
            0% {
              transform: rotatex(-30deg) rotatey(0deg);
            }

            100% {
              transform: rotatex(-30deg) rotatey(360deg);
            }
          }

          .glowing-cube div {
            position: absolute;
            inset: 0;
            transform-style: preserve-3d;
          }

          .glowing-cube div span {
            position: absolute;
            inset: 0;
            background: linear-gradient(#151515, #3aff5e);
            transform: rotatey(calc(90deg * var(--i))) translatez(calc(150px / 2));
          }

          .glowing-cube .top {
            position: absolute;
            inset: 0;
            background: #222;
            transform: rotatex(90deg) translatez(calc(150px / 2));
            display: flex;
            justify-content: center;
            align-items: center;
            color: #ffffff;
            font-size: 7rem;
          }

          .glowing-cube .top::before {
            content: '';
            position: absolute;
            width: 100%;
            height: 100%;
            background-image: url('/assets/icon-rabbit.svg');
            background-size: 80px;
            background-position: center;
            background-repeat: no-repeat;
            display: flex;
            justify-content: center;
            align-items: center;
          }

          .glowing-cube .top::after {
            content: '';
            position: absolute;
            background: #3aff5e;
            inset: 0;
            transform: translatez(calc(0px - calc(150px + 100px)));
            filter: blur(30px);
            box-shadow: 0 0 120px rgba(58, 134, 255, 0.2),
              0 0 200px rgba(58, 134, 255, 0.4),
              0 0 300px #00ff2f,
              0 0 400px #51fd71,
              0 0 500px #3aff5e;
          }
        </style>
        <p style="margin-top: 20px; font-size: 16px;">Inicializando sistema...</p>
      </div>
    </div>
  `;
  
  // Sistema de recuperação de erros para garantir que a interface seja renderizada
  let appRenderAttempted = false;
  
  // Função para renderizar o aplicativo com tratamento de erros
  const renderApp = () => {
    try {
      if (appRenderAttempted) {
        logger.warn('Tentativa de renderizar o aplicativo mais de uma vez ignorada');
        return;
      }
      
      appRenderAttempted = true;
      logger.info('Renderizando aplicativo React...');
      
      // Criar root React e renderizar o aplicativo
      try {
        createRoot(rootElement).render(<App />);
        logger.info('Aplicativo renderizado com sucesso');
      } catch (renderError) {
        logger.error('Erro crítico ao renderizar React App:', renderError);
        
        // Mostrar uma mensagem de erro amigável para o usuário
        rootElement.innerHTML = `
          <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; background-color: #1a1a1a; color: #f0f0f0; padding: 20px; text-align: center;">
            <h2>Ops! Algo deu errado.</h2>
            <p>Não foi possível carregar a aplicação corretamente.</p>
            <p>Por favor, tente recarregar a página ou verifique sua conexão com a internet.</p>
            <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background-color: #3aff5e; color: #000; border: none; border-radius: 4px; cursor: pointer;">
              Recarregar
            </button>
          </div>
        `;
      }
    } catch (e) {
      logger.error('Erro grave durante tentativa de renderização:', e);
    }
  };
  
  // Aguardar um pequeno intervalo para dar tempo à conexão de ser estabelecida
  const renderTimeout = setTimeout(() => {
    renderApp();
  }, 2000);
  
  // Garantir que renderizamos mesmo se ocorrer algum outro erro
  window.addEventListener('load', () => {
    // Se ainda não renderizamos após 5 segundos, força a renderização
    const forceRenderTimeout = setTimeout(() => {
      if (!appRenderAttempted) {
        logger.warn('Forçando renderização do aplicativo após timeout');
        clearTimeout(renderTimeout); // Limpar o outro timer se ainda estiver pendente
        renderApp();
      }
    }, 5000);
  });
} else {
  logger.error('Elemento root não encontrado!');
}
