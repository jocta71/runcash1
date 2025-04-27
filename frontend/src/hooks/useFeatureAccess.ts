import { useEffect, useState } from 'react';
import { useSubscription } from '@/context/SubscriptionContext';
import { api } from '@/lib/api';
import { PlanType } from '@/types/plans';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';

interface UseFeatureAccessOptions {
  featureId: string;
  fetchOnMount?: boolean;
  mockDataFallback?: any;
  redirectToPlans?: boolean;
  requiredPlan?: PlanType;
  showToast?: boolean;
}

/**
 * Hook personalizado para verificar acesso a recursos premium
 * Permite verificar se o usuário tem acesso a um recurso específico,
 * mostrar mensagens de erro e redirecionar para página de planos
 */
export function useFeatureAccess(options: UseFeatureAccessOptions) {
  const { 
    featureId, 
    fetchOnMount = false, 
    mockDataFallback = null,
    redirectToPlans = false,
    requiredPlan = PlanType.PREMIUM,
    showToast = false
  } = options;
  
  const { hasFeatureAccess, currentPlan, currentSubscription, loading } = useSubscription();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(fetchOnMount);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Verificar se o usuário tem acesso ao recurso
  const hasAccess = hasFeatureAccess(featureId);
  
  // Verificar se o usuário tem o plano mínimo necessário
  const hasPlanAccess = currentPlan && currentPlan.type >= requiredPlan;
  
  // Verificar se o usuário tem uma assinatura ativa
  const hasActiveSubscription = currentSubscription && 
    (currentSubscription.status === 'active' || currentSubscription.status === 'ativo');
  
  // Verificar se é um plano pago
  const hasPaidPlan = currentPlan && currentPlan.type > PlanType.FREE;

  // Carregar dados do recurso via API
  const fetchData = async () => {
    // Se não tiver acesso, nem tentar buscar dados
    if (!hasAccess) {
      if (mockDataFallback) {
        setData(mockDataFallback);
        setIsLoading(false);
        return;
      }
      
      if (redirectToPlans) {
        redirectToPlanPage();
        return;
      }
      
      setError('Acesso não autorizado. Faça upgrade do seu plano.');
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Endpoint específico para o recurso
      const endpoint = `/features/${featureId}`;
      const response = await api.get(endpoint);
      
      if (response.data.success) {
        setData(response.data.data);
      } else {
        setError(response.data.message || 'Erro ao carregar dados');
        setData(mockDataFallback);
      }
    } catch (err: any) {
      console.error(`[useFeatureAccess] Erro ao buscar recurso ${featureId}:`, err);
      setError(err.message || 'Erro ao buscar dados');
      setData(mockDataFallback);
    } finally {
      setIsLoading(false);
    }
  };

  // Função para redirecionar para a página de planos
  const redirectToPlanPage = () => {
    if (showToast) {
      toast({
        title: "Acesso restrito",
        description: `Este recurso requer o plano ${
          requiredPlan === PlanType.PREMIUM ? 'Premium' : 
          requiredPlan === PlanType.PRO ? 'Profissional' : 'Básico'
        }.`,
        variant: "destructive"
      });
    }
    
    navigate('/planos');
  };

  // Verificar acesso e carregar dados iniciais se necessário
  useEffect(() => {
    if (fetchOnMount && !loading) {
      fetchData();
    }
  }, [fetchOnMount, loading, featureId]);

  return {
    hasAccess,
    hasPlanAccess,
    hasActiveSubscription,
    hasPaidPlan,
    isLoading: isLoading || loading,
    error,
    data,
    fetchData,
    redirectToPlanPage,
    currentPlan,
    requiredPlan
  };
} 