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
const DEBUG_ENABLED = true;

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
  
  // Estado para controlar highlights de atualizações
  const [highlightWins, setHighlightWins] = useState(false);
  const [highlightLosses, setHighlightLosses] = useState(false);
  
  // Usar o hook personalizado para obter dados em tempo real, apenas se tivermos um roletaId
  const { 
    numbers, 
    loading: isLoading, 
    error, 
    isConnected = true, 
    hasData = false, // Não assumir que temos dados
    strategy, 
    strategyLoading, 
    refreshNumbers = () => {},
    refreshStrategy = () => Promise.resolve(false)
  } = roletaId ? useRouletteData(roletaId, roletaNome) : {
    // Se não tivermos roletaId, não usar dados de fallback, mostrar como não disponível
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
    if (!Array.isArray(numbers) || numbers.length === 0) {
      // Não usar lastNumbers como fallback, retornar array vazio
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
  }, [numbers, roletaNome]);

  // Otimizar trend com useMemo - não gerar dados simulados
  const trendData = useMemo(() => {
    // Usar apenas dados reais, não gerar simulados
    if (trend && trend.length > 0) {
      return trend;
    }
    // Retornar array vazio em vez de gerar dados
    return [];
  }, [trend]);

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
      }
    };
    
    // Inscrever para receber eventos específicos desta roleta
    eventService.on('strategy_update', handleStrategyUpdate);
    
    // Limpar inscrição ao desmontar
    return () => {
      eventService.off('strategy_update', handleStrategyUpdate);
    };
  }, [roletaId, roletaNome]);
  
  // Efeito para subscrever ao WebSocket diretamente
  useEffect(() => {
    if (!roletaId || !roletaNome) return;
    
    // Instância do serviço de socket
    const socketService = SocketService.getInstance();
    
    // Callback para números em tempo real
    const handleNumberEvent = (event: any) => {
      if (event.type === 'new_number' && 
          (event.roleta_id === roletaId || event.roleta_nome === roletaNome)) {
        console.log(`[RouletteCard] WebSocket: Número recebido para ${roletaNome}: ${event.numero}`);
        
        // Atualizar os dados via API ao receber novo número
        refreshNumbers();
      }
    };
    
    // Callback para atualizações de estratégia
    const handleStrategyEvent = (event: any) => {
      if (event.type === 'strategy_update' && 
          (event.roleta_id === roletaId || event.roleta_nome === roletaNome)) {
        console.log(`[RouletteCard] WebSocket: Atualização de estratégia para ${roletaNome}`);
        
        // Atualizar os dados via API ao receber atualização de estratégia
        refreshStrategy();
      }
    };
    
    // Subscrever aos eventos da roleta
    socketService.subscribe(roletaNome, handleNumberEvent);
    socketService.subscribe(roletaNome, handleStrategyEvent);
    
    // Limpar inscrição ao desmontar
    return () => {
      socketService.unsubscribe(roletaNome, handleNumberEvent);
      socketService.unsubscribe(roletaNome, handleStrategyEvent);
    };
  }, [roletaId, roletaNome, refreshNumbers, refreshStrategy]);

  // Função para gerar sugestões
  const generateSuggestion = () => {
    // Obter números do grupo selecionado
    const group = numberGroups.find(g => g.id === selectedGroup);
    if (!group) return [];
    
    // Gerar sugestão baseada no grupo
    const newSuggestion = group.numbers;
    setSuggestion(newSuggestion);
    
    return newSuggestion;
  };

  // Toggle para mostrar/ocultar sugestões
  const toggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBlurred(!isBlurred);
  };

  // Navegar para página de detalhes
  const handleDetailsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/roletas/${roletaId || 'unknown'}`);
  };

  // Navegar para página de jogo
  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast({
      title: "Em breve!",
      description: "Jogo para esta roleta estará disponível em breve.",
    });
  };
  
  // Função para recarregar dados
  const reloadData = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      // Mostrar toast de recarregamento
      toast({
        title: "Recarregando dados",
        description: `Atualizando dados para ${roletaNome}...`,
      });
      
      // Recarregar números e estratégia
      const success = await refreshNumbers();
      const strategySuccess = await refreshStrategy();
      
      if (success || strategySuccess) {
        toast({
          title: "Dados atualizados",
          description: `Os dados de ${roletaNome} foram atualizados com sucesso.`,
        });
      } else {
        toast({
          title: "Aviso",
          description: "Não foi possível obter novos dados neste momento.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error(`Erro ao recarregar dados: ${error}`);
      toast({
        title: "Erro",
        description: "Falha ao atualizar os dados. Tente novamente mais tarde.",
        variant: "destructive",
      });
    }
  };

  // Classe dinâmica para highlight de vitórias
  const winsClass = highlightWins ? "text-green-400 transition-colors duration-500" : "text-green-600";
  
  // Classe dinâmica para highlight de derrotas
  const lossesClass = highlightLosses ? "text-red-400 transition-colors duration-500" : "text-red-600";
  
  // Determinar o insight baseado nos números disponíveis
  const insight = getInsightMessage(mappedNumbers.slice(0, 10), strategyWins, strategyLosses);
  
  // Verificar se temos dados para exibir
  const hasDisplayableData = mappedNumbers.length > 0;

  return (
    <div className="bg-zinc-900 rounded-lg shadow-lg overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all duration-300">
      {/* Cabeçalho do Card */}
      <div className="p-4 bg-zinc-950 flex items-center justify-between border-b border-zinc-800">
        <h3 className="font-bold text-white truncate">{roletaNome}</h3>
        <div className="flex space-x-2 items-center">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          <button onClick={(e) => { e.stopPropagation(); refreshStrategy(); }} 
                  className="p-1 rounded-full hover:bg-zinc-800" 
                  title="Atualizar dados">
            <RefreshCw className="h-4 w-4 text-zinc-400 hover:text-white transition-colors" />
          </button>
        </div>
      </div>
      
      {/* Corpo do Card */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-12">
            <span className="text-zinc-500">Carregando dados...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-12 text-red-500">
            <span>Erro ao carregar dados</span>
          </div>
        ) : !hasDisplayableData ? (
          <div className="flex items-center justify-center h-12">
            <span className="text-zinc-500">Sem dados disponíveis</span>
          </div>
        ) : (
          /* Exibir dados quando disponíveis */
          <div>
            {/* Últimos números */}
            <LastNumbers 
              numbers={mappedNumbers.slice(0, 18)} 
              className="mb-4" 
              isBlurred={isBlurred}
            />
            
            {/* Insights */}
            <div className="mb-4 text-sm text-zinc-400 italic">
              {insight}
            </div>
            
            {/* Estatísticas */}
            <div className="flex justify-between mb-4">
              <div className="flex items-center">
                <span className="text-zinc-400 mr-2">Vitórias:</span>
                <span className={winsClass}>{strategyWins}</span>
              </div>
              <div className="flex items-center">
                <span className="text-zinc-400 mr-2">Derrotas:</span>
                <span className={lossesClass}>{strategyLosses}</span>
              </div>
            </div>
            
            {/* Estado da estratégia */}
            {strategyState && (
              <div className="mb-4 p-2 bg-zinc-800 rounded">
                <div className="text-sm">
                  <span className="text-zinc-400">Estado: </span>
                  <span className={`font-medium ${
                    strategyState === 'TRIGGER' ? 'text-amber-500' : 
                    strategyState === 'POST_GALE_NEUTRAL' ? 'text-blue-400' :
                    'text-zinc-300'
                  }`}>
                    {strategyState}
                  </span>
                </div>
                {strategyDisplay && (
                  <div className="text-sm mt-1">
                    <span className="text-zinc-400">Sugestão: </span>
                    <span className="text-white">{strategyDisplay}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Rodapé com ações */}
      <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex justify-between">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleDetailsClick} 
          className="text-xs text-zinc-400 hover:text-white">
          Detalhes
        </Button>
        
        <Button 
          variant="default" 
          size="sm" 
          onClick={handlePlayClick} 
          className="text-xs bg-green-700 hover:bg-green-600">
          Jogar
        </Button>
      </div>
      
      {/* Modal de estatísticas */}
      <RouletteStatsModal 
        open={statsOpen} 
        onOpenChange={setStatsOpen}
        roletaId={roletaId}
        roletaNome={roletaNome}
        numbers={mappedNumbers.slice(0, 100)}
      />
    </div>
  );
});

export default RouletteCard;