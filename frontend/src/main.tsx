import { createRoot } from 'react-dom/client'
import React from 'react'
import App from './App'
import './index.css'
import { initializeLogging } from './services/utils/initLogger'
import { getLogger } from './services/utils/logger'
import { setupGlobalErrorHandlers } from './utils/error-handlers'
import EventService from './services/EventService'
import cryptoService from './utils/crypto-service'
import { UnifiedRouletteClient } from './services/UnifiedRouletteClient'

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
const logger = getLogger('Main');

// Configurar manipuladores globais de erro
setupGlobalErrorHandlers();

// Flag global para controlar a inicialização do sistema de roletas
window.ROULETTE_SYSTEM_INITIALIZED = false;

// Simplificar inicialização: Apenas instanciar o UnifiedRouletteClient
function initializeRoulettesSystem() {
  logger.info('Inicializando UnifiedRouletteClient como fonte única de dados...');
  
  try {
    // Obter a instância singleton do UnifiedRouletteClient
    // Ele se conectará automaticamente ao stream SSE no construtor
    const client = UnifiedRouletteClient.getInstance({
      enableLogging: true, // Manter logs do cliente unificado
      autoConnect: true // Garantir que ele se conecte
    });

    // O UnifiedRouletteClient já emite eventos no EventBus, 
    // não precisamos disparar eventos manualmente aqui.

    logger.info('UnifiedRouletteClient inicializado e conexão SSE deve ser estabelecida.');
    
    // Marcar como inicializado
    window.ROULETTE_SYSTEM_INITIALIZED = true;

    // TODO: Verificar se SocketService ainda é necessário ou se pode ser removido/refatorado
    // logger.info('Inicializando SocketService (se ainda necessário)...');
    // const socketService = SocketService.getInstance(); 

  } catch (error) {
    logger.error('Erro ao inicializar UnifiedRouletteClient:', error);
    window.ROULETTE_SYSTEM_INITIALIZED = false;
  }
}

// Função para verificar a saúde da API (pode ser mantida)
async function checkAPIHealth() {
  try {
    logger.info('Verificando saúde da API em: /api/health');
    const response = await fetch('/api/health');
    if (response.ok) {
      logger.info(`✅ API saudável, resposta de /api/health: ${response.status}`);
    } else {
      logger.warn(`⚠️ API pode estar com problemas, resposta de /api/health: ${response.status}`);
    }
  } catch (error) {
    logger.error('❌ Erro ao verificar saúde da API:', error);
  }
}

// Inicializar sistema de roletas e verificar saúde da API
initializeRoulettesSystem();
checkAPIHealth();

// Setup da chave de acesso (pode ser mantido)
try {
  logger.info('Configurando chave de acesso para descriptografia...');
  cryptoService.setupAccessKey(); // Tenta configurar a chave
  logger.info('[CryptoService] Verificação de chave: Chave configurada com sucesso');
} catch (error: any) {
  logger.error('[CryptoService] Erro na configuração da chave:', error.message);
  // Não ativar modo dev automaticamente, UnifiedRouletteClient não usa mais descriptografia
  // logger.warn('[App] Nenhuma chave de descriptografia funcionou, verificar configuração.');
}

// --- Renderização do App React ---
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  logger.error('Container React #root não encontrado no DOM');
}

// Expor funções globais (se necessário para depuração ou legado)
window.isRouletteSystemInitialized = () => window.ROULETTE_SYSTEM_INITIALIZED;
window.getRouletteSystem = () => {
  if (!window.ROULETTE_SYSTEM_INITIALIZED) return null;
  return {
    // Retornar apenas o cliente unificado
    unifiedClient: UnifiedRouletteClient.getInstance(),
    eventService: EventService.getInstance(),
    // socketService: SocketService.getInstance() // Se mantido
  };
};
