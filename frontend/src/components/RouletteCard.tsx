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
import { RouletteApi } from '@/services/api/rouletteApi';

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

interface RouletteCardProps {
  roletaId: string;
  roletaNome: string;
  className?: string;
}

const RouletteCard: React.FC<RouletteCardProps> = ({
  roletaId,
  roletaNome,
  className = ''
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [numbers, setNumbers] = useState<number[]>([]);

  useEffect(() => {
    const loadRouletteData = async () => {
      try {
        setLoading(true);
        
        // Tentar obter dados da roleta usando a API
        if (roletaId) {
          const rouletteData = await RouletteApi.fetchRouletteHistory(roletaId);
          if (rouletteData && rouletteData.length > 0) {
            setNumbers(rouletteData.slice(0, 15).map((n: any) => n.numero || n));
          }
        }
        
        setError(false);
      } catch (err) {
        console.error(`Erro ao carregar dados da roleta ${roletaId}:`, err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    
    loadRouletteData();
  }, [roletaId]);

  if (loading) {
    return (
      <div className={`roulette-card p-4 bg-gray-800 rounded-lg shadow-lg ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{roletaNome}</h3>
          <div className="text-sm text-gray-400">ID: {roletaId}</div>
        </div>
        <div className="flex justify-center items-center h-20">
          <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-blue-500 rounded-full"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`roulette-card p-4 bg-gray-800 rounded-lg shadow-lg ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{roletaNome}</h3>
          <div className="text-sm text-gray-400">ID: {roletaId}</div>
        </div>
        <div className="text-center p-2 bg-red-900/50 rounded my-2">
          <p className="text-sm text-red-200">Falha ao carregar dados</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`roulette-card p-4 bg-gray-800 rounded-lg shadow-lg ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{roletaNome}</h3>
        <div className="text-sm text-gray-400">ID: {roletaId}</div>
      </div>
        
      <div className="mb-4">
        <RouletteNumbers
          roletaId={roletaId}
          roletaNome={roletaNome}
          maxNumbers={15}
        />
      </div>
        
      <div className="flex justify-between items-center text-sm text-gray-400">
        <button 
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
          onClick={() => {/* Implementar visualização detalhada */}}
        >
          Ver detalhes
        </button>
        
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>Ao vivo</span>
        </div>
      </div>
    </div>
  );
};

export default RouletteCard;