import { useState, useEffect, useCallback } from 'react';
import { fetchCardRouletteData, CardRouletteData } from '@/integrations/api/rouletteService';

interface UseCardRouletteDataResult {
  data: CardRouletteData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook para buscar e gerenciar os dados específicos para o card de roleta
 * @param roletaId ID da roleta para buscar os dados
 * @returns Objeto com dados da roleta, estado de carregamento, erro e função de atualização
 */
export const useCardRouletteData = (roletaId: string): UseCardRouletteDataResult => {
  const [data, setData] = useState<CardRouletteData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Função para buscar os dados da roleta
  const fetchData = useCallback(async () => {
    if (!roletaId) {
      setError('ID da roleta não informado');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const cardData = await fetchCardRouletteData(roletaId);
      
      if (cardData) {
        setData(cardData);
      } else {
        setError('Dados da roleta não encontrados');
      }
    } catch (err: any) {
      console.error('Erro ao buscar dados do card de roleta:', err);
      setError(`Erro ao buscar dados: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [roletaId]);

  // Função para atualizar os dados manualmente
  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  // Efeito para carregar os dados na inicialização
  useEffect(() => {
    fetchData();
    
    // Opcionalmente, pode-se adicionar um intervalo para atualização automática
    // const interval = setInterval(fetchData, 30000); // 30 segundos
    // return () => clearInterval(interval);
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refresh
  };
};

export default useCardRouletteData; 