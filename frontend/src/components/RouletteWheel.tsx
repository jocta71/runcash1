import React from "react";
import { ROULETTE_COLORS, ROULETTE_NUMBERS, RED_NUMBERS, generateRouletteWheel } from "./RouletteSidePanelStats";

// Tipos para o componente
interface RouletteWheelProps {
  numbers: {
    numero: number;
    timestamp: string;
  }[];
  size?: number;
  className?: string;
}

/**
 * Componente para visualizar uma roda de roleta baseada no histórico de números
 * Números mais frequentes são destacados com cores mais intensas
 */
const RouletteWheel: React.FC<RouletteWheelProps> = ({ 
  numbers, 
  size = 300,
  className = ""
}) => {
  if (!numbers || numbers.length === 0) {
    return (
      <div className="flex items-center justify-center p-4 text-center">
        <p className="text-gray-400">Sem dados históricos para exibir a roleta</p>
      </div>
    );
  }

  const { segments, center, radius } = generateRouletteWheel(numbers, size);

  return (
    <div className={`relative ${className}`}>
      <svg 
        width={size} 
        height={size} 
        viewBox={`0 0 ${size} ${size}`}
        className="roulette-wheel"
      >
        {/* Círculo de fundo */}
        <circle 
          cx={center} 
          cy={center} 
          r={radius + 5} 
          fill="#2a2a2a"
          stroke="#888" 
          strokeWidth="2"
        />
        
        {/* Segmentos da roleta */}
        {segments.map((segment, index) => (
          <g key={`segment-${index}`}>
            <path 
              d={segment.path} 
              fill={segment.color} 
              stroke="#444" 
              strokeWidth="1"
            />
            <text 
              x={segment.text.x} 
              y={segment.text.y}
              fill="white"
              fontSize={radius / 15}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${(index * 360 / ROULETTE_NUMBERS.length) + 90}, ${segment.text.x}, ${segment.text.y})`}
            >
              {segment.text.content}
            </text>
          </g>
        ))}
        
        {/* Círculo central */}
        <circle 
          cx={center} 
          cy={center} 
          r={radius * 0.2} 
          fill="#444"
          stroke="#888" 
          strokeWidth="2"
        />
      </svg>
      
      {/* Legenda */}
      <div className="mt-4 text-sm flex flex-col gap-2">
        <h4 className="text-gray-300 font-semibold mb-1">Legenda:</h4>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <div className="w-4 h-4 mr-1" style={{ backgroundColor: ROULETTE_COLORS.RED }}></div>
            <span className="text-gray-300">Vermelhos</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 mr-1" style={{ backgroundColor: ROULETTE_COLORS.BLACK }}></div>
            <span className="text-gray-300">Pretos</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 mr-1" style={{ backgroundColor: ROULETTE_COLORS.GREEN }}></div>
            <span className="text-gray-300">Zero</span>
          </div>
        </div>
        <p className="text-gray-400 text-xs mt-1">
          * Números mais frequentes são destacados com cores mais intensas
        </p>
      </div>
    </div>
  );
};

export default RouletteWheel; 