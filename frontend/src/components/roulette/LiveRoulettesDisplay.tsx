import React, { useEffect, useState } from 'react';
import RouletteCard from '@/components/RouletteCard';
import { RouletteData } from '@/integrations/api/rouletteService';
import RouletteFeedService from '@/services/RouletteFeedService';
import LastNumbersBar from './LastNumbersBar';
import EventService from '@/services/EventService';
import CasinoAPIAdapter from '@/services/CasinoAPIAdapter';
import RouletteMiniStats from '@/components/RouletteMiniStats';
import RouletteStatsModal from '@/components/RouletteStatsModal';

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
  const [selectedRoulette, setSelectedRoulette] = useState<RouletteData | null>(null);
  const [showStatsInline, setShowStatsInline] = useState(false);

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

  // Função para selecionar uma roleta e mostrar estatísticas ao lado
  const handleRouletteSelect = (roleta: RouletteData) => {
    setSelectedRoulette(roleta);
    setShowStatsInline(true);
  };

  // Função para fechar a visualização de estatísticas
  const handleCloseStats = () => {
    setSelectedRoulette(null);
    setShowStatsInline(false);
  };

  // Se temos dados passados por props, mostrar eles diretamente
  if (roulettesData && roulettesData.length > 0) {
    return (
      <div className="container mx-auto px-4 py-6">
        <h2 className="text-2xl font-bold mb-6 text-white">Roletas Disponíveis</h2>
        
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Lista de roletas à esquerda */}
          <div className="lg:w-1/4">
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <h3 className="text-xl font-bold text-white mb-4">Roletas</h3>
              <div className="space-y-3 max-h-[80vh] overflow-y-auto pr-2">
                {roulettes.map(roleta => (
                  <div 
                    key={roleta.id} 
                    className={`bg-gray-800 rounded-lg overflow-hidden shadow-lg cursor-pointer hover:bg-gray-750 transition-colors p-3 ${selectedRoulette?.id === roleta.id ? 'border-2 border-[#00ff00]' : ''}`}
                    onClick={() => handleRouletteSelect(roleta)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-white">{roleta.nome}</h3>
                      {Array.isArray(roleta.numero) && roleta.numero.length > 0 && (
                        <div 
                          className={`${
                            roleta.numero[0].numero === 0 
                              ? "bg-green-600" 
                              : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(roleta.numero[0].numero)
                                ? "bg-red-600"
                                : "bg-black"
                          } w-8 h-8 rounded-full flex items-center justify-center text-white font-medium`}
                        >
                          {roleta.numero[0].numero}
                        </div>
                      )}
                    </div>
                    
                    {Array.isArray(roleta.numero) && roleta.numero.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {roleta.numero.slice(0, 8).map((n, index) => {
                          const num = n.numero;
                          const bgColor = num === 0 
                            ? "bg-green-600" 
                            : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num)
                              ? "bg-red-600"
                              : "bg-black";
                          
                          return (
                            <div 
                              key={index} 
                              className={`${bgColor} text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium`}
                            >
                              {num}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm">Aguardando números...</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Estatísticas detalhadas à direita */}
          <div className="lg:w-3/4">
            {selectedRoulette && Array.isArray(selectedRoulette.numero) && selectedRoulette.numero.length > 0 ? (
              <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg h-full">
                <div className="h-full">
                  <RouletteStatsInline 
                    roletaNome={selectedRoulette.nome}
                    lastNumbers={selectedRoulette.numero.map(n => n.numero)}
                  />
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg flex items-center justify-center p-12 h-64 text-center">
                <p className="text-gray-400 text-lg">
                  {selectedRoulette 
                    ? "Não há dados suficientes para exibir estatísticas." 
                    : "Selecione uma roleta para ver estatísticas detalhadas"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // Componente de estatísticas inline 
  const RouletteStatsInline = ({ roletaNome, lastNumbers }: { roletaNome: string, lastNumbers: number[] }) => {
    return (
      <div className="p-4 h-full overflow-y-auto">
        <h3 className="text-xl font-bold text-[#00ff00] mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
            <path d="M3 3v18h18"></path>
            <path d="M18 12V8"></path>
            <path d="M12 18v-2"></path>
            <path d="M6 18v-6"></path>
          </svg>
          Estatísticas da {roletaNome}
        </h3>
        
        {/* Histórico de números */}
        <div className="mb-6 bg-gray-900 rounded-lg p-4">
          <h4 className="text-lg text-[#00ff00] mb-3">Histórico de Números</h4>
          <div className="grid grid-cols-10 gap-1 max-h-[300px] overflow-y-auto">
            {lastNumbers.slice(0, 200).map((num, idx) => {
              const bgColor = num === 0 
                ? "bg-green-600" 
                : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num)
                  ? "bg-red-600"
                  : "bg-black";
              
              return (
                <div 
                  key={idx} 
                  className={`${bgColor} text-white w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-xs font-medium`}
                >
                  {num}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Estatísticas resumidas - mostrar tabelas de estatísticas simples */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-900 rounded-lg p-4">
            <h4 className="text-lg text-white mb-3">Distribuição por Cor</h4>
            <div className="space-y-2">
              {[
                { label: "Vermelho", color: "bg-red-600", count: lastNumbers.filter(n => [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n)).length },
                { label: "Preto", color: "bg-black", count: lastNumbers.filter(n => n !== 0 && ![1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n)).length },
                { label: "Verde (0)", color: "bg-green-600", count: lastNumbers.filter(n => n === 0).length }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-4 h-4 ${item.color} rounded-full mr-2`}></div>
                    <span className="text-gray-300">{item.label}</span>
                  </div>
                  <span className="font-bold text-white">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-4">
            <h4 className="text-lg text-white mb-3">Par/Ímpar</h4>
            <div className="space-y-2">
              {[
                { label: "Par", count: lastNumbers.filter(n => n !== 0 && n % 2 === 0).length },
                { label: "Ímpar", count: lastNumbers.filter(n => n % 2 === 1).length }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-gray-300">{item.label}</span>
                  <span className="font-bold text-white">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-4">
            <h4 className="text-lg text-white mb-3">Faixas</h4>
            <div className="space-y-2">
              {[
                { label: "Baixo (1-18)", count: lastNumbers.filter(n => n >= 1 && n <= 18).length },
                { label: "Alto (19-36)", count: lastNumbers.filter(n => n >= 19 && n <= 36).length }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-gray-300">{item.label}</span>
                  <span className="font-bold text-white">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Números quentes e frios */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-900 rounded-lg p-4">
            <h4 className="text-lg text-white mb-3">Números Quentes</h4>
            <div className="flex flex-wrap gap-2">
              {getHotNumbers(lastNumbers).map((num, idx) => {
                const bgColor = num.number === 0 
                  ? "bg-green-600" 
                  : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num.number)
                    ? "bg-red-600"
                    : "bg-black";
                
                return (
                  <div key={idx} className="flex items-center">
                    <div className={`${bgColor} w-8 h-8 rounded-full flex items-center justify-center text-white mr-1`}>
                      {num.number}
                    </div>
                    <span className="text-gray-400 text-sm">({num.count}x)</span>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-4">
            <h4 className="text-lg text-white mb-3">Números Frios</h4>
            <div className="flex flex-wrap gap-2">
              {getColdNumbers(lastNumbers).map((num, idx) => {
                const bgColor = num.number === 0 
                  ? "bg-green-600" 
                  : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num.number)
                    ? "bg-red-600"
                    : "bg-black";
                
                return (
                  <div key={idx} className="flex items-center">
                    <div className={`${bgColor} w-8 h-8 rounded-full flex items-center justify-center text-white mr-1`}>
                      {num.number}
                    </div>
                    <span className="text-gray-400 text-sm">({num.count}x)</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Função para obter os números mais frequentes
  const getHotNumbers = (numbers: number[]) => {
    const frequency: Record<number, number> = {};
    
    // Inicializar todos os números possíveis
    for (let i = 0; i <= 36; i++) {
      frequency[i] = 0;
    }
    
    // Contar a frequência
    numbers.forEach(num => {
      if (frequency[num] !== undefined) {
        frequency[num]++;
      }
    });
    
    // Converter para array e ordenar do mais frequente para o menos frequente
    return Object.keys(frequency)
      .map(num => ({ number: parseInt(num), count: frequency[parseInt(num)] }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };
  
  // Função para obter os números menos frequentes
  const getColdNumbers = (numbers: number[]) => {
    const frequency: Record<number, number> = {};
    
    // Inicializar todos os números possíveis
    for (let i = 0; i <= 36; i++) {
      frequency[i] = 0;
    }
    
    // Contar a frequência
    numbers.forEach(num => {
      if (frequency[num] !== undefined) {
        frequency[num]++;
      }
    });
    
    // Converter para array e ordenar do menos frequente para o mais frequente
    return Object.keys(frequency)
      .map(num => ({ number: parseInt(num), count: frequency[parseInt(num)] }))
      .filter(item => numbers.includes(item.number) && item.count > 0)
      .sort((a, b) => a.count - b.count)
      .slice(0, 5);
  };

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