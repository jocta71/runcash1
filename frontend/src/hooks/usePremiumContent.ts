import { useState, useEffect } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { api } from '@/lib/api';
import { PlanType } from '@/types/plans';

interface UsePremiumContentOptions {
  /**
   * ID do recurso que está sendo acessado
   */
  featureId: string;
  /**
   * Plano mínimo necessário para acesso completo
   */
  requiredPlan?: PlanType;
  /**
   * Endpoint da API para buscar dados (sem o prefixo de API)
   */
  endpoint?: string;
  /**
   * Se true, faz a requisição automaticamente na montagem do componente
   */
  fetchOnMount?: boolean;
  /**
   * Dados de fallback para mostrar quando o usuário não tem acesso
   */
  fallbackData?: any;
  /**
   * Nível de degradação para usuários sem acesso (0-100)
   * Define o quanto os dados serão limitados/degradados para usuários sem plano
   * 0 = sem degradação, 100 = totalmente degradado (sem dados)
   */
  degradationLevel?: number;
}

/**
 * Hook para gerenciar acesso a conteúdo premium
 * Permite mostrar versões degradadas ou estilizadas do conteúdo para usuários sem assinatura
 */
export function usePremiumContent<T>({
  featureId,
  requiredPlan = PlanType.BASIC,
  endpoint,
  fetchOnMount = false,
  fallbackData = null,
  degradationLevel = 70,
}: UsePremiumContentOptions) {
  const { hasFeatureAccess, currentPlan } = useSubscription();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  
  const hasAccess = hasFeatureAccess(featureId);
  
  /**
   * Função para buscar dados da API
   * Se o usuário tem acesso, obtém dados completos
   * Se não tem acesso e degradedPreview=true, obtém dados degradados
   */
  const fetchData = async (customEndpoint?: string): Promise<T | null> => {
    if (!endpoint && !customEndpoint) {
      console.error('Endpoint não especificado para fetchData');
      return null;
    }
    
    const targetEndpoint = customEndpoint || endpoint;
    
    try {
      setLoading(true);
      setError(null);
      
      // Adicionar parâmetro indicando se o usuário tem acesso premium
      const params = new URLSearchParams();
      params.append('hasAccess', hasAccess ? 'true' : 'false');
      
      // Adicionar informação do plano atual para o backend decidir o nível de acesso
      if (currentPlan) {
        params.append('planType', currentPlan.type);
      }
      
      // Adicionar o nível de degradação solicitado
      params.append('degradationLevel', degradationLevel.toString());
      
      // Fazer requisição incluindo os parâmetros
      const response = await api.get<T>(`${targetEndpoint}?${params.toString()}`);
      
      setData(response.data);
      return response.data;
    } catch (err) {
      console.error('Erro ao buscar dados premium:', err);
      setError(err instanceof Error ? err : new Error('Erro ao buscar dados premium'));
      return null;
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Processa dados para usuários sem acesso premium
   * Aplica degradação conforme o nível configurado
   */
  const processDataForNonPremium = (fullData: any): any => {
    if (hasAccess || !fullData) return fullData;
    
    // Função adaptativa para degradar dados com base no nível de degradação
    try {
      // Para arrays, limita o número de itens
      if (Array.isArray(fullData)) {
        const limitFactor = 1 - degradationLevel / 100;
        const limitCount = Math.max(1, Math.floor(fullData.length * limitFactor));
        return fullData.slice(0, limitCount);
      }
      
      // Para objetos, reduz propriedades ou detalhe
      if (typeof fullData === 'object' && fullData !== null) {
        // Versão simplificada retornando apenas algumas propriedades
        const simplifiedData = {};
        const mainProps = Object.keys(fullData).slice(0, 3); // Pegar apenas primeiras 3 propriedades
        
        mainProps.forEach(prop => {
          simplifiedData[prop] = fullData[prop];
        });
        
        // Adicionar indicador de conteúdo degradado
        simplifiedData['isPremiumDegraded'] = true;
        
        return simplifiedData;
      }
      
      // Para outros tipos, retorna como está
      return fullData;
    } catch (err) {
      console.error('Erro ao processar dados para versão não-premium:', err);
      return fallbackData || { error: 'Dados limitados para usuários premium' };
    }
  };
  
  // Efetuar fetch automático se solicitado
  useEffect(() => {
    if (fetchOnMount && endpoint) {
      fetchData();
    }
  }, [fetchOnMount, endpoint, hasAccess]);
  
  return {
    data,
    loading,
    error,
    hasAccess,
    fetchData,
    processDataForNonPremium,
    degradationLevel
  };
} 