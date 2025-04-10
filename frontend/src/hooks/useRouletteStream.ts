import { useState, useEffect } from 'react';
import RouletteStreamService from '@/services/RouletteStreamService';
import EventService from '@/services/EventService';

/**
 * Hook para acesso aos dados de streaming de roleta em tempo real
 */
export const useRouletteStream = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [roulettes, setRoulettes] = useState<any[]>([]);

  useEffect(() => {
    // Obter o serviço singleton
    const streamService = RouletteStreamService.getInstance();
    
    // Definir o handler para atualizações de dados
    const handleDataUpdate = (event: any) => {
      if (event && event.data) {
        setRoulettes(event.data);
        setLastUpdate(new Date());
      }
    };
    
    // Registrar evento para receber atualizações de dados em tempo real
    EventService.on('roulette:data-updated', handleDataUpdate);
    
    // Iniciar a conexão com o serviço de streaming
    streamService.connect();
    setIsConnected(true);
    
    // Limpeza ao desmontar
    return () => {
      EventService.off('roulette:data-updated', handleDataUpdate);
    };
  }, []);

  /**
   * Solicita uma atualização manual dos dados
   */
  const refreshData = () => {
    EventService.emit('roulette:manual-refresh', {
      timestamp: new Date().toISOString()
    });
  };

  return {
    isConnected,
    lastUpdate,
    roulettes,
    refreshData
  };
};
