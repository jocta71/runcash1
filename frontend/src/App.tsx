import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/toaster";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import { RouletteAnalysisPage } from '@/pages/RouletteAnalysisPage';
import { useState, useEffect, lazy, Suspense, useRef } from "react";
import SocketService from '@/services/SocketAdapter';
import LoadingScreen from './components/LoadingScreen';
import RoulettesPage from './pages/Roulettes';
import './App.css';
import RouletteHistoryPage from './pages/RouletteHistoryPage';
import { ThemeProvider } from './components/theme-provider';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorPage from './pages/ErrorPage';
import { AuthProvider } from "./context/AuthContext";
import { NotificationsProvider } from "./context/NotificationsContext";
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import GoogleAuthHandler from './components/GoogleAuthHandler';
import ProtectedRoute from './components/ProtectedRoute';
import AuthPage from "./pages/AuthPage";

// Importação de componentes principais com lazy loading
const Index = lazy(() => import("@/pages/Index"));
const StrategiesPage = lazy(() => import("@/pages/StrategiesPage"));
const StrategyFormPage = lazy(() => import("@/pages/StrategyFormPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const SeedPage = lazy(() => import("@/pages/SeedPage"));
const PlansPage = lazy(() => import("@/pages/PlansPage"));
const PaymentSuccess = lazy(() => import("@/pages/PaymentSuccess"));
const PaymentCanceled = lazy(() => import("@/pages/PaymentCanceled"));
const LiveRoulettePage = lazy(() => import("@/pages/LiveRoulettePage"));
const TestPage = lazy(() => import("@/pages/TestPage"));

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
        <ThemeProvider defaultTheme="dark" storageKey="runcash-theme">
          <TooltipProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <NotificationsProvider>
                  <BrowserRouter>
                    <GoogleAuthHandler />
                    <Routes>
                      {/* Rota pública de login - Acessível mesmo sem autenticação */}
                      <Route path="/login" element={
                        <Suspense fallback={<LoadingScreen />}>
                          <AuthPage />
                        </Suspense>
                      } />
                      
                      {/* Redirecionamento para login se acessar diretamente a raiz sem autenticação */}
                      <Route index element={
                        <ProtectedRoute>
                          <Suspense fallback={<LoadingScreen />}>
                            <Index />
                          </Suspense>
                        </ProtectedRoute>
                      } />
                      
                      {/* Todas as outras rotas são protegidas */}
                      <Route path="/roulettes" element={
                        <ProtectedRoute>
                          <Suspense fallback={<LoadingScreen />}>
                            <RoulettesPage />
                          </Suspense>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/history" element={
                        <ProtectedRoute>
                          <Suspense fallback={<LoadingScreen />}>
                            <RouletteHistoryPage />
                          </Suspense>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/analysis" element={
                        <ProtectedRoute>
                          <Suspense fallback={<LoadingScreen />}>
                            <RouletteAnalysisPage />
                          </Suspense>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/strategies" element={
                        <ProtectedRoute>
                          <Suspense fallback={<LoadingScreen />}>
                            <StrategiesPage />
                          </Suspense>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/strategy/:id" element={
                        <ProtectedRoute>
                          <Suspense fallback={<LoadingScreen />}>
                            <StrategyFormPage />
                          </Suspense>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/profile" element={
                        <ProtectedRoute>
                          <Suspense fallback={<LoadingScreen />}>
                            <ProfilePage />
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
                  </BrowserRouter>
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
