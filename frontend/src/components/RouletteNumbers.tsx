import React, { useState, useEffect } from 'react';

interface RouletteNumbersProps {
  numbers: number[];
  limit?: number;
}

const RouletteNumbers: React.FC<RouletteNumbersProps> = ({ 
  numbers,
  limit = 5
}) => {
  // Função para determinar a cor de um número
  const getNumberColor = (num: number): string => {
    if (num === 0) {
      return 'bg-green-600';
    }
    return num % 2 === 0 ? 'bg-black' : 'bg-red-600';
  };

  return (
    <div className="flex flex-wrap gap-1">
      {numbers.slice(0, limit).map((num, index) => (
        <div
          key={index}
          className={`${getNumberColor(num)} w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm`}
        >
          {num}
        </div>
      ))}
      {numbers.length === 0 && (
        <div className="text-gray-500 text-sm">Sem números disponíveis</div>
      )}
    </div>
  );
};

export default RouletteNumbers; 