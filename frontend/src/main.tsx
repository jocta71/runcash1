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
import cryptoService from './utils/crypto-service'
import UnifiedRouletteClient from './services/UnifiedRouletteClient'

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
  
  // Garantir que temos apenas uma instância do cliente
  const unifiedClient = (window as any)._unifiedRouletteClientInstance || 
                        UnifiedRouletteClient.getInstance({
                          streamingEnabled: true,
                          autoConnect: false // Inicialmente desabilitado para evitar múltiplas conexões
                        });
  
  // Armazenar globalmente para referência
  (window as any)._unifiedRouletteClientInstance = unifiedClient;
  
  // Inicializar outros serviços
  const eventService = EventService.getInstance();
  const rouletteFeedService = RouletteFeedService.getInstance();
  
  // Registrar o UnifiedRouletteClient no RouletteFeedService (compatibilidade)
  rouletteFeedService.registerSocketService(unifiedClient);
  
  // Garantir que temos apenas uma conexão SSE
  const diagnostics = unifiedClient.diagnoseConnectionState();
  logger.info(`Estado atual das conexões: ${diagnostics.GLOBAL_SSE_CONNECTIONS_COUNT} conexões ativas`);
  
  if (diagnostics.GLOBAL_SSE_CONNECTIONS_COUNT === 0) {
    logger.info('Estabelecendo conexão SSE única para todos os componentes...');
    try {
      await unifiedClient.connectStream();
      logger.info('Conexão SSE estabelecida com sucesso.');
    } catch (error) {
      logger.error('Erro ao estabelecer conexão SSE:', error);
    }
  } else {
    logger.info(`Já existem ${diagnostics.GLOBAL_SSE_CONNECTIONS_COUNT} conexões SSE ativas. Usando conexões existentes.`);
  }
  
  // Inicializar o serviço de feed e buscar dados iniciais uma única vez
  logger.info('Inicializando serviço de feed e realizando única busca de dados de roletas...');
  unifiedClient.fetchRouletteData().then(data => {
    logger.info(`Dados iniciais obtidos pelo UnifiedRouletteClient: ${data.length} roletas`);
    
    rouletteFeedService.initialize().then(() => {
      logger.info('RouletteFeedService inicializado usando dados do UnifiedRouletteClient');
      
      // Disparar evento para notificar componentes
      eventService.dispatchEvent({
        type: 'roulette:data-updated',
        data: {
          source: 'initial-load',
          timestamp: new Date().toISOString()
        }
      });
      
      // Iniciar polling apenas como fallback se o streaming falhar
      if (!unifiedClient.getStatus().isStreamConnected) {
        logger.info('Streaming não conectado, iniciando polling como fallback (intervalo de 10s)');
        rouletteFeedService.startPolling();
      } else {
        logger.info('Streaming conectado, polling não será iniciado');
      }
    }).catch(error => {
      logger.error('Erro ao inicializar RouletteFeedService:', error);
    });
  }).catch(error => {
    logger.error('Erro ao buscar dados iniciais pelo UnifiedRouletteClient:', error);
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
    rouletteFeedService,
    eventService,
    unifiedClient
  };
}

// Encapsular código com await em uma função auto-invocável
(async function() {
  // Informa ao usuário que a conexão está sendo estabelecida
  logger.info('Conexão com o servidor sendo estabelecida em background...');

  // Função para limpar todas as conexões EventSource existentes
  const cleanupExistingEventSources = async () => {
    logger.info('Verificando e limpando conexões SSE existentes...');
    let count = 0;
    
    // Verificar conexões EventSource que possam estar em propriedades globais
    if (typeof window !== 'undefined') {
      // Tentar fechar qualquer conexão EventSource que possa estar ativa
      try {
        // 1. Verificar objetos globais conhecidos que possam ter referências a EventSource
        const globalObj = window as any;
        
        // 2. Tentar encontrar EventSource em _eventSourceInstances (se existir)
        if (globalObj._eventSourceInstances && Array.isArray(globalObj._eventSourceInstances)) {
          globalObj._eventSourceInstances.forEach((es: any) => {
            try {
              if (es && typeof es.close === 'function') {
                es.close();
                count++;
                logger.info('EventSource fechado de _eventSourceInstances');
              }
            } catch (e) {
              logger.error('Erro ao fechar EventSource:', e);
            }
          });
          globalObj._eventSourceInstances = [];
        }
        
        // 3. Verificar a presença de conexões SSE específicas por URL conhecida
        const checkAndCloseSSE = (url: string) => {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', `${url}/check-connection`, false); // Chamada síncrona
          xhr.send(null);
          // Se a conexão existir, o servidor pode retornar um status indicando isso
          return xhr.status === 200;
        };
        
        // Lista de URLs base conhecidas para verificar
        const knownSSEUrls = [
          'https://starfish-app-fubxw.ondigitalocean.app/api/stream/roulettes'
        ];
        
        knownSSEUrls.forEach(url => {
          try {
            // Apenas verificar, não fechar diretamente (a verificação pode não ser confiável)
            logger.info(`Verificando conexão SSE para: ${url}`);
            const exists = checkAndCloseSSE(url);
            if (exists) {
              logger.info(`Conexão existente detectada para ${url}`);
            }
          } catch (e) {
            logger.error(`Erro ao verificar SSE para ${url}:`, e);
          }
        });
      } catch (e) {
        logger.error('Erro durante verificação de conexões SSE:', e);
      }
    }
    
    logger.info(`${count} conexões EventSource detectadas e limpas`);
    
    // Adicionar um atraso maior para garantir que as conexões sejam completamente fechadas
    return new Promise<void>(resolve => setTimeout(resolve, 1000));
  };
  
  // Limpar conexões existentes
  await cleanupExistingEventSources();

  // Inicializar o cliente de roletas no início para estabelecer conexão antecipada
  logger.info('Inicializando UnifiedRouletteClient antes do render...');
  const { default: UnifiedRouletteClient } = await import('./services/UnifiedRouletteClient');

  // Inspeção explícita de conexões existentes
  logger.info('Verificando se já existe uma instância do UnifiedRouletteClient...');
  const existingInstance = (window as any)._unifiedRouletteClientInstance;
  let unifiedClient;

  if (existingInstance && typeof existingInstance.diagnoseConnectionState === 'function') {
    logger.info('Reutilizando instância existente do UnifiedRouletteClient');
    unifiedClient = existingInstance;
    
    // Diagnosticar estado atual da conexão
    const diagnostics = unifiedClient.diagnoseConnectionState();
    logger.info(`Estado atual das conexões: ${diagnostics.GLOBAL_SSE_CONNECTIONS_COUNT} conexões ativas`);
    
    // Se já houver conexões ativas, não criar outra
    if (diagnostics.GLOBAL_SSE_CONNECTIONS_COUNT === 0) {
      logger.info('Nenhuma conexão SSE ativa encontrada. Estabelecendo nova conexão...');
      await unifiedClient.connectStream();
    } else {
      logger.info('Conexões SSE já existentes encontradas. Não criando nova conexão.');
    }
  } else {
    // Criar nova instância com autoConnect desabilitado para controlar manualmente
    logger.info('Criando nova instância do UnifiedRouletteClient...');
    unifiedClient = UnifiedRouletteClient.getInstance({
      streamingEnabled: true,
      autoConnect: false
    });
    
    // Armazenar globalmente para referência futura
    (window as any)._unifiedRouletteClientInstance = unifiedClient;
    
    // Estabelecer conexão SSE única explicitamente
    logger.info('Estabelecendo conexão SSE única...');
    await unifiedClient.connectStream();
  }

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
  unifiedClient.fetchRouletteData().catch(err => {
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
