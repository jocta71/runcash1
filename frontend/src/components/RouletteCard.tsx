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
  
  // Estado para armazenar números recebidos diretamente do WebSocket
  const [mappedNumbersOverride, setMappedNumbersOverride] = useState<number[]>([]);
  
  // Dentro do componente RouletteCard, adicionar state para estratégia selecionada
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  
  // Estados locais
  const [numbers, setNumbers] = useState<number[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [lastNumber, setLastNumber] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Referência ao timer de destaque
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Estado para controlar o destaque visual após um novo número
  const [highlight, setHighlight] = useState(false);
  
  // Estado para estratégia atual
  const [currentStrategyState, setCurrentStrategyState] = useState<any>({
    estado: 'NEUTRAL',
    sugestao_display: '',
    vitorias: 0,
    derrotas: 0
  });
  
  // Referência ao elemento do card
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Usar o hook personalizado para obter dados em tempo real, apenas se tivermos um roletaId
  const { 
    numbers: apiNumbers, 
    loading: isLoadingApi, 
    error, 
    isConnected = true, 
    hasData = false, // Não assumir que temos dados
    strategy: apiStrategy, 
    strategyLoading: isLoadingApiStrategy, 
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
    // Prioridade 1: Números recebidos diretamente do WebSocket
    if (mappedNumbersOverride.length > 0) {
      console.log(`[RouletteCard] Usando números do WebSocket direto para ${roletaNome}:`, mappedNumbersOverride.slice(0, 5));
      return mappedNumbersOverride;
    }

    // Prioridade 2: Números da API
    if (Array.isArray(apiNumbers) && apiNumbers.length > 0) {
      const mapped = apiNumbers.map(numObj => {
        const num = typeof numObj.numero === 'number' ? numObj.numero : 
                   typeof numObj.numero === 'string' ? parseInt(numObj.numero, 10) : 0;
        return isNaN(num) ? 0 : num;
      });
      
      if (DEBUG_ENABLED) {
        debugLog(`[RouletteCard] Números mapeados da API para ${roletaNome}:`, mapped.slice(0, 5));
      }
      
      return mapped;
    }
    
    // Sem dados reais, retornar array vazio
    console.log(`[RouletteCard] Sem números reais para ${roletaNome}. Retornando array vazio.`);
    return [];
  }, [apiNumbers, roletaNome, mappedNumbersOverride]);

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
    if (apiStrategy && !isLoadingApiStrategy) {
      debugLog(`[RouletteCard] Inicializando estado da estratégia de ${roletaNome} com dados carregados:`, apiStrategy);
      setStrategyState(apiStrategy.estado || '');
      setStrategyDisplay(apiStrategy.sugestao_display || '');
      setStrategyTerminals(apiStrategy.terminais_gatilho || []);
      setStrategyWins(apiStrategy.vitorias || 0);
      setStrategyLosses(apiStrategy.derrotas || 0);
    }
  }, [apiStrategy, isLoadingApiStrategy, roletaNome]);

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
    eventService.subscribeToEvent('strategy_update', handleStrategyUpdate);
    
    // Limpar inscrição ao desmontar
    return () => {
      eventService.unsubscribeFromEvent('strategy_update', handleStrategyUpdate);
    };
  }, [roletaId, roletaNome]);

  // Efeito para escutar eventos de atualização de estratégia
  useEffect(() => {
    const socketService = SocketService.getInstance();
    
    // Função para lidar com atualizações de estratégia
    const handleStrategyUpdate = (event: any) => {
      if (event.type === 'strategy_update' && event.roleta_nome === name) {
        setCurrentStrategyState({
          estado: event.estado,
          sugestao_display: event.sugestao_display || '',
          vitorias: event.vitorias,
          derrotas: event.derrotas
        });
      }
    };
    
    // Função para lidar com eventos de carregamento de dados históricos
    const handleHistoricalDataEvent = (event: any) => {
      if (event.type !== 'historical_data_loaded') return;
      
      // Desativar estado de carregamento após carregar dados históricos, independente do resultado
      console.log(`[RouletteCard] Evento historical_data_loaded recebido, atualizando estado de carregamento`);
      setIsLoading(false);
    };
    
    // Inscrever para atualizações de estratégia
    socketService.subscribe(name, handleStrategyUpdate);
    
    // Inscrever para eventos globais de carregamento
    socketService.subscribe('*', handleHistoricalDataEvent);
    
    // Limpeza
    return () => {
      socketService.unsubscribe(name, handleStrategyUpdate);
      socketService.unsubscribe('*', handleHistoricalDataEvent);
    };
  }, [name]);

  // Efeito para escutar eventos do websocket
  useEffect(() => {
    const socketService = SocketService.getInstance();
    
    const handleEvent = (event: any) => {
      // Verificar se é um evento do tipo new_number
      if (event.type !== 'new_number') {
        console.log(`[RouletteCard] Ignorando evento de tipo não suportado: ${event.type}`);
        return;
      }
      
      // Verificar se o evento é para esta roleta, usando correspondência mais flexível
      // Verifica nome exato, normalizado (sem espaços/caixa baixa) e parcial
      const eventRoletaNome = event.roleta_nome || '';
      const normalizedEventName = eventRoletaNome.toLowerCase().replace(/\s+/g, '');
      const normalizedComponentName = name.toLowerCase().replace(/\s+/g, '');
      
      const isExactMatch = eventRoletaNome === name;
      const isNormalizedMatch = normalizedEventName === normalizedComponentName;
      const isPartialMatch = 
        normalizedEventName.includes(normalizedComponentName) || 
        normalizedComponentName.includes(normalizedEventName);
      
      // Se não houver nenhuma correspondência, ignorar o evento
      if (!isExactMatch && !isNormalizedMatch && !isPartialMatch) {
        return;
      }
      
      console.log(`[RouletteCard] Processando número ${event.numero} para ${name} de evento ${eventRoletaNome}`);
      
      // Garantir que o número é um número válido
      let numero: number;
      if (typeof event.numero === 'number') {
        numero = event.numero;
      } else if (typeof event.numero === 'string') {
        numero = parseInt(event.numero, 10);
              } else {
        console.warn(`[RouletteCard] Número inválido recebido: ${event.numero}`);
        return;
      }
      
      if (isNaN(numero) || numero < 0 || numero > 36) {
        console.warn(`[RouletteCard] Número fora do intervalo válido: ${numero}`);
        return;
      }
      
      // Definir último número
      setLastNumber(numero);
      
      // Adicionar número à lista e manter apenas os últimos N
      setNumbers(prevNumbers => {
        const newNumbers = [numero, ...prevNumbers];
        return newNumbers.slice(0, 20); // Manter apenas os últimos 20 números
      });
      
      // Importante: Desativar estado de carregamento quando recebemos o primeiro número
      setIsLoading(false);
      
      // Atualizar o estado de dados disponíveis no array com override
      setMappedNumbersOverride(prevNumbers => {
        // Se o número já existe no array, não duplicar
        if (prevNumbers.includes(numero)) {
          return prevNumbers;
        }
        // Adicionar o número no início do array e manter apenas os 20 últimos
        return [numero, ...prevNumbers].slice(0, 20);
      });
      
      // Acionar o destaque visual
      setHighlight(true);
      
      // Limpar o timer anterior se existir
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      
      // Configurar o novo timer para remover o destaque
      highlightTimerRef.current = setTimeout(() => {
        setHighlight(false);
        highlightTimerRef.current = null;
      }, 800);
    };
    
    // Inscrever para eventos globais (receber todos e filtrar internamente)
    socketService.subscribe('*', handleEvent);
    
    // Também inscrever pelo nome específico para garantir
    socketService.subscribe(name, handleEvent);
    
    // Escutar eventos do EventService também
    const eventService = EventService.getInstance();
    const handleNumberEvent = (event: any) => {
      // Se for new_number, processar como outros eventos
      if (event.type === 'new_number') {
        handleEvent(event);
      }
    };
    
    // Inscrever para eventos do EventService também
    eventService.subscribeToEvent('new_number', handleNumberEvent);
    
    setIsSubscribed(true);
    
    // Limpar a inscrição quando o componente for desmontado
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      socketService.unsubscribe(name, handleEvent);
      socketService.unsubscribe('*', handleEvent);
      eventService.unsubscribeFromEvent('new_number', handleNumberEvent);
      setIsSubscribed(false);
    };
  }, [name]);

  // Efeito para inicializar números do mappedNumbers para números
  useEffect(() => {
    if (mappedNumbers.length > 0 && isLoading) {
      console.log(`[RouletteCard] Inicializando com dados de API para ${roletaNome}: ${mappedNumbers.length} números`);
      setNumbers(mappedNumbers);
      // Importante: Desativar estado de carregamento quando temos dados da API
      setIsLoading(false);
    }
  }, [mappedNumbers, isLoading, roletaNome]);

  // Efeito para atualizar com dados quando números da API estiverem disponíveis
  useEffect(() => {
    if (apiNumbers.length > 0 && mappedNumbers.length === 0) {
      const newNumbers = apiNumbers.map(n => 
        typeof n.numero === 'number' ? n.numero : parseInt(n.numero, 10)
      ).filter(n => !isNaN(n));
      
      if (newNumbers.length > 0) {
        console.log(`[RouletteCard] Atualizando números de ${roletaNome} com dados da API:`, newNumbers.slice(0, 5));
        setNumbers(newNumbers);
        // Importante: Desativar estado de carregamento quando recebemos dados da API
        setIsLoading(false);
      }
    }
  }, [apiNumbers, mappedNumbers, roletaNome]);

  // Efeito para definir o último número quando temos dados
  useEffect(() => {
    if (numbers.length > 0 && lastNumber === null) {
      console.log(`[RouletteCard] Definindo último número para ${roletaNome}: ${numbers[0]}`);
      setLastNumber(numbers[0]);
      // Importante: Desativar estado de carregamento quando temos dados locais
      setIsLoading(false);
    }
  }, [numbers, lastNumber, roletaNome]);

  // Efeito para escutar eventos relacionados à falta de dados
  useEffect(() => {
    const eventService = EventService.getInstance();
    
    // Handler para eventos de falta de dados
    const handleNoDataEvent = (event: any) => {
      if (event.type !== 'no_data_available') return;
      
      // Verificar se o evento é para esta roleta
      if ((event.roleta_id === roletaId || event.roleta_nome === roletaNome)) {
        console.log(`[RouletteCard] Evento no_data_available recebido para ${roletaNome}`);
        // Desativar estado de carregamento mesmo sem dados
        setIsLoading(false);
      }
    };
    
    // Inscrever para eventos de falta de dados
    eventService.subscribeToEvent('no_data_available', handleNoDataEvent);
    
    // Limpar inscrição ao desmontar
    return () => {
      eventService.unsubscribeFromEvent('no_data_available', handleNoDataEvent);
    };
  }, [roletaId, roletaNome]);

  // Função para gerar sugestões
  const generateSuggestion = () => {
    // Obter números do grupo selecionado
    const selectedGroupObj = numberGroups[selectedGroup as keyof typeof numberGroups];
    if (!selectedGroupObj) return [];
    
    // Gerar sugestão baseada no grupo
    const newSuggestion = selectedGroupObj.numbers;
    setSuggestion(newSuggestion);
    
    return newSuggestion;
  };

  // Toggle para mostrar/ocultar sugestões
  const toggleVisibility = (e: any) => {
    e.stopPropagation();
    setIsBlurred(!isBlurred);
  };

  // Navegar para página de detalhes
  const handleDetailsClick = (e: any) => {
    e.stopPropagation();
    navigate(`/roletas/${roletaId || 'unknown'}`);
  };

  // Navegar para página de jogo
  const handlePlayClick = (e: any) => {
    e.stopPropagation();
    toast({
      title: "Em breve!",
      description: "Jogo para esta roleta estará disponível em breve.",
    });
  };

  // Função para recarregar dados
  const reloadData = async (e: any) => {
    e.stopPropagation();
    
    try {
      // Mostrar toast de recarregamento
      toast({
        title: "Recarregando dados",
        description: `Atualizando dados para ${roletaNome}...`,
      });
      
      // Recarregar números e estratégia
      await refreshNumbers();
      await refreshStrategy();
      
      toast({
        title: "Dados atualizados",
        description: `Os dados de ${roletaNome} foram atualizados com sucesso.`,
      });
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
  
  // Verificar se temos dados reais para exibir (apenas do WebSocket ou API)
  const hasDisplayableData = mappedNumbers.length > 0;
  
  // Mostrar logs para depuração
  useEffect(() => {
    console.log(`[RouletteCard] Estado do card para ${roletaNome}:`, {
      hasNumbers: mappedNumbers.length > 0,
      numbersCount: mappedNumbers.length,
      isLoading,
      hasError: !!error,
      numbersSource: mappedNumbersOverride.length > 0 ? 'WebSocket' : (apiNumbers.length > 0 ? 'API' : 'Nenhum')
    });
  }, [mappedNumbers, mappedNumbersOverride, apiNumbers, isLoading, error, roletaNome]);

  // Renderização apenas quando props são alteradas ou estados específicos mudam
  return (
    <div 
      ref={cardRef}
      className={`rounded-lg border bg-zinc-900 border-zinc-800 overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-200 relative ${highlight ? 'ring-2 ring-green-500' : ''}`}
    >
      {/* Barra superior com título */}
      <div className="bg-zinc-950 px-4 py-2 border-b border-zinc-800 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <h3 className="font-semibold text-white">{roletaNome}</h3>
          
          {/* Indicadores visuais */}
          {isConnected && (
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Tendência */}
          {Array.isArray(trend) && trend.length > 0 && trend[0]?.value > 0 && <ArrowUp className="w-4 h-4 text-green-500" />}
          {Array.isArray(trend) && trend.length > 0 && trend[0]?.value < 0 && <ArrowDown className="w-4 h-4 text-red-500" />}
          
          {/* Botão de refresh */}
          <button 
            onClick={reloadData}
            className="text-zinc-400 hover:text-white transition-colors duration-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Último número */}
      <div className={`flex justify-center items-center p-2 ${highlight ? 'bg-green-500/10' : 'bg-transparent'} transition-colors duration-300`}>
        {isLoading ? (
          <div className="w-12 h-12 flex items-center justify-center">
            <Loader2 className="animate-spin w-6 h-6 text-zinc-500" />
          </div>
        ) : lastNumber !== null ? (
          <RouletteNumber 
            number={lastNumber} 
            size="lg" 
            isBlurred={isBlurred}
          />
        ) : (
          <div className="w-12 h-12 flex items-center justify-center">
            <HelpCircle className="w-6 h-6 text-zinc-500" />
          </div>
        )}
      </div>
      
      {/* Corpo do Card */}
      <div className="p-4">
        {isLoading && numbers.length === 0 && mappedNumbers.length === 0 && mappedNumbersOverride.length === 0 ? (
          <div className="flex items-center justify-center h-12">
            <span className="text-zinc-500">Carregando dados...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-12 text-red-500">
            <span>Erro ao carregar dados</span>
          </div>
        ) : numbers.length === 0 && mappedNumbers.length === 0 && mappedNumbersOverride.length === 0 ? (
          <div className="flex items-center justify-center h-12">
            <span className="text-zinc-500">Sem dados disponíveis</span>
          </div>
        ) : (
          /* Exibir dados quando disponíveis */
          <div>
            {/* Últimos números */}
            <LastNumbers 
              numbers={numbers.length > 0 ? numbers : mappedNumbersOverride.length > 0 ? mappedNumbersOverride : mappedNumbers.slice(0, 18)} 
              className="mb-4" 
              isBlurred={isBlurred}
            />
            
            {/* Debug - Remover em produção */}
            <div className="mb-2 text-xs text-zinc-500">
              {name} - Eventos: {numbers.length} | API: {mappedNumbers.length} | Override: {mappedNumbersOverride.length}
            </div>
            
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
            
            {/* Seletor de estratégia */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2">Estratégia</h3>
              <StrategySelector 
                roletaId={roletaId}
                roletaNome={roletaNome}
                onStrategyChange={setSelectedStrategy}
              />
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
        
        {DEBUG_ENABLED && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              // Gerar um número aleatório entre 0 e 36
              const randomNumber = Math.floor(Math.random() * 37);
              console.log(`[RouletteCard] Injetando número REAL de teste ${randomNumber} para ${roletaNome}`);
              
              // Injetar evento de teste usando o SocketService
              const socketService = SocketService.getInstance();
              socketService.injectTestEvent(roletaNome, randomNumber);
              
              // Atualizar o estado isLoading
              setIsLoading(false);
              
              toast({
                title: "Dados reais adicionados",
                description: `Carregado número ${randomNumber} para ${roletaNome}`,
                variant: "default"
              });
            }}
            className="text-xs bg-amber-800 hover:bg-amber-700 text-white"
          >
            Testar
          </Button>
        )}
        
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
        onClose={setStatsOpen} 
        roletaNome={roletaNome}
        lastNumbers={mappedNumbers.slice(0, 100)}
        wins={strategyWins}
        losses={strategyLosses}
      />
    </div>
  );
});

export default RouletteCard;