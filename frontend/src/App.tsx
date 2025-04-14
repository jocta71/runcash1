import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/toaster";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import { useState, useEffect, lazy, Suspense, useRef } from "react";
import LoadingScreen from './components/LoadingScreen';
import './App.css';
import { ThemeProvider } from './components/theme-provider';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorPage from './pages/ErrorPage';
import { AuthProvider } from "./context/AuthContext";
import { NotificationsProvider } from "./context/NotificationsContext";
import GoogleAuthHandler from './components/GoogleAuthHandler';
import ProtectedRoute from './components/ProtectedRoute';
import SoundManager from "./components/SoundManager";
import { markPerformance, initPerformanceOptimizations, optimizeRouting } from './utils/performance-optimizer';

// Iniciar otimizações de desempenho
initPerformanceOptimizations();

// Marcar início da renderização do App
markPerformance('app_component_init');

// Importação de componentes com lazy loading usando os arquivos existentes
const HomePage = lazy(() => import('./pages/Index'));
const LoginPage = lazy(() => import('./pages/AuthPage'));
const RegisterPage = lazy(() => import('./pages/AuthPage'));
const PlansPage = lazy(() => import('./pages/PlansPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const NotFoundPage = lazy(() => import('./pages/NotFound'));
const WebhookTestPage = lazy(() => import('./pages/WebhookTestPage'));
const SubscriptionManagePage = lazy(() => import('./pages/SubscriptionManagePage'));
const RouletteAnalysisPage = lazy(() => import('./pages/RouletteAnalysisPage'));
const RoulettesPage = lazy(() => import('./pages/Roulettes'));
const RouletteHistoryPage = lazy(() => import('./pages/RouletteHistoryPage'));
const StrategiesPage = lazy(() => import("./pages/StrategiesPage"));
const StrategyFormPage = lazy(() => import("./pages/StrategyFormPage"));
const SeedPage = lazy(() => import("./pages/SeedPage"));
const PaymentPage = lazy(() => import("./pages/PaymentPage"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentCanceled = lazy(() => import("./pages/PaymentCanceled"));
const LiveRoulettePage = lazy(() => import("./pages/LiveRoulettePage"));
const TestPage = lazy(() => import("./pages/TestPage"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const DashboardPage = lazy(() => import("./pages/Index")); // Usando Index como fallback para Dashboard

// Criar único cliente de consulta com configurações otimizadas
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      refetchOnWindowFocus: false,
      retry: 1,
      // gcTime é o substituto do cacheTime nas versões mais recentes do React-Query
      gcTime: 10 * 60 * 1000, // 10 minutos
    },
  },
});

// Componente de suspense com feedback visual otimizado e tracking de performance
const SuspenseWrapper = ({ children, name }: { children: React.ReactNode, name?: string }) => {
  useEffect(() => {
    if (name) {
      markPerformance(`suspense_loading_${name}`);
      return () => {
        markPerformance(`suspense_loaded_${name}`);
      };
    }
  }, [name]);
  
  return (
    <Suspense fallback={
      <div className="lazy-loading-container">
        <LoadingScreen />
      </div>
    }>
      {children}
    </Suspense>
  );
};

// Componente principal da aplicação
const App = () => {
  // Criar uma única instância do QueryClient com useRef
  const queryClient = useRef(createQueryClient());
  const [isRouterReady, setIsRouterReady] = useState(false);

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
    // Marcar momento de montagem do componente
    markPerformance('app_component_mounted');
    
    // Resolver o erro de freeze/congelamento
    handleFreeze();
    
    // Também executar quando a janela é redimensionada
    window.addEventListener('resize', handleFreeze);
    
    // Iniciar otimização de roteamento
    optimizeRouting();
    
    // Marcar que o roteador está pronto após um breve delay
    setTimeout(() => {
      setIsRouterReady(true);
      markPerformance('router_ready');
    }, 100);
    
    return () => {
      window.removeEventListener('resize', handleFreeze);
      markPerformance('app_component_unmount');
    };
  }, []);

  markPerformance('app_render');
  
  return (
    <ErrorBoundary FallbackComponent={ErrorPage}>
      <QueryClientProvider client={queryClient.current}>
        <ThemeProvider defaultTheme="dark" storageKey="runcash-theme">
          <TooltipProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <NotificationsProvider>
                  <SoundManager>
                    <BrowserRouter>
                      <GoogleAuthHandler />
                      {isRouterReady && (
                        <Routes>
                          <Route path="/" element={
                            <SuspenseWrapper name="home">
                              <HomePage />
                            </SuspenseWrapper>
                          } />
                          <Route path="/login" element={
                            <SuspenseWrapper name="login">
                              <LoginPage />
                            </SuspenseWrapper>
                          } />
                          <Route path="/registro" element={
                            <SuspenseWrapper name="register">
                              <RegisterPage />
                            </SuspenseWrapper>
                          } />
                          <Route path="/planos" element={
                            <SuspenseWrapper name="plans">
                              <PlansPage />
                            </SuspenseWrapper>
                          } />
                          
                          <Route path="/dashboard" element={
                            <ProtectedRoute>
                              <SuspenseWrapper name="dashboard">
                                <DashboardPage />
                              </SuspenseWrapper>
                            </ProtectedRoute>
                          } />
                          
                          <Route path="/perfil" element={
                            <ProtectedRoute>
                              <SuspenseWrapper name="profile">
                                <ProfilePage />
                              </SuspenseWrapper>
                            </ProtectedRoute>
                          } />
                          
                          <Route path="/assinatura" element={
                            <ProtectedRoute>
                              <SuspenseWrapper name="subscription">
                                <SubscriptionManagePage />
                              </SuspenseWrapper>
                            </ProtectedRoute>
                          } />
                          
                          <Route path="/webhook-test" element={
                            <SuspenseWrapper name="webhook">
                              <WebhookTestPage />
                            </SuspenseWrapper>
                          } />
                          
                          <Route path="*" element={
                            <SuspenseWrapper name="not-found">
                              <NotFoundPage />
                            </SuspenseWrapper>
                          } />
                        </Routes>
                      )}
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
