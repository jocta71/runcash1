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
        <SubscriptionProvider>
          <TooltipProvider>
            <Toaster />
            <ThemeProvider defaultTheme="dark" storageKey="runcash-theme">
              <BrowserRouter>
                <Suspense fallback={<LoadingScreen />}>
                  <Routes>
                    {/* Rota de autenticação */}
                    <Route path="/auth" element={<AuthPage />} />
                    
                    {/* Página para popular números das roletas */}
                    <Route path="/seed-numbers" element={<SeedPage />} />
                    
                    {/* Rota principal (com dados reais do MongoDB) */}
                    <Route path="/" element={<Index />} />
                    
                    {/* Nova rota para roletas ao vivo */}
                    <Route path="/live-roulettes" element={<LiveRoulettePage />} />
                    
                    {/* Página de teste */}
                    <Route path="/test" element={<TestPage />} />
                    
                    {/* Rotas relacionadas a planos e pagamentos */}
                    <Route path="/planos" element={<PlansPage />} />
                    <Route path="/payment-success" element={<PaymentSuccess />} />
                    <Route path="/payment-canceled" element={<PaymentCanceled />} />
                    
                    {/* Rota de perfil do usuário */}
                    <Route path="/profile" element={<ProfilePage />} />
                    
                    {/* Rota para página não encontrada */}
                    <Route path="*" element={<NotFound />} />

                    {/* Rota para página de análise */}
                    <Route path="/analise" element={<RouletteAnalysisPage />} />
                    
                    {/* Rotas para estratégias */}
                    <Route path="/strategies" element={<StrategiesPage />} />
                    <Route path="/strategies/create" element={<StrategyFormPage />} />
                    <Route path="/strategies/edit/:id" element={<StrategyFormPage />} />
                    <Route path="/strategies/view/:id" element={<StrategiesPage />} />
                    
                    {/* Redirecionamento da antiga rota de tempo real para a página principal */}
                    <Route path="/realtime" element={<Navigate to="/" />} />

                    {/* Rota para roletas */}
                    <Route path="/roulettes" element={<LiveRoulettePage />} />
                    
                    {/* Rota para histórico de roletas */}
                    <Route path="/historico" element={<LiveRoulettePage />} />
                    <Route path="/historico/:roletaId" element={<RouletteHistoryPage />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </ThemeProvider>
          </TooltipProvider>
        </SubscriptionProvider>
      </ErrorBoundary>
    </div>
  );
};

export default App;
