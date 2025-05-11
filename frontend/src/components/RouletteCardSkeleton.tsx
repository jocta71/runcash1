import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

/**
 * Componente de skeleton para o card de roleta
 * Exibe um esboço animado do card de roleta durante o carregamento
 */
const RouletteCardSkeleton: React.FC = () => {
  return (
    <Card className="relative overflow-visible transition-all duration-300 backdrop-filter bg-opacity-40 bg-vegas-darkbg border border-gray-800/30 hover:border-gray-700/50">
      {/* Efeito de pulse para simular carregamento */}
      <CardContent className="p-4 relative z-10">
        {/* Cabeçalho skeleton */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-gray-700 animate-pulse mr-2"></div>
            <div className="h-6 w-36 bg-gray-800 rounded animate-pulse"></div>
          </div>
          <div className="h-5 w-16 bg-gray-800 rounded-full animate-pulse"></div>
        </div>
        
        {/* Números recentes skeleton */}
        <div className="flex flex-wrap gap-1 justify-center my-5 p-3 rounded-xl border border-gray-700/20 bg-[#131111]">
          {/* Círculos simulando números */}
          {[...Array(12)].map((_, idx) => (
            <div 
              key={idx} 
              className="w-6 h-6 rounded-full bg-gray-800 animate-pulse"
              style={{ 
                animationDelay: `${idx * 120}ms`,
                opacity: 0.7 - (idx * 0.05)
              }}
            ></div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default RouletteCardSkeleton; 