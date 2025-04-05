import { TrendingUp, Eye, EyeOff, Target, Star, RefreshCw, ArrowUp, ArrowDown, Loader2, HelpCircle } from 'lucide-react';
import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { toast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { strategies, numberGroups } from './roulette/constants';
import LastNumbers from './roulette/LastNumbers';
import WinRateDisplay from './roulette/WinRateDisplay';
import RouletteTrendChart from './roulette/RouletteTrendChart';
import SuggestionDisplay from './roulette/SuggestionDisplay';
import RouletteActionButtons from './roulette/RouletteActionButtons';
import RouletteStatsModal from './RouletteStatsModal';
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
import { RouletteData } from '@/types';
import NumberDisplay from './NumberDisplay';
import { Badge } from "@/components/ui/badge";
import { PieChart, Phone, Timer, Cpu, Zap, History } from "lucide-react";
import RouletteStats from './RouletteStats';
import { useRouletteSettingsStore } from '@/stores/routleteStore';
import { cn } from '@/lib/utils';

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
  data: RouletteData;
  isDetailView?: boolean;
}

const RouletteCard: React.FC<RouletteCardProps> = ({ data, isDetailView = false }) => {
  const [lastNumber, setLastNumber] = useState<number | null>(data.lastNumbers?.[0] || null);
  const [recentNumbers, setRecentNumbers] = useState<number[]>(data.lastNumbers || []);
  const [isNewNumber, setIsNewNumber] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasInitialized = useRef(false);
  const socketService = SocketService.getInstance();
  const { enableSound, enableNotifications } = useRouletteSettingsStore();

  // Função para processar um novo número em tempo real
  const processRealtimeNumber = (newNumberEvent: RouletteNumberEvent) => {
    // Verificar se é um número válido
    if (typeof newNumberEvent.numero !== 'number' || isNaN(newNumberEvent.numero)) {
      console.warn('Número inválido recebido:', newNumberEvent);
      return;
    }

    const newNumber = newNumberEvent.numero;
    
    // Atualizar o último número
    setLastNumber(prevLastNumber => {
      // Se o número for igual ao último, não fazer nada
      if (prevLastNumber === newNumber) return prevLastNumber;
      
      // Se for um número diferente, atualizar
      return newNumber;
    });

    // Atualizar a lista de números recentes
    setRecentNumbers(prevNumbers => {
      // Evitar duplicação do mesmo número em sequência
      if (prevNumbers.length > 0 && prevNumbers[0] === newNumber) {
        return prevNumbers;
      }
      
      // Adicionar o novo número ao início e manter apenas os últimos X números
      return [newNumber, ...prevNumbers].slice(0, 20);
    });

    // Ativar efeito visual de novo número
    setIsNewNumber(true);
    
    // Incrementar contador de atualizações
    setUpdateCount(prev => prev + 1);
    
    // Tocar som se habilitado
    if (enableSound && audioRef.current) {
      audioRef.current.play().catch(e => console.log('Erro ao tocar áudio:', e));
    }
    
    // Mostrar notificação se habilitado
    if (enableNotifications) {
      toast({
        title: `Novo número: ${newNumber}`,
        description: `${data.name}: ${newNumber}`,
        variant: "default",
      });
    }

    // Remover destaque após alguns segundos
    setTimeout(() => {
      setIsNewNumber(false);
    }, 2000);
  };

  useEffect(() => {
    // Inicializar referência ao elemento de áudio
    audioRef.current = new Audio('/sounds/notification.mp3');
    
    // Evitar inicialização duplicada
    if (hasInitialized.current) return;
    
    const roletaId = data.id;
    const roletaNome = data.name;
    
    if (!roletaId || !roletaNome) {
      console.warn('RouletteCard: ID ou nome da roleta ausente:', data);
      return;
    }
        
    console.log(`[RouletteCard] Inicializando card para ${roletaNome} (${roletaId})`);
    hasInitialized.current = true;
    
    // Função para lidar com eventos de novos números
    const handleNewNumber = (event: RouletteNumberEvent) => {
      // Verificar se componente ainda está montado
      if (!cardRef.current) {
        console.warn(`[RouletteCard] Evento recebido após desmontagem para ${roletaNome}`);
        return;
      }

      // Verificar se este evento é para esta roleta
      if (event.roleta_id === roletaId || 
          event.roleta_nome.toLowerCase().includes(roletaNome.toLowerCase()) || 
          roletaNome.toLowerCase().includes(event.roleta_nome.toLowerCase())) {
        console.log(`[RouletteCard] Número recebido para ${roletaNome}: ${event.numero}`);
        
        // Processar número de forma segura
        try {
          processRealtimeNumber(event);
        } catch (error) {
          console.error(`[RouletteCard] Erro ao processar número para ${roletaNome}:`, error);
        }
      }
    };
    
    // Registrar para eventos globais
    EventService.getInstance().subscribe('new_number', handleNewNumber);
    
    // Registrar para eventos específicos desta roleta
    socketService.subscribe(roletaNome, handleNewNumber);
    
    // Iniciar polling agressivo para esta roleta em particular
    socketService.startAggressivePolling(roletaId, roletaNome);
    
    // Função de limpeza para remover os listeners quando o componente for desmontado
    return () => {
      console.log(`[RouletteCard] Desmontando card para ${roletaNome}`);
      
      // Remover listeners para evitar vazamento de memória
      try {
        EventService.getInstance().unsubscribe('new_number', handleNewNumber);
      } catch (e) {
        console.warn(`[RouletteCard] Erro ao remover listener do EventService:`, e);
      }
      
      try {
        socketService.unsubscribe(roletaNome, handleNewNumber);
      } catch (e) {
        console.warn(`[RouletteCard] Erro ao remover listener do SocketService:`, e);
      }
      
      try {
        socketService.stopPollingForRoulette(roletaId);
      } catch (e) {
        console.warn(`[RouletteCard] Erro ao parar polling:`, e);
      }
      
      // Limpar referência de áudio
      if (audioRef.current) {
        try {
          // Garantir que o áudio está pausado
          audioRef.current.pause();
          audioRef.current.src = '';
          audioRef.current = null;
        } catch (e) {
          console.warn(`[RouletteCard] Erro ao limpar referência de áudio:`, e);
        }
      }
      
      // Marcar que foi limpo
      hasInitialized.current = false;
    };
  }, [data.id, data.name]); // Dependências reduzidas ao essencial

  // ... existing code com lógica de renderização ...
  
  return (
    <Card 
      ref={cardRef}
      className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-md", 
        isNewNumber ? "border-green-500 shadow-green-200" : "",
        isDetailView ? "w-full" : "w-full"
      )}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold truncate">{data.name}</h3>
          <div className="flex gap-1">
            <Badge variant="outline" className="bg-muted text-xs">
              {updateCount > 0 ? `${updateCount} atualizações` : "Aguardando..."}
            </Badge>
          </div>
        </div>
        
        {/* Número atual */}
        <div className={cn(
          "flex justify-center my-4 transition-all duration-300",
          isNewNumber ? "scale-110" : ""
        )}>
          <NumberDisplay 
            number={lastNumber} 
            size="large" 
            highlight={isNewNumber}
          />
      </div>
      
        {/* Últimos números */}
        <div className="flex flex-wrap gap-1 justify-center my-3">
          {recentNumbers.slice(0, isDetailView ? 20 : 10).map((num, idx) => (
            <NumberDisplay 
              key={`${num}-${idx}`}
              number={num} 
              size="small" 
              highlight={idx === 0 && isNewNumber}
            />
          ))}
            </div>
            
            {/* Estatísticas */}
        <div className="mt-4 text-sm text-muted-foreground">
          <RouletteStats numbers={recentNumbers} />
        </div>
        
        {/* Indicadores */}
        <div className="flex justify-between mt-4 text-xs text-muted-foreground">
              <div className="flex items-center">
            <Zap className="h-3 w-3 mr-1" />
            <span>Tempo real</span>
              </div>
              <div className="flex items-center">
            <History className="h-3 w-3 mr-1" />
            <span>{recentNumbers.length} números</span>
          </div>
      </div>
      </CardContent>
    </Card>
  );
};

export default RouletteCard;