import React from 'react';

// Sequência dos números na roleta europeia (padrão)
const EUROPEAN_ROULETTE_SEQUENCE = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 
  8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

// Sequência dos números na roleta americana
const AMERICAN_ROULETTE_SEQUENCE = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 
  "00", 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2
];

// Setores de apostas especiais
const SPECIAL_SECTORS = [
  { id: 'VOISINS_DU_ZERO', name: 'Voisins', numbers: [0, 2, 3, 4, 7, 12, 15, 18, 19, 21, 22, 25, 26, 28, 29, 32, 35] },
  { id: 'TIER', name: 'Tier', numbers: [5, 8, 10, 11, 13, 16, 23, 24, 27, 30, 33, 36] },
  { id: 'ORPHELINS', name: 'Orphelins', numbers: [1, 6, 9, 14, 17, 20, 31, 34] },
  { id: 'JEU_0', name: 'Zero', numbers: [0, 3, 12, 15, 26, 32, 35] }
];

// Lista de cores por número
const getNumberColor = (number: number | string): string => {
  if (number === 0 || number === "00") return 'bg-green-600';
  
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return redNumbers.includes(Number(number)) ? 'bg-red-600' : 'bg-black';
};

interface RouletteRacetrackProps {
  type?: 'european' | 'american';
  lastNumber?: number | null;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  showSectors?: boolean;
}

const RouletteRacetrack = ({ 
  type = 'european', 
  lastNumber = null, 
  size = 'small',
  className = '',
  showSectors = true
}: RouletteRacetrackProps) => {
  const sequence = type === 'european' ? EUROPEAN_ROULETTE_SEQUENCE : AMERICAN_ROULETTE_SEQUENCE;
  
  // Determinar tamanho baseado no prop size
  const sizeClasses = {
    small: 'h-14',
    medium: 'h-16', 
    large: 'h-20'
  };
  
  // Determinar o tamanho dos círculos dos números
  const numberSize = {
    small: 'w-3 h-3 text-[6px]',
    medium: 'w-4 h-4 text-[8px]',
    large: 'w-5 h-5 text-[10px]'
  };
  
  return (
    <div className={`relative w-full ${sizeClasses[size]} ${className} rounded-full overflow-hidden bg-[#121212]`}>
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Números no racetrack */}
        <div className="absolute w-full h-full">
          {sequence.map((number, index) => {
            // Calcular a posição em um círculo
            const angle = (index / sequence.length) * 2 * Math.PI;
            const isLastNumber = lastNumber !== null && number.toString() === lastNumber.toString();
            
            // Calcular x e y - forma mais oval (mais achatada horizontalmente)
            const radius = { x: 46, y: 30 }; 
            const x = 50 + radius.x * Math.cos(angle - Math.PI/2);
            const y = 50 + radius.y * Math.sin(angle - Math.PI/2);
            
            // Determinar a cor do número
            const bgColorClass = getNumberColor(number);
            
            return (
              <div 
                key={`${number}-${index}`}
                className={`absolute rounded-full flex items-center justify-center
                  ${numberSize[size]} ${bgColorClass}
                  ${isLastNumber ? 'ring-1 ring-yellow-400 z-10' : ''}
                  transform -translate-x-1/2 -translate-y-1/2 text-white font-bold`}
                style={{ 
                  left: `${x}%`, 
                  top: `${y}%`,
                }}
              >
                {number}
              </div>
            );
          })}
        </div>
        
        {/* Setores especiais no centro */}
        {showSectors && (
          <div className="absolute flex flex-col gap-1 justify-center items-center w-full h-full">
            <div className="bg-[#121212]/80 px-2 py-1 rounded">
              <div className="text-center">
                <div className="text-[8px] leading-tight text-white/90 space-y-[2px]">
                  {SPECIAL_SECTORS.map((sector) => (
                    <div key={sector.id} className="font-medium">{sector.name}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RouletteRacetrack; 