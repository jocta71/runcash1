import { TrendingUp, Eye, EyeOff, Target, Star, RefreshCw, ArrowUp, ArrowDown, Loader2, HelpCircle, BarChart3 } from 'lucide-react';
import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { toast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { strategies, numberGroups } from './roulette/constants';
import LastNumbers from './roulette/LastNumbers';
import WinRateDisplay from './roulette/WinRateDisplay';
import RouletteTrendChart from './roulette/RouletteTrendChart';
import SuggestionDisplay from './roulette/SuggestionDisplay';
import RouletteActionButtons from './roulette/RouletteActionButtons';
import RouletteSidePanelStats from './RouletteSidePanelStats';
import { useRouletteData } from '@/hooks/useRouletteData';
import { Button } from '@/components/ui/button';
import { StrategyUpdateEvent } from '@/services/EventService';
import EventService from '@/services/EventService';
import SocketService from '@/services/SocketService';
import StrategySelector from '@/components/StrategySelector';
import { Strategy } from '@/services/StrategyService';
import RouletteNumber from './roulette/RouletteNumber';
import { RequestThrottler } from '@/services/utils/requestThrottler';
import { getLogger } from '@/services/utils/logger';
import { Card, CardContent } from "@/components/ui/card";
import { RouletteData, RouletteNumberEvent } from '@/types';
import NumberDisplay from './NumberDisplay';
import { Badge } from "@/components/ui/badge";
import { PieChart, Phone, Timer, Cpu, Zap, History } from "lucide-react";
import RouletteStats from './RouletteStats';
import { useRouletteSettingsStore } from '@/stores/routleteStore';
import { cn } from '@/lib/utils';
import RouletteFeedService from '@/services/RouletteFeedService';
import RouletteNumbers from './RouletteNumbers';
import { addRouletteToFavorites, removeRouletteFromFavorites } from "@/services/FavoritesService";
import { RouletteApi } from '@/services/api/rouletteApi';
import { Copy, Heart, BarChart2, Info, Server, Clock, Check, LinkIcon, MonitorSmartphone, PlayCircle, Bookmark, BookmarkCheck } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Logger específico para este componente
const logger = getLogger('RouletteCard');

// Debug flag - set to false to disable logs in production
const DEBUG_ENABLED = false;

// Helper function for controlled logging
const debugLog = (...args: any[]) => {
  if (DEBUG_ENABLED) {
    console.log(...args);
  }
};

// Função para gerar insights com base nos números
const getInsightMessage = (numbers: number[], wins: number, losses: number) => {
  if (!numbers || numbers.length === 0) {
    return "Aguardando dados...";
  }
  
  // Verificar repetições de dúzias
  const lastFiveNumbers = numbers.slice(0, 5);
  const firstDozen = lastFiveNumbers.filter(n => n >= 1 && n <= 12).length;
  const secondDozen = lastFiveNumbers.filter(n => n >= 13 && n <= 24).length;
  const thirdDozen = lastFiveNumbers.filter(n => n >= 25 && n <= 36).length;
  
  if (firstDozen >= 3) {
    return "Primeira dúzia aparecendo com frequência";
  } else if (secondDozen >= 3) {
    return "Segunda dúzia aparecendo com frequência";
  } else if (thirdDozen >= 3) {
    return "Terceira dúzia aparecendo com frequência";
  }
  
  // Verificar números pares ou ímpares
  const oddCount = lastFiveNumbers.filter(n => n % 2 === 1).length;
  const evenCount = lastFiveNumbers.filter(n => n % 2 === 0 && n !== 0).length;
  
  if (oddCount >= 4) {
    return "Tendência para números ímpares";
  } else if (evenCount >= 4) {
    return "Tendência para números pares";
  }
  
  // Verificar números baixos ou altos
  const lowCount = lastFiveNumbers.filter(n => n >= 1 && n <= 18).length;
  const highCount = lastFiveNumbers.filter(n => n >= 19 && n <= 36).length;
  
  if (lowCount >= 4) {
    return "Tendência para números baixos (1-18)";
  } else if (highCount >= 4) {
    return "Tendência para números altos (19-36)";
  }
  
  // Baseado na taxa de vitória
  const winRate = wins / (wins + losses);
  if (winRate > 0.7) {
    return "Boa taxa de acerto! Continue com a estratégia";
  } else if (winRate < 0.3) {
    return "Taxa de acerto baixa, considere mudar a estratégia";
  }
  
  return "Padrão normal, observe mais alguns números";
};

// Mapa de cores para os números da roleta
const colorMap: Record<number, string> = {
  0: 'bg-green-600',
  1: 'bg-red-600',
  2: 'bg-black',
  3: 'bg-red-600',
  // ... outros números
};

// Função auxiliar para determinar a cor de um número
const getNumberColor = (number: number): string => {
  if (number === 0) return 'bg-green-600';
  return number % 2 === 0 ? 'bg-black' : 'bg-red-600';
};

interface RouletteCardProps {
  roulette: any;
  onSelectRoulette?: (roulette: any) => void;
  showBadge?: boolean;
  showStatusBadge?: boolean;
  className?: string;
}

const RouletteCard = ({ 
  roulette, 
  onSelectRoulette, 
  showBadge = true,
  showStatusBadge = true,
  className = ''
}: RouletteCardProps) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [lastNumbers, setLastNumbers] = useState<number[]>([]);
  
  useEffect(() => {
    // Garantir que usamos o correto campo para últimos números
    if (roulette.lastNumbers && Array.isArray(roulette.lastNumbers)) {
      setLastNumbers(roulette.lastNumbers);
    } else if (roulette.numeros && Array.isArray(roulette.numeros)) {
      // Pegar os 5 primeiros números
      setLastNumbers(roulette.numeros.slice(0, 5));
    } else {
      // Definir uma lista vazia para evitar erros
      setLastNumbers([]);
    }
    
    // Determinar se a roleta está ao vivo
    setIsLive(roulette.status === 'active' || roulette.status === 'live');
  }, [roulette]);
  
  const handleFavoriteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFavorite(!isFavorite);
    
    // Adicionar/remover dos favoritos
    if (!isFavorite) {
      addRouletteToFavorites(roulette.id);
    } else {
      removeRouletteFromFavorites(roulette.id);
    }
  };
  
  // Obter o nome da roleta de forma segura
  const getRoutletteName = () => {
    return roulette.nome || roulette.name || 'Roleta Sem Nome';
  };
  
  return (
    <div 
      className={`relative bg-card rounded-lg overflow-hidden shadow-lg transform transition-all duration-200 hover:scale-105 hover:shadow-xl cursor-pointer ${className}`}
      onClick={() => onSelectRoulette && onSelectRoulette(roulette)}
    >
      {/* Status badge */}
      {showStatusBadge && (
        <div className="absolute top-2 right-2 z-10">
          {isLive ? (
            <div className="flex items-center px-2 py-1 rounded-full bg-green-700 text-white text-xs font-medium animate-pulse">
              <span className="w-2 h-2 rounded-full bg-white mr-1"></span>
              AO VIVO
            </div>
          ) : (
            <div className="flex items-center px-2 py-1 rounded-full bg-gray-700 text-white text-xs font-medium">
              <Clock className="w-3 h-3 mr-1" /> OFFLINE
            </div>
          )}
        </div>
      )}
      
      {/* Provider badge */}
      {showBadge && roulette.provider && (
        <div className="absolute top-2 left-2 bg-gray-800/80 text-white text-xs px-2 py-1 rounded-full z-10">
          {roulette.provider}
        </div>
      )}
      
      {/* Favorite button */}
      <button
        onClick={handleFavoriteToggle}
        className="absolute bottom-2 right-2 bg-gray-800/80 text-white p-1.5 rounded-full z-10"
      >
        {isFavorite ? (
          <BookmarkCheck className="h-4 w-4 text-yellow-400" />
        ) : (
          <Bookmark className="h-4 w-4" />
        )}
      </button>
      
      {/* Card header */}
      <div className="relative" style={{ backgroundColor: roulette.cor_background || '#111827' }}>
        <div className="p-4 text-white">
          <h3 className="font-bold text-lg truncate">{getRoutletteName()}</h3>
          <p className="text-sm text-gray-300 truncate">
            ID: {roulette.id || roulette.roleta_id || "N/A"}
          </p>
        </div>
      </div>
      
      {/* Numbers history */}
      <div className="p-4 bg-card">
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Últimos Números</h4>
          <div className="flex space-x-1">
            {lastNumbers.length > 0 ? (
              <RouletteNumbers numbers={lastNumbers} />
            ) : (
              <div className="text-gray-500 text-sm">Sem números disponíveis</div>
            )}
          </div>
        </div>
        
        {/* Strategy status */}
        {roulette.estado_estrategia && (
          <div className="mt-2">
            <h4 className="text-sm font-medium text-gray-400 mb-1">Estratégia</h4>
            <div className="flex items-center">
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                roulette.estado_estrategia === 'vitoria' ? 'bg-green-900/30 text-green-400' :
                roulette.estado_estrategia === 'derrota' ? 'bg-red-900/30 text-red-400' :
                'bg-gray-800 text-gray-300'
              }`}>
                {roulette.estado_estrategia.charAt(0).toUpperCase() + roulette.estado_estrategia.slice(1)}
              </div>
              
              {/* Stats badges */}
              {(roulette.vitorias || roulette.derrotas) && (
                <div className="ml-2 flex space-x-1 text-xs">
                  {typeof roulette.vitorias === 'number' && (
                    <span className="bg-green-900/20 text-green-400 px-1.5 py-0.5 rounded">
                      {roulette.vitorias} V
                    </span>
                  )}
                  {typeof roulette.derrotas === 'number' && (
                    <span className="bg-red-900/20 text-red-400 px-1.5 py-0.5 rounded">
                      {roulette.derrotas} D
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RouletteCard;