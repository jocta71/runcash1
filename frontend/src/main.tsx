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
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Erro na aplicação:', error, errorInfo);
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
            <pre style={{ overflow: 'auto' }}>{this.state.error?.toString()}</pre>
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

// Inicializar serviços com tratamento de erros
let socketService: any = null;

try {
  socketService = RESTSocketService.getInstance();
  console.log('✅ RESTSocketService inicializado com sucesso');
} catch (error) {
  console.error('❌ Erro ao inicializar RESTSocketService:', error);
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
        console.error('⚠️ Erro ao pré-carregar dados via socket, continuando sem dados iniciais:', socketError);
      }
    } else {
      console.warn('⚠️ Serviço de socket indisponível, inicializando sem dados');
    }
    
    renderApp();
  } catch (error) {
    console.error('❌ Erro ao pré-carregar dados de roletas:', error);
    console.log('🔄 Renderizando aplicativo mesmo com erro de pré-carregamento');
    renderApp();
  }
};

// Função para renderizar o aplicativo com ErrorBoundary
const renderApp = () => {
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
};

// Iniciar pré-carregamento de dados após um pequeno atraso
setTimeout(preloadRouletteData, PRELOAD_TIME);
