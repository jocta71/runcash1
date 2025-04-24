import { useEffect, useState } from 'react';
import { useSubscription } from '@/context/SubscriptionContext';
import { api } from '@/lib/api';
import { PlanType } from '@/types/plans';

interface UseFeatureAccessOptions {
  featureId: string;
  fetchOnMount?: boolean;
  mockDataFallback?: any;
  requiredPlan?: PlanType;
}

/**
 * Hook personalizado para gerenciar o acesso a recursos premium
 * Garante que os dados protegidos são obtidos apenas se o usuário tiver permissão
 */
export function useFeatureAccess<T>({
  featureId,
  fetchOnMount = false,
  mockDataFallback,
  requiredPlan
}: UseFeatureAccessOptions) {
  const { hasFeatureAccess, availablePlans, currentPlan, loading: subscriptionLoading } = useSubscription();
  const [data, setData] = useState<T | null>(null);
  const [mockData, setMockData] = useState<any>(mockDataFallback || null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Determinar qual plano é necessário para esta feature
  const requiredPlanForFeature = requiredPlan || determineRequiredPlan(featureId, availablePlans);
  
  // Verificar acesso ao recurso
  useEffect(() => {
    // Não verificar acesso enquanto o contexto de assinatura estiver carregando
    if (subscriptionLoading) {
      return;
    }
    
    const checkAccess = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log(`[useFeatureAccess] Verificando acesso a feature "${featureId}"...`);
        
        // Verificar acesso via contexto de assinatura
        const access = await hasFeatureAccess(featureId);
        setHasAccess(access);
        
        console.log(`[useFeatureAccess] Acesso a feature "${featureId}": ${access ? 'Permitido' : 'Negado'}`);
        
        // Se tiver acesso e fetchOnMount estiver ativado, busca os dados
        if (access && fetchOnMount) {
          await fetchProtectedData(`/api/features/${featureId}`);
        }
      } catch (err: any) {
        console.error(`[useFeatureAccess] Erro ao verificar acesso a feature "${featureId}":`, err);
        setError(err instanceof Error ? err : new Error(err?.message || 'Erro ao verificar acesso'));
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    };
    
    checkAccess();
  }, [featureId, hasFeatureAccess, fetchOnMount, subscriptionLoading, currentPlan]);
  
  // Função para buscar dados protegidos do servidor
  const fetchProtectedData = async (endpoint: string) => {
    if (!hasAccess) {
      console.log(`[useFeatureAccess] Tentativa de buscar dados protegidos ${endpoint} negada (sem acesso)`);
      return null;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      console.log(`[useFeatureAccess] Buscando dados protegidos em ${endpoint}`);
      const response = await api.get<T>(endpoint);
      setData(response.data);
      console.log(`[useFeatureAccess] Dados obtidos com sucesso de ${endpoint}`);
      return response.data;
    } catch (err) {
      console.error(`[useFeatureAccess] Erro ao buscar dados em ${endpoint}:`, err);
      setError(err instanceof Error ? err : new Error('Erro ao buscar dados protegidos'));
      return null;
    } finally {
      setLoading(false);
    }
  };
  
  // Função para gerar dados fictícios para exibição quando o acesso é negado
  const generateMockData = (template: any) => {
    if (hasAccess) {
      return;
    }
    
    console.log(`[useFeatureAccess] Gerando dados simulados para feature "${featureId}" (acesso negado)`);
    setMockData(template);
  };
  
  return {
    data,
    mockData,
    loading: loading || subscriptionLoading,
    hasAccess,
    error,
    requiredPlan: requiredPlanForFeature,
    fetchProtectedData,
    generateMockData
  };
}

/**
 * Função auxiliar para determinar qual plano é necessário para uma feature
 */
function determineRequiredPlan(featureId: string, availablePlans: any[]): PlanType {
  // Verificar qual é o plano mínimo que contém essa feature
  if (availablePlans.find(p => p.type === PlanType.FREE && p.allowedFeatures?.includes(featureId))) {
    return PlanType.FREE;
  }
  
  if (availablePlans.find(p => p.type === PlanType.BASIC && p.allowedFeatures?.includes(featureId))) {
    return PlanType.BASIC;
  }
  
  if (availablePlans.find(p => p.type === PlanType.PRO && p.allowedFeatures?.includes(featureId))) {
    return PlanType.PRO;
  }
  
  // Se não encontrou em nenhum dos anteriores, assume que é PREMIUM
  return PlanType.PREMIUM;
} 