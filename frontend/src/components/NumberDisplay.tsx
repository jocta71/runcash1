import React from 'react';
import { cn } from '@/lib/utils';

interface NumberDisplayProps {
  number: number | null;
  size?: 'small' | 'medium' | 'large' | 'tiny';
  highlight?: boolean;
}

const getColorClass = (number: number | null): string => {
  if (number === null) return 'bg-gray-300';
  if (number === 0) return 'bg-green-500 text-white';
  
  // Números vermelhos na roleta europeia
  const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return numerosVermelhos.includes(number) 
    ? 'bg-[#FF1D46] text-white' 
    : 'bg-[#292524] text-white';
};

// Novo helper para determinar a cor de destaque baseada no número
const getHighlightStyles = (number: number | null) => {
  if (number === null) return {};
  
  // Para o Zero (verde)
  if (number === 0) {
    return {
      ringColor: 'rgba(16, 185, 129, 0.9)',  // verde esmeralda
      glowColor: '0 0 12px 3px rgba(16, 185, 129, 0.8), 0 0 20px 5px rgba(16, 185, 129, 0.4)',
      borderColor: 'rgba(16, 185, 129, 1)'
    };
  }
  
  // Números vermelhos
  const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  if (numerosVermelhos.includes(number)) {
    return {
      ringColor: 'rgba(239, 68, 68, 0.9)',  // vermelho
      glowColor: '0 0 12px 3px rgba(239, 68, 68, 0.8), 0 0 20px 5px rgba(239, 68, 68, 0.4)',
      borderColor: 'rgba(239, 68, 68, 1)'
    };
  }
  
  // Números pretos
  return {
    ringColor: 'rgba(56, 189, 248, 0.9)',  // azul claro/ciano
    glowColor: '0 0 12px 3px rgba(56, 189, 248, 0.8), 0 0 20px 5px rgba(56, 189, 248, 0.4)',
    borderColor: 'rgba(56, 189, 248, 1)'
  };
};

const NumberDisplay: React.FC<NumberDisplayProps> = ({ 
  number, 
  size = 'medium',
  highlight = false 
}) => {
  // Definir classes de tamanho
  const sizeClasses = {
    tiny: 'w-5 h-5 text-[10px]',
    small: 'w-6 h-6 text-xs',
    medium: 'w-7 h-7 text-xs',
    large: 'w-12 h-12 text-xl font-bold'
  };

  // Obter estilos de destaque específicos para o número
  const highlightStyles = getHighlightStyles(number);

  return (
    <div 
      className={cn(
        "flex items-center justify-center transition-all border border-gray-700 rounded-[4px]",
        sizeClasses[size],
        getColorClass(number),
        highlight && "font-bold z-20"
      )}
      style={{
        transform: highlight ? 'scale(1.2)' : 'scale(1)',
        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        boxShadow: highlight ? highlightStyles.glowColor : 'none',
        border: highlight ? `1.5px solid ${highlightStyles.borderColor}` : '',
        animation: highlight ? 'pulse 2s infinite' : 'none',
        position: 'relative',
      }}
    >
      {/* Efeito de anel pulsante para o destaque */}
      {highlight && (
        <div 
          className="absolute inset-0 rounded-[4px] opacity-80 pointer-events-none z-10"
          style={{
            boxShadow: `0 0 0 3px ${highlightStyles.ringColor}`,
            animation: 'pulseRing 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite'
          }}
        />
      )}
      
      {/* Número */}
      <span className={cn(highlight && "text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.8)]")}>
        {number !== null ? number : '?'}
      </span>
      
      {/* Estilos CSS para as animações */}
      {highlight && (
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes pulse {
              0% { transform: scale(1.2); }
              50% { transform: scale(1.25); }
              100% { transform: scale(1.2); }
            }
            @keyframes pulseRing {
              0% { transform: scale(1); opacity: 0.8; }
              50% { transform: scale(1.08); opacity: 0.5; }
              100% { transform: scale(1); opacity: 0.8; }
            }
          `
        }} />
      )}
    </div>
  );
};

export default NumberDisplay; 