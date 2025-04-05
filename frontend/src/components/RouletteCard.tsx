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
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
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
    hasData = false,
    strategy: apiStrategy, 
    strategyLoading: isLoadingApiStrategy, 
    refreshNumbers,
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
    refreshNumbers: () => Promise.resolve(false),
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
        // Verificar e validar cada número para evitar NaN
        let num = 0;
        
        if (typeof numObj === 'number' && !isNaN(numObj)) {
          num = numObj;
        } else if (numObj && typeof numObj !== 'undefined') {
          // Verificar se o objeto tem uma propriedade 'numero'
          if (typeof numObj.numero !== 'undefined') {
            if (typeof numObj.numero === 'number' && !isNaN(numObj.numero)) {
              num = numObj.numero;
            } else if (typeof numObj.numero === 'string' && numObj.numero.trim() !== '') {
              const parsed = parseInt(numObj.numero, 10);
              num = !isNaN(parsed) ? parsed : 0;
            }
          }
          // Verificar se o objeto tem valor direto
          else if (typeof numObj === 'number') {
            num = numObj;
          } else if (typeof numObj === 'string' && numObj.trim() !== '') {
            const parsed = parseInt(numObj, 10);
            num = !isNaN(parsed) ? parsed : 0;
          }
        }
        
        return num;
      });
      
      if (DEBUG_ENABLED) {
        debugLog(`[RouletteCard] Números mapeados da API para ${roletaNome}:`, mapped.slice(0, 5));
      }
      
      return mapped;
    }
    
    // Prioridade 3: Números passados via props
    if (Array.isArray(lastNumbers) && lastNumbers.length > 0) {
      // Usar números passados como props, se disponíveis
      console.log(`[RouletteCard] Usando números de props para ${roletaNome}:`, lastNumbers.slice(0, 5));
      return lastNumbers.map(num => {
        if (typeof num === 'number') return num;
        if (typeof num === 'string') return parseInt(num, 10);
        if (typeof num === 'object' && num?.numero) return parseInt(num.numero, 10);
        return 0;
      });
    }
    
    // Sem dados reais, retornar array vazio
    console.log(`[RouletteCard] Sem números reais para ${roletaNome}. Retornando array vazio.`);
    return [];
  }, [apiNumbers, roletaNome, mappedNumbersOverride, lastNumbers]);

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
    const handleHistoricalDataEvents = (event: any) => {
      if (event.type === 'historical_data_loading') {
        setIsLoading(true);
      } else if (event.type === 'historical_data_loaded') {
        setIsLoading(false);
      }
    };
    
    // Inscrever para atualizações de estratégia
    socketService.subscribe(name, handleStrategyUpdate);
    
    // Inscrever para eventos globais de carregamento
    socketService.subscribe('*', handleHistoricalDataEvents);
    
    // Limpeza
    return () => {
      socketService.unsubscribe(name, handleStrategyUpdate);
      socketService.unsubscribe('*', handleHistoricalDataEvents);
    };
  }, [name]);

  // Efeito para conectar ao endpoint específico da roleta e escutar atualizações em tempo real
  useEffect(() => {
    // Verificar se temos o ID da roleta
    if (!roletaId) {
      console.log(`[RouletteCard] ID da roleta não disponível para ${roletaNome}, não será possível conectar ao endpoint específico`);
      return;
    }

    console.log(`[RouletteCard] ⚡️ Configurando conexão específica para roleta ${roletaId} (${roletaNome})`);
    
    // Obter instância do socketService
    const socketService = SocketService.getInstance();
    
    // Conectar ao endpoint específico desta roleta
    socketService.subscribeToRouletteEndpoint(roletaId, roletaNome);
    
    // Forçar reconexão para garantir que estamos recebendo eventos em tempo real
    socketService.reconnect().then(connected => {
      if (connected) {
        console.log(`[RouletteCard] Reconexão bem-sucedida, solicitando dados para ${roletaNome}`);
        // Reinscrever no endpoint específico após reconexão
        socketService.subscribeToRouletteEndpoint(roletaId, roletaNome);
        // Solicitar dados imediatamente
        socketService.requestRouletteNumbers(roletaId);
      } else {
        console.log(`[RouletteCard] Falha na reconexão para ${roletaNome}, tentando novamente em 3s`);
        // Tentar novamente após um breve delay
        setTimeout(() => {
          socketService.reconnect().then(success => {
            if (success) {
              socketService.subscribeToRouletteEndpoint(roletaId, roletaNome);
              socketService.requestRouletteNumbers(roletaId);
            }
          });
        }, 3000);
      }
    });
    
    // Configurar verificação periódica para manter dados atualizados
    const dataRefreshInterval = setInterval(() => {
      console.log(`[RouletteCard] Verificação periódica de dados para ${roletaNome}`);
      
      if (socketService.isSocketConnected()) {
        // Adicionar timestamp para evitar cache
        console.log(`[RouletteCard] Solicitando dados atualizados para ${roletaNome}`);
        socketService.requestRouletteNumbers(roletaId);
      } else {
        console.log(`[RouletteCard] Socket desconectado, reconectando para ${roletaNome}`);
        socketService.reconnect().then(connected => {
          if (connected) {
            socketService.subscribeToRouletteEndpoint(roletaId, roletaNome);
          }
        });
      }
    }, 10000); // Verificar a cada 10 segundos
    
    // Limpar intervalo quando o componente for desmontado
    return () => {
      console.log(`[RouletteCard] Limpando recursos para ${roletaNome}`);
      clearInterval(dataRefreshInterval);
    };
  }, [roletaId, roletaNome]);

  // Função para processar atualizações em tempo real de números
  const processRealtimeNumber = useCallback((numero: number) => {
    console.log(`[RouletteCard] ⚡ Processando número em tempo real: ${numero} para ${roletaNome}`);
    
    // Verificar se o número é válido
    if (typeof numero !== 'number' || isNaN(numero)) {
      console.warn(`[RouletteCard] Número inválido recebido: ${numero}, ignorando`);
      return;
    }
    
    // Atualizar o último número
    setLastNumber(numero);
    
    // Atualizar o array de números em tempo real
    setNumbers(prevNumbers => {
      // Verificar se o número já existe para evitar duplicatas
      const numberExists = prevNumbers.some(n => n === numero);
      if (numberExists) {
        return prevNumbers;
      }
      
      const newNumbers = [numero, ...prevNumbers];
      return newNumbers.slice(0, 20); // Manter apenas os últimos 20
    });
    
    // Atualizar o estado de override para garantir exibição imediata
    setMappedNumbersOverride(prevNumbers => {
      // Verificar se o número já existe
      const numberExists = prevNumbers.some(n => n === numero);
      if (numberExists) {
        return prevNumbers;
      }
      
      // Adicionar o número no início e manter apenas os 20 últimos
      const newArray = [numero, ...prevNumbers].slice(0, 20);
      console.log(`[RouletteCard] Números atualizados em tempo real para ${roletaNome}:`, newArray.slice(0, 5));
      
      return newArray;
    });
    
    // Acionar o destaque visual
    setHighlight(true);
    
    // Atualizar imediatamente a UI para mostrar o novo número
    if (cardRef.current) {
      // Aplicar classe de destaque para animação visual
      cardRef.current.classList.add('highlight-card');
      setTimeout(() => {
        if (cardRef.current) {
          cardRef.current.classList.remove('highlight-card');
        }
      }, 1000);
    }
    
    // Mostrar notificação de novo número
    toast({
      title: `Novo número: ${numero}`,
      description: `${roletaNome}`,
      variant: "default",
      duration: 2000
    });
    
    // Limpar o timer anterior se existir
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    
    // Configurar novo timer para remover o destaque
    highlightTimerRef.current = setTimeout(() => {
      setHighlight(false);
      highlightTimerRef.current = null;
    }, 1500);
  }, [roletaNome, setLastNumber, setNumbers, setMappedNumbersOverride, setHighlight]);

  // Efeito para escutar eventos do websocket específicos para esta roleta
  useEffect(() => {
    const socketService = SocketService.getInstance();
    const eventService = EventService.getInstance();
    
    // Função que processa eventos de novos números
    const handleEvent = (event: any) => {
      // Ignorar eventos não relacionados ou sem dados
      if (!event || !event.type) return;
      
      // Verificar se o evento é para esta roleta
      const isForThisRoulette = 
        (event.roleta_nome && (event.roleta_nome === name || event.roleta_nome === roleta_nome)) ||
        (event.roleta_id && (event.roleta_id === roletaId || event.roleta_id === roletaId));
        
      if (!isForThisRoulette) return;
      
      // Processar novo número
      if (event.type === 'new_number' && event.numero !== undefined) {
        let numero: number;
        
        // Validar e converter o número
        if (typeof event.numero === 'number' && !isNaN(event.numero)) {
          numero = event.numero;
        } else if (typeof event.numero === 'string' && event.numero.trim() !== '') {
          const parsed = parseInt(event.numero, 10);
          numero = !isNaN(parsed) ? parsed : 0;
        } else {
          console.warn(`[RouletteCard] Número inválido recebido: ${event.numero}, ignorando`);
          return;
        }
        
        console.log(`[RouletteCard] EVENTO RECEBIDO PARA ${roletaNome}: Novo número ${numero}`);
        
        // Processar via função dedicada
        processRealtimeNumber(numero);
      }
    };
    
    // Inscrever para eventos globais e específicos
    socketService.subscribe('*', handleEvent);
    socketService.subscribe(name || '', handleEvent);
    
    // Registrar listener específico para eventos de roleta do EventService
    EventService.on('roulette:new-number', handleEvent);
    
    // Se temos ID da roleta, inscrever especificamente por ID
    if (roletaId) {
      socketService.subscribe(roletaId, handleEvent);
      
      // Registrar para atualizações específicas da API
      socketService.subscribeToRouletteEndpoint(roletaId, roletaNome);
      
      // Iniciar polling agressivo para esta roleta
      socketService.startAggressivePolling(roletaId, roletaNome);
      
      // Solicitar dados imediatamente
      socketService.requestRouletteNumbers(roletaId);
    }
    
    // Limpar a inscrição quando o componente for desmontado
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      
      socketService.unsubscribe('*', handleEvent);
      socketService.unsubscribe(name || '', handleEvent);
      EventService.off('roulette:new-number', handleEvent);
      
      if (roletaId) {
        socketService.unsubscribe(roletaId, handleEvent);
        socketService.stopPollingForRoulette(roletaId);
      }
    };
  }, [name, roleta_nome, roletaId, roletaNome, processRealtimeNumber]);

  // Adicionar um efeito para a detecção de dados carregados
  useEffect(() => {
    // Log detalhado do estado dos dados no componente
    console.log(`[RouletteCard] Estado do card para ${roletaNome}:`, {
      isLoading,
      hasApiData: apiNumbers.length > 0,
      hasSocketData: mappedNumbersOverride.length > 0,
      mappedNumbersLength: mappedNumbers.length,
      lastNumberState: lastNumber,
      currentTime: new Date().toISOString()
    });
    
    // FORÇAR desativação do carregamento se temos QUALQUER tipo de dados
    if (isLoading && (apiNumbers.length > 0 || mappedNumbersOverride.length > 0 || mappedNumbers.length > 0)) {
      console.log(`[RouletteCard] FORÇANDO desativação do isLoading para ${roletaNome} - dados detectados`);
      setIsLoading(false);
      
      // Se temos dados e não temos lastNumber definido, definir usando os dados disponíveis
      if (lastNumber === null) {
        // Tentar todas as fontes possíveis de dados
        const firstNumber = 
          mappedNumbersOverride[0] || 
          (apiNumbers[0] && (typeof apiNumbers[0] === 'number' ? apiNumbers[0] : apiNumbers[0].numero)) ||
          mappedNumbers[0];
          
        if (firstNumber !== undefined && firstNumber !== null) {
          console.log(`[RouletteCard] Definindo lastNumber para ${roletaNome} como ${firstNumber}`);
          const parsedNumber = typeof firstNumber === 'number' ? 
            firstNumber : 
            parseInt(String(firstNumber), 10);
            
          if (!isNaN(parsedNumber)) {
            setLastNumber(parsedNumber);
          }
        }
      }
    }
    
    // Segurança: desativar carregamento após timeout mesmo sem dados
    if (isLoading) {
      const timer = setTimeout(() => {
        console.log(`[RouletteCard] Timeout de carregamento atingido para ${roletaNome} - forçando desativação`);
        setIsLoading(false);
      }, 3000); // 3 segundos de timeout
      
      return () => clearTimeout(timer);
    }
  }, [isLoading, apiNumbers, mappedNumbersOverride, mappedNumbers, lastNumber, roletaNome]);

  // Atualizar o lastNumber apenas quando tiver um número válido
  useEffect(() => {
    if (mappedNumbers.length > 0) {
      const firstNumber = mappedNumbers[0];
      // Garantir que é um número válido e não é um zero de placeholder
      if (typeof firstNumber === 'number' && !isNaN(firstNumber)) {
        // Só atualizar se o número for maior que zero ou se for um zero real da roleta
        if (firstNumber > 0 || (firstNumber === 0 && mappedNumbers.length > 1)) {
          console.log(`[RouletteCard] Atualizando lastNumber para ${roletaNome}: ${firstNumber}`);
          setLastNumber(firstNumber);
        } else {
          console.log(`[RouletteCard] Ignorando possível zero de placeholder para ${roletaNome}`);
        }
      } else {
        console.warn(`[RouletteCard] Ignorando número inválido para ${roletaNome}: ${firstNumber}`);
      }
    }
  }, [mappedNumbers, roletaNome]);

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

  // Função para recarregar dados usando o throttler
  const reloadData = async (e: any) => {
    e.stopPropagation();
    
    if (!roletaId) {
      toast({
        title: "Erro",
        description: "ID da roleta não informado. Não é possível recarregar dados.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Usar o throttler para controlar a taxa de requisições
      const throttleKey = `roulette_refresh_${roletaId}`;
      
      // Forçar atualização imediata independente do intervalo
      await RequestThrottler.scheduleRequest(
        throttleKey,
        async () => {
          logger.debug(`Recarregando dados para roleta ${roletaNome}`);
          const numbersSuccess = await refreshNumbers();
          const strategySuccess = await refreshStrategy();
          return { numbersSuccess, strategySuccess };
        },
        true // Forçar execução imediata
      );
      
      toast({
        title: "Dados atualizados",
        description: `Os dados da ${roletaNome} foram atualizados com sucesso.`,
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: `Não foi possível atualizar os dados da ${roletaNome}.`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
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
  
  // Renderização apenas quando props são alteradas ou estados específicos mudam
  return (
    <div 
      ref={cardRef}
      className={`bg-gray-900 rounded-lg overflow-hidden shadow-lg flex flex-col transition-all duration-300 
        ${highlight ? 'border-2 border-primary animate-pulse' : 'border border-gray-700'}`}
      style={{ minHeight: '420px' }}
    >
      <div className="p-4 flex justify-between items-center bg-gray-800 relative">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-bold text-white">{roletaNome}</h3>
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-white animate-spin ml-2" />
          ) : null}
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            className="h-8 p-0 w-8"
            onClick={reloadData}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            className="h-8 p-0 w-8"
            onClick={toggleVisibility}
          >
            {showSuggestions ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            className="h-8 p-0 w-8"
            onClick={handleDetailsClick}
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 flex-grow flex flex-col justify-between">
        {/* Seção do último número da roleta */}
        <div className="flex items-center justify-center mb-4">
          {lastNumber !== null ? (
            <div className="relative">
              <RouletteNumber 
                number={lastNumber} 
                size="xl" 
                pulse={highlight}
              />
              <div className="mt-2 text-center text-sm text-gray-400">
                Último número
              </div>
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center animate-pulse">
              <span className="text-gray-600 text-2xl">?</span>
            </div>
          )}
        </div>

        {/* Seção de histórico */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-gray-300 text-sm font-semibold">Histórico</h4>
          </div>
          <LastNumbers 
            numbers={mappedNumbers} 
            className="mb-2"
            isBlurred={isBlurred}
          />
        </div>

        {/* Seção de estatísticas */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-gray-300 text-sm font-semibold">Desempenho</h4>
          </div>
          <div className="flex space-x-2">
            <div className={`flex-1 bg-gray-800 p-2 rounded-lg ${highlightWins ? 'border border-green-500' : ''}`}>
              <div className="text-xs text-gray-400">Vitórias</div>
              <div className="text-lg font-bold text-green-500 flex items-center">
                {strategyWins || wins}
                {highlightWins && <ArrowUp className="w-4 h-4 ml-1 text-green-500" />}
              </div>
            </div>
            <div className={`flex-1 bg-gray-800 p-2 rounded-lg ${highlightLosses ? 'border border-red-500' : ''}`}>
              <div className="text-xs text-gray-400">Derrotas</div>
              <div className="text-lg font-bold text-red-500 flex items-center">
                {strategyLosses || losses}
                {highlightLosses && <ArrowDown className="w-4 h-4 ml-1 text-red-500" />}
              </div>
            </div>
          </div>
        </div>

        {/* Seção de insights e tendências */}
        <div className="mb-4">
          <div className="text-sm text-gray-300 bg-gray-800 p-2 rounded-lg">
            {currentStrategyState?.sugestao_display || strategyDisplay || getInsightMessage(mappedNumbers, wins, losses)}
          </div>
        </div>

        {/* Seção de estratégia */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-gray-300 text-sm font-semibold">Estratégia</h4>
          </div>
          <StrategySelector 
            strategies={strategies}
            selectedStrategy={currentStrategy}
            onChange={setCurrentStrategy}
            isDisabled={isLoading}
          />
        </div>

        {/* Botões de ação */}
        <div className="mt-4 flex justify-center space-x-2">
          <Button
            variant="default"
            className="w-full"
            disabled={isLoading}
            onClick={handlePlayClick}
          >
            Jogar
          </Button>
        </div>
      </div>

      {statsOpen && (
        <RouletteStatsModal
          open={statsOpen}
          onClose={() => setStatsOpen(false)}
          roletaId={roletaId}
          roletaNome={roletaNome}
          numbers={mappedNumbers}
          strategy={currentStrategyState}
        />
      )}
    </div>
  );
});

export default RouletteCard;