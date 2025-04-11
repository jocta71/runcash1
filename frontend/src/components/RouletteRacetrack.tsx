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
}

const RouletteRacetrack: React.FC<RouletteRacetrackProps> = ({ 
  type = 'european', 
  lastNumber = null, 
  size = 'small',
  className = ''
}) => {
  const sequence = type === 'european' ? EUROPEAN_ROULETTE_SEQUENCE : AMERICAN_ROULETTE_SEQUENCE;
  
  // Determinar tamanho baseado no prop size
  const sizeClasses = {
    small: 'h-12',
    medium: 'h-24', 
    large: 'h-32'
  };
  
  // Determinar o tamanho dos círculos dos números
  const numberSize = {
    small: 'w-3 h-3 text-[6px]',
    medium: 'w-5 h-5 text-[8px]',
    large: 'w-7 h-7 text-xs'
  };
  
  return (
    <div className={`relative w-full ${sizeClasses[size]} ${className} overflow-hidden rounded-full border border-gray-700 bg-gray-800`}>
      <div className="absolute inset-1 rounded-full border border-gray-600 bg-gray-800 flex items-center justify-center">
        {/* Números no racetrack */}
        <div className="absolute inset-0">
          {sequence.map((number, index) => {
            // Calcular a posição em um círculo
            const angle = (index / sequence.length) * 2 * Math.PI;
            const isLastNumber = lastNumber !== null && number.toString() === lastNumber.toString();
            
            // Calcular x e y - ajustar para forma oval
            const radius = { x: 47, y: 42 }; // Porcentagem do container (oval)
            const x = 50 + radius.x * Math.cos(angle - Math.PI/2); // -90 graus para começar do topo
            const y = 50 + radius.y * Math.sin(angle - Math.PI/2);
            
            return (
              <div 
                key={`${number}-${index}`}
                className={`absolute rounded-full flex items-center justify-center
                  ${numberSize[size]} ${getNumberColor(number)}
                  ${isLastNumber ? 'ring-2 ring-yellow-400 z-10' : ''}
                  transform -translate-x-1/2 -translate-y-1/2 text-white font-bold`}
                style={{ 
                  left: `${x}%`, 
                  top: `${y}%`,
                }}
              >
                {size !== 'small' && number}
              </div>
            );
          })}
        </div>
        
        {/* Indicador central */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[10%] h-[10%] rounded-full bg-gray-600"></div>
        </div>
      </div>
    </div>
  );
};

export default RouletteRacetrack; 