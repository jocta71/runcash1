
import React from 'react';

interface ChipStackProps {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
}

const ChipStack = ({ amount, size = 'md' }: ChipStackProps) => {
  // Calculate how many chips to display based on amount
  const chipCount = Math.min(Math.ceil(amount / 100), 5);
  
  // Determine chip colors based on value
  const getChipColor = (index: number) => {
    const colors = [
      'bg-red-600 border-red-800',       // $100
      'bg-blue-600 border-blue-800',     // $500
      'bg-green-600 border-green-800',   // $1000
      'bg-purple-600 border-purple-800', // $5000
      'bg-black border-gray-800'         // $10000
    ];
    return colors[index % colors.length];
  };
  
  // Set size dimensions
  const dimensions = {
    sm: { size: 'w-6 h-6', stack: '-mt-2' },
    md: { size: 'w-8 h-8', stack: '-mt-3' },
    lg: { size: 'w-10 h-10', stack: '-mt-4' }
  };
  
  return (
    <div className="relative inline-block">
      {[...Array(chipCount)].map((_, index) => (
        <div
          key={index}
          className={`${dimensions[size].size} rounded-full ${getChipColor(index)} border-2 absolute 
                     flex items-center justify-center text-white font-bold text-xs
                     shadow-lg transform transition-all duration-300 hover:scale-110
                     ${index > 0 ? dimensions[size].stack : ''}`}
          style={{ top: `${index * -4}px`, zIndex: 10 - index }}
        >
          {index === 0 && <span className="drop-shadow-md">${amount}</span>}
        </div>
      ))}
    </div>
  );
};

export default ChipStack;
