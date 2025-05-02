import React, { ErrorInfo, ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import RESTSocketService from './services/RESTSocketService'

// Componente para capturar erros de renderização
class ErrorBoundary extends React.Component<
  { children: ReactNode, fallback?: ReactNode },
  { hasError: boolean, error: Error | null }
> {
  constructor(props: { children: ReactNode, fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    // Registrando erro no método estático
    console.error('ErrorBoundary capturou um erro:', error.message);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log mais detalhado para diagnóstico
    console.error('Erro detalhado na aplicação:', {
      mensagem: error.message,
      stack: error.stack,
      componente: errorInfo.componentStack,
      tipo: error.name
    });

    // Se disponível, registrar em um serviço de monitoramento
    if (window.navigator && window.navigator.userAgent) {
      console.info('Ambiente do usuário:', window.navigator.userAgent);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h1>Algo deu errado</h1>
          <p>Ocorreu um erro ao carregar a aplicação. Por favor, tente novamente mais tarde.</p>
          <details style={{ marginTop: '20px', textAlign: 'left', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
            <summary>Detalhes do erro (técnico)</summary>
            <p><strong>Mensagem:</strong> {this.state.error?.message || 'Erro desconhecido'}</p>
            <pre style={{ overflow: 'auto' }}>{this.state.error?.stack}</pre>
          </details>
          <button 
            onClick={() => window.location.reload()} 
            style={{ 
              marginTop: '20px', 
              padding: '10px 15px', 
              background: '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Tentar Novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Inicializar serviços com tratamento de erros e logs detalhados
let socketService: any = null;

try {
  console.log('🔄 Iniciando RESTSocketService...');
  socketService = RESTSocketService.getInstance();
  console.log('✅ RESTSocketService inicializado com sucesso');
} catch (error) {
  console.error('❌ Erro ao inicializar RESTSocketService:', error);
  // Registrar detalhes adicionais do erro
  if (error instanceof Error) {
    console.error('Detalhes do erro:', {
      mensagem: error.message,
      stack: error.stack,
      tipo: error.name
    });
  }
}

// Tempo para pré-carregar dados (1.5 segundos)
const PRELOAD_TIME = 1500;

// Função para pré-carregar dados de roletas com tratamento de erros
const preloadRouletteData = async () => {
  try {
    console.log('📊 Pré-carregando dados de roletas...');
    
    // Iniciar carregamento dos dados via Socket
    if (socketService) {
      console.log('🔄 Iniciando serviço de socket para dados em tempo real');
      
      try {
        // Pré-carregar dados das roletas antes de renderizar o aplicativo
        await socketService.requestRecentNumbers();
        
        // Também carregar histórico de números
        await socketService.loadHistoricalRouletteNumbers();
        
        console.log('✅ Dados de roletas pré-carregados com sucesso!');
      } catch (socketError) {
        console.error('⚠️ Erro ao pré-carregar dados via socket:', socketError);
        // Log mais detalhado sobre o erro de socket
        if (socketError instanceof Error) {
          console.error('Detalhes do erro de socket:', {
            mensagem: socketError.message,
            stack: socketError.stack,
            tipo: socketError.name
          });
        }
        console.log('⚠️ Continuando sem dados iniciais...');
      }
    } else {
      console.warn('⚠️ Serviço de socket indisponível, inicializando sem dados');
    }
    
    renderApp();
  } catch (error) {
    console.error('❌ Erro ao pré-carregar dados de roletas:', error);
    // Log mais detalhado sobre o erro de pré-carregamento
    if (error instanceof Error) {
      console.error('Detalhes do erro de pré-carregamento:', {
        mensagem: error.message,
        stack: error.stack,
        tipo: error.name
      });
    }
    console.log('🔄 Renderizando aplicativo mesmo com erro de pré-carregamento');
    renderApp();
  }
};

// Função para renderizar o aplicativo com ErrorBoundary
const renderApp = () => {
  console.log('🚀 Iniciando renderização do aplicativo...');
  try {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <ErrorBoundary>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </ErrorBoundary>
      </React.StrictMode>,
    );
    console.log('✅ Aplicativo renderizado com sucesso!');
  } catch (error) {
    console.error('❌ Erro fatal ao renderizar aplicativo:', error);
    // Tentativa de renderização de fallback mínimo em caso de erro grave
    if (document.getElementById('root')) {
      document.getElementById('root')!.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <h1>Erro crítico ao iniciar aplicação</h1>
          <p>Não foi possível iniciar o aplicativo. Tente recarregar a página.</p>
          <button onclick="window.location.reload()" style="padding: 10px; margin-top: 20px;">
            Recarregar
          </button>
        </div>
      `;
    }
  }
};

// Iniciar pré-carregamento de dados após um pequeno atraso
console.log('⏱️ Agendando pré-carregamento de dados em', PRELOAD_TIME, 'ms');
setTimeout(preloadRouletteData, PRELOAD_TIME);
