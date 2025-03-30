import React from 'react';
import { WandSparkles, Eye, EyeOff, Target, AlertTriangle, Info, TrendingUp, Trophy, CircleX } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import RouletteNumber from './RouletteNumber';

interface SuggestionDisplayProps {
  suggestion: number[];
  selectedGroup: string;
  isBlurred: boolean;
  toggleVisibility: (e: React.MouseEvent) => void;
  numberGroups: Record<string, { name: string; numbers: number[]; color: string }>;
  strategyState?: string;
  strategyDisplay?: string;
  strategyTerminals?: number[];
  wins?: number;
  losses?: number;
}

const SuggestionDisplay = ({ 
  suggestion, 
  selectedGroup, 
  isBlurred, 
  toggleVisibility,
  numberGroups,
  strategyState,
  strategyDisplay,
  strategyTerminals,
  wins = 0,
  losses = 0
}: SuggestionDisplayProps) => {
  
  const getSuggestionColor = (num: number) => {
    const groupKey = selectedGroup as keyof typeof numberGroups;
    return numberGroups[groupKey].color;
  };

  // Sempre usar dados de estratégia quando disponíveis
  const useStrategyData = strategyState !== undefined && strategyState !== null && strategyState !== "";
  
  // Determinar a sugestão a ser exibida - priorizar terminais da estratégia
  const displaySuggestion = (useStrategyData && strategyTerminals && strategyTerminals.length > 0) 
    ? strategyTerminals 
    : suggestion;
    
  const displayLabel = useStrategyData ? 'Terminais' : 'Sugestão';
  
  // Cores para diferentes estados
  const getStateColor = () => {
    if (!strategyState) return 'text-[#00ff00]';
    
    switch (strategyState) {
      case 'TRIGGER': 
        return 'text-green-500';
      case 'POST_GALE_NEUTRAL': 
        return 'text-yellow-500';
      case 'MORTO': 
        return 'text-red-400';
      default: 
        return 'text-blue-400';
    }
  };
  
  const displayColor = useStrategyData ? getStateColor() : 'text-[#00ff00]';
  
  // Estado específico para TRIGGER ou POST_GALE_NEUTRAL
  const isActiveState = strategyState === 'TRIGGER' || strategyState === 'POST_GALE_NEUTRAL';
  
  // Garantir que sugestão de display seja sempre visível
  const safeStrategyDisplay = strategyDisplay || (
    strategyTerminals && strategyTerminals.length > 0 
      ? `APOSTAR NOS TERMINAIS: ${strategyTerminals.join(',')}` 
      : "AGUARDANDO GATILHO"
  );
  
  return (
    <div className="space-y-0.5">
      {/* Exibir o estado da estratégia de forma mais proeminente */}
      {useStrategyData && (
        <div className={`mb-2 p-2 rounded-md ${
          strategyState === 'TRIGGER' ? 'bg-green-500/30 border border-green-400' : 
          strategyState === 'POST_GALE_NEUTRAL' ? 'bg-yellow-500/30 border border-yellow-400' : 
          strategyState === 'MORTO' ? 'bg-red-500/30 border border-red-400' : 
          'bg-blue-500/30 border border-blue-400'
        }`}>
          <div className="flex flex-col">
            <div className="flex justify-between items-center">
              <div className={`text-[12px] font-semibold ${displayColor} flex items-center gap-1.5`}>
                <Target size={12} />
                <span>Estado: {strategyState || "DESCONHECIDO"}</span>
              </div>
              
              <button 
                onClick={toggleVisibility} 
                className="text-gray-400 hover:text-white transition-colors"
              >
                {isBlurred ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            
            {/* Mostrar a sugestão de display de forma destacada */}
            {safeStrategyDisplay && (
              <div className={`text-[11px] ${displayColor} font-bold mt-1.5 px-1 py-0.5 rounded bg-black/30`}>
                {safeStrategyDisplay}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Seção de Vitórias e Derrotas */}
      <div className="flex justify-between items-center mb-2 bg-black/20 p-1.5 rounded-md">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Trophy size={14} className="text-green-500" />
            <span className="text-green-400 text-xs font-bold">{wins}</span>
          </div>
          <div className="flex items-center gap-1">
            <CircleX size={14} className="text-red-500" />
            <span className="text-red-400 text-xs font-bold">{losses}</span>
          </div>
        </div>
        <div className="text-[9px] text-gray-400">
          Taxa: {wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0}%
        </div>
      </div>
      
      {/* Seção de Terminais e Estratégia - Agora mais clara e destacada */}
      <div className="grid grid-cols-2 gap-2 mt-2">
        {/* Coluna de Terminais */}
        <div>
          <div className="text-red-500 text-xs font-bold mb-1 uppercase flex items-center gap-1">
            <Target size={10} />
            <span>terminais</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {displaySuggestion.map((num, i) => (
              <TooltipProvider key={i}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <RouletteNumber
                        number={num}
                        className={`w-7 h-7 text-[11px] font-bold border-2 ${useStrategyData ? `border-${displayColor.replace('text-', '')}` : 'border-[#00ff00]'} ${
                          useStrategyData 
                            ? (strategyState === 'TRIGGER' ? 'bg-green-500/20' : 
                              strategyState === 'POST_GALE_NEUTRAL' ? 'bg-yellow-500/20' :
                              'bg-blue-500/20') 
                            : getSuggestionColor(num)
                        } ${isBlurred ? 'blur-sm' : (strategyState === 'TRIGGER' ? 'animate-pulse' : '')}`}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Terminal {num}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
        
        {/* Coluna de Estratégia */}
        <div>
          <div className="text-red-500 text-xs font-bold mb-1 uppercase flex items-center gap-1">
            <WandSparkles size={10} />
            <span>estrategia</span>
          </div>
          <div className={`text-[10px] ${displayColor} font-medium bg-black/30 p-1.5 rounded-sm`}>
            {isActiveState ? (
              <div className="flex flex-col">
                <span className="font-bold">{strategyState}</span>
                <span className="text-[9px] mt-0.5">{safeStrategyDisplay}</span>
              </div>
            ) : (
              <span>{safeStrategyDisplay || "Aguardando Padrão"}</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Texto adicional para estados ativos - Mais claro e instrutivo */}
      {useStrategyData && isActiveState && (
        <div className="mt-1 bg-black/20 p-1 rounded">
          <p className={`text-[10px] ${displayColor} font-semibold text-center`}>
            {strategyState === 'TRIGGER' 
              ? '👉 APOSTAR NOS TERMINAIS ACIMA 👈' 
              : '⚠️ OBSERVE OS TERMINAIS ACIMA ⚠️'}
          </p>
        </div>
      )}
    </div>
  );
};

export default SuggestionDisplay;
