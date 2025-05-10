import { createRoot } from 'react-dom/client'
import React from 'react'
import App from './App'
import './index.css'
import SocketService from './services/SocketService'
import { initializeLogging } from './services/utils/initLogger'
import { getLogger } from './services/utils/logger'
import { setupGlobalErrorHandlers } from './utils/error-handlers'
import RouletteFeedService from './services/RouletteFeedService'
import { EventService } from './services/EventService'
import globalRouletteDataService from './services/GlobalRouletteDataService'
import cryptoService from './utils/crypto-service'

// Declarar as propriedades globais no window
declare global {
  interface Window {
    ROULETTE_SYSTEM_INITIALIZED: boolean;
    isRouletteSystemInitialized: () => boolean;
    initializeRouletteSystem: () => Promise<any>;
    getRouletteSystem: () => any;
    __rouletteEventService: any;
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

// Registrar o EventService no window para debugging
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__rouletteEventService = EventService;
}

// Registrar um manipulador global de erros para capturar problemas de inicialização
window.addEventListener('error', (event) => {
  console.error('Erro global capturado:', event.error);
  
  // Tentar registrar no serviço de eventos se estiver disponível
  if (EventService && typeof EventService.emit === 'function') {
    EventService.emit('error:global', {
      message: event.message,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error?.toString(),
      stack: event.error?.stack,
      timestamp: new Date().toISOString()
    });
  }
});

// Inicializar o sistema de roletas
async function initializeRoulettesSystem() {
  console.log('Iniciando sistema de roletas...');
  
  try {
    // Usar a inicialização global
    if (typeof window.initializeRouletteSystem === 'function') {
      return await window.initializeRouletteSystem();
    } else {
      console.error('Função de inicialização não encontrada');
      return null;
    }
  } catch (error) {
    console.error('Falha ao inicializar sistema de roletas:', error);
    return null;
  }
}

// Definir função helper para verificar se o sistema está inicializado
window.isRouletteSystemInitialized = () => {
  return !!window.ROULETTE_SYSTEM_INITIALIZED;
};

// Função auxiliar para obter a instância do RouletteFeedService
function getRouletteFeedInstance() {
  return RouletteFeedService.getInstance();
}

// Encapsular código com await em uma função auto-invocável
(async function() {
  // Informa ao usuário que a conexão está sendo estabelecida
  logger.info('Conexão com o servidor sendo estabelecida em background...');

  try {
    // Inicializar o EventService
    logger.info('Verificando disponibilidade do EventService...');
    if (!EventService) {
      logger.error('EventService não disponível. Criando fallback interno.');
      // Não fazer nada, o sistema continuará com a inicialização
    } else {
      logger.info('EventService disponível e inicializado.');
    }

    // Inicializar o cliente de roletas no início para estabelecer conexão antecipada
    logger.info('Inicializando UnifiedRouletteClient antes do render...');
    try {
      const { default: UnifiedRouletteClient } = await import('./services/UnifiedRouletteClient');
      if (typeof UnifiedRouletteClient?.getInstance !== 'function') {
        throw new Error('UnifiedRouletteClient não possui método getInstance');
      }
      
      const unifiedClient = UnifiedRouletteClient.getInstance({
        streamingEnabled: true,
        autoConnect: true
      }); // Inicia a conexão
      
      // Verificar saúde da API, mas não bloquear a inicialização se falhar
      if (typeof unifiedClient.checkAPIHealth === 'function') {
        unifiedClient.checkAPIHealth().catch(error => {
          logger.warn('Verificação de saúde da API falhou, mas continuando inicialização:', error);
        });
      }
      
      logger.info('UnifiedRouletteClient inicializado com sucesso.');
    } catch (error) {
      logger.error('Falha ao inicializar UnifiedRouletteClient:', error);
      // Continuar com a inicialização mesmo com erro
    }

    // Inicializar o sistema de roletas como parte do carregamento da aplicação
    logger.info('Inicializando sistema de roletas de forma centralizada...');
    try {
      const rouletteSystem = await initializeRoulettesSystem();
      // Expor globalmente a função para verificar se o sistema foi inicializado
      window.isRouletteSystemInitialized = () => window.ROULETTE_SYSTEM_INITIALIZED;
      window.getRouletteSystem = () => rouletteSystem;
      logger.info('Sistema de roletas inicializado com sucesso.');
    } catch (error) {
      logger.error('Falha ao inicializar sistema de roletas, continuando sem ele:', error);
      // Definir função fallback
      window.isRouletteSystemInitialized = () => false;
      window.getRouletteSystem = () => null;
    }

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

    // Inicializar serviço de descriptografia
    console.log('[Main] Configurando chave de acesso para descriptografia...');
    try {
      if (typeof cryptoService?.setupAccessKey === 'function') {
        cryptoService.setupAccessKey();
        
        // Tentar inicializar as chaves comuns para descriptografia
        console.log('[App] Inicializando sistema de criptografia');
        const keyFound = false; // tryCommonKeys removido

        // Se nenhuma chave funcionar, ativar o modo de desenvolvimento
        if (!keyFound && typeof cryptoService?.enableDevMode === 'function') {
          console.warn('[App] Nenhuma chave de descriptografia funcionou, ativando modo de desenvolvimento');
          cryptoService.enableDevMode(true);
        }
      } else {
        console.warn('[Main] cryptoService.setupAccessKey não é uma função válida.');
      }
    } catch (error) {
      console.error('[Main] Erro ao configurar chave de acesso para descriptografia:', error);
    }
  } catch (error) {
    logger.error('Erro crítico durante inicialização:', error);
  }
})();

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
      </div>
    </div>
  `;
  
  // Aguardar um pequeno intervalo para dar tempo à conexão de ser estabelecida
  setTimeout(() => {
    createRoot(rootElement).render(<App />);
  }, 1500);
} else {
  logger.error('Elemento root não encontrado!');
}

// Inicializar o sistema de roletas como parte do carregamento da aplicação
window.initializeRouletteSystem = async () => {
  try {
    // Inicializar apenas se ainda não estiver inicializado
    if (window.ROULETTE_SYSTEM_INITIALIZED) {
      console.log('Sistema de roletas já inicializado. Ignorando chamada.');
      return getRouletteFeedInstance();
    }
    
    console.log('Inicializando sistema centralizado de roletas...');
    
    // Primeiro confirmar que o EventService está disponível
    if (!EventService) {
      console.error('EventService não está disponível. Inicialização abortada.');
      throw new Error('EventService não está disponível');
    }
    
    // Inicializar singleton do RouletteFeedService
    const rouletteFeedService = getRouletteFeedInstance();
    
    // Inicializar serviço de cache global
    const rouletteDataService = globalRouletteDataService;
    
    console.log('Serviços de roleta inicializados com sucesso.');
    
    // Definir função helper para recuperar o sistema
    window.getRouletteSystem = () => ({
      rouletteFeedService,
      rouletteDataService,
      cryptoService,
      EventService
    });
    
    // Marcar como inicializado
    window.ROULETTE_SYSTEM_INITIALIZED = true;
    
    return rouletteFeedService;
  } catch (error) {
    console.error('Erro ao inicializar sistema de roletas:', error);
    throw error;
  }
};
