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
import globalRouletteDataService, { GlobalRouletteDataService } from './services/GlobalRouletteDataService'

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
  
  // Inicializar os serviços em ordem
  const socketService = SocketService.getInstance();
  const eventService = EventService.getInstance();
  const rouletteFeedService = RouletteFeedService.getInstance();
  
  // Registrar o SocketService no RouletteFeedService
  rouletteFeedService.registerSocketService(socketService);
  
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
    window.ROULETTE_SYSTEM_INITIALIZED = false;
    logger.info('Sistema de roletas finalizado');
  });
  
  return {
    socketService,
    rouletteFeedService,
    eventService,
    globalRouletteDataService
  };
}

// Inicializar o SocketService logo no início para estabelecer conexão antecipada
logger.info('Inicializando SocketService antes do render...');
const socketService = SocketService.getInstance(); // Inicia a conexão

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
socketService.loadHistoricalRouletteNumbers().catch(err => {
  logger.error('Erro ao pré-carregar dados históricos:', err);
});

// Expor globalmente a função para verificar se o sistema foi inicializado
window.isRouletteSystemInitialized = () => window.ROULETTE_SYSTEM_INITIALIZED;
window.getRouletteSystem = () => rouletteSystem;

const rootElement = document.getElementById("root");
if (rootElement) {
  // Adicionar elemento visual para indicar carregamento inicial
  rootElement.innerHTML = `
    <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #1a1a1a; color: #f0f0f0;">
      <div style="text-align: center;">
        <div style="width: 150px; height: 150px; position: relative; transform-style: preserve-3d; animation: cube-rotate 4s linear infinite; margin: 0 auto;">
          <div style="position: absolute; inset: 0; background: #222; transform: rotatex(90deg) translatez(75px); display: flex; justify-content: center; align-items: center;">
            <span style="font-size: 50px;">🐰</span>
          </div>
          <div style="position: absolute; inset: 0; transform-style: preserve-3d;">
            <span style="position: absolute; inset: 0; background: linear-gradient(#151515, #3aff5e); transform: rotatey(0deg) translatez(75px);"></span>
            <span style="position: absolute; inset: 0; background: linear-gradient(#151515, #3aff5e); transform: rotatey(90deg) translatez(75px);"></span>
            <span style="position: absolute; inset: 0; background: linear-gradient(#151515, #3aff5e); transform: rotatey(180deg) translatez(75px);"></span>
            <span style="position: absolute; inset: 0; background: linear-gradient(#151515, #3aff5e); transform: rotatey(270deg) translatez(75px);"></span>
          </div>
          <div style="position: absolute; inset: 0; background: #222; transform: rotatex(90deg) translatez(75px);">
            <div style="content: ''; position: absolute; background: #3aff5e; inset: 0; transform: translatez(-250px); filter: blur(30px); box-shadow: 0 0 120px rgba(58, 134, 255, 0.2), 0 0 200px rgba(58, 134, 255, 0.4), 0 0 300px #00ff2f, 0 0 400px #51fd71, 0 0 500px #3aff5e;"></div>
          </div>
        </div>
      </div>
    </div>
    <style>
      @keyframes cube-rotate {
        0% { transform: rotatex(-30deg) rotatey(0deg); }
        100% { transform: rotatex(-30deg) rotatey(360deg); }
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
