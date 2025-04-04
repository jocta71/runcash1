import { useEffect, useState } from 'react';
import RouletteFeedService from '@/services/RouletteFeedService';
import LastNumbersBar from './LastNumbersBar';
import EventService from '@/services/EventService';

interface RouletteTable {
  tableId: string;
  tableName: string;
  numbers: string[];
  dealer?: string;
  players?: number;
}

const LiveRoulettesDisplay = () => {
  const [tables, setTables] = useState<RouletteTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Iniciar o serviço de feed das roletas
    const feedService = RouletteFeedService.getInstance();
    feedService.startPolling();
    
    // Função para atualizar a lista de mesas
    const updateTables = () => {
      const allTables = feedService.getAllRouletteTables();
      
      if (allTables.length > 0) {
        const formattedTables = allTables.map(item => ({
          tableId: item.tableId,
          tableName: item.tableId, // Inicialmente usamos o ID como nome
          numbers: item.numbers
        }));
        
        setTables(formattedTables);
        setIsLoading(false);
      }
    };
    
    // Verificar se já temos mesas disponíveis
    updateTables();
    
    // Escutar por atualizações de números
    const handleNumbersUpdated = (data: any) => {
      setTables(prevTables => {
        // Verificar se a mesa já existe na lista
        const tableIndex = prevTables.findIndex(t => t.tableId === data.tableId);
        
        if (tableIndex >= 0) {
          // Atualizar mesa existente
          const updatedTables = [...prevTables];
          updatedTables[tableIndex] = {
            ...updatedTables[tableIndex],
            numbers: data.numbers,
            tableName: data.tableName || updatedTables[tableIndex].tableName,
            dealer: data.dealer,
            players: data.players
          };
          return updatedTables;
        } else {
          // Adicionar nova mesa
          return [
            ...prevTables,
            {
              tableId: data.tableId,
              tableName: data.tableName || data.tableId,
              numbers: data.numbers,
              dealer: data.dealer,
              players: data.players
            }
          ];
        }
      });
      
      setIsLoading(false);
    };
    
    // Inscrever para eventos de atualização
    EventService.on('roulette:numbers-updated', handleNumbersUpdated);
    
    // Configurar um intervalo para verificar atualizações em caso de falha no evento
    const checkInterval = setInterval(updateTables, 10000);
    
    // Limpeza ao desmontar
    return () => {
      EventService.off('roulette:numbers-updated', handleNumbersUpdated);
      clearInterval(checkInterval);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        <span className="ml-2 text-white">Carregando mesas de roleta...</span>
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="text-center p-4 text-gray-400">
        Nenhuma mesa de roleta ativa no momento.
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4 text-white">Roletas ao Vivo</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tables.map(table => (
          <LastNumbersBar 
            key={table.tableId}
            tableId={table.tableId}
            tableName={table.tableName}
          />
        ))}
      </div>
    </div>
  );
};

export default LiveRoulettesDisplay; 