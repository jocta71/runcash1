import React from 'react';

interface RouletteNumbersProps {
  numbers: number[];
  isNewNumber: (index: number) => boolean;
  tableName?: string;
  className?: string;
  onNumberClick?: (index: number, number: number) => void;
  interactive?: boolean;
  limit?: number;
  isBlurred?: boolean;
}

const getNumberColorClass = (number: number): string => {
  if (number === 0) {
    return 'bg-green-600 text-white';
  }
  
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  if (redNumbers.includes(number)) {
    return 'bg-red-600 text-white';
  }
  
  return 'bg-gray-900 text-white';
};

const LastNumbersBar = ({ numbers, isNewNumber, tableName, className, onNumberClick, interactive, limit = 20 }: RouletteNumbersProps) => {
  const handleClick = (index: number, number: number) => {
    if (interactive && onNumberClick) {
      onNumberClick(index, number);
    }
  };

  const displayNumbers = numbers.slice(0, limit);

  return (
    <div className={`flex items-center space-x-1 overflow-hidden ${className}`}>
      {displayNumbers.map((number, index) => {
        const colorClass = getNumberColorClass(number);
        const highlightClass = isNewNumber(index) ? 'animate-pulse border-2 border-yellow-400' : '';
        const cursorClass = interactive ? 'cursor-pointer' : '';

        return (
          <div
            key={`${tableName}-${index}-${number}`}
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${colorClass} ${highlightClass} ${cursorClass}`}
            onClick={() => handleClick(index, number)}
            title={`Número: ${number}`}
          >
            <span>{number}</span>
          </div>
        );
      })}
      {numbers.length > limit && (
        <div className="text-xs text-gray-500">(...)</div>
      )}
    </div>
  );
};

export default LastNumbersBar; 