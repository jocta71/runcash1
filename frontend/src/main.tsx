import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import SocketService from './services/SocketService';
import { initializeLogging } from './services/utils/initLogger';
import { getLogger } from './services/utils/logger';

// Inicializar o sistema de log
initializeLogging();

// Obter logger para o componente principal
const logger = getLogger('Main');

// Inicializar o SocketService logo no início para estabelecer conexão antecipada
logger.info('Inicializando SocketService antes do render...');
const socketService = SocketService.getInstance(); // Inicia a conexão

// Informa ao usuário que a conexão está sendo estabelecida
logger.info('Conexão com o servidor sendo estabelecida em background...');

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
