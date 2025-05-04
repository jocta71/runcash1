import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/toaster";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import { useEffect, lazy, Suspense, useRef, useState } from "react";
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
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
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
                          
                          {/* Removidas as rotas: /roulettes, /history, /analysis, /strategies, /strategy/:id */}
                          
                          <Route path="/profile" element={
                            <ProtectedRoute>
                              <Suspense fallback={<LoadingScreen />}>
                                <ProfilePage />
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
                      </LoginModalProvider>
                      <Toaster />
                    </BrowserRouter>
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
