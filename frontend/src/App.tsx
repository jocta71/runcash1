import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useNavigate, useLocation, Navigate } from "react-router-dom";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/toaster";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import { useEffect, lazy, Suspense, useRef, useState, createContext, useContext, useCallback } from "react";
import LoadingScreen from './components/LoadingScreen';
import './App.css';
import { ThemeProvider } from './components/theme-provider';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorPage from './pages/ErrorPage';
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationsProvider } from "./context/NotificationsContext";
import GoogleAuthHandler from './components/GoogleAuthHandler';
import ProtectedRoute from './components/ProtectedRoute';
import SoundManager from "./components/SoundManager";
import { LoginModalProvider, useLoginModal } from "./context/LoginModalContext";
import UnifiedRouletteClient from './services/UnifiedRouletteClient';
import { Button } from "./components/ui/button";
import { RefreshCw } from "lucide-react";
import EventService from './services/EventService';
// Importar o dashboard diretamente para debug
const RoulettesDashboard = lazy(() => import("@/components/RoulettesDashboard"));

// Contexto para o carregamento de dados
interface DataLoadingContextProps {
  isDataLoaded: boolean;
  rouletteData: any[];
  error: string | null;
  forceReconnect: () => void;
}

const DataLoadingContext = createContext<DataLoadingContextProps>({
  isDataLoaded: false,
  rouletteData: [],
  error: null,
  forceReconnect: () => {}
});

// Hook para facilitar o uso do contexto
export const useDataLoading = () => useContext(DataLoadingContext);

// Provider para centralizar o carregamento de dados
const DataLoadingProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [rouletteData, setRouletteData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const clientRef = useRef<UnifiedRouletteClient | null>(null);
  
  // Função para forçar reconexão do stream
  const forceReconnect = () => {
    if (reconnecting) return;
    
    setReconnecting(true);
    console.log('Forçando reconexão do stream...');
    
    if (clientRef.current) {
      clientRef.current.forceReconnectStream();
      
      // Após reconectar, tentar buscar dados novos
      setTimeout(async () => {
        try {
          const newData = await clientRef.current?.forceUpdate();
          if (newData && newData.length > 0) {
            console.log(`Reconexão bem-sucedida. ${newData.length} roletas carregadas`);
            setRouletteData(newData);
            setIsDataLoaded(true);
          }
        } catch (err) {
          console.error('Erro ao recarregar dados após reconexão:', err);
        } finally {
          setReconnecting(false);
        }
      }, 2000);
    } else {
      console.error('Cliente não inicializado');
      setReconnecting(false);
    }
  };
  
  // Manipulador de dados recebidos do SSE
  const handleDataFromSSE = useCallback((updateEvent: any) => {
    console.log(`[DataLoadingProvider] Recebendo atualização SSE: ${updateEvent.source || 'desconhecido'}`);
    
    if (clientRef.current) {
      // Obter dados atualizados do cliente
      const freshData = clientRef.current.getAllRoulettes();
      
      if (freshData && freshData.length > 0) {
        setRouletteData(freshData);
        setIsDataLoaded(true);
        setError(null);
      }
    }
  }, []);
  
  // Inicializar o cliente de roletas e carregar dados
  useEffect(() => {
    // Timeout de segurança para evitar tela de carregamento infinita
    const safetyTimeout = setTimeout(() => {
      if (isLoading) {
        console.log('Timeout de segurança acionado - liberando interface');
        setIsLoading(false);
      }
    }, 5000); // 5 segundos máximos de espera
    
    const initializeData = async () => {
      try {
        console.log('Inicializando cliente SSE para dados de roletas...');
        
        // Obter a instância do cliente unificado com foco em SSE
        const client = UnifiedRouletteClient.getInstance({
          autoConnect: true,
          streamingEnabled: true,
          enablePolling: false, // Desativar polling, usar apenas SSE
        });
        
        clientRef.current = client;
        
        // Inscrever-se para atualizações de dados
        EventService.on('roulette:data-updated', handleDataFromSSE);
        
        // Primeiro verificar se já temos dados em cache
        const cachedData = client.getAllRoulettes();
        
        if (cachedData && cachedData.length > 0) {
          console.log(`Usando ${cachedData.length} roletas do cache`);
          setRouletteData(cachedData);
          setIsDataLoaded(true);
          setIsLoading(false);
          return; // Encerrar já que temos dados
        }
        
        // Se não temos cache, forçar conexão ao stream SSE
        console.log('Cache vazio, conectando ao stream SSE...');
        client.connectStream();
        
        // Dar um tempo para o stream se conectar
        setTimeout(async () => {
          // Forçar uma atualização para tentar obter dados iniciais
          const data = await client.forceUpdate();
          
          if (data && data.length > 0) {
            console.log(`Dados iniciais carregados: ${data.length} roletas`);
            setRouletteData(data);
            setIsDataLoaded(true);
          } else {
            console.log('Sem dados iniciais, aguardando stream SSE...');
          }
          
          setIsLoading(false);
        }, 1500);
      } catch (err) {
        console.error('Erro ao inicializar dados:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
        setIsLoading(false);
      }
    };
    
    initializeData();
    
    // Limpar listeners e timeouts
    return () => {
      clearTimeout(safetyTimeout);
      EventService.off('roulette:data-updated', handleDataFromSSE);
    };
  }, [handleDataFromSSE]);
  
  // Registrar o estado de diagnóstico do cliente na janela global para depuração
  useEffect(() => {
    if (clientRef.current) {
      // Expor método de diagnóstico de conexão para depuração
      (window as any).diagnoseRouletteConnection = () => {
        if (clientRef.current) {
          console.log('---- DIAGNÓSTICO DE CONEXÃO SSE ----');
          return clientRef.current.diagnoseConnectionState();
        }
        return 'Cliente não inicializado';
      };
      
      // Expor método de reconexão forçada para depuração
      (window as any).forceRouletteUpdate = forceReconnect;
    }
    
    return () => {
      // Limpar métodos de diagnóstico
      delete (window as any).diagnoseRouletteConnection;
      delete (window as any).forceRouletteUpdate;
    };
  }, [forceReconnect]);
  
  // Se estiver carregando, mostrar a tela de carregamento
  if (isLoading) {
    return <LoadingScreen message="Carregando dados da roleta..." />;
  }
  
  // Renderizar mesmo se não tiver dados completos,
  // o contexto vai continuar atualizando em segundo plano
  return (
    <DataLoadingContext.Provider value={{ isDataLoaded, rouletteData, error, forceReconnect }}>
      {/* Botão flutuante para reconexão em caso de problemas */}
      {error && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            size="sm"
            variant="destructive"
            className="flex items-center gap-1 bg-red-600 text-white px-3 py-2 rounded-md"
            onClick={forceReconnect}
            disabled={reconnecting}
          >
            <RefreshCw className={`h-4 w-4 ${reconnecting ? 'animate-spin' : ''}`} />
            {reconnecting ? 'Reconectando...' : 'Reconectar Dados'}
          </Button>
        </div>
      )}
      {children}
    </DataLoadingContext.Provider>
  );
};

// Importação de componentes principais com lazy loading
const Index = lazy(() => import("@/pages/Index"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const ProfileSubscription = lazy(() => import("@/pages/ProfileSubscription"));
const AccountRedirect = lazy(() => import("@/pages/AccountRedirect"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const PlansPage = lazy(() => import("@/pages/PlansPage"));
const PaymentPage = lazy(() => import("@/pages/PaymentPage"));
const PaymentSuccessPage = lazy(() => import("@/pages/PaymentSuccessPage"));
const PaymentCanceled = lazy(() => import("@/pages/PaymentCanceled"));
const LiveRoulettePage = lazy(() => import("@/pages/LiveRoulettePage"));
const TestPage = lazy(() => import("@/pages/TestPage"));
const BillingPage = lazy(() => import("@/pages/BillingPage"));
const GerenciarChavesPage = lazy(() => import("@/pages/GerenciarChaves"));
// Comentando a importação da página de checkout, já que agora está integrada nos planos
// const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
// Comentando a importação da página de teste do Asaas
// const AsaasTestPage = lazy(() => import("@/pages/AsaasTestPage"));

// Criação do cliente de consulta
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Componente de redirecionamento para /minha-conta
const MinhaContaRedirect = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate('/billing', { replace: true });
  }, [navigate]);
  
  return <LoadingScreen />;
};

// Componente de redirecionamento para /minha-conta/assinatura
const MinhaContaAssinaturaRedirect = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate('/billing', { replace: true });
  }, [navigate]);
  
  return <LoadingScreen />;
};

// Componente de redirecionamento para /account
const AccountRouteRedirect = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate('/billing', { replace: true });
  }, [navigate]);
  
  return <LoadingScreen />;
};

// Componente para gerenciar o estado de autenticação e modal de login
const AuthStateManager = () => {
  const location = useLocation();
  const { user, checkAuth, token } = useAuth();
  const { showLoginModal } = useLoginModal();
  const [checkedOnMount, setCheckedOnMount] = useState(false);
  
  // Verificar autenticação uma vez ao montar o componente
  useEffect(() => {
    const initialAuthCheck = async () => {
      if (!checkedOnMount) {
        console.log('[AuthStateManager] Verificação inicial de autenticação');
        await checkAuth();
        setCheckedOnMount(true);
      }
    };
    
    initialAuthCheck();
  }, [checkAuth, checkedOnMount]);
  
  // Verificar autenticação quando a página for recarregada
  useEffect(() => {
    const handleVisibilityChange = async () => {
      // Quando a página se torna visível novamente, verificar autenticação
      if (document.visibilityState === 'visible') {
        console.log('[AuthStateManager] Página visível - verificando autenticação');
        await checkAuth();
      }
    };
    
    // Adicionar listener para mudança de visibilidade
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Adicionar listener para atualização de página
    window.addEventListener('pageshow', (event) => {
      // O evento bfcache (back-forward cache) indica que a página foi restaurada de um cache
      if (event.persisted) {
        console.log('[AuthStateManager] Página restaurada do cache - verificando autenticação');
        checkAuth();
      }
    });
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handleVisibilityChange);
    };
  }, [checkAuth]);
  
  useEffect(() => {
    // Verificar se há um state na navegação que solicita o modal de login
    if (location.state && location.state.showLoginModal) {
      console.log('[AuthStateManager] Solicitação para mostrar modal de login via state');
      
      // Mostrar o modal de login com os parâmetros passados no state
      showLoginModal({
        redirectAfterLogin: location.state.redirectAfterLogin,
        message: location.state.message || 'Por favor, faça login para continuar.'
      });
      
      // Limpar o state para evitar que o modal apareça novamente em navegações futuras
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location, showLoginModal]);
  
  return null; // Este componente não renderiza nada
};

// Componente principal da aplicação
const App = () => {
  // Criar uma única instância do QueryClient com useRef para mantê-la durante re-renders
  const queryClient = useRef(createQueryClient());

  // Gerenciador de congelamento para ambientes de desenvolvimento
  const handleFreeze = () => {
    try {
      // Verificar se há erros de renderização pendentes
      if (document.body && document.getElementById('root')) {
        const freezeOverlay = document.getElementById('freeze-overlay');
        if (freezeOverlay) {
          console.log('[FREEZE] Removendo overlay de congelamento');
          document.body.removeChild(freezeOverlay);
        }
      }
    } catch (error) {
      console.error('[FREEZE] Erro ao lidar com congelamento:', error);
    }
  };

  // Executado apenas uma vez quando o App é montado
  useEffect(() => {
    // Resolver o erro de freeze/congelamento
    handleFreeze();
    
    // Também executar quando a janela é redimensionada, o que pode ajudar a "descongelar"
    window.addEventListener('resize', handleFreeze);
    
    return () => {
      window.removeEventListener('resize', handleFreeze);
    };
  }, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorPage}>
      <QueryClientProvider client={queryClient.current}>
        <ThemeProvider defaultTheme="system" storageKey="runcash-theme">
          <TooltipProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <NotificationsProvider>
                  <SoundManager>
                    <DataLoadingProvider>
                      <BrowserRouter>
                        <GoogleAuthHandler />
                        <LoginModalProvider>
                          <AuthStateManager />
                          <Routes>
                            {/* Remover rota explícita de login e sempre usar o modal */}
                            
                            {/* Páginas principais - Acessíveis mesmo sem login, mas mostram modal se necessário */}
                            <Route index element={
                              <ProtectedRoute>
                                <Suspense fallback={<LoadingScreen />}>
                                  <Index />
                                </Suspense>
                              </ProtectedRoute>
                            } />
                            
                            {/* Rota para página de gerenciamento de chaves de acesso API */}
                            <Route path="/gerenciar-chaves" element={
                              <ProtectedRoute requireAuth={true}>
                                <Suspense fallback={<LoadingScreen />}>
                                  <GerenciarChavesPage />
                                </Suspense>
                              </ProtectedRoute>
                            } />
                            
                            {/* Removidas as rotas: /roulettes, /history, /analysis, /strategies, /strategy/:id */}
                            
                            <Route path="/profile" element={
                              <ProtectedRoute>
                                <Suspense fallback={<LoadingScreen />}>
                                  <ProfilePage />
                                </Suspense>
                              </ProtectedRoute>
                            } />
                            
                            {/* Adicionada rota /profile/billing */}
                            <Route path="/profile/billing" element={
                              <ProtectedRoute>
                                <Suspense fallback={<LoadingScreen />}>
                                  <BillingPage />
                                </Suspense>
                              </ProtectedRoute>
                            } />
                            
                            {/* Página de detalhes da assinatura - agora redirecionando para /billing */}
                            <Route path="/minha-conta/assinatura" element={
                              <ProtectedRoute>
                                <Suspense fallback={<LoadingScreen />}>
                                  <MinhaContaAssinaturaRedirect />
                                </Suspense>
                              </ProtectedRoute>
                            } />
                            
                            {/* Rota para /minha-conta que redireciona para /minha-conta/assinatura */}
                            <Route path="/minha-conta" element={
                              <ProtectedRoute>
                                <Suspense fallback={<LoadingScreen />}>
                                  <MinhaContaRedirect />
                                </Suspense>
                              </ProtectedRoute>
                            } />
                            
                            {/* Redirecionamento da rota /account (usada após pagamento) */}
                            <Route path="/account" element={
                              <Suspense fallback={<LoadingScreen />}>
                                <AccountRouteRedirect />
                              </Suspense>
                            } />
                            
                            <Route path="/billing" element={
                              <ProtectedRoute>
                                <Suspense fallback={<LoadingScreen />}>
                                  <BillingPage />
                                </Suspense>
                              </ProtectedRoute>
                            } />
                            
                            <Route path="/planos" element={
                              <ProtectedRoute>
                                <Suspense fallback={<LoadingScreen />}>
                                  <PlansPage />
                                </Suspense>
                              </ProtectedRoute>
                            } />
                            
                            {/* Rotas de pagamento removidas, pois o checkout agora está integrado na página de planos */}
                            {/* 
                            <Route path="/pagamento" element={
                              <ProtectedRoute>
                                <Suspense fallback={<LoadingScreen />}>
                                  <CheckoutPage />
                                </Suspense>
                              </ProtectedRoute>
                            } />
                            
                            <Route path="/pagamento/:planId" element={
                              <ProtectedRoute>
                                <Suspense fallback={<LoadingScreen />}>
                                  <CheckoutPage />
                                </Suspense>
                              </ProtectedRoute>
                            } />
                            */}
                            
                            {/* Mantendo a rota antiga para compatibilidade */}
                            <Route path="/payment" element={
                              <ProtectedRoute>
                                <Suspense fallback={<LoadingScreen />}>
                                  <PaymentPage />
                                </Suspense>
                              </ProtectedRoute>
                            } />
                            
                            <Route path="/payment/:planId" element={
                              <ProtectedRoute>
                                <Suspense fallback={<LoadingScreen />}>
                                  <PaymentPage />
                                </Suspense>
                              </ProtectedRoute>
                            } />
                            
                            <Route path="/payment-success" element={
                              <ProtectedRoute>
                                <Suspense fallback={<LoadingScreen />}>
                                  <PaymentSuccessPage />
                                </Suspense>
                              </ProtectedRoute>
                            } />
                            
                            <Route path="/pagamento/sucesso" element={
                              <ProtectedRoute>
                                <Suspense fallback={<LoadingScreen />}>
                                  <PaymentSuccessPage />
                                </Suspense>
                              </ProtectedRoute>
                            } />
                            
                            <Route path="/pagamento/cancelado" element={
                              <ProtectedRoute>
                                <Suspense fallback={<LoadingScreen />}>
                                  <PaymentCanceled />
                                </Suspense>
                              </ProtectedRoute>
                            } />
                            
                            <Route path="/live" element={
                              <ProtectedRoute>
                                <Suspense fallback={<LoadingScreen />}>
                                  <LiveRoulettePage />
                                </Suspense>
                              </ProtectedRoute>
                            } />
                            
                            {/* Rota para a página de teste */}
                            <Route path="/test" element={
                              <ProtectedRoute>
                                <Suspense fallback={<LoadingScreen />}>
                                  <TestPage />
                                </Suspense>
                              </ProtectedRoute>
                            } />
                            
                            {/* Rota direta para o Dashboard de Roletas para facilitar testes */}
                            <Route path="/dashboard" element={
                              <Navigate to="/" replace />
                            } />
                            
                            {/* Rota para a página de teste do Asaas - DESATIVADA */}
                            {/* 
                            <Route path="/asaas-test" element={
                              <ProtectedRoute>
                                <Suspense fallback={<LoadingScreen />}>
                                  <AsaasTestPage />
                                </Suspense>
                              </ProtectedRoute>
                            } />
                            */}
                            
                            {/* Rota para página não encontrada */}
                            <Route path="*" element={
                              <ProtectedRoute>
                                <Suspense fallback={<LoadingScreen />}>
                                  <NotFound />
                                </Suspense>
                              </ProtectedRoute>
                            } />
                          </Routes>
                          <Toaster />
                        </LoginModalProvider>
                      </BrowserRouter>
                    </DataLoadingProvider>
                  </SoundManager>
                </NotificationsProvider>
              </SubscriptionProvider>
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
