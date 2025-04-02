import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/AuthPage";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCanceled from "./pages/PaymentCanceled";
import PlansPage from "./pages/PlansPage";
import ProfilePage from "./pages/ProfilePage";
import SeedPage from "./pages/SeedPage";
import StrategiesPage from "./pages/StrategiesPage";
import StrategyFormPage from "./pages/StrategyFormPage";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import { RouletteAnalysisPage } from '@/pages/RouletteAnalysisPage';
import { useState, useEffect, lazy, Suspense } from "react";
import SocketService from '@/services/SocketService';
import LoadingScreen from './components/LoadingScreen';

// Configuração melhorada do QueryClient para evitar recarregamentos desnecessários
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      // Aumentar o stale time para reduzir recarregamentos desnecessários
      staleTime: 5 * 60 * 1000, // 5 minutos
      // Manter dados no cache mesmo se não estiverem sendo usados (ex: quando você volta para a página)
      gcTime: 10 * 60 * 1000, // 10 minutos (antes era cacheTime)
      // Não refetch automaticamente quando a janela recupera o foco
      refetchOnWindowFocus: false,
      // Não refetch quando você volta para a página
      refetchOnMount: false,
      // Evita refetch ao reconectar
      refetchOnReconnect: false,
    },
  },
});

const App = () => {
  // Criar uma única instância do QueryClient que seja mantida mesmo após re-renders
  const [queryClient] = useState(createQueryClient);

  // Adicionar este useEffect para lidar com erros de renderização
  useEffect(() => {
    // Resolver o erro de freeze/congelamento
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

    // Executar verificação após o componente estar montado
    handleFreeze();
    
    // Também executar quando a janela é redimensionada, o que pode ajudar a "descongelar"
    window.addEventListener('resize', handleFreeze);
    
    return () => {
      window.removeEventListener('resize', handleFreeze);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SubscriptionProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            {/* Adiciona o loader de dados aqui para que seja carregado em qualquer rota */}
            <DataLoader />
            
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                {/* Rota de autenticação */}
                <Route path="/auth" element={<AuthPage />} />
                
                {/* Página para popular números das roletas */}
                <Route path="/seed-numbers" element={<SeedPage />} />
                
                {/* Rota principal (com dados reais do MongoDB) */}
                <Route path="/" element={<Index />} />
                
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
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </SubscriptionProvider>
    </QueryClientProvider>
  );
};

// Componente de inicialização para carregar dados históricos
const DataLoader = () => {
  useEffect(() => {
    // Inicializar o SocketService e carregar dados históricos
    const socketService = SocketService.getInstance();
    
    // Tempo curto para garantir que o DOM está carregado
    const timer = setTimeout(() => {
      console.log('[DataLoader] Carregando dados históricos...');
      
      // Conectar ao WebSocket e carregar dados históricos
      if (!socketService.isConnected()) {
        socketService.connect();
      }
      
      // Forçar a carga de dados históricos mesmo que já esteja conectado
      socketService.loadHistoricalRouletteNumbers().then(() => {
        console.log('[DataLoader] Dados históricos carregados com sucesso');
      }).catch(error => {
        console.error('[DataLoader] Erro ao carregar dados históricos:', error);
      });
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);
  
  return null; // Componente não renderiza nada
};

export default App;
