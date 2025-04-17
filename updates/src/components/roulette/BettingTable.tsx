import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import ChipStack from './ChipStack';

interface BettingTableProps {
  onBetPlaced?: (type: string, numbers: number[], amount: number) => void;
  className?: string;
}

const BettingTable = ({ onBetPlaced, className }: BettingTableProps) => {
  const [selectedBet, setSelectedBet] = useState<{ type: string; numbers: number[] } | null>(null);
  const [betAmount, setBetAmount] = useState(100);
  
  const handleNumberClick = (num: number) => {
    setSelectedBet({ type: 'straight', numbers: [num] });
  };
  
  const handleSectionClick = (section: string, numbers: number[]) => {
    setSelectedBet({ type: section, numbers });
  };
  
  const placeBet = () => {
    if (!selectedBet) return;
    
    if (onBetPlaced) {
      onBetPlaced(selectedBet.type, selectedBet.numbers, betAmount);
    }
    
    // Reset after placing bet
    setSelectedBet(null);
  };
  
  const chipAmounts = [100, 500, 1000, 5000];
  
  // Calculate which section different bet types cover
  const dozens = [
    { name: '1st 12', numbers: Array.from({ length: 12 }, (_, i) => i + 1) },
    { name: '2nd 12', numbers: Array.from({ length: 12 }, (_, i) => i + 13) },
    { name: '3rd 12', numbers: Array.from({ length: 12 }, (_, i) => i + 25) }
  ];
  
  const columns = [
    { name: '1st col', numbers: Array.from({ length: 12 }, (_, i) => 3 * i + 1) },
    { name: '2nd col', numbers: Array.from({ length: 12 }, (_, i) => 3 * i + 2) },
    { name: '3rd col', numbers: Array.from({ length: 12 }, (_, i) => 3 * i + 3) }
  ];
  
  const getNumberClass = (num: number) => {
    if (num === 0) return 'bg-green-600 text-white';
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return redNumbers.includes(num) ? 'bg-red-600 text-white' : 'bg-transparent text-white';
  };
  
  const isSelected = (num: number) => {
    return selectedBet?.numbers.includes(num);
  };
  
  return (
    <div className={cn("bg-[#0E3B28] rounded-xl p-4 border border-vegas-gold/30", className)}>
      <div className="flex flex-col gap-4">
        {/* Numbers grid */}
        <div className="grid grid-cols-3 gap-1">
          <div className="col-span-3 grid grid-cols-3 gap-1">
            <div 
              className={cn("bg-green-600 text-white rounded p-3 text-center font-bold hover:opacity-80 cursor-pointer transition-all",
                isSelected(0) && "ring-2 ring-vegas-gold animate-pulse-gold")}
              onClick={() => handleNumberClick(0)}
            >
              0
              {isSelected(0) && <div className="mt-1"><ChipStack amount={betAmount} size="sm" /></div>}
            </div>
            <div className="col-span-2 grid grid-cols-12 gap-1">
              {Array.from({ length: 36 }, (_, i) => i + 1).map(num => (
                <div
                  key={num}
                  className={cn(
                    getNumberClass(num),
                    "aspect-square flex items-center justify-center rounded text-xs font-bold hover:opacity-80 cursor-pointer transition-all",
                    isSelected(num) && "ring-2 ring-vegas-gold animate-pulse-gold"
                  )}
                  onClick={() => handleNumberClick(num)}
                >
                  {num}
                  {isSelected(num) && <div className="absolute -bottom-3"><ChipStack amount={betAmount} size="sm" /></div>}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Dozens */}
        <div className="grid grid-cols-3 gap-1">
          {dozens.map((dozen, i) => (
            <div
              key={i}
              className={cn(
                "bg-[#0D2F20] text-vegas-gold p-2 text-center rounded cursor-pointer hover:bg-[#0A241A] transition-all",
                selectedBet?.type === `dozen-${i+1}` && "ring-2 ring-vegas-gold"
              )}
              onClick={() => handleSectionClick(`dozen-${i+1}`, dozen.numbers)}
            >
              {dozen.name}
              {selectedBet?.type === `dozen-${i+1}` && <div className="mt-1"><ChipStack amount={betAmount} size="sm" /></div>}
            </div>
          ))}
        </div>
        
        {/* Outside bets */}
        <div className="grid grid-cols-6 gap-1 text-center text-xs">
          <div 
            className={cn(
              "bg-[#0D2F20] text-vegas-gold p-2 rounded cursor-pointer hover:bg-[#0A241A] transition-all",
              selectedBet?.type === 'low' && "ring-2 ring-vegas-gold"
            )}
            onClick={() => handleSectionClick('low', Array.from({ length: 18 }, (_, i) => i + 1))}
          >
            1-18
            {selectedBet?.type === 'low' && <div className="mt-1"><ChipStack amount={betAmount} size="sm" /></div>}
          </div>
          <div 
            className={cn(
              "bg-[#0D2F20] text-vegas-gold p-2 rounded cursor-pointer hover:bg-[#0A241A] transition-all",
              selectedBet?.type === 'even' && "ring-2 ring-vegas-gold"
            )}
            onClick={() => handleSectionClick('even', Array.from({ length: 18 }, (_, i) => (i + 1) * 2))}
          >
            EVEN
            {selectedBet?.type === 'even' && <div className="mt-1"><ChipStack amount={betAmount} size="sm" /></div>}
          </div>
          <div 
            className={cn(
              "bg-red-700 text-white p-2 rounded cursor-pointer hover:bg-red-800 transition-all",
              selectedBet?.type === 'red' && "ring-2 ring-vegas-gold"
            )}
            onClick={() => handleSectionClick('red', [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])}
          >
            RED
            {selectedBet?.type === 'red' && <div className="mt-1"><ChipStack amount={betAmount} size="sm" /></div>}
          </div>
          <div 
            className={cn(
              "bg-transparent text-white p-2 rounded cursor-pointer hover:bg-gray-900 transition-all",
              selectedBet?.type === 'black' && "ring-2 ring-vegas-gold"
            )}
            onClick={() => handleSectionClick('black', [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35])}
          >
            BLACK
            {selectedBet?.type === 'black' && <div className="mt-1"><ChipStack amount={betAmount} size="sm" /></div>}
          </div>
          <div 
            className={cn(
              "bg-[#0D2F20] text-vegas-gold p-2 rounded cursor-pointer hover:bg-[#0A241A] transition-all",
              selectedBet?.type === 'odd' && "ring-2 ring-vegas-gold"
            )}
            onClick={() => handleSectionClick('odd', Array.from({ length: 18 }, (_, i) => i * 2 + 1))}
          >
            ODD
            {selectedBet?.type === 'odd' && <div className="mt-1"><ChipStack amount={betAmount} size="sm" /></div>}
          </div>
          <div 
            className={cn(
              "bg-[#0D2F20] text-vegas-gold p-2 rounded cursor-pointer hover:bg-[#0A241A] transition-all",
              selectedBet?.type === 'high' && "ring-2 ring-vegas-gold"
            )}
            onClick={() => handleSectionClick('high', Array.from({ length: 18 }, (_, i) => i + 19))}
          >
            19-36
            {selectedBet?.type === 'high' && <div className="mt-1"><ChipStack amount={betAmount} size="sm" /></div>}
          </div>
        </div>
        
        {/* Chip selection */}
        <div className="mt-2">
          <div className="text-vegas-gold text-sm mb-1">Valor da aposta:</div>
          <div className="flex justify-center gap-2">
            {chipAmounts.map(amount => (
              <button
                key={amount}
                className={cn(
                  "rounded-full transition-all",
                  betAmount === amount ? "ring-2 ring-vegas-gold scale-110" : ""
                )}
                onClick={() => setBetAmount(amount)}
              >
                <ChipStack amount={amount} size="md" />
              </button>
            ))}
          </div>
        </div>
        
        {/* Place bet button */}
        {selectedBet && (
          <button
            className="mt-2 bg-gradient-to-b from-vegas-gold to-yellow-600 text-black py-2 rounded-lg font-bold hover:from-vegas-gold hover:to-yellow-500 transition-all"
            onClick={placeBet}
          >
            Apostar ${betAmount} - {selectedBet.type}
          </button>
        )}
      </div>
    </div>
  );
};

export default BettingTable;
