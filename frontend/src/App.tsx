import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/toaster";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import { RouletteAnalysisPage } from '@/pages/RouletteAnalysisPage';
import { useState, useEffect, useRef } from "react";
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
import GoogleAuthHandler from './components/GoogleAuthHandler';
import ProtectedRoute from './components/ProtectedRoute';
import AuthPage from "./pages/AuthPage";
import SoundManager from "./components/SoundManager";
import HomePage from './pages/Index';
import NotFound from './pages/NotFound';
import AuthRoute from './components/AuthRoute';
import RouletteDetailsPage from './pages/RouletteDetailsPage';
import StrategyFormPage from './pages/StrategyFormPage';
import StrategiesPage from './pages/StrategiesPage';
import ProfilePage from './pages/ProfilePage';
import ProfileSubscription from './pages/ProfileSubscription';
import PaymentPage from './pages/PaymentPage';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentCanceled from './pages/PaymentCanceled';
import LiveRoulettePage from './pages/LiveRoulettePage';
import SeedPage from './pages/SeedPage';
import AsaasTestPage from './pages/AsaasTestPage';
import BillingPage from './pages/BillingPage';
import PlansPage from './pages/PlansPage';

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
                  <SoundManager>
                    <BrowserRouter>
                      <GoogleAuthHandler />
                      <Routes>
                        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                        <Route path="/auth" element={<AuthRoute><AuthPage /></AuthRoute>} />
                        <Route path="/login" element={<Navigate to="/auth" replace />} />
                        <Route path="/auth/callback" element={<GoogleAuthHandler />} />
                        
                        <Route path="/roulette/:platformId/:rouletteId" element={<ProtectedRoute><RouletteDetailsPage /></ProtectedRoute>} />
                        <Route path="/strategies" element={<ProtectedRoute><StrategiesPage /></ProtectedRoute>} />
                        <Route path="/strategies/new" element={<ProtectedRoute><StrategyFormPage /></ProtectedRoute>} />
                        <Route path="/strategies/edit/:id" element={<ProtectedRoute><StrategyFormPage /></ProtectedRoute>} />
                        
                        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                        <Route path="/profile/subscription" element={<ProtectedRoute><ProfileSubscription /></ProtectedRoute>} />
                        <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
                        <Route path="/planos" element={<PlansPage />} />
                        <Route path="/payment/:planId" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
                        <Route path="/payment-success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
                        <Route path="/payment-canceled" element={<ProtectedRoute><PaymentCanceled /></ProtectedRoute>} />
                        
                        <Route path="/roleta-ao-vivo" element={<ProtectedRoute><LiveRoulettePage /></ProtectedRoute>} />
                        <Route path="/historico" element={<ProtectedRoute><RouletteHistoryPage /></ProtectedRoute>} />
                        <Route path="/historico/:platformId/:rouletteId" element={<ProtectedRoute><RouletteAnalysisPage /></ProtectedRoute>} />
                        <Route path="/seed-verify" element={<ProtectedRoute><SeedPage /></ProtectedRoute>} />
                        
                        <Route path="/teste-asaas" element={<AsaasTestPage />} />
                        
                        <Route path="/error" element={<ErrorPage />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
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
