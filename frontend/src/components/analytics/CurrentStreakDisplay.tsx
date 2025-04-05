import React from 'react';
import { CurrentStreak } from '@/hooks/useRoletaAnalytics';

interface CurrentStreakDisplayProps {
  streak: CurrentStreak;
}

export const CurrentStreakDisplay: React.FC<CurrentStreakDisplayProps> = ({ streak }) => {
  if (!streak.type || !streak.value || streak.count <= 1) {
    return (
      <div className="p-3 bg-[#1a1922] rounded-lg border border-gray-700 w-full">
        <h3 className="text-sm font-medium text-gray-300 mb-1">Sequência atual</h3>
        <p className="text-white text-sm">Nenhuma sequência detectada</p>
      </div>
    );
  }

  // Determinar se a sequência é significativa
  const isSignificant = streak.count >= 4;
  
  // Estilo baseado na significância
  const borderClass = isSignificant 
    ? 'border-yellow-500/50 animate-pulse' 
    : 'border-gray-700';

  // Determinar cor do texto baseado no tipo de sequência
  const getValueColor = (streak: CurrentStreak) => {
    if (!streak || !streak.value) {
      return 'text-gray-400';
    }
    
    try {
      const valueSafe = String(streak.value).toLowerCase();
      
      switch (streak.type) {
        case 'cor':
          if (valueSafe === 'vermelho') return 'text-red-600';
          if (valueSafe === 'preto') return 'text-black';
          if (valueSafe === 'verde') return 'text-green-600';
          return 'text-gray-400';
        case 'par_impar':
          return 'text-purple-600';
        case 'high_low':
          return 'text-blue-600';
        default:
          return 'text-gray-400';
      }
    } catch (error) {
      console.error('Erro ao processar valor da sequência:', streak, error);
      return 'text-gray-400';
    }
  };

  // Gerar texto descritivo
  const getMessage = (streak: CurrentStreak) => {
    if (!streak || !streak.value || !streak.count) {
      return 'Sem sequência atual';
    }
    
    try {
      const isSignificant = streak.isSignificant;
      if (isSignificant) {
        return `${streak.count}x ${streak.value}`;
      }
      return `${streak.count}x ${streak.value}`;
    } catch (error) {
      console.error('Erro ao gerar mensagem da sequência:', streak, error);
      return 'Sequência desconhecida';
    }
  };

  return (
    <div className={`p-3 bg-[#1a1922] rounded-lg border ${borderClass} w-full`}>
      <h3 className="text-sm font-medium text-gray-300 mb-1">Sequência atual</h3>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white text-sm">
            Tipo: <span className="font-medium capitalize">{streak.type}</span>
          </p>
          <p className={`text-sm font-medium capitalize ${getValueColor(streak)}`}>
            {streak.value} × {streak.count}
          </p>
        </div>
        
        {isSignificant && (
          <div className="bg-yellow-500/20 rounded-full px-3 py-1">
            <span className="text-yellow-400 text-xs font-medium">Alerta</span>
          </div>
        )}
      </div>
      
      <p className="text-xs text-gray-400 mt-2">{getMessage(streak)}</p>
    </div>
  );
}; 