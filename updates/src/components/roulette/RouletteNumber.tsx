import React from 'react';

interface RouletteNumberProps {
  number: number;
  className?: string;
}

const RouletteNumber = ({ number, className = '' }: RouletteNumberProps) => {
  const getRouletteNumberColor = (num: number) => {
    if (num === 0) return "bg-vegas-green text-black";
    
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    
    if (redNumbers.includes(num)) {
      return "bg-red-600 text-white";
    } else {
      return "bg-transparent text-white";
    }
  };

  return (
    <div
      className={`w-8 h-8 rounded-full ${getRouletteNumberColor(number)} flex items-center justify-center text-sm font-medium ${className}`}
    >
      {number}
    </div>
  );
};

export default RouletteNumber;
