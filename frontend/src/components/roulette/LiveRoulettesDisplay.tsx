import React, { useEffect, useState } from 'react';
import RouletteCard from '@/components/RouletteCard';
import { RouletteData } from '@/integrations/api/rouletteService';
import RouletteFeedService from '@/services/RouletteFeedService';
import LastNumbersBar from './LastNumbersBar';
import EventService from '@/services/EventService';
import CasinoAPIAdapter from '@/services/CasinoAPIAdapter';

interface RouletteTable {
  tableId: string;
  tableName: string;
  numbers: string[];
  dealer?: string;
  players?: number;
}

interface LiveRoulettesDisplayProps {
  roulettesData?: RouletteData[]; // Opcional para manter compatibilidade retroativa
}

const LiveRoulettesDisplay: React.FC<LiveRoulettesDisplayProps> = ({ roulettesData }) => {
  const [tables, setTables] = useState<RouletteTable[]>([]);
  const [roulettes, setRoulettes] = useState<RouletteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Usar os dados passados como prop ou manter lógica antiga
  useEffect(() => {
    if (roulettesData && Array.isArray(roulettesData) && roulettesData.length > 0) {
      console.log(`[LiveRoulettesDisplay] Usando ${roulettesData.length} roletas fornecidas via props`);
      setRoulettes(roulettesData);
      
      // Converter os dados das roletas para o formato de tabela
      const rouletteTables = roulettesData.map(roleta => {
        // Extrair os números do campo numero (limitado a 30 mais recentes)
        const numeros = Array.isArray(roleta.numero) 
          ? roleta.numero.slice(0, 30).map(n => n.numero.toString()) 
          : [];
        
        return {
          tableId: roleta.id || '',
          tableName: roleta.nome || roleta.name || 'Roleta',
          numbers: numeros,
          canonicalId: roleta.canonicalId || roleta._id
        };
      });
      
      console.log('[LiveRoulettesDisplay] Tabelas de roletas criadas a partir dos dados:', rouletteTables);
      setTables(rouletteTables);
      setIsLoading(false);
    }
  }, [roulettesData]);

  // Se temos dados passados por props, mostrar eles diretamente
  if (roulettesData && roulettesData.length > 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-6 text-white">Roletas ao Vivo</h2>
        
        {/* Grid de roletas com os dados da API */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roulettes.map(roleta => (
            <div key={roleta.id} className="bg-gray-800 rounded-lg overflow-hidden shadow-lg">
              <div className="p-4">
                <h3 className="text-xl font-bold text-white mb-2">{roleta.nome || roleta.name}</h3>
                <p className="text-gray-400 text-sm mb-4">ID: {roleta.canonicalId || roleta._id || roleta.id}</p>
                
                {/* Exibir os últimos 20 números */}
                <div className="mb-4">
                  <h4 className="text-lg font-semibold text-white mb-2">Últimos números:</h4>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(roleta.numero) && roleta.numero.length > 0 ? (
                      roleta.numero.slice(0, 20).map((numero, index) => {
                        // Determinar a cor do número para exibição
                        let bgColor = 'bg-green-500'; // Verde para zero
                        if (numero.numero > 0) {
                          bgColor = numero.cor === 'vermelho' ? 'bg-red-600' : 'bg-black';
                        }
                        
                        return (
                          <div 
                            key={index} 
                            className={`${bgColor} w-8 h-8 rounded-full flex items-center justify-center text-white font-bold`}
                          >
                            {numero.numero}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-gray-500">Nenhum número disponível</p>
                    )}
                  </div>
                </div>
                
                {/* Estatísticas básicas */}
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="bg-gray-700 p-2 rounded text-center">
                    <span className="text-gray-300 text-sm">Vermelhos</span>
                    <p className="text-white font-bold">
                      {Array.isArray(roleta.numero) 
                        ? roleta.numero.filter(n => n.cor === 'vermelho').length 
                        : 0}
                    </p>
                  </div>
                  <div className="bg-gray-700 p-2 rounded text-center">
                    <span className="text-gray-300 text-sm">Pretos</span>
                    <p className="text-white font-bold">
                      {Array.isArray(roleta.numero) 
                        ? roleta.numero.filter(n => n.cor === 'preto').length 
                        : 0}
                    </p>
                  </div>
                  <div className="bg-gray-700 p-2 rounded text-center">
                    <span className="text-gray-300 text-sm">Zeros</span>
                    <p className="text-white font-bold">
                      {Array.isArray(roleta.numero) 
                        ? roleta.numero.filter(n => n.numero === 0).length 
                        : 0}
                    </p>
                  </div>
                  <div className="bg-gray-700 p-2 rounded text-center">
                    <span className="text-gray-300 text-sm">Total</span>
                    <p className="text-white font-bold">
                      {Array.isArray(roleta.numero) ? roleta.numero.length : 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Lógica antiga do componente (mantida para compatibilidade)
  useEffect(() => {
    // Iniciar o adaptador de API do cassino
    const apiAdapter = CasinoAPIAdapter.getInstance();
    apiAdapter.configure({
      pollInterval: 5000 // 5 segundos entre verificações
    });
    
    // Buscar dados iniciais imediatamente
    apiAdapter.fetchDataOnce().then(initialData => {
      console.log('[LiveRoulettesDisplay] Dados iniciais carregados com sucesso:', 
        initialData?.LiveTables ? Object.keys(initialData.LiveTables).length : 0);
    });
    
    // Iniciar polling regular
    apiAdapter.startPolling();
    
    // Função para atualizar a lista de mesas
    const updateTables = () => {
      const feedService = RouletteFeedService.getInstance();
      const allTables = feedService.getAllRouletteTables();
      
      if (allTables.length > 0) {
        console.log(`[LiveRoulettesDisplay] Atualizando lista de mesas: ${allTables.length} mesas disponíveis`);
        
        const formattedTables = allTables.map(item => ({
          tableId: item.tableId,
          tableName: item.tableId, // Inicialmente usamos o ID como nome
          numbers: item.numbers
        }));
        
        setTables(formattedTables);
        setIsLoading(false);
      }
    };
    
    // Escutar por atualizações de números
    const handleNumbersUpdated = (data: any) => {
      console.log(`[LiveRoulettesDisplay] Dados atualizados para mesa ${data.tableName || data.tableId}:`, {
        primeiros_numeros: data.numbers?.slice(0, 3)
      });
      
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
          console.log(`[LiveRoulettesDisplay] Nova mesa adicionada: ${data.tableName || data.tableId}`);
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
    EventService.on('casino:data-updated', () => {
      console.log('[LiveRoulettesDisplay] Dados gerais do casino atualizados, atualizando a lista de mesas');
      setTimeout(updateTables, 100); // Pequeno delay para garantir que o serviço processou os dados
    });
    
    // Escutar por eventos específicos de novos números
    const handleNewNumber = (data: any) => {
      console.log(`[LiveRoulettesDisplay] NOVO NÚMERO recebido para ${data.tableName || data.tableId}: ${data.number}`);
      
      // Forçar atualização imediata para garantir que o novo número seja mostrado
      setTimeout(() => {
        apiAdapter.fetchDataOnce();
        updateTables();
      }, 100);
    };
    
    // Registrar evento para novos números
    EventService.on('roulette:new-number', handleNewNumber);
    
    // Verificar se já temos mesas disponíveis
    updateTables();
    
    // Configurar um intervalo para verificar atualizações em caso de falha no evento
    const checkInterval = setInterval(() => {
      console.log('[LiveRoulettesDisplay] Verificação periódica de dados');
      apiAdapter.fetchDataOnce(); // Forçar atualização periódica
      
      // Re-verificar estado das mesas para garantir que temos os dados mais recentes
      setTimeout(updateTables, 200);
    }, 15000); // A cada 15 segundos
    
    // Limpeza ao desmontar
    return () => {
      EventService.off('roulette:numbers-updated', handleNumbersUpdated);
      EventService.off('casino:data-updated', updateTables);
      EventService.off('roulette:new-number', handleNewNumber);
      clearInterval(checkInterval);
      apiAdapter.stopPolling();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8 h-64">
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
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-6 text-white">Roletas ao Vivo</h2>
      
      {/* Grid de roletas similar ao do site de referência */}
      <div className="sc-casino-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {tables.map(table => (
          <LastNumbersBar 
            key={table.tableId}
            tableId={table.tableId}
            tableName={table.tableName}
          />
        ))}
      </div>
      
      {/* Botão para atualizar manualmente */}
      <div className="flex justify-center mt-8">
        <button 
          onClick={() => CasinoAPIAdapter.getInstance().fetchDataOnce()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
        >
          Atualizar Dados
        </button>
      </div>
    </div>
  );
};

export default LiveRoulettesDisplay; 