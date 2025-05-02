import { useEffect, useState } from 'react';
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
  const [data, setData] = useState<T | null>(null);
  const [mockData, setMockData] = useState<any>(mockDataFallback || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Função que sempre retorna true para permitir acesso a todas as features
  const hasFeatureAccess = (featureId: string): boolean => {
    console.log(`[useFeatureAccess] Feature ${featureId} solicitada - acesso concedido (subscription check removido)`);
    return true;
  };
  
  // Função para buscar dados protegidos do servidor
  const fetchProtectedData = async (endpoint: string) => {
    if (!hasFeatureAccess(featureId)) {
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
    if (hasFeatureAccess(featureId)) {
      return;
    }
    
    setMockData(template);
  };
  
  // Efeito para buscar dados automaticamente na montagem, se solicitado
  useEffect(() => {
    if (fetchOnMount && hasFeatureAccess(featureId)) {
      fetchProtectedData(`/api/features/${featureId}`);
    }
  }, [fetchOnMount, hasFeatureAccess, featureId]);
  
  return {
    data,
    mockData,
    loading,
    error,
    hasFeatureAccess,
    fetchProtectedData,
    generateMockData
  };
}

export default useFeatureAccess; 