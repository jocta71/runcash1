
import React from 'react';
import { TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import ChipStack from './ChipStack';

interface Bet {
  type: string;
  description: string;
  numbers: number[];
  players: number;
  amount: number;
}

interface PopularBetsProps {
  bets: Bet[];
  onSelectBet?: (bet: Bet) => void;
  className?: string;
}

const PopularBets = ({ bets, onSelectBet, className }: PopularBetsProps) => {
  const handleClickBet = (bet: Bet) => {
    if (onSelectBet) {
      onSelectBet(bet);
    }
  };
  
  // Sort bets by number of players
  const sortedBets = [...bets].sort((a, b) => b.players - a.players);
  
  return (
    <div className={cn("bg-gradient-to-b from-vegas-black/80 to-[#0A1716]/80 rounded-xl border border-vegas-gold/20 p-4", className)}>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={18} className="text-vegas-gold" />
        <h3 className="text-vegas-gold font-bold">Apostas Populares</h3>
      </div>
      
      <div className="space-y-3">
        {sortedBets.map((bet, index) => (
          <div 
            key={index}
            className="bg-vegas-black/50 border border-vegas-gold/10 rounded-lg p-3 cursor-pointer hover:border-vegas-gold/30 transition-all duration-300"
            onClick={() => handleClickBet(bet)}
          >
            <div className="flex justify-between items-center mb-2">
              <div className="font-semibold text-vegas-gold">{bet.description}</div>
              <div className="flex items-center gap-1 text-xs text-vegas-gold/70">
                <Users size={14} />
                <span>{bet.players}</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex flex-wrap gap-1">
                {bet.type === 'numbers' ? (
                  bet.numbers.map((num, i) => (
                    <div 
                      key={i}
                      className={`w-5 h-5 rounded-full text-xs flex items-center justify-center
                        ${num === 0 
                          ? 'bg-green-600 text-white' 
                          : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num) 
                            ? 'bg-red-600 text-white' 
                            : 'bg-black text-white'
                        }`}
                    >
                      {num}
                    </div>
                  ))
                ) : (
                  <div className="text-sm">{bet.type}</div>
                )}
              </div>
              
              <ChipStack amount={bet.amount} size="sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PopularBets;
