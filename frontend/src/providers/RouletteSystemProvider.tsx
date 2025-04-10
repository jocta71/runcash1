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
  
  // Inicializar o sistema quando o provider for montado
  useEffect(() => {
    logger.info('Inicializando sistema de roletas via provider');
    
    const initialized = RouletteSystemInitializer.initialize();
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
      
      // Registrar os listeners
      document.addEventListener('roulette:data-updated', handleDataUpdate);
      document.addEventListener('roulette:connection-changed', handleConnectionChange);
      
      return () => {
        // Limpar os listeners ao desmontar
        document.removeEventListener('roulette:data-updated', handleDataUpdate);
        document.removeEventListener('roulette:connection-changed', handleConnectionChange);
        
        // Desligar o sistema
        RouletteSystemInitializer.shutdown();
      };
    }
  }, []);
  
  // Função para solicitar atualização manual de dados
  const refreshData = () => {
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
  };

  // Valores do contexto
  const contextValue: RouletteSystemContextType = {
    isInitialized,
    isConnected,
    lastUpdate,
    refreshData
  };

  return (
    <RouletteSystemContext.Provider value={contextValue}>
      {children}
    </RouletteSystemContext.Provider>
  );
};

// Hook para usar o sistema de roletas em qualquer componente
export const useRouletteSystem = () => useContext(RouletteSystemContext);

export default RouletteSystemProvider;
