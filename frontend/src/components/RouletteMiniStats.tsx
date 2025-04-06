import React, { useState, useMemo } from 'react';
import { BarChart } from 'lucide-react';
import RouletteStatsModal from './RouletteStatsModal';

interface RouletteMiniStatsProps {
  roletaId: string;
  roletaNome: string;
  numbers: number[];
}

const RouletteMiniStats: React.FC<RouletteMiniStatsProps> = ({ 
  roletaId, 
  roletaNome, 
  numbers = [] 
}) => {
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  
  // Calcular estatísticas dos números
  const stats = useMemo(() => {
    if (!numbers || numbers.length === 0) {
      return {
        red: 0, 
        black: 0,
        green: 0,
        odd: 0,
        even: 0,
        high: 0,
        low: 0,
        total: 0
      };
    }

    // Números vermelhos na roleta europeia
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    
    let red = 0, black = 0, green = 0;
    let odd = 0, even = 0;
    let high = 0, low = 0;
    
    for (const num of numbers) {
      // Cor
      if (num === 0) {
        green++;
      } else if (redNumbers.includes(num)) {
        red++;
      } else {
        black++;
      }
      
      // Par/ímpar (0 não é contabilizado)
      if (num !== 0) {
        if (num % 2 === 0) {
          even++;
        } else {
          odd++;
        }
      }
      
      // Alto/baixo
      if (num >= 1 && num <= 18) {
        low++;
      } else if (num >= 19 && num <= 36) {
        high++;
      }
    }
    
    return {
      red, 
      black, 
      green,
      odd, 
      even,
      high, 
      low,
      total: numbers.length
    };
  }, [numbers]);

  // Função para determinar a cor de fundo com base no número
  const getNumberBackground = (num: number): string => {
    if (num === 0) return 'bg-green-600';
    
    // Números vermelhos na roleta
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    
    return redNumbers.includes(num) 
      ? 'bg-red-600' 
      : 'bg-zinc-900';
  };

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden shadow-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xl font-bold text-white">{numbers.length > 0 ? numbers[0] : '-'}</h3>
        <button 
          onClick={() => setIsStatsModalOpen(true)}
          className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-white transition-colors"
          title="Ver estatísticas detalhadas"
        >
          <BarChart className="h-5 w-5" />
        </button>
      </div>
      
      {/* Números recentes */}
      <div className="flex flex-wrap gap-2 mb-4">
        {numbers.slice(0, 10).map((num, index) => (
          <div 
            key={index}
            className={`${getNumberBackground(num)} text-white w-8 h-8 rounded-full flex items-center justify-center font-medium`}
          >
            {num}
          </div>
        ))}
      </div>
      
      {/* Estatísticas resumidas */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-300">
        <div className="flex justify-between">
          <span>Vermelho:</span>
          <span className="font-medium text-white">{stats.red}</span>
        </div>
        <div className="flex justify-between">
          <span>Preto:</span>
          <span className="font-medium text-white">{stats.black}</span>
        </div>
        <div className="flex justify-between">
          <span>Par:</span>
          <span className="font-medium text-white">{stats.even}</span>
        </div>
        <div className="flex justify-between">
          <span>Ímpar:</span>
          <span className="font-medium text-white">{stats.odd}</span>
        </div>
        <div className="flex justify-between">
          <span>Alto (19-36):</span>
          <span className="font-medium text-white">{stats.high}</span>
        </div>
        <div className="flex justify-between">
          <span>Baixo (1-18):</span>
          <span className="font-medium text-white">{stats.low}</span>
        </div>
        <div className="flex justify-between">
          <span>Verde (0):</span>
          <span className="font-medium text-white">{stats.green}</span>
        </div>
        <div className="flex justify-between">
          <span>Total:</span>
          <span className="font-medium text-white">{stats.total}</span>
        </div>
      </div>
      
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-4 w-4" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Tempo real</span>
        <span>{stats.total} números</span>
      </div>
      
      {/* Modal de estatísticas completas */}
      <RouletteStatsModal
        open={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
        roletaNome={roletaNome}
        lastNumbers={numbers}
        wins={0}
        losses={0}
      />
    </div>
  );
};

export default RouletteMiniStats; 