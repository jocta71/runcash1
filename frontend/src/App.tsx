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
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import GoogleAuthHandler from './components/GoogleAuthHandler';

// Importação de componentes principais
const Index = lazy(() => import("@/pages/Index"));
const StrategiesPage = lazy(() => import("@/pages/StrategiesPage"));
const StrategyFormPage = lazy(() => import("@/pages/StrategyFormPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const AuthPage = lazy(() => import("@/pages/AuthPage"));
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

// Definição do roteamento
const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <Index />
      </Suspense>
    ),
  },
  {
    path: '/auth',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <AuthPage />
      </Suspense>
    ),
  },
  {
    path: '/roulettes',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <RoulettesPage />
      </Suspense>
    ),
  },
  {
    path: '/history',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <RouletteHistoryPage />
      </Suspense>
    ),
  },
  {
    path: '/analysis',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <RouletteAnalysisPage />
      </Suspense>
    ),
  },
  {
    path: '/strategies',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <StrategiesPage />
      </Suspense>
    ),
  },
  {
    path: '/strategy/:id',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <StrategyFormPage />
      </Suspense>
    ),
  },
  {
    path: '/profile',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <ProfilePage />
      </Suspense>
    ),
  },
  {
    path: '/live',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <LiveRoulettePage />
      </Suspense>
    ),
  },
  {
    path: '*',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <NotFound />
      </Suspense>
    ),
  }
]);

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
                      <Route path="/login" element={<AuthPage />} />
                      <Route path="*" element={<RouterProvider router={router} />} />
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
