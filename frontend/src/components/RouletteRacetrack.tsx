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
  { id: 'VOISINS_DU_ZERO', name: 'Voisins du Zero', numbers: [0, 2, 3, 4, 7, 12, 15, 18, 19, 21, 22, 25, 26, 28, 29, 32, 35] },
  { id: 'TIER', name: 'Tiers du Cylindre', numbers: [5, 8, 10, 11, 13, 16, 23, 24, 27, 30, 33, 36] },
  { id: 'ORPHELINS', name: 'Orphelins', numbers: [1, 6, 9, 14, 17, 20, 31, 34] },
  { id: 'JEU_0', name: 'Jeu 0', numbers: [0, 3, 12, 15, 26, 32, 35] }
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

const RouletteRacetrack: React.FC<RouletteRacetrackProps> = ({ 
  type = 'european', 
  lastNumber = null, 
  size = 'small',
  className = '',
  showSectors = true
}) => {
  const sequence = type === 'european' ? EUROPEAN_ROULETTE_SEQUENCE : AMERICAN_ROULETTE_SEQUENCE;
  
  // Determinar tamanho baseado no prop size
  const sizeClasses = {
    small: 'h-14',
    medium: 'h-24', 
    large: 'h-32'
  };
  
  // Determinar o tamanho dos círculos dos números
  const numberSize = {
    small: 'w-3.5 h-3.5 text-[8px]',
    medium: 'w-5 h-5 text-[9px]',
    large: 'w-6 h-6 text-xs'
  };
  
  return (
    <div className={`relative w-full ${sizeClasses[size]} ${className} rounded-3xl overflow-hidden bg-[#141923] border border-[#2a2a31]`}>
      {/* Fundo do racetrack escuro com gradiente */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#191c27] to-[#111318]"></div>
      
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Anel principal (track) - forma oval mais pronunciada */}
        <div className="absolute w-[96%] h-[85%] border border-[#2a2a31] rounded-full"></div>
        
        {/* Números no racetrack */}
        <div className="absolute w-full h-full">
          {sequence.map((number, index) => {
            // Calcular a posição em um círculo
            const angle = (index / sequence.length) * 2 * Math.PI;
            const isLastNumber = lastNumber !== null && number.toString() === lastNumber.toString();
            
            // Calcular x e y - ajustar para forma oval mais pronunciada
            const radius = { x: 48, y: 40 }; // Porcentagem do container (oval mais achatada)
            const x = 50 + radius.x * Math.cos(angle - Math.PI/2); // -90 graus para começar do topo
            const y = 50 + radius.y * Math.sin(angle - Math.PI/2);
            
            // Determinar a cor do número
            let bgColorClass = 'bg-black';
            let textColorClass = 'text-white';
            if (number === 0) {
              bgColorClass = 'bg-green-600';
            } else if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(Number(number))) {
              bgColorClass = 'bg-red-600';
            }
            
            return (
              <div 
                key={`${number}-${index}`}
                className={`absolute rounded-full flex items-center justify-center
                  ${numberSize[size]} ${bgColorClass} ${textColorClass}
                  ${isLastNumber ? 'ring-1 ring-yellow-400 z-10' : ''}
                  transform -translate-x-1/2 -translate-y-1/2 font-bold shadow-[0_0_2px_rgba(0,0,0,0.8)]`}
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
        
        {/* Setores especiais (posicionados no centro) */}
        {showSectors && (
          <div className="absolute w-[70%] top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-0.5">
            {SPECIAL_SECTORS.map((sector, idx) => (
              <div 
                key={sector.id}
                className="w-full bg-opacity-60 bg-[#272c39] text-white text-[7px] tracking-tight rounded-sm px-1 py-0.5 text-center"
              >
                {sector.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RouletteRacetrack; 