import React, { useEffect, useState } from 'react';
import RouletteFeedService from '../services/RouletteFeedService';
import EventService from '../services/EventService';

interface RouletteTableProps {
  tableId: string;
  tableName: string;
  dealer: string;
  numbers: string[];
}

const RouletteTable: React.FC<RouletteTableProps> = ({ tableId, tableName, dealer, numbers }) => {
  // Função para determinar a cor do número
  const getNumberColor = (number: string): string => {
    const num = parseInt(number, 10);
    if (num === 0) return 'bg-green-600';
    
    // Números vermelhos na roleta europeia
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return redNumbers.includes(num) ? 'bg-red-600' : 'bg-gray-900';
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold mb-2">{tableName}</h3>
      <p className="text-sm text-gray-600 mb-3">Dealer: {dealer}</p>
      
      <div className="flex flex-wrap gap-2">
        {numbers.map((number, index) => (
          <div 
            key={`${tableId}-${number}-${index}`} 
            className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${getNumberColor(number)} ${index === 0 ? 'animate-pulse' : ''}`}
          >
            {number}
          </div>
        ))}
        
        {numbers.length === 0 && (
          <p className="text-sm text-gray-500 italic">Sem números registrados</p>
        )}
      </div>
    </div>
  );
};

const CasinoRoulettes: React.FC = () => {
  const [rouletteTables, setRouletteTables] = useState<{
    tableId: string;
    tableName: string;
    dealer: string;
    numbers: string[];
  }[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Inicializar o serviço de feed de roletas
    const rouletteFeedService = RouletteFeedService.getInstance();
    
    // Iniciar o serviço usando o 888casino
    rouletteFeedService.start(true);
    
    // Função para processar atualizações de números
    const handleNumbersUpdate = (data: any) => {
      setRouletteTables(prev => {
        // Verificar se a mesa já existe na lista
        const existingTableIndex = prev.findIndex(table => table.tableId === data.tableId);
        
        if (existingTableIndex >= 0) {
          // Atualizar mesa existente
          const updatedTables = [...prev];
          updatedTables[existingTableIndex] = {
            ...updatedTables[existingTableIndex],
            numbers: data.numbers
          };
          return updatedTables;
        } else {
          // Adicionar nova mesa
          return [
            ...prev,
            {
              tableId: data.tableId,
              tableName: data.tableName || `Mesa ${data.tableId}`,
              dealer: data.dealer || 'Desconhecido',
              numbers: data.numbers
            }
          ];
        }
      });
      
      setIsLoading(false);
    };
    
    // Escutar eventos de atualização
    EventService.on('roulette:numbers-updated', handleNumbersUpdate);
    
    // Carregar dados iniciais após um curto intervalo
    setTimeout(() => {
      const initialTables = rouletteFeedService.getAllRouletteTables();
      
      if (initialTables.length > 0) {
        setRouletteTables(initialTables.map(table => ({
          tableId: table.tableId,
          tableName: table.tableName || `Mesa ${table.tableId}`,
          dealer: 'Carregando...',
          numbers: table.numbers
        })));
        
        setIsLoading(false);
      }
    }, 2000); // Esperar 2 segundos para carregar dados iniciais
    
    // Limpar ao desmontar
    return () => {
      EventService.off('roulette:numbers-updated', handleNumbersUpdate);
      rouletteFeedService.stop();
    };
  }, []);
  
  // Ordenar mesas por nome
  const sortedTables = [...rouletteTables].sort((a, b) => 
    a.tableName.localeCompare(b.tableName)
  );
  
  // Filtrar apenas mesas de roleta (caso recebamos outros tipos)
  const roulettesOnly = sortedTables.filter(table => 
    table.tableName.toLowerCase().includes('roulette') || 
    table.tableName.toLowerCase().includes('ruleta')
  );
  
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-6">Roletas ao Vivo (888casino)</h2>
      
      {isLoading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-2"></div>
          <p>Carregando roletas...</p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      )}
      
      {!isLoading && roulettesOnly.length === 0 && !error && (
        <div className="text-center py-8 text-gray-500">
          <p>Nenhuma roleta encontrada.</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roulettesOnly.map(table => (
          <RouletteTable
            key={table.tableId}
            tableId={table.tableId}
            tableName={table.tableName}
            dealer={table.dealer}
            numbers={table.numbers}
          />
        ))}
      </div>
    </div>
  );
};

export default CasinoRoulettes; 