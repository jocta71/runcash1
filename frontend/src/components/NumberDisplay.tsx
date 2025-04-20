import React from 'react';
import { cn } from '@/lib/utils';

interface NumberDisplayProps {
  number: number | null;
  size?: 'small' | 'medium' | 'large';
  highlight?: boolean;
}

const getColorClass = (number: number | null): string => {
  if (number === null) return 'bg-gray-300';
  if (number === 0) return 'bg-green-500 text-white';
  
  // Números vermelhos na roleta europeia
  const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return numerosVermelhos.includes(number) 
    ? 'bg-[#FF1D46] text-white' 
    : 'bg-[#292524] text-white';
};

const NumberDisplay: React.FC<NumberDisplayProps> = ({ 
  number, 
  size = 'medium',
  highlight = false 
}) => {
  // Definir classes de tamanho
  const sizeClasses = {
    small: 'w-6 h-6 text-xs',
    medium: 'w-8 h-8 text-sm',
    large: 'w-16 h-16 text-2xl font-bold'
  };

  return (
    <div 
      className={cn(
        "flex items-center justify-center transition-all border border-gray-700 rounded-[4px]",
        sizeClasses[size],
        getColorClass(number),
        highlight && "ring-2 ring-offset-2 ring-yellow-400 animate-pulse"
      )}
    >
      {number !== null ? number : '?'}
    </div>
  );
};

export default NumberDisplay; 