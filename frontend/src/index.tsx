import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Inicialização do cliente SSE centralizado
// Esta função deve ser chamada antes de qualquer componente React ser renderizado
async function initializeCentralizedSSE() {
  try {
    console.log('[Main] Estabelecendo conexão SSE única centralizada...');
    
    // Importar dinamicamente o RouletteStreamClient
    const { default: RouletteStreamClient } = await import('./utils/RouletteStreamClient');
    
    // Obter a instância e iniciar a conexão
    const client = RouletteStreamClient.getInstance();
    const connected = await client.connect();
    
    if (connected) {
      console.log('[Main] Conexão SSE centralizada estabelecida com sucesso');
    } else {
      console.warn('[Main] Não foi possível estabelecer conexão SSE centralizada, componentes usarão conexão sob demanda');
    }
    
    return true;
  } catch (error) {
    console.error('[Main] Erro ao inicializar conexão SSE centralizada:', error);
    return false;
  }
}

// Inicializar a conexão SSE antes de renderizar a aplicação
initializeCentralizedSSE().then(() => {
  // Renderizar a aplicação React após inicialização do SSE
  const container = document.getElementById('root');
  if (container) {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
}); 