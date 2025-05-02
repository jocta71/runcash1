import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import 'virtual:uno.css'
import { AuthProvider } from './context/AuthContext'
import RESTSocketService from './services/RESTSocketService'

// Inicializar serviços 
const socketService = RESTSocketService.getInstance();

// Tempo para pré-carregar dados (1.5 segundos)
const PRELOAD_TIME = 1500;

// Função para pré-carregar dados de roletas
const preloadRouletteData = async () => {
  try {
    console.log('📊 Pré-carregando dados de roletas...');
    
    // Iniciar carregamento dos dados via Socket
    if (socketService) {
      console.log('🔄 Iniciando serviço de socket para dados em tempo real');
      
      // Pré-carregar dados das roletas antes de renderizar o aplicativo
      await socketService.requestRecentNumbers();
      
      // Também carregar histórico de números
      await socketService.loadHistoricalRouletteNumbers();
    }
    
    console.log('✅ Dados de roletas pré-carregados com sucesso!');
    renderApp();
  } catch (error) {
    console.error('❌ Erro ao pré-carregar dados de roletas:', error);
    console.log('🔄 Renderizando aplicativo mesmo com erro de pré-carregamento');
    renderApp();
  }
};

// Função para renderizar o aplicativo
const renderApp = () => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
};

// Iniciar pré-carregamento de dados após um pequeno atraso
setTimeout(preloadRouletteData, PRELOAD_TIME);
