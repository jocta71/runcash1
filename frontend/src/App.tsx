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
import { AuthProvider } from './context/AuthContext';
import { NotificationsProvider } from './components/NotificationsProvider';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

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

// Definir as rotas
const router = createBrowserRouter([
  {
    path: "/auth",
    element: <Suspense fallback={<LoadingScreen />}><AuthPage /></Suspense>
  },
  {
    path: "/",
    element: <Suspense fallback={<LoadingScreen />}><Index /></Suspense>
  },
  {
    path: "/live-roulettes",
    element: <Suspense fallback={<LoadingScreen />}><LiveRoulettePage /></Suspense>
  },
  {
    path: "/test",
    element: <Suspense fallback={<LoadingScreen />}><TestPage /></Suspense>
  },
  {
    path: "/planos",
    element: <Suspense fallback={<LoadingScreen />}><PlansPage /></Suspense>
  },
  {
    path: "/payment-success",
    element: <Suspense fallback={<LoadingScreen />}><PaymentSuccess /></Suspense>
  },
  {
    path: "/payment-canceled",
    element: <Suspense fallback={<LoadingScreen />}><PaymentCanceled /></Suspense>
  },
  {
    path: "/profile",
    element: <Suspense fallback={<LoadingScreen />}><ProfilePage /></Suspense>
  },
  {
    path: "*",
    element: <Suspense fallback={<LoadingScreen />}><NotFound /></Suspense>
  },
  {
    path: "/analise",
    element: <Suspense fallback={<LoadingScreen />}><RouletteAnalysisPage /></Suspense>
  },
  {
    path: "/strategies",
    element: <Suspense fallback={<LoadingScreen />}><StrategiesPage /></Suspense>
  },
  {
    path: "/strategies/create",
    element: <Suspense fallback={<LoadingScreen />}><StrategyFormPage /></Suspense>
  },
  {
    path: "/strategies/edit/:id",
    element: <Suspense fallback={<LoadingScreen />}><StrategyFormPage /></Suspense>
  },
  {
    path: "/strategies/view/:id",
    element: <Suspense fallback={<LoadingScreen />}><StrategiesPage /></Suspense>
  },
  {
    path: "/realtime",
    element: <Navigate to="/" />
  },
  {
    path: "/roulettes",
    element: <Suspense fallback={<LoadingScreen />}><LiveRoulettePage /></Suspense>
  },
  {
    path: "/historico",
    element: <Suspense fallback={<LoadingScreen />}><LiveRoulettePage /></Suspense>
  },
  {
    path: "/historico/:roletaId",
    element: <Suspense fallback={<LoadingScreen />}><RouletteHistoryPage /></Suspense>
  },
  {
    path: "/seed-numbers",
    element: <Suspense fallback={<LoadingScreen />}><SeedPage /></Suspense>
  }
]);

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
    <div className="App">
      <ErrorBoundary fallback={<ErrorPage />}>
        <QueryClientProvider client={queryClient.current}>
          <NotificationsProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <ThemeProvider defaultTheme="dark" storageKey="runcash-theme">
                  <Toaster />
                  <div className="min-h-screen bg-background text-foreground">
                    <RouterProvider router={router} />
                  </div>
                </ThemeProvider>
              </SubscriptionProvider>
            </AuthProvider>
          </NotificationsProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </div>
  );
};

export default App;
