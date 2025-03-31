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
import useCardRouletteData from '@/hooks/useCardRouletteData';
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
  
  // Usar o hook de dados do card se tivermos um roletaId
  const cardRouletteData = roletaId ? useCardRouletteData(roletaId) : null;
  
  // Usar o hook personalizado para obter dados em tempo real, apenas se tivermos um roletaId
  const { 
    numbers, 
    loading: isLoading, 
    error, 
    isConnected = true, 
    hasData = false, 
    strategy, 
    strategyLoading, 
    refreshNumbers = () => {},
    refreshStrategy = () => Promise.resolve(false)
  } = roletaId ? useRouletteData(roletaId, roletaNome) : {
    numbers: [],
    loading: true,
    error: "ID da roleta não informado",
    isConnected: false,
    hasData: false,
    strategy: null,
    strategyLoading: true,
    refreshNumbers: () => {},
    refreshStrategy: () => Promise.resolve(false)
  };
  
  // Converter os objetos RouletteNumber para números simples
  const mappedNumbers = useMemo(() => {
    // Primeiro verificar se temos dados do cardRouletteData
    if (cardRouletteData?.data?.numeros && cardRouletteData.data.numeros.length > 0) {
      return cardRouletteData.data.numeros.map(num => typeof num === 'number' ? num : 0);
    }
    
    // Caso contrário, usar os dados do hook padrão
    if (!Array.isArray(numbers) || numbers.length === 0) {
      return [];
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
  }, [numbers, roletaNome, cardRouletteData]);

  // Otimizar trend com useMemo - usar dados do cardRouletteData se disponíveis
  const trendData = useMemo(() => {
    // Primeiro verificar se temos tendência nos dados do cardRouletteData
    if (cardRouletteData?.data?.tendencia && cardRouletteData.data.tendencia.length > 0) {
      return cardRouletteData.data.tendencia;
    }
    
    // Caso contrário, usar tendência fornecida como prop
    if (trend && trend.length > 0) {
      return trend;
    }
    
    // Sem dados de tendência disponíveis
    return [];
  }, [trend, cardRouletteData]);

  // Vitórias e Derrotas - usar dados do cardRouletteData se disponíveis
  const currentWins = useMemo(() => {
    return cardRouletteData?.data?.vitorias !== undefined ? cardRouletteData.data.vitorias : wins;
  }, [cardRouletteData, wins]);
  
  const currentLosses = useMemo(() => {
    return cardRouletteData?.data?.derrotas !== undefined ? cardRouletteData.data.derrotas : losses;
  }, [cardRouletteData, losses]);

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
      setStrategyState(strategy.estado || '');
      setStrategyDisplay(strategy.sugestao_display || '');
      setStrategyTerminals(strategy.terminais_gatilho || []);
      setStrategyWins(strategy.vitorias || 0);
      setStrategyLosses(strategy.derrotas || 0);
    }
  }, [strategy, strategyLoading, roletaNome]);

  // Efeito para atualizar dados ao receber eventos de estratégia
  useEffect(() => {
    const eventService = EventService.getInstance();
    
    // Função para processar eventos de estratégia
    const handleStrategyUpdate = (event: any) => {
      // Verificar se é um evento relevante para esta roleta
      if (event.type !== 'strategy_update' || 
          (event.roleta_id !== roletaId && event.roleta_nome !== roletaNome)) {
        return;
      }
      
      // Verificar se temos dados de vitórias e derrotas
      if (event.vitorias !== undefined || event.derrotas !== undefined) {
        console.log(`[RouletteCard] Atualizando vitórias/derrotas para ${roletaNome}:`, {
          vitorias: event.vitorias,
          derrotas: event.derrotas,
          timestamp: new Date().toISOString()
        });
        
        // Aplicar efeito visual de destaque por alguns segundos
        setHighlightWins(true);
        setHighlightLosses(true);
        
        // Remover classe após 2 segundos
        setTimeout(() => {
          setHighlightWins(false);
          setHighlightLosses(false);
        }, 2000);
        
        // Atualizar os estados com os valores recebidos do evento
        if (event.vitorias !== undefined) {
          setStrategyWins(parseInt(event.vitorias));
        }
        
        if (event.derrotas !== undefined) {
          setStrategyLosses(parseInt(event.derrotas));
        }
        
        // Atualizar também outros dados da estratégia
        if (event.estado !== undefined) {
          setStrategyState(event.estado);
        }
        
        if (event.sugestao_display !== undefined) {
          setStrategyDisplay(event.sugestao_display);
        }
        
        if (event.terminais_gatilho !== undefined) {
          setStrategyTerminals(event.terminais_gatilho);
        }
      } else {
        console.log(`[RouletteCard] Evento de estratégia sem dados de vitórias/derrotas para ${roletaNome}`);
      }
    };
    
    // Registrar manipulador para eventos de estratégia
    eventService.subscribeToEvent('strategy_update', handleStrategyUpdate);
    
    // Solicitar a estratégia atual ao montar o componente
    const socketService = SocketService.getInstance();
    if (socketService.isSocketConnected() && roletaId) {
      console.log(`[RouletteCard] Solicitando dados de estratégia para ${roletaNome}`, { roletaId });
      socketService.sendMessage({
        type: 'get_strategy',
        roleta_id: roletaId,
        roleta_nome: roletaNome
      });
    }
    
    // Configurar um intervalo para solicitar atualizações de estratégia periodicamente
    const strategyRefreshInterval = setInterval(() => {
      if (socketService.isSocketConnected() && roletaId) {
        console.log(`[RouletteCard] Solicitando atualização periódica de estratégia para ${roletaNome}`);
        socketService.sendMessage({
          type: 'get_strategy',
          roleta_id: roletaId,
          roleta_nome: roletaNome
        });
      }
    }, 15000); // Atualizar a cada 15 segundos
    
    // Limpar ao desmontar
    return () => {
      eventService.unsubscribeFromEvent('strategy_update', handleStrategyUpdate);
      clearInterval(strategyRefreshInterval);
    };
  }, [roletaId, roletaNome]);

  // Efeito para verificar dados ao montar
  useEffect(() => {
    debugLog(`[RouletteCard] Montado para ${roletaNome} (ID: ${roletaId})`);
    
    if (!isLoading && mappedNumbers.length === 0) {
      debugLog(`[RouletteCard] Sem números para ${roletaNome}, tentando refresh...`);
      refreshNumbers();
    }
    
    // Também atualizar a estratégia quando os números são atualizados
    const socketService = SocketService.getInstance();
    if (socketService.isSocketConnected() && roletaId && mappedNumbers.length > 0) {
      console.log(`[RouletteCard] Atualizando estratégia após receber novos números para ${roletaNome}`);
      socketService.sendMessage({
        type: 'get_strategy',
        roleta_id: roletaId,
        roleta_nome: roletaNome
      });
    }
  }, [roletaId, roletaNome, isLoading, hasData, mappedNumbers.length, refreshNumbers]);

  // Efeito para reagir a atualizações de números e solicitar dados de estratégia
  useEffect(() => {
    // Quando novos números são recebidos, solicitar atualização de estratégia
    if (mappedNumbers.length > 0 && roletaId) {
      console.log(`[RouletteCard] Atualizando estratégia após receber novos números para ${roletaNome}`);
      refreshStrategy();
    }
  }, [mappedNumbers, roletaNome, roletaId, refreshStrategy]);

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

  // Atualizar a função reloadData para usar o refresh do cardRouletteData
  const reloadData = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    toast({
      title: "Atualizando dados",
      description: `Buscando dados mais recentes para ${roletaNome}...`,
      duration: 3000
    });
    
    // Atualizar dados do card se disponível
    if (cardRouletteData && typeof cardRouletteData.refresh === 'function') {
      cardRouletteData.refresh().catch(console.error);
    }
    
    // Manter a atualização original também
    refreshNumbers();
    refreshStrategy().catch(console.error);
  };

  // Memoização do LastNumbers component para evitar re-renders
  const numbersDisplay = useMemo(() => (
    <LastNumbers 
      numbers={mappedNumbers} 
      isLoading={isLoading && mappedNumbers.length === 0}
    />
  ), [mappedNumbers, isLoading]);

  // Estados para controlar efeito visual quando valores de vitórias/derrotas mudam
  const [highlightWins, setHighlightWins] = useState(false);
  const [highlightLosses, setHighlightLosses] = useState(false);

  return (
    <div 
      className="bg-[#17161e] border border-white/10 rounded-lg p-3 flex flex-col h-full w-full"
      data-roleta-id={roletaId}
      data-loading={isLoading ? 'true' : 'false'}
      data-connected={isConnected ? 'true' : 'false'}
      onClick={handleDetailsClick}
    >
      {/* Header com nome da roleta e controles */}
      <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">
        <div className="text-base font-bold text-white truncate max-w-[140px]">
            {roletaNome}
          </div>
          
        <div className="flex items-center space-x-2">
          <TrendingUp
            size={16}
            className={isConnected ? "text-[#00ff00]" : "text-gray-500"}
            aria-label={isConnected ? 'Conectado' : 'Desconectado'}
          />
          {showSuggestions && 
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsBlurred(!isBlurred);
              }}
              className="text-[#00ff00]"
            >
              {isBlurred ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
          {/* Adicionar botão de refresh */}
          <button 
            onClick={reloadData}
            className="text-gray-400 hover:text-white"
            aria-label="Recarregar dados"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>
      
      {/* Display de números - exibir mensagem se não há dados */}
      {mappedNumbers.length > 0 ? (
        <div className="flex flex-wrap gap-1 my-2">
          {mappedNumbers.slice(0, 12).map((num, idx) => (
            <div
              key={`${num}-${idx}`}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold 
                ${num === 0 ? 'bg-green-600 text-white' : 
                  [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num) ? 
                  'bg-red-600 text-white' : 'bg-black text-white'
                }
              `}
            >
              {num}
            </div>
          ))}
        </div>
      ) : (
        <div className="my-2 text-xs text-gray-400 text-center py-2">
          {isLoading ? "Carregando números..." : "Sem dados disponíveis"}
        </div>
      )}
      
      {/* Taxa de vitória com indicador visual de atualização */}
      <div className="mt-1 mb-2">
        <div className="flex justify-between text-xs text-gray-400">
          <span className="relative">
            Vitórias: 
            <span 
              className={`font-medium text-green-400 transition-opacity duration-300 ${
                highlightWins ? 'animate-pulse text-green-300' : ''
              }`}
              data-testid="vitorias-counter"
              data-value={strategy?.vitorias ?? strategyWins ?? 0}
            >
              {strategy?.vitorias ?? strategyWins ?? 0}
            </span>
          </span>
          <span className="relative">
            Derrotas: 
            <span 
              className={`font-medium text-red-400 transition-opacity duration-300 ${
                highlightLosses ? 'animate-pulse text-red-300' : ''
              }`}
              data-testid="derrotas-counter"
              data-value={strategy?.derrotas ?? strategyLosses ?? 0}
            >
              {strategy?.derrotas ?? strategyLosses ?? 0}
            </span>
          </span>
        </div>
      </div>
      
      {/* Botões de ação */}
      <div className="mt-auto pt-2 flex justify-between">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setStatsOpen(true);
          }}
          className="px-2 py-1 text-xs bg-[#1A191F] text-gray-300 rounded hover:bg-[#22202a]"
        >
          Detalhes
        </button>
        
        <button 
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/roleta/${roletaId}`);
          }}
          className="px-2 py-1 text-xs bg-[#00ff00]/20 text-[#00ff00] rounded hover:bg-[#00ff00]/30"
          disabled={!roletaId}
        >
          Jogar
        </button>
      </div>
      
      {/* Modal de estatísticas */}
      <RouletteStatsModal 
        open={statsOpen} 
        onClose={setStatsOpen} 
        roletaNome={roletaNome}
        lastNumbers={mappedNumbers}
        wins={strategy?.vitorias ?? strategyWins ?? 0}
        losses={strategy?.derrotas ?? strategyLosses ?? 0}
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