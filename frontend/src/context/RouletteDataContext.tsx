import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import UnifiedRouletteClient from '../services/UnifiedRouletteClient';
import { RouletteData } from '@/types';

// Interface para o contexto
interface RouletteDataContextType {
  roulettes: RouletteData[];
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  getRouletteById: (id: string) => RouletteData | undefined;
  getLastUpdate: () => Date;
}

// Valores padrão para o contexto
const defaultContextValue: RouletteDataContextType = {
  roulettes: [],
  isLoading: true,
  error: null,
  refreshData: async () => {},
  getRouletteById: () => undefined,
  getLastUpdate: () => new Date(),
};

// Criar o contexto
const RouletteDataContext = createContext<RouletteDataContextType>(defaultContextValue);

// Props para o provedor
interface RouletteDataProviderProps {
  children: ReactNode;
}

// Provedor do contexto
export const RouletteDataProvider: React.FC<RouletteDataProviderProps> = ({ children }) => {
  const [roulettes, setRoulettes] = useState<RouletteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Obter instância do cliente unificado
  const client = UnifiedRouletteClient.getInstance();

  // Função para carregar dados das roletas
  const loadRouletteData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Verificar se já existem dados em cache
      const cachedData = client.getAllRoulettes();
      
      if (cachedData && cachedData.length > 0) {
        console.log('[RouletteDataContext] Usando dados em cache:', cachedData.length);
        setRoulettes(cachedData);
        setLastUpdate(new Date());
        setError(null);
      } else {
        // Forçar atualização dos dados
        console.log('[RouletteDataContext] Buscando dados atualizados...');
        const data = await client.forceUpdate();
        setRoulettes(data);
        setLastUpdate(new Date());
        setError(null);
      }
    } catch (err) {
      console.error('[RouletteDataContext] Erro ao carregar dados:', err);
      setError('Falha ao carregar dados das roletas');
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  // Atualizar dados quando o provedor for montado
  useEffect(() => {
    loadRouletteData();
    
    // Assinar para atualizações
    const unsubscribe = client.on('update', (updatedData) => {
      if (Array.isArray(updatedData)) {
        console.log('[RouletteDataContext] Atualização recebida:', updatedData.length);
        setRoulettes(updatedData);
        setLastUpdate(new Date());
      } else if (updatedData && typeof updatedData === 'object') {
        // Atualizar apenas uma roleta específica
        setRoulettes(prevRoulettes => {
          const newRoulettes = [...prevRoulettes];
          const index = newRoulettes.findIndex(r => 
            r.id === updatedData.id || r._id === updatedData._id || r.nome === updatedData.nome
          );
          
          if (index !== -1) {
            newRoulettes[index] = updatedData;
          } else {
            newRoulettes.push(updatedData);
          }
          
          return newRoulettes;
        });
        setLastUpdate(new Date());
      }
    });
    
    // Limpar ao desmontar
    return () => {
      unsubscribe();
    };
  }, [client, loadRouletteData]);

  // Obter roleta por ID
  const getRouletteById = useCallback((id: string): RouletteData | undefined => {
    return roulettes.find(r => 
      r.id === id || r._id === id || (r.nome && r.nome.toLowerCase() === id.toLowerCase())
    );
  }, [roulettes]);

  // Obter timestamp da última atualização
  const getLastUpdate = useCallback((): Date => {
    return lastUpdate;
  }, [lastUpdate]);

  // Valor do contexto
  const contextValue: RouletteDataContextType = {
    roulettes,
    isLoading,
    error,
    refreshData: loadRouletteData,
    getRouletteById,
    getLastUpdate,
  };

  return (
    <RouletteDataContext.Provider value={contextValue}>
      {children}
    </RouletteDataContext.Provider>
  );
};

// Hook personalizado para usar o contexto
export const useRouletteData = (): RouletteDataContextType => {
  const context = useContext(RouletteDataContext);
  
  if (!context) {
    throw new Error('useRouletteData deve ser usado dentro de um RouletteDataProvider');
  }
  
  return context;
}; 