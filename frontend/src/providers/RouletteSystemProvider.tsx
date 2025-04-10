import React, { createContext, useEffect, useState, useContext } from 'react';
import RouletteSystemInitializer from '@/services/RouletteSystemInitializer';
import { getLogger } from '@/services/utils/logger';

const logger = getLogger('RouletteSystemProvider');

// Contexto para o sistema de roletas
interface RouletteSystemContextType {
  isInitialized: boolean;
  isConnected: boolean;
  lastUpdate: Date | null;
  refreshData: () => void;
}

const defaultContext: RouletteSystemContextType = {
  isInitialized: false,
  isConnected: false,
  lastUpdate: null,
  refreshData: () => {}
};

export const RouletteSystemContext = createContext<RouletteSystemContextType>(defaultContext);

// Provider para o sistema de roletas
export const RouletteSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  // Inicializar o sistema quando o provider for montado
  useEffect(() => {
    try {
      logger.info('Inicializando sistema de roletas via provider');
      
      // Tentar inicializar de forma segura
      let initialized = false;
      try {
        initialized = RouletteSystemInitializer.initialize();
      } catch (initError) {
        logger.error('Erro ao inicializar o sistema de roletas:', initError);
        console.error('Falha ao inicializar sistema de roletas:', initError);
        // Continuar mesmo com erro para não quebrar a renderização
      }
      
      setIsInitialized(initialized);
      
      if (initialized) {
        setIsConnected(true);
        
        // Registrar para eventos de atualização
        const handleDataUpdate = () => {
          setLastUpdate(new Date());
        };
        
        // Registrar para eventos de conexão/desconexão
        const handleConnectionChange = (event: any) => {
          if (event && typeof event.connected === 'boolean') {
            setIsConnected(event.connected);
          }
        };
        
        try {
          // Registrar os listeners
          document.addEventListener('roulette:data-updated', handleDataUpdate);
          document.addEventListener('roulette:connection-changed', handleConnectionChange);
          
          return () => {
            try {
              // Limpar os listeners ao desmontar
              document.removeEventListener('roulette:data-updated', handleDataUpdate);
              document.removeEventListener('roulette:connection-changed', handleConnectionChange);
              
              // Desligar o sistema
              RouletteSystemInitializer.shutdown();
            } catch (cleanupError) {
              logger.error('Erro ao limpar recursos do sistema de roletas:', cleanupError);
            }
          };
        } catch (eventsError) {
          logger.error('Erro ao configurar eventos:', eventsError);
          console.error('Falha ao configurar eventos de roletas:', eventsError);
        }
      }
    } catch (fatalError) {
      setError(fatalError as Error);
      logger.error('Erro fatal ao configurar o provider de roletas:', fatalError);
      console.error('Erro fatal no provider de roletas:', fatalError);
    }
  }, []);
  
  // Função para solicitar atualização manual de dados
  const refreshData = () => {
    try {
      if (isInitialized) {
        // Solicitar atualização através do sistema
        const streamService = RouletteSystemInitializer.getStreamService();
        if (streamService) {
          logger.info('Solicitando atualização manual de dados');
          const event = new CustomEvent('roulette:manual-refresh', {
            detail: { timestamp: new Date().toISOString() }
          });
          document.dispatchEvent(event);
          setLastUpdate(new Date());
        }
      }
    } catch (refreshError) {
      logger.error('Erro ao solicitar atualização manual:', refreshError);
      console.error('Falha ao solicitar atualização manual de dados:', refreshError);
    }
  };

  // Valores do contexto
  const contextValue: RouletteSystemContextType = {
    isInitialized,
    isConnected,
    lastUpdate,
    refreshData
  };

  // Se houver erro fatal, renderize um fallback simples
  if (error) {
    console.warn('O provider de roletas encontrou um erro, mas continuará renderizando seus filhos');
  }

  return (
    <RouletteSystemContext.Provider value={contextValue}>
      {children}
    </RouletteSystemContext.Provider>
  );
};

// Hook para usar o sistema de roletas em qualquer componente
export const useRouletteSystem = () => useContext(RouletteSystemContext);

export default RouletteSystemProvider;
