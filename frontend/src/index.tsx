import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from './context/AuthContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { NotificationsProvider } from './context/NotificationsContext';
import UnifiedRouletteClient from './services/UnifiedRouletteClient';

console.log('[Main] Inicializando UnifiedRouletteClient antes do render...');

// Obter uma única instância global que será compartilhada por toda a aplicação
const unifiedClient = UnifiedRouletteClient.getInstance();

// Verificar se há conexões SSE existentes e limpar
console.log('[Main] Verificando e limpando conexões SSE existentes...');
const existingEventSources = Object.keys(window)
  .filter(key => window[key as keyof Window] instanceof EventSource)
  .map(key => window[key as keyof Window] as EventSource);

console.log(`[Main] ${existingEventSources.length} conexões EventSource limpas`);

// Estabelecer uma única conexão SSE compartilhada
console.log('[Main] Estabelecendo conexão SSE única...');
unifiedClient.connectStream();

// Inicializar renderização da aplicação
console.log('[Main] Inicializando componentes da aplicação...');

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <NotificationsProvider>
              <App />
            </NotificationsProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
); 