import { useState, useEffect } from 'react';
import { RouletteRepository, RouletteData } from '../services/data/rouletteRepository';

/**
 * Hook personalizado para acessar os dados de uma roleta específica
 * @param rouletteId ID da roleta (qualquer formato)
 * @returns Estado do hook contendo os dados, estado de carregamento e erro
 */
export function useRoulette(rouletteId: string) {
  const [roulette, setRoulette] = useState<RouletteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      try {
        setLoading(true);
        
        if (!rouletteId) {
          throw new Error('ID da roleta não fornecido');
        }
        
        const data = await RouletteRepository.fetchRouletteById(rouletteId);
        
        if (!isMounted) return;
        
        if (data) {
          setRoulette(data);
          setError(null);
        } else {
          setError(`Roleta não encontrada (ID: ${rouletteId})`);
        }
      } catch (err) {
        if (!isMounted) return;
        
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error('useRoulette error:', err);
        setError(errorMsg);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    loadData();
    
    // Assinar atualizações em tempo real
    const unsubscribe = RouletteRepository.subscribeToRouletteUpdates(
      rouletteId,
      (updatedData) => {
        if (isMounted) {
          setRoulette(updatedData);
        }
      }
    );
    
    // Limpar ao desmontar
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [rouletteId]);
  
  return { roulette, loading, error };
}

/**
 * Hook personalizado para acessar os dados de múltiplas roletas
 * @param rouletteIds Lista de IDs de roletas
 * @returns Estado do hook contendo um objeto mapeado de IDs para dados, estado de carregamento e erro
 */
export function useMultipleRoulettes(rouletteIds: string[]) {
  const [roulettes, setRoulettes] = useState<Record<string, RouletteData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    let isMounted = true;
    const unsubscribers: (() => void)[] = [];
    
    const loadData = async () => {
      try {
        setLoading(true);
        
        if (!rouletteIds.length) {
          setRoulettes({});
          return;
        }
        
        // Mapa para armazenar dados das roletas
        const roulettesMap: Record<string, RouletteData> = {};
        
        // Carregar todas as roletas de uma vez para otimizar
        const allRoulettes = await RouletteRepository.fetchAllRoulettesWithNumbers();
        
        if (!isMounted) return;
        
        // Filtrar apenas as roletas solicitadas
        for (const id of rouletteIds) {
          const roulette = allRoulettes.find(r => 
            r.id === id || id.includes(r.id) || r.id.includes(id)
          );
          
          if (roulette) {
            roulettesMap[id] = roulette;
            
            // Assinar atualizações em tempo real para cada roleta
            const unsubscribe = RouletteRepository.subscribeToRouletteUpdates(
              id,
              (updatedData) => {
                if (isMounted) {
                  setRoulettes(prev => ({
                    ...prev,
                    [id]: updatedData
                  }));
                }
              }
            );
            
            unsubscribers.push(unsubscribe);
          }
        }
        
        setRoulettes(roulettesMap);
        setError(null);
      } catch (err) {
        if (!isMounted) return;
        
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error('useMultipleRoulettes error:', err);
        setError(errorMsg);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    loadData();
    
    // Limpar ao desmontar
    return () => {
      isMounted = false;
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [rouletteIds.join(',')]);
  
  return { roulettes, loading, error };
} 