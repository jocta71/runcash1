import { TrendingUp, Eye, EyeOff, Target, Star, RefreshCw } from 'lucide-react';
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

// Gera dados de tendência baseados na taxa de vitória e derrota
const generateTrendFromWinRate = (wins: number, losses: number) => {
  const total = wins + losses;
  if (total === 0) {
    return Array.from({ length: 20 }, () => ({ value: Math.random() * 100 }));
  }
  
  const winRate = wins / total;
  
  return Array.from({ length: 20 }, (_, i) => {
    const randomVariation = (Math.random() - 0.5) * 30;
    return { value: winRate * 100 + randomVariation };
  });
};

interface RouletteCardProps {
  roletaId?: string;
  name?: string;
  roleta_nome?: string;
  wins?: number;
  losses?: number;
  lastNumbers?: number[];
  trend?: { value: number }[];
}

const RouletteCard = memo(({ 
  roletaId,
  name, 
  roleta_nome, 
  wins = 0, 
  losses = 0,
  lastNumbers = [],
  trend = []
}: RouletteCardProps) => {
  const navigate = useNavigate();
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [suggestion, setSuggestion] = useState<number[]>([]);
  const [isBlurred, setIsBlurred] = useState(false);
  const [currentStrategy, setCurrentStrategy] = useState(strategies[0]);
  const [selectedGroup, setSelectedGroup] = useState<string>("grupo-123");
  const [statsOpen, setStatsOpen] = useState(false);
  
  // Adicionar estado para os dados de estratégia
  const [strategyState, setStrategyState] = useState<string>("");
  const [strategyDisplay, setStrategyDisplay] = useState<string>("");
  const [strategyTerminals, setStrategyTerminals] = useState<number[]>([]);
  const [strategyWins, setStrategyWins] = useState<number>(0);
  const [strategyLosses, setStrategyLosses] = useState<number>(0);
  
  // Manter apenas referência para o último número processado para controle
  const lastProcessedNumberRef = useRef<number | null>(null);
  
  // Verificar se o nome da roleta é válido, com fallback para roleta_nome
  const roletaNome = name || roleta_nome || "Roleta Desconhecida";
  
  // Usar o hook personalizado para obter dados em tempo real, apenas se tivermos um roletaId
  const { 
    numbers, 
    loading: isLoading, 
    error, 
    isConnected = true, 
    hasData = true, 
    strategy, 
    strategyLoading, 
    refreshNumbers = () => {} 
  } = roletaId ? useRouletteData(roletaId, roletaNome) : {
    numbers: lastNumbers.map(num => ({ numero: num })),
    loading: false,
    error: null,
    isConnected: true,
    hasData: lastNumbers && lastNumbers.length > 0,
    strategy: null,
    strategyLoading: false,
    refreshNumbers: () => {}
  };
  
  // Converter os objetos RouletteNumber para números simples
  const mappedNumbers = useMemo(() => {
    if (!Array.isArray(numbers)) {
      return lastNumbers || [];
    }
    
    const mapped = numbers.map(numObj => {
      const num = typeof numObj.numero === 'number' ? numObj.numero : 
                 typeof numObj.numero === 'string' ? parseInt(numObj.numero, 10) : 0;
      return isNaN(num) ? 0 : num;
    });
    
    if (DEBUG_ENABLED) {
      debugLog(`[RouletteCard] Números mapeados para ${roletaNome}:`, mapped.slice(0, 5));
    }
    
    return mapped;
  }, [numbers, roletaNome, lastNumbers]);

  // Otimizar trend com useMemo para evitar recálculos desnecessários
  const trendData = useMemo(() => {
    if (trend && trend.length > 0) {
      return trend;
    }
    return generateTrendFromWinRate(strategyWins || wins, strategyLosses || losses);
  }, [wins, losses, strategyWins, strategyLosses, trend]);

  // Callback memoizado para atualizar a estratégia
  const updateStrategy = useCallback((event: StrategyUpdateEvent) => {
    debugLog(`[RouletteCard] Evento de estratégia recebido para ${roletaNome}: ${event.estado}`);
    
    if (mappedNumbers.length > 0) {
      lastProcessedNumberRef.current = mappedNumbers[0];
    }
    
    setStrategyState(event.estado);
    setStrategyDisplay(event.sugestao_display || "");
    setStrategyTerminals(event.terminais_gatilho || []);
    setStrategyWins(event.vitorias);
    setStrategyLosses(event.derrotas);
  }, [mappedNumbers, roletaNome]);

  // Efeito para inicializar os dados da estratégia a partir do hook
  useEffect(() => {
    if (strategy && !strategyLoading) {
      debugLog(`[RouletteCard] Inicializando estado da estratégia de ${roletaNome} com dados carregados:`, strategy);
      setStrategyState(strategy.estado);
      setStrategyDisplay(strategy.sugestao_display || "");
      setStrategyTerminals(strategy.terminais_gatilho || []);
      setStrategyWins(strategy.vitorias);
      setStrategyLosses(strategy.derrotas);
    }
  }, [strategy, strategyLoading, roletaNome]);

  // Efeito para subscrever eventos de estratégia do backend
  useEffect(() => {
    const eventService = EventService.getInstance();
    
    debugLog(`[RouletteCard] Montando componente para ${roletaNome} (ID: ${roletaId})`);
    
    const handleStrategyUpdate = (event: StrategyUpdateEvent) => {
      if (event.type !== 'strategy_update' || 
          (event.roleta_id !== roletaId && event.roleta_nome !== roletaNome)) {
        return;
      }
      
      updateStrategy(event);
    };
    
    debugLog(`[RouletteCard] Inscrevendo para eventos de estratégia: ${roletaNome}`);
    eventService.subscribeToEvent('strategy_update', handleStrategyUpdate);
    
    const globalHandler = (event: any) => {
      if (event.roleta_id === roletaId || event.roleta_nome === roletaNome) {
        debugLog(`[RouletteCard] Evento global recebido para ${roletaNome}:`, event);
      }
    };
    
    eventService.subscribeToGlobalEvents(globalHandler);
    
    const requestCurrentStrategy = () => {
      const socketService = SocketService.getInstance();
      
      if (!socketService.isSocketConnected()) {
        debugLog(`[RouletteCard] Socket.IO não conectado para ${roletaNome}`);
        return;
      }
      
      debugLog(`[RouletteCard] Solicitando estratégia atual para ${roletaNome}`);
      
      socketService.sendMessage({
        type: 'get_strategy',
        roleta_id: roletaId,
        roleta_nome: roletaNome
      });
    };
    
    setTimeout(requestCurrentStrategy, 2000);
    
    return () => {
      debugLog(`[RouletteCard] Desmontando componente para ${roletaNome}`);
      eventService.unsubscribeFromEvent('strategy_update', handleStrategyUpdate);
      eventService.unsubscribeFromGlobalEvents(globalHandler);
    };
  }, [roletaId, roletaNome, updateStrategy]);

  // Efeito para verificar dados ao montar
  useEffect(() => {
    debugLog(`[RouletteCard] Montado para ${roletaNome} (ID: ${roletaId})`);
    
    if (!isLoading && mappedNumbers.length === 0) {
      debugLog(`[RouletteCard] Sem números para ${roletaNome}, tentando refresh...`);
      refreshNumbers();
    }
  }, [roletaId, roletaNome, isLoading, hasData, mappedNumbers.length, refreshNumbers]);

  const generateSuggestion = () => {
    const groupKeys = Object.keys(numberGroups);
    const randomGroupKey = groupKeys[Math.floor(Math.random() * groupKeys.length)];
    const selectedGroup = numberGroups[randomGroupKey as keyof typeof numberGroups];
    
    const relatedStrategy = strategies.find(s => s.name.includes(selectedGroup.numbers.join(',')));
    setCurrentStrategy(relatedStrategy || strategies[0]);
    
    setSuggestion([...selectedGroup.numbers]);
    setSelectedGroup(randomGroupKey);
    
    toast({
      title: "Sugestão Gerada",
      description: `Grupo: ${selectedGroup.name}`,
      variant: "default"
    });
  };

  const toggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBlurred(!isBlurred);
  };

  const handleDetailsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStatsOpen(true);
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast({
      title: "Roleta Aberta",
      description: "Redirecionando para o jogo...",
      variant: "default"
    });
  };
  
  // Função para tentar recarregar os dados
  const reloadData = (e: React.MouseEvent) => {
    e.stopPropagation();
    refreshNumbers();
  };

  // Memoização do LastNumbers component para evitar re-renders
  const numbersDisplay = useMemo(() => (
    <LastNumbers 
      numbers={mappedNumbers} 
      isLoading={isLoading && mappedNumbers.length === 0}
    />
  ), [mappedNumbers, isLoading]);

  return (
    <div 
      className="bg-[#17161e]/90 backdrop-filter backdrop-blur-sm border border-white/10 rounded-xl p-3 md:p-4 space-y-2 md:space-y-3 flex flex-col h-auto w-full overflow-hidden shadow-lg"
      data-roleta-id={roletaId}
      data-loading={isLoading ? 'true' : 'false'}
      data-connected={isConnected ? 'true' : 'false'}
      onClick={handleDetailsClick}
    >
      {/* Header com nome da roleta e controles */}
      <div className="flex justify-between items-start mb-2 border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <div className="text-lg font-bold text-white truncate max-w-[180px]">
            {roletaNome}
          </div>
          
          {/* Indicador de estado da estratégia - versão mais visível */}
          {strategyState && (
            <div className={`text-xs px-2 py-1 rounded-md font-semibold flex items-center gap-1.5 min-w-20 justify-center ${
              strategyState === 'TRIGGER' ? 'bg-green-500/30 text-green-300 border border-green-500/50' : 
              strategyState === 'POST_GALE_NEUTRAL' ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50' : 
              strategyState === 'MORTO' ? 'bg-red-500/30 text-red-300 border border-red-500/50' : 
              'bg-blue-500/30 text-blue-300 border border-blue-500/50'
            }`}>
              {strategyState === 'WAITING' ? 'Aguardando' :
               strategyState === 'ACTIVE' ? 'Ativo' :
               strategyState === 'TRIGGER' ? 'Padrão' :
               strategyState}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <TrendingUp
            size={16}
            className={`text-[#00ff00] ${isConnected ? 'animate-pulse' : 'text-opacity-30'}`}
            aria-label={isConnected ? 'Conectado' : 'Desconectado'}
          />
          <Star size={16} className="text-[#00ff00]" style={{opacity: 0.7}} />
          {showSuggestions && 
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsBlurred(!isBlurred);
              }}
              className="text-[#00ff00] hover:text-[#00ff00]/90 transition-colors"
            >
              {isBlurred ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        </div>
      </div>
      
      {/* Display de números - usando o componente memoizado */}
      <div className="flex flex-col py-2">
        {numbersDisplay}
      </div>
      
      {/* Taxa de vitória */}
      <div className="mt-1 mb-3">
        <WinRateDisplay 
          wins={strategyWins || wins} 
          losses={strategyLosses || losses} 
        />
        <RouletteTrendChart data={trendData} />
      </div>
      
      {/* Análise de padrão */}
      <div className="mb-3">
        <div className="flex items-center gap-1">
          <Target size={10} className="text-[#00ff00]" />
          <span className="text-[8px] text-[#00ff00] font-medium">Análise de Padrão</span>
        </div>
        <div className="text-[10px] text-gray-300">
          {hasData && mappedNumbers.length > 0 ? 
            getInsightMessage(mappedNumbers, strategyWins || wins, strategyLosses || losses) : 
            "Aguardando dados..."
          }
        </div>
      </div>
      
      {/* Status atual */}
      <div className="mb-4">
        <div className="flex items-center gap-1">
          <Target size={10} className="text-[#00ff00]" />
          <span className="text-[8px] text-[#00ff00] font-medium">Status</span>
        </div>
        <div className="text-[10px] text-gray-300">
          {strategyState === 'TRIGGER' ? 'Aguardando padrão...' :
            strategyState === 'ACTIVE' ? (
              <SuggestionDisplay
                suggestion={strategyDisplay || "Estratégia ativa, mas sem sugestão"}
                isActive={true}
                terminals={strategyTerminals}
                isBlurred={isBlurred && showSuggestions}
              />
            ) : 'Aguardando padrão...'}
        </div>
      </div>
      
      {/* Botões de ação */}
      <RouletteActionButtons 
        onDetailsClick={(e) => {
          e.stopPropagation();
          setStatsOpen(true);
        }} 
        onPlayClick={(e) => {
          e.stopPropagation();
          navigate(`/roleta/${roletaId}`);
        }}
        isConnected={isConnected}
        hasData={hasData}
      />
      
      {/* Modal de estatísticas */}
      <RouletteStatsModal 
        open={statsOpen} 
        onClose={setStatsOpen} 
        roletaNome={roletaNome}
        lastNumbers={mappedNumbers}
        wins={strategyWins || wins}
        losses={strategyLosses || losses}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Função de comparação personalizada para React.memo
  // Retorna true se o componente NÃO deve ser renderizado novamente
  return prevProps.roletaId === nextProps.roletaId &&
         prevProps.name === nextProps.name &&
         prevProps.roleta_nome === nextProps.roleta_nome;
});

export default RouletteCard;