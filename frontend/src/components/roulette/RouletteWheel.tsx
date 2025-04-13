
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dices } from 'lucide-react';

interface RouletteWheelProps {
  onResult?: (number: number) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const RouletteWheel = ({ onResult, size = 'md', className = '' }: RouletteWheelProps) => {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  
  // All possible roulette numbers in order
  const rouletteNumbers = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ];
  
  const getNumberColor = (num: number) => {
    if (num === 0) return 'text-white bg-green-600';
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return redNumbers.includes(num) ? 'text-white bg-red-600' : 'text-white bg-black';
  };
  
  const sizeDimensions = {
    sm: { wheel: 'w-48 h-48', numbers: 'text-[8px]' },
    md: { wheel: 'w-64 h-64', numbers: 'text-[10px]' },
    lg: { wheel: 'w-80 h-80', numbers: 'text-xs' }
  };
  
  const spinWheel = () => {
    if (spinning) return;
    
    setSpinning(true);
    setResult(null);
    
    // Calculate a random spin (5-10 full rotations plus random position)
    const randomSpins = 5 + Math.random() * 5;
    const randomPosition = Math.random() * 360;
    const newRotation = rotation + (randomSpins * 360) + randomPosition;
    
    // Determine which number the wheel landed on
    const anglePerNumber = 360 / rouletteNumbers.length;
    const normalizedPosition = newRotation % 360;
    const index = Math.floor((360 - normalizedPosition) / anglePerNumber) % rouletteNumbers.length;
    const resultNumber = rouletteNumbers[index];
    
    setRotation(newRotation);
    
    // Simulate the spinning time and set the result
    setTimeout(() => {
      setResult(resultNumber);
      setSpinning(false);
      if (onResult) onResult(resultNumber);
    }, 5000);
  };
  
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className={`${sizeDimensions[size].wheel} relative overflow-hidden rounded-full border-4 border-vegas-gold shadow-xl bg-[#0A0C14] mb-4`}>
        {/* Inner wheel with numbers */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 5s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none'
          }}
        >
          {rouletteNumbers.map((num, i) => {
            const angle = (i * 360) / rouletteNumbers.length;
            return (
              <div
                key={i}
                className={`absolute top-0 left-1/2 -ml-4 -translate-x-1/2 ${sizeDimensions[size].numbers} font-bold ${getNumberColor(num)} w-8 h-8 flex items-center justify-center transform-origin-bottom`}
                style={{
                  transform: `rotate(${angle}deg) translateY(8px)`,
                  height: '50%'
                }}
              >
                {num}
              </div>
            );
          })}
          
          {/* Center of wheel */}
          <div className="absolute top-1/2 left-1/2 w-10 h-10 -mt-5 -ml-5 rounded-full bg-gradient-to-b from-vegas-gold to-yellow-700 shadow-lg z-10"></div>
        </div>
        
        {/* Pointer/indicator */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-6 bg-vegas-gold z-20 clip-triangle shadow-md"></div>
      </div>
      
      {/* Result display */}
      {result !== null && (
        <div className={`mb-4 ${getNumberColor(result)} w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold animate-bounce`}>
          {result}
        </div>
      )}
      
      <Button
        onClick={spinWheel}
        disabled={spinning}
        className="bg-gradient-to-b from-vegas-gold to-yellow-600 text-black font-bold hover:from-vegas-gold hover:to-yellow-500 hover:shadow-gold"
      >
        <Dices className="mr-2" />
        {spinning ? 'Girando...' : 'Girar Roleta'}
      </Button>
    </div>
  );
};

export default RouletteWheel;
