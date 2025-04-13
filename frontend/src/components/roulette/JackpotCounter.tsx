
import React, { useState, useEffect } from 'react';
import { DollarSign, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JackpotCounterProps {
  initialValue: number;
  incrementInterval?: number;
  incrementAmount?: number;
  className?: string;
}

const JackpotCounter = ({
  initialValue = 10000,
  incrementInterval = 5000,
  incrementAmount = 50,
  className
}: JackpotCounterProps) => {
  const [jackpot, setJackpot] = useState(initialValue);
  const [isAnimating, setIsAnimating] = useState(false);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setJackpot(prev => prev + incrementAmount);
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 1000);
    }, incrementInterval);
    
    return () => clearInterval(timer);
  }, [incrementInterval, incrementAmount]);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(value);
  };
  
  return (
    <div className={cn(
      "bg-gradient-to-b from-black to-gray-900 border border-vegas-gold/30 rounded-xl p-4 shadow-lg",
      className
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Trophy size={20} className="text-vegas-gold" />
          <h3 className="text-vegas-gold font-bold text-lg">JACKPOT</h3>
        </div>
        <div className="bg-black px-2 py-1 rounded-md border border-vegas-gold/30">
          <DollarSign size={16} className="text-vegas-gold" />
        </div>
      </div>
      
      <div className={cn(
        "text-center font-mono text-2xl font-bold bg-gradient-to-b from-vegas-gold to-yellow-500 bg-clip-text text-transparent py-2",
        isAnimating && "animate-pulse-gold scale-105 transition-transform"
      )}>
        {formatCurrency(jackpot)}
      </div>
      
      <div className="text-center text-xs text-vegas-gold/70 mt-1">
        Aumente suas chances! Jogue agora!
      </div>
    </div>
  );
};

export default JackpotCounter;
