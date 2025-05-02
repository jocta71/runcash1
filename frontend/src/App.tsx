import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/toaster";
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
import SubscriptionRequiredModal from "./components/SubscriptionRequiredModal";

// Importação de componentes principais com lazy loading
const Index = lazy(() => import("@/pages/Index"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const ProfileSubscription = lazy(() => import("@/pages/ProfileSubscription"));
const AccountRedirect = lazy(() => import("@/pages/AccountRedirect"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const PlansPage = lazy(() => import("@/pages/PlansPage"));
const LiveRoulettePage = lazy(() => import("@/pages/LiveRoulettePage"));
const TestPage = lazy(() => import("@/pages/TestPage"));
const BillingPage = lazy(() => import("@/pages/BillingPage"));
// Comentando a importação da página de teste do Asaas
// const AsaasTestPage = lazy(() => import("@/pages/AsaasTestPage"));
// Importação da nossa nova página de teste de assinatura
// const TestAssinaturaPage = lazy(() => import("@/pages/TestAssinaturaPage"));

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

// Componente para gerenciar os recursos do aplicativo que precisam do Router
const AppContent = () => {
  const navigate = useNavigate();
  
  // Função para redirecionar para a página de planos
  const handleUpgrade = () => {
    navigate('/plans');
  };
  
  return (
    <>
      <GoogleAuthHandler />
      <AuthStateManager />
      {/* Modal de assinatura requerida */}
      <SubscriptionRequiredModal onUpgrade={handleUpgrade} />
      <Routes>
        {/* Páginas principais - Acessíveis mesmo sem login, mas mostram modal se necessário */}
        <Route index element={
          <ProtectedRoute>
            <Suspense fallback={<LoadingScreen />}>
              <Index />
            </Suspense>
          </ProtectedRoute>
        } />
        
        {/* Rotas de planos e assinatura */}
        <Route path="/plans" element={
          <Suspense fallback={<LoadingScreen />}>
            <PlansPage />
          </Suspense>
        } />
        
        <Route path="/billing" element={
          <ProtectedRoute>
            <Suspense fallback={<LoadingScreen />}>
              <BillingPage />
            </Suspense>
          </ProtectedRoute>
        } />
        
        {/* Rota de testes */}
        <Route path="/test" element={
          <Suspense fallback={<LoadingScreen />}>
            <TestPage />
          </Suspense>
        } />
        
        {/* Rotas de redirecionamento para compatibilidade */}
        <Route path="/minha-conta" element={<MinhaContaRedirect />} />
        <Route path="/minha-conta/assinatura" element={<MinhaContaAssinaturaRedirect />} />
        <Route path="/account" element={<AccountRouteRedirect />} />
        <Route path="/account/redirect" element={
          <Suspense fallback={<LoadingScreen />}>
            <AccountRedirect />
          </Suspense>
        } />
        
        {/* Rotas de perfil */}
        <Route path="/profile" element={
          <ProtectedRoute>
            <Suspense fallback={<LoadingScreen />}>
              <ProfilePage />
            </Suspense>
          </ProtectedRoute>
        } />
        
        <Route path="/profile/subscription" element={
          <ProtectedRoute>
            <Suspense fallback={<LoadingScreen />}>
              <ProfileSubscription />
            </Suspense>
          </ProtectedRoute>
        } />
        
        {/* Rota de roleta ao vivo */}
        <Route path="/live/:rouletteId" element={
          <Suspense fallback={<LoadingScreen />}>
            <LiveRoulettePage />
          </Suspense>
        } />
        
        {/* Rota 404 para páginas não encontradas */}
        <Route path="*" element={
          <Suspense fallback={<LoadingScreen />}>
            <NotFound />
          </Suspense>
        } />
      </Routes>
      <Toaster />
    </>
  );
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
              <NotificationsProvider>
                <SoundManager>
                  <BrowserRouter>
                    <LoginModalProvider>
                      <AppContent />
                    </LoginModalProvider>
                  </BrowserRouter>
                </SoundManager>
              </NotificationsProvider>
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
