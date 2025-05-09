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
import cryptoService from './utils/crypto-service'

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
async function initializeRoulettesSystem() {
  logger.info('Inicializando sistema centralizado de roletas');
  
  // Inicializar os serviços em ordem
  const socketService = SocketService.getInstance();
  const eventService = EventService.getInstance();
  const rouletteFeedService = RouletteFeedService.getInstance();
  
  // Registrar o SocketService no RouletteFeedService
  rouletteFeedService.registerSocketService(socketService);
  
  // Inicializar o UnifiedRouletteClient diretamente para garantir conexão SSE
  const { default: UnifiedRouletteClient } = await import('./services/UnifiedRouletteClient');
  const unifiedClient = UnifiedRouletteClient.getInstance({
    streamingEnabled: true,
    autoConnect: true
  });
  
  // Forçar conexão com stream SSE
  unifiedClient.connectStream();
  
  // Inicializar o serviço global e buscar dados iniciais uma única vez
  logger.info('Inicializando serviço global e realizando única busca de dados de roletas...');
  
  // Usar a instância importada diretamente
  globalRouletteDataService.fetchRouletteData().then(data => {
    logger.info(`Dados iniciais obtidos pelo serviço global: ${data.length} roletas`);
    
    // Em seguida, inicializar o RouletteFeedService que usará os dados do serviço global
    rouletteFeedService.initialize().then(() => {
      logger.info('RouletteFeedService inicializado usando dados do serviço global');
      
      // Disparar evento para notificar componentes
      eventService.dispatchEvent({
        type: 'roulette:data-updated',
        data: {
          source: 'initial-load',
          timestamp: new Date().toISOString()
        }
      });
      
      // Iniciar polling com intervalo de 10 segundos
      rouletteFeedService.startPolling();
      logger.info('Polling de roletas iniciado (intervalo de 10s)');
    }).catch(error => {
      logger.error('Erro ao inicializar RouletteFeedService:', error);
    });
  }).catch(error => {
    logger.error('Erro ao buscar dados iniciais pelo serviço global:', error);
  });
  
  // Marcar como inicializado
  window.ROULETTE_SYSTEM_INITIALIZED = true;
  
  // Adicionar função para limpar recursos quando a página for fechada
  window.addEventListener('beforeunload', () => {
    rouletteFeedService.stop();
    unifiedClient.dispose();
    window.ROULETTE_SYSTEM_INITIALIZED = false;
    logger.info('Sistema de roletas finalizado');
  });
  
  return {
    socketService,
    rouletteFeedService,
    eventService,
    globalRouletteDataService,
    unifiedClient
  };
}

// Inicializar o SocketService logo no início para estabelecer conexão antecipada
logger.info('Inicializando SocketService antes do render...');
const socketService = SocketService.getInstance(); // Inicia a conexão

// Encapsular código com await em uma função auto-invocável
(async function() {
  // Informa ao usuário que a conexão está sendo estabelecida
  logger.info('Conexão com o servidor sendo estabelecida em background...');

  // Inicializar o sistema de roletas como parte do carregamento da aplicação
  logger.info('Inicializando sistema de roletas de forma centralizada...');
  const rouletteSystem = await initializeRoulettesSystem();

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
  socketService.loadHistoricalRouletteNumbers().catch(err => {
    logger.error('Erro ao pré-carregar dados históricos:', err);
  });

  // Expor globalmente a função para verificar se o sistema foi inicializado
  window.isRouletteSystemInitialized = () => window.ROULETTE_SYSTEM_INITIALIZED;
  window.getRouletteSystem = () => rouletteSystem;

  // Inicializar serviço de descriptografia
  console.log('[Main] Configurando chave de acesso para descriptografia...');
  cryptoService.setupAccessKey();

  // Tentar inicializar as chaves comuns para descriptografia
  console.log('[App] Inicializando sistema de criptografia');
  const keyFound = false; // tryCommonKeys removido

  // Se nenhuma chave funcionar, ativar o modo de desenvolvimento
  if (!keyFound) {
    console.warn('[App] Nenhuma chave de descriptografia funcionou, ativando modo de desenvolvimento');
    cryptoService.enableDevMode(true);
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
