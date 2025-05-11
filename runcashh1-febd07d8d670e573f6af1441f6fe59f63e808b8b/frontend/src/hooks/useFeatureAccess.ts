import { useEffect, useState } from 'react';
import { useSubscription } from '@/context/SubscriptionContext';
import { api } from '@/lib/api';

interface UseFeatureAccessOptions {
  featureId: string;
  fetchOnMount?: boolean;
  mockDataFallback?: any;
}

/**
 * Hook personalizado para gerenciar o acesso a recursos premium
 * Garante que os dados protegidos são obtidos apenas se o usuário tiver permissão
 */
export function useFeatureAccess<T>({
  featureId,
  fetchOnMount = false,
  mockDataFallback
}: UseFeatureAccessOptions) {
  const { hasFeatureAccess } = useSubscription();
  const [data, setData] = useState<T | null>(null);
  const [mockData, setMockData] = useState<any>(mockDataFallback || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const hasAccess = hasFeatureAccess(featureId);
  
  // Função para buscar dados protegidos do servidor
  const fetchProtectedData = async (endpoint: string) => {
    if (!hasAccess) {
      return null;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get<T>(endpoint);
      setData(response.data);
      return response.data;
    } catch (err) {
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
    
    setMockData(template);
  };
  
  // Efeito para buscar dados automaticamente na montagem, se solicitado
  useEffect(() => {
    if (fetchOnMount && hasAccess) {
      fetchProtectedData(`/api/features/${featureId}`);
    }
  }, [fetchOnMount, hasAccess, featureId]);
  
  return {
    data,
    mockData,
    loading,
    error,
    hasAccess,
    fetchProtectedData,
    generateMockData
  };
} 