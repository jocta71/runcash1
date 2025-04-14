import React, { useEffect, useState, useRef } from 'react';
import RouletteCard from '@/components/RouletteCard';
import { RouletteData } from '@/integrations/api/rouletteService';
import RouletteFeedService from '@/services/RouletteFeedService';
import LastNumbersBar from './LastNumbersBar';
import EventService from '@/services/EventService';
import CasinoAPIAdapter from '@/services/CasinoAPIAdapter';
import RouletteMiniStats from '@/components/RouletteMiniStats';
import RouletteStatsModal from '@/components/RouletteStatsModal';
import RouletteStatsInline from './RouletteStatsInline';

// Componente de estatísticas inline 
const RouletteStatsInline = ({ roletaNome, lastNumbers }: { roletaNome: string, lastNumbers: number[] }) => {
  // Calcular estatísticas
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const redCount = lastNumbers.filter(n => redNumbers.includes(n)).length;
  const blackCount = lastNumbers.filter(n => n !== 0 && !redNumbers.includes(n)).length;
  const zeroCount = lastNumbers.filter(n => n === 0).length;
  const total = lastNumbers.length;
  
  // Calcular porcentagens
  const redPercent = Math.round((redCount / total) * 100);
  const blackPercent = Math.round((blackCount / total) * 100);
  const zeroPercent = Math.round((zeroCount / total) * 100);
  
  // Calcular frequência de números
  const numberFrequency: Record<number, number> = {};
  lastNumbers.forEach(num => {
    numberFrequency[num] = (numberFrequency[num] || 0) + 1;
  });
  
  // Encontrar números quentes (mais frequentes)
  const hotNumbers = Object.entries(numberFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => ({ number: parseInt(entry[0]), count: entry[1] }));
    
  // Encontrar números frios (menos frequentes)
  const coldNumbers = Object.entries(numberFrequency)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 5)
    .map(entry => ({ number: parseInt(entry[0]), count: entry[1] }));
  
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-green-500 mb-4">{roletaNome} - Estatísticas</h2>
      
      {/* Grid de 3 colunas para organizar as estatísticas */}
      <div className="grid grid-cols-3 gap-6">
        {/* Coluna 1: Números históricos */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-white font-semibold mb-3">Últimos Números</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {lastNumbers.slice(0, 18).map((num, idx) => {
              const bgColor = num === 0 
                ? "bg-green-600" 
                : redNumbers.includes(num) ? "bg-red-600" : "bg-black";
              
              return (
                <div 
                  key={idx}
                  className={`${bgColor} w-8 h-8 rounded-full flex items-center justify-center text-white font-medium`}
                >
                  {num}
                </div>
              );
            })}
          </div>
          <p className="text-gray-400 text-sm">Total de jogos: {total}</p>
        </div>
        
        {/* Coluna 2: Taxas de vitória */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-white font-semibold mb-3">Distribuição de Cores</h3>
          
          {/* Barra vermelho */}
          <div className="mb-2">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-red-500">Vermelho</span>
              <span className="text-white">{redCount} ({redPercent}%)</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div className="bg-red-600 h-2.5 rounded-full" style={{ width: `${redPercent}%` }}></div>
            </div>
          </div>
          
          {/* Barra preto */}
          <div className="mb-2">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-300">Preto</span>
              <span className="text-white">{blackCount} ({blackPercent}%)</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div className="bg-gray-900 h-2.5 rounded-full" style={{ width: `${blackPercent}%` }}></div>
            </div>
          </div>
          
          {/* Barra verde */}
          <div className="mb-2">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-green-500">Zero</span>
              <span className="text-white">{zeroCount} ({zeroPercent}%)</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${zeroPercent}%` }}></div>
            </div>
          </div>
          
          {/* Estatísticas adicionais em grid */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="bg-gray-700 p-2 rounded">
              <p className="text-xs text-gray-400">Par</p>
              <p className="text-white font-medium">
                {lastNumbers.filter(n => n !== 0 && n % 2 === 0).length} ({Math.round((lastNumbers.filter(n => n !== 0 && n % 2 === 0).length / total) * 100)}%)
              </p>
            </div>
            <div className="bg-gray-700 p-2 rounded">
              <p className="text-xs text-gray-400">Ímpar</p>
              <p className="text-white font-medium">
                {lastNumbers.filter(n => n % 2 === 1).length} ({Math.round((lastNumbers.filter(n => n % 2 === 1).length / total) * 100)}%)
              </p>
            </div>
            <div className="bg-gray-700 p-2 rounded">
              <p className="text-xs text-gray-400">1-18</p>
              <p className="text-white font-medium">
                {lastNumbers.filter(n => n >= 1 && n <= 18).length} ({Math.round((lastNumbers.filter(n => n >= 1 && n <= 18).length / total) * 100)}%)
              </p>
            </div>
            <div className="bg-gray-700 p-2 rounded">
              <p className="text-xs text-gray-400">19-36</p>
              <p className="text-white font-medium">
                {lastNumbers.filter(n => n >= 19 && n <= 36).length} ({Math.round((lastNumbers.filter(n => n >= 19 && n <= 36).length / total) * 100)}%)
              </p>
            </div>
          </div>
        </div>
        
        {/* Coluna 3: Números quentes e frios */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-white font-semibold mb-3">Frequência de Números</h3>
          
          {/* Números quentes */}
          <div className="mb-4">
            <h4 className="text-sm text-gray-400 mb-2">Números Quentes</h4>
            <div className="flex flex-wrap gap-2">
              {hotNumbers.map(({number, count}) => {
                const bgColor = number === 0 
                  ? "bg-green-600" 
                  : redNumbers.includes(number) ? "bg-red-600" : "bg-black";
                
                return (
                  <div key={number} className="flex flex-col items-center">
                    <div 
                      className={`${bgColor} w-8 h-8 rounded-full flex items-center justify-center text-white font-medium mb-1`}
                    >
                      {number}
                    </div>
                    <span className="text-xs text-gray-400">{count}x</span>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Números frios */}
          <div>
            <h4 className="text-sm text-gray-400 mb-2">Números Frios</h4>
            <div className="flex flex-wrap gap-2">
              {coldNumbers.map(({number, count}) => {
                const bgColor = number === 0 
                  ? "bg-green-600" 
                  : redNumbers.includes(number) ? "bg-red-600" : "bg-black";
                
                return (
                  <div key={number} className="flex flex-col items-center">
                    <div 
                      className={`${bgColor} w-8 h-8 rounded-full flex items-center justify-center text-white font-medium mb-1`}
                    >
                      {number}
                    </div>
                    <span className="text-xs text-gray-400">{count}x</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
      {/* Resumo de estatísticas */}
      <div className="mt-6 bg-gray-800 rounded-lg p-4">
        <h3 className="text-white font-semibold mb-3">Resumo de Estatísticas</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-700 p-3 rounded">
            <p className="text-sm text-gray-400">Vermelhos</p>
            <p className="text-xl font-bold text-white">{redCount}</p>
            <p className="text-xs text-red-400">{redPercent}% do total</p>
          </div>
          <div className="bg-gray-700 p-3 rounded">
            <p className="text-sm text-gray-400">Pretos</p>
            <p className="text-xl font-bold text-white">{blackCount}</p>
            <p className="text-xs text-gray-400">{blackPercent}% do total</p>
          </div>
          <div className="bg-gray-700 p-3 rounded">
            <p className="text-sm text-gray-400">Zeros</p>
            <p className="text-xl font-bold text-white">{zeroCount}</p>
            <p className="text-xs text-green-400">{zeroPercent}% do total</p>
          </div>
          <div className="bg-gray-700 p-3 rounded">
            <p className="text-sm text-gray-400">Total de jogos</p>
            <p className="text-xl font-bold text-white">{total}</p>
            <p className="text-xs text-blue-400">100%</p>
          </div>
        </div>
      </div>
    </div>
  );
};

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
  const rouletteCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // Referência ao serviço de feed centralizado, sem iniciar novo polling
  const feedService = React.useMemo(() => {
    // Verificar se o sistema já foi inicializado globalmente
    if (window.isRouletteSystemInitialized && window.isRouletteSystemInitialized()) {
      console.log('[LiveRoulettesDisplay] Usando sistema de roletas já inicializado');
      // Recuperar o serviço do sistema global
      return window.getRouletteSystem 
        ? window.getRouletteSystem().rouletteFeedService 
        : RouletteFeedService.getInstance();
    }
    
    // Fallback para o comportamento padrão
    console.log('[LiveRoulettesDisplay] Sistema global não detectado, usando instância padrão');
    return RouletteFeedService.getInstance();
  }, []);

  // Usar os dados passados como prop ou obter do feedService
  useEffect(() => {
    if (roulettesData && Array.isArray(roulettesData) && roulettesData.length > 0) {
      console.log(`[LiveRoulettesDisplay] Usando ${roulettesData.length} roletas fornecidas via props`);
      setRoulettes(roulettesData);
      setIsLoading(false);
      
      // Em vez de definir diretamente, vamos simular um clique mais tarde
    } else {
      // Obter dados do feed service em vez de fazer requisições diretas
      console.log('[LiveRoulettesDisplay] Buscando dados de roletas do serviço centralizado');
      
      // Verificar se o serviço já tem dados em cache
      const cachedRoulettes = feedService.getAllRoulettes();
      
      if (cachedRoulettes && cachedRoulettes.length > 0) {
        console.log(`[LiveRoulettesDisplay] Usando ${cachedRoulettes.length} roletas do cache centralizado`);
        setRoulettes(cachedRoulettes);
        setIsLoading(false);
        
        // Em vez de definir diretamente, vamos simular um clique mais tarde
      } else {
        // Não inicializar mais o polling aqui - isso agora é responsabilidade do sistema centralizado
        console.log('[LiveRoulettesDisplay] Aguardando dados serem carregados pela inicialização central');
        
        // Definir timeout de fallback caso demore muito
        setTimeout(() => {
          // Verificar novamente após alguns segundos
          const delayedRoulettes = feedService.getAllRoulettes();
          if (delayedRoulettes && delayedRoulettes.length > 0) {
            console.log(`[LiveRoulettesDisplay] Dados recebidos após espera: ${delayedRoulettes.length} roletas`);
            setRoulettes(delayedRoulettes);
            setIsLoading(false);
            
            // Em vez de definir diretamente, vamos simular um clique mais tarde
          }
        }, 3000); // Timeout mais curto, pois já temos um timeout na página
      }
    }
  }, [feedService, roulettesData]);
  
  // Efeito para simular clique automático quando os dados são carregados
  useEffect(() => {
    // Verificar se temos roletas carregadas, não temos roleta selecionada,
    // e a segunda roleta existe
    if (roulettes.length > 1 && !selectedRoulette && !isLoading) {
      console.log('[LiveRoulettesDisplay] Simulando clique na segunda roleta');
      // Pequeno delay para garantir que a UI já renderizou
      setTimeout(() => {
        // Simular clique usando a função de manipulação de clique existente
        handleRouletteSelect(roulettes[1]);
      }, 100);
    }
  }, [roulettes, selectedRoulette, isLoading]);

  // Inscrever-se para atualizações de dados do feed service
  useEffect(() => {
    const handleDataUpdated = (updateData: any) => {
      console.log('[LiveRoulettesDisplay] Recebida atualização de dados');
      
      // Obter dados atualizados do cache
      const updatedRoulettes = feedService.getAllRoulettes();
      
      if (updatedRoulettes && updatedRoulettes.length > 0) {
        console.log(`[LiveRoulettesDisplay] Atualizando com ${updatedRoulettes.length} roletas`);
        setRoulettes(updatedRoulettes);
        setIsLoading(false); // Garantir que o loading seja desativado
        
        // Se ainda não houver roleta selecionada, selecionar a segunda
        if (!selectedRoulette && updatedRoulettes.length > 1) {
          setSelectedRoulette(updatedRoulettes[1]);
          setShowStatsInline(true);
        } else if (selectedRoulette) {
          // Atualizar a roleta selecionada com dados mais recentes
          const updatedSelectedRoulette = updatedRoulettes.find(r => 
            r.id === selectedRoulette.id || r._id === selectedRoulette._id || r.nome === selectedRoulette.nome
          );
          
          if (updatedSelectedRoulette) {
            setSelectedRoulette(updatedSelectedRoulette);
          }
        }
      }
    };
    
    // Inscrever-se no evento de atualização de dados
    EventService.on('roulette:data-updated', handleDataUpdated);
    
    // Limpar ao desmontar
    return () => {
      EventService.off('roulette:data-updated', handleDataUpdated);
    };
  }, [feedService, selectedRoulette]);

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
      <div className="max-w-[1200px] mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Roletas Disponíveis</h2>
            <p className="text-gray-400">Escolha uma roleta para começar a jogar</p>
          </div>
          <div className="relative w-64">
            <input 
              type="text" 
              placeholder="Buscar roleta..." 
              className="w-full bg-gray-800 text-white py-2 px-4 pl-10 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <svg 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
        </div>
        
        {/* Layout flexbox: roletas à esquerda, estatísticas à direita */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Lista de roletas à esquerda */}
          <div className="w-full md:w-1/2 overflow-y-auto max-h-[calc(100vh-200px)]">
            <div className="grid grid-cols-1 gap-3">
              {roulettes.map((roleta, index) => (
                <div 
                  key={roleta.id} 
                  ref={el => rouletteCardRefs.current[index] = el}
                  className={`bg-gray-900 rounded-lg overflow-hidden shadow-lg cursor-pointer hover:bg-gray-800 transition-colors border border-gray-800 ${selectedRoulette?.id === roleta.id ? 'ring-2 ring-[#00ff00]' : ''}`}
                  onClick={() => handleRouletteSelect(roleta)}
                >
                  <div className="p-3">
                    {/* Cabeçalho do card */}
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        {/* Nome da roleta com contagem de atualizações */}
                        <h3 className="text-lg font-semibold text-white">{roleta.nome}</h3>
                        
                        {/* Ícone do número de atualizações */}
                        <div className="flex items-center">
                          <span className="bg-gray-800 text-xs text-gray-300 px-2 py-0.5 rounded">
                            {Array.isArray(roleta.numero) && roleta.numero.length > 0 ? roleta.numero.length : 0} números
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Número atual e últimos números em linha */}
                    <div className="flex items-center gap-2">
                      {/* Número atual */}
                      <div className="flex-shrink-0">
                        {Array.isArray(roleta.numero) && roleta.numero.length > 0 ? (
                          <div 
                            className={`${
                              roleta.numero[0].numero === 0 
                                ? "bg-green-600" 
                                : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(roleta.numero[0].numero)
                                  ? "bg-red-600"
                                  : "bg-black"
                            } w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold`}
                          >
                            {roleta.numero[0].numero}
                          </div>
                        ) : (
                          <div className="bg-gray-700 text-gray-400 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold">
                            ?
                          </div>
                        )}
                      </div>
                      
                      {/* Últimos números recentes em linha */}
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(roleta.numero) && roleta.numero.slice(1, 6).map((n, index) => {
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
                    </div>
                    
                    {/* Rodapé do card simplificado */}
                    <div className="flex items-center justify-between mt-3 text-xs text-gray-500 border-t border-gray-800 pt-2">
                      <div className="flex items-center gap-1">
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          width="12" 
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span>Tempo real</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Painel de estatísticas à direita */}
          <div className="w-full md:w-1/2 bg-gray-900 rounded-lg overflow-hidden shadow-lg border border-gray-800">
            {selectedRoulette && Array.isArray(selectedRoulette.numero) && selectedRoulette.numero.length > 0 ? (
              <RouletteStatsInline 
                roletaNome={selectedRoulette.nome}
                lastNumbers={selectedRoulette.numero.map(n => n.numero)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-[70vh] p-6 text-center">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="64" 
                  height="64" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="text-gray-600 mb-4"
                >
                  <path d="M3 3v18h18"></path>
                  <path d="M18 12V8"></path>
                  <path d="M12 18v-2"></path>
                  <path d="M6 18v-6"></path>
                </svg>
                <h3 className="text-xl font-semibold text-gray-300 mb-2">Selecione uma roleta</h3>
                <p className="text-gray-500 max-w-md">Clique em uma roleta à esquerda para visualizar estatísticas detalhadas, histórico de números e tendências.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
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
      
      {/* Grid de roletas com exatamente 3 cards por linha */}
      <div className="grid grid-cols-3 gap-6">
        {tables.map(table => (
          <LastNumbersBar 
            key={table.tableId}
            tableId={table.tableId}
            tableName={table.tableName}
          />
        ))}
      </div>
      
      {/* Botão para atualizar manualmente com a nova função */}
      <div className="flex justify-center mt-8">
        <button 
          onClick={() => (window as any).forceRouletteUpdate?.()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
        >
          Atualizar Agora
        </button>
      </div>
    </div>
  );
};

export default LiveRoulettesDisplay; 