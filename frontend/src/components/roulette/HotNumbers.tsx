
import React from 'react';
import { Flame } from 'lucide-react';
import RouletteNumber from './RouletteNumber';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface HotNumbersProps {
  numbers: number[];
  occurrences: number[];
}

const HotNumbers = ({ numbers, occurrences }: HotNumbersProps) => {
  return (
    <div className="glass-card p-3 rounded-xl border border-vegas-gold/30">
      <div className="flex items-center gap-2 mb-3">
        <Flame size={18} className="text-orange-500" />
        <h3 className="text-vegas-gold text-sm font-semibold">Números Quentes</h3>
      </div>
      
      <div className="flex gap-2 justify-center flex-wrap">
        {numbers.map((num, i) => (
          <TooltipProvider key={i}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative animate-pulse-gold">
                  <RouletteNumber number={num} className="hover:scale-110 transition-transform duration-300" />
                  <div className="absolute -top-1 -right-1 bg-orange-500 text-black text-xs w-4 h-4 rounded-full flex items-center justify-center">
                    {occurrences[i]}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Saiu {occurrences[i]} vezes nas últimas 100 rodadas</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    </div>
  );
};

export default HotNumbers;
