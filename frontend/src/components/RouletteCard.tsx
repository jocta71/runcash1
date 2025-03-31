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
    if (!Array.isArray(numbers) || numbers.length === 0) {
      return [];
    }
    
    const mapped = numbers.map(numObj => {
      const num = typeof numObj.numero === 'number' ? numObj.numero : 
                 typeof numObj.numero === 'string' ? parseInt(numObj.numero, 10) : 0;
      return isNaN(num) ? 0 : num;
    });
    
    debugLog(`[RouletteCard] Números mapeados para ${roletaNome}:`, mapped.slice(0, 5));
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
    // Função para lidar com atualizações de estratégia do servidor
    const handleStrategyUpdate = (event: any) => {
      if (event.roleta_nome !== roletaNome) return;
      
      debugLog(`[RouletteCard] Evento de estratégia recebido para ${roletaNome}`);
      updateStrategy({
        roleta_id: event.roleta_id,
        roleta_nome: event.roleta_nome,
        estado: event.estado || 'NEUTRAL',
        vitorias: event.vitorias || 0,
        derrotas: event.derrotas || 0,
        terminais_gatilho: event.terminais_gatilho || [],
        sugestao_display: event.sugestao_display || '',
        numero_gatilho: event.numero_gatilho
      });
    };
    
    // Inscrever no serviço de eventos
    EventService.subscribe('strategy_update', handleStrategyUpdate);
    
    return () => {
      // Limpar inscrição ao desmontar
      EventService.unsubscribe('strategy_update', handleStrategyUpdate);
    };
  }, [roletaNome, updateStrategy]);
  
  // Efeito para atualizar dados ao receber novos números
  useEffect(() => {
    // Função para lidar com novos números recebidos
    const handleNewNumber = (event: any) => {
      if (event.roleta_nome !== roletaNome) return;
      
      // Registrar o evento e atualizar números se necessário
      debugLog(`[RouletteCard] Novo número recebido para ${roletaNome}: ${event.numero}`);
      
      // Forçar atualização da estratégia quando novos números chegarem
      refreshStrategy().catch(console.error);
    };
    
    // Inscrever no serviço de eventos
    EventService.subscribe('new_number', handleNewNumber);
    
    return () => {
      // Limpar inscrição ao desmontar
      EventService.unsubscribe('new_number', handleNewNumber);
    };
  }, [roletaNome, refreshStrategy]);
  
  // Gerar sugestão de números baseada no estado da estratégia
  const generateSuggestion = () => {
    if (!currentStrategy) return [];
    
    // Pegar todos os números do grupo atual
    const groupNumbers = numberGroups[selectedGroup] || [];
    
    // Filtrar aleatoriamente metade dos números
    const shuffled = [...groupNumbers].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.ceil(groupNumbers.length / 2));
  };
  
  // Botão para alternar visualização de sugestões
  const toggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBlurred(!isBlurred);
  };
  
  // Botão para ver detalhes da roleta
  const handleDetailsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStatsOpen(true);
  };
  
  // Botão para jogar (redirecionar para página de jogo)
  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (roletaId) {
      navigate(`/roleta/${roletaId}`);
    } else {
      toast({ title: "Ação indisponível", description: "Roleta sem identificador" });
    }
  };
  
  // Botão para recarregar dados
  const reloadData = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Garantir que temos um ID
    if (!roletaId) {
      toast({ title: "Erro", description: "ID da roleta não informado" });
      return;
    }
    
    // Atualizar números e estratégia
    Promise.all([
      refreshNumbers(),
      refreshStrategy()
    ]).then(([numbersSuccess, strategySuccess]) => {
      const message = `Dados ${numbersSuccess ? 'atualizados' : 'não atualizados'}`;
      toast({ 
        title: numbersSuccess ? "Sucesso" : "Atenção", 
        description: message, 
        variant: numbersSuccess ? "default" : "destructive" 
      });
    }).catch(error => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    });
  };
    
  // Preparar dados para o gráfico
  const chartData = useMemo(() => ({
    labels: mappedNumbers.slice(0, 15).map((_, i) => `${i + 1}`),
    datasets: [{
      label: 'Número',
      data: mappedNumbers.slice(0, 15).map(n => n),
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 1
    }]
  }), [mappedNumbers]);
  
  // Gerar insights sobre padrões nos números
  const insightMessage = useMemo(() => 
    getInsightMessage(mappedNumbers, strategyWins, strategyLosses),
  [mappedNumbers, strategyWins, strategyLosses]);
  
  // Gerar sugestão apenas quando necessário
  useEffect(() => {
    if (showSuggestions) {
      setSuggestion(generateSuggestion());
    }
  }, [currentStrategy, selectedGroup, showSuggestions]);

  // Principal determinação se temos dados para exibir
  const hasNumbersToShow = mappedNumbers.length > 0;
  
  return (
    <div className="bg-card rounded-xl overflow-hidden shadow-md border border-border h-full">
      {/* Cabeçalho */}
      <div className="bg-muted/80 p-2 flex justify-between items-center">
        <h3 className="text-sm font-semibold truncate w-3/5">{roletaNome}</h3>
        <div className="flex space-x-1">
          <button 
            onClick={toggleVisibility}
            className="p-1 hover:bg-muted rounded-full"
            title={isBlurred ? "Mostrar dados" : "Esconder dados"}
          >
            {isBlurred ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button 
            onClick={reloadData} 
            className="p-1 hover:bg-muted rounded-full"
            title="Recarregar dados"
          >
            <RefreshCw size={16} />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setStatsOpen(true);
            }}
            className="p-1 hover:bg-muted rounded-full"
            title="Ver estatísticas"
          >
            <TrendingUp size={16} />
          </button>
        </div>
      </div>
      
      {/* Corpo do cartão */}
      <div className={`p-4 bg-card ${isBlurred ? 'blur-sm' : ''}`}>
        {isLoading ? (
          // Estado de carregamento
          <div className="flex justify-center items-center h-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !hasNumbersToShow ? (
          // Sem dados disponíveis
          <div className="text-center py-4 text-sm text-muted-foreground">
            Sem dados disponíveis
          </div>
        ) : (
          // Dados disponíveis - mostrar informações
          <div>
            {/* Últimos números */}
            {hasNumbersToShow && (
              <LastNumbers numbers={mappedNumbers.slice(0, 10)} />
            )}
            
            {/* Insight sobre padrões */}
            <div className="mt-2 text-xs text-muted-foreground">
              {insightMessage}
            </div>
          </div>
        )}
      </div>
      
      {/* Rodapé com estatísticas e ações */}
      <div className="p-2 border-t border-border flex items-center justify-between">
        <div className="flex space-x-4 text-xs">
          <div className="flex items-center">
            <span className="text-green-500 mr-1">Vitórias:</span>
            <span>{strategyWins}</span>
          </div>
          <div className="flex items-center">
            <span className="text-red-500 mr-1">Derrotas:</span>
            <span>{strategyLosses}</span>
          </div>
        </div>
        <Button 
          onClick={handleDetailsClick}
          variant="ghost" 
          size="sm"
          className="text-xs px-2 py-1"
        >
          Detalhes
        </Button>
        <Button 
          onClick={handlePlayClick}
          variant="default" 
          size="sm"
          className="text-xs px-2 py-1"
        >
          Jogar
        </Button>
      </div>
      
      {/* Modal de estatísticas */}
      <RouletteStatsModal
        open={statsOpen}
        onOpenChange={setStatsOpen}
        roletaId={roletaId}
        roletaNome={roletaNome}
        numbers={mappedNumbers}
        chartData={chartData}
        strategy={{
          estado: strategyState,
          wins: strategyWins,
          losses: strategyLosses,
          terminais: strategyTerminals,
          display: strategyDisplay
        }}
      />
    </div>
  );
});

export default RouletteCard;