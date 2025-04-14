
import React from 'react';
import RouletteNumber from './RouletteNumber';
import { Loader2 } from 'lucide-react';

interface LastNumbersProps {
  numbers: number[];
  isLoading?: boolean;
}

const LastNumbers = ({ numbers, isLoading = false }: LastNumbersProps) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-10">
        <Loader2 size={20} className="animate-spin text-vegas-gold" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-center gap-2 max-w-full">
      {numbers.map((num, i) => (
        <RouletteNumber key={i} number={num} />
      ))}
    </div>
  );
};

export default LastNumbers;
