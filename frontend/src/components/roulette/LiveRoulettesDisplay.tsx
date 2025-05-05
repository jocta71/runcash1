import React, { useEffect, useState, useRef } from 'react';
// <<< Remover import RouletteData daqui se não usada ou importar de local correto >>>
// import { RouletteData } from '@/integrations/api/rouletteService';
import LastNumbersBar from './LastNumbersBar';
// <<< Remover import EventService se não usado >>>
// import EventService from '@/services/EventService';

// <<< Mover/Ajustar tipo RouletteData >>>
interface RouletteData { 
  id: string;
  _id?: string; 
  name?: string;
  nome?: string;
  numero?: any[];
  [key: string]: any;
}

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
  roulettesData?: RouletteData[];
}

const LiveRoulettesDisplay: React.FC<LiveRoulettesDisplayProps> = ({ roulettesData }) => {
  // Estado simplificado
  const [roulettes, setRoulettes] = useState<RouletteData[]>(roulettesData || []);
  const [isLoading, setIsLoading] = useState(!roulettesData || roulettesData.length === 0);
  const [selectedRoulette, setSelectedRoulette] = useState<RouletteData | null>(null);
  const [showStatsInline, setShowStatsInline] = useState(false);
  const rouletteCardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // useEffect para atualizar estado com base nas props
  useEffect(() => {
    if (roulettesData && Array.isArray(roulettesData)) {
      console.log(`[LiveRoulettesDisplay] Atualizando com ${roulettesData.length} roletas das props`);
      setRoulettes(roulettesData);
      setIsLoading(roulettesData.length === 0);
    } else {
      setRoulettes([]);
      setIsLoading(true);
    }
  }, [roulettesData]);

  // Funções de controle da UI
  const handleRouletteSelect = (roleta: RouletteData) => {
    console.log("[LiveRoulettesDisplay] Roleta selecionada:", roleta.nome || roleta.id);
    setSelectedRoulette(roleta);
    setShowStatsInline(true);
  };

  const handleCloseStats = () => {
    setSelectedRoulette(null);
    setShowStatsInline(false);
  };

  // Lógica de renderização (simplificada para o exemplo)
  if (isLoading) {
    // Pode mostrar um loader aqui se necessário
    return <div>Carregando roletas...</div>;
  }
  
  if (roulettes.length === 0) {
     return <div className="text-center p-4 text-gray-400">Nenhuma roleta disponível no momento.</div>;
  }

  // <<< Código de renderização principal >>>
  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6">
       {/* ... (Cabeçalho, busca, etc. - Omitido para brevidade) ... */}
       
       <div className="flex flex-col md:flex-row gap-4">
         {/* Lista de roletas à esquerda */}
         <div className="w-full md:w-1/2 overflow-y-auto max-h-[calc(100vh-200px)]">
           <div className="grid grid-cols-1 gap-3">
             {roulettes.map((roleta, index) => (
               <div 
                 key={roleta.id || roleta._id || index} // Chave mais robusta
                 ref={el => rouletteCardRefs.current[index] = el}
                 className={`bg-gray-900 rounded-lg overflow-hidden shadow-lg cursor-pointer hover:bg-gray-800 transition-colors border ${selectedRoulette?.id === roleta.id ? 'border-2 border-[#00ff00]' : 'border-gray-800'}`}
                 onClick={() => handleRouletteSelect(roleta)}
               >
                 <div className="p-3">
                    <h3 className="text-white font-semibold text-sm">{roleta.nome || roleta.name || `Roleta ${roleta.id}`}</h3>
                    {/* <<< CORRIGIR PROPS PASSADAS PARA LastNumbersBar >>> */}
                    {roleta.numero && (
                       <LastNumbersBar 
                         tableId={roleta.id || roleta._id || 'unknown'} // Passar ID
                         tableName={roleta.nome || roleta.name || 'Unknown Roulette'} // Passar nome
                         numbers={Array.isArray(roleta.numero) ? roleta.numero.slice(-10) : []} // Passar números
                         interactive={false} // Não interativo dentro do display?
                       />
                    )} 
                 </div>
               </div>
             ))}
           </div>
         </div>

         {/* Painel de estatísticas à direita */}
         <div className={`w-full md:w-1/2 transition-all duration-300 ease-in-out ${showStatsInline ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full md:translate-x-0 md:opacity-100 pointer-events-none md:pointer-events-auto'}`}>
           {selectedRoulette && showStatsInline && (
             <div className="bg-gray-900 rounded-lg shadow-lg relative h-full">
               <button 
                 onClick={handleCloseStats} 
                 className="absolute top-2 right-2 text-gray-400 hover:text-white z-10"
                 aria-label="Fechar estatísticas"
               >
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
               </button>
               <RouletteStatsInline 
                  roletaNome={selectedRoulette.nome || selectedRoulette.name || `Roleta ${selectedRoulette.id}`}
                  lastNumbers={selectedRoulette.numero || []} 
               />
             </div>
           )}
           {!selectedRoulette && showStatsInline && (
              <div className="bg-gray-900 rounded-lg shadow-lg h-full flex items-center justify-center text-gray-500">
                 Selecione uma roleta para ver as estatísticas.
              </div>
           )}
         </div>
       </div>
    </div>
  );
};

export default LiveRoulettesDisplay; 