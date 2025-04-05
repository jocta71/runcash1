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
  
  // Mapeamento de ID para nome canônico de roleta
  const ID_TO_NAME_MAP: Record<string, string> = {
    "2010016": "Immersive Roulette",
    "2380335": "Brazilian Mega Roulette",
    "2010065": "Bucharest Auto-Roulette",
    "2010096": "Speed Auto Roulette",
    "2010017": "Auto-Roulette",
    "2010098": "Auto-Roulette VIP"
  };
  
  // Usar o ID para determinar o nome correto se o nome estiver como "Roleta Desconhecida"
  const displayName = useMemo(() => {
    if (roletaNome !== "Roleta Desconhecida") {
      return roletaNome;
    }
    
    // Se temos um ID e o nome é "Roleta Desconhecida", verificar no mapeamento
    if (roletaId && ID_TO_NAME_MAP[roletaId]) {
      return ID_TO_NAME_MAP[roletaId];
    }
    
    return roletaNome;
  }, [roletaNome, roletaId]);
  
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
  
  // Mapear os números da API para o formato usado no componente
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
      
      // Se temos últimos números válidos, usar eles como fallback
      if (mapped.length === 0 && Array.isArray(lastNumbers) && lastNumbers.length > 0) {
        if (DEBUG_ENABLED) {
          debugLog(`[RouletteCard] Usando lastNumbers como fallback para ${roletaNome}:`, lastNumbers.slice(0, 5));
        }
        return lastNumbers;
      }
      
      return mapped;
    }
    
    // Prioridade 3: lastNumbers
    if (Array.isArray(lastNumbers) && lastNumbers.length > 0) {
      if (DEBUG_ENABLED) {
        debugLog(`[RouletteCard] Usando lastNumbers como único recurso para ${roletaNome}:`, lastNumbers.slice(0, 5));
      }
      return lastNumbers;
    }
    
    // Fallback para array vazio
    return [];
  }, [apiNumbers, roletaNome, mappedNumbersOverride, lastNumbers]);

  // NOVO EFEITO: Atualizar e garantir a ordem dos números recebidos
  useEffect(() => {
    // Se temos dados, garantir que estejam na ordem correta e que o último número seja sempre atualizado
    if (mappedNumbers.length > 0) {
      // Verificar se o primeiro número (mais recente) é diferente do último número conhecido
      if (lastNumber !== mappedNumbers[0]) {
        console.log(`[RouletteCard] Atualizando lastNumber de ${lastNumber} para ${mappedNumbers[0]} (${displayName})`);
        // Atualizar o último número para garantir consistência
        setLastNumber(mappedNumbers[0]);
      }
    }
  }, [mappedNumbers, lastNumber, displayName]);

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
      console.log(`[RouletteCard] ID da roleta não disponível para ${displayName}, não será possível conectar ao endpoint específico`);
      return;
    }

    console.log(`[RouletteCard] ⚡️ Configurando conexão específica para roleta ${roletaId} (${displayName})`);
    
    // Obter instância do socketService
    const socketService = SocketService.getInstance();
    
    // Conectar ao endpoint específico desta roleta
    socketService.subscribeToRouletteEndpoint(roletaId, displayName);
    
    // Forçar reconexão para garantir que estamos recebendo eventos em tempo real
    socketService.reconnect().then(connected => {
      if (connected) {
        console.log(`[RouletteCard] Reconexão bem-sucedida, solicitando dados para ${displayName}`);
        // Reinscrever no endpoint específico após reconexão
        socketService.subscribeToRouletteEndpoint(roletaId, displayName);
        // Solicitar dados imediatamente
        socketService.requestRouletteNumbers(roletaId);
      } else {
        console.log(`[RouletteCard] Falha na reconexão para ${displayName}, tentando novamente em 3s`);
        // Tentar novamente após um breve delay
        setTimeout(() => {
          socketService.reconnect().then(success => {
            if (success) {
              socketService.subscribeToRouletteEndpoint(roletaId, displayName);
              socketService.requestRouletteNumbers(roletaId);
            }
          });
        }, 3000);
      }
    });
    
    // Configurar verificação periódica para manter dados atualizados
    const dataRefreshInterval = setInterval(() => {
      console.log(`[RouletteCard] Verificação periódica de dados para ${displayName}`);
      
      if (socketService.isSocketConnected()) {
        // Adicionar timestamp para evitar cache
        console.log(`[RouletteCard] Solicitando dados atualizados para ${displayName}`);
        socketService.requestRouletteNumbers(roletaId);
      } else {
        console.log(`[RouletteCard] Socket desconectado, reconectando para ${displayName}`);
        socketService.reconnect().then(connected => {
          if (connected) {
            socketService.subscribeToRouletteEndpoint(roletaId, displayName);
          }
        });
      }
    }, 10000); // Verificar a cada 10 segundos
    
    // Limpar intervalo quando o componente for desmontado
    return () => {
      console.log(`[RouletteCard] Limpando recursos para ${displayName}`);
      clearInterval(dataRefreshInterval);
    };
  }, [roletaId, displayName]);

  // Função para processar número recebido em tempo real
  const processRealtimeNumber = useCallback((newNumber: any) => {
    // Verificar se é um número ou objeto com propriedade número
    let processedNumber: number = -1;
    
    // Se já é um número
    if (typeof newNumber === 'number' && !isNaN(newNumber)) {
      processedNumber = newNumber;
    } 
    // Se é um objeto
    else if (typeof newNumber === 'object' && newNumber !== null) {
      // Tenta extrair o número de várias propriedades possíveis
      if ('numero' in newNumber && typeof newNumber.numero !== 'undefined') {
        processedNumber = typeof newNumber.numero === 'number' 
          ? newNumber.numero 
          : parseInt(String(newNumber.numero), 10);
      } else if ('value' in newNumber && typeof newNumber.value !== 'undefined') {
        processedNumber = typeof newNumber.value === 'number'
          ? newNumber.value
          : parseInt(String(newNumber.value), 10);
      } else if ('number' in newNumber && typeof newNumber.number !== 'undefined') {
        processedNumber = typeof newNumber.number === 'number'
          ? newNumber.number
          : parseInt(String(newNumber.number), 10);
      }
    }
    // Se é uma string
    else if (typeof newNumber === 'string') {
      processedNumber = parseInt(newNumber, 10);
    }
    
    // Se conseguimos processar o número
    if (!isNaN(processedNumber) && processedNumber >= 0) {
      setLastNumber(processedNumber);
      
      // Atualizar a lista de números, mantendo o último número recebido sempre na primeira posição
      setMappedNumbersOverride(prev => {
        // Remover o número se já existir na lista para evitar duplicação
        const filteredNumbers = prev.filter(n => n !== processedNumber);
        // Adicionar o novo número no início
        return [processedNumber, ...filteredNumbers].slice(0, 20);
      });
      
      // Atualizar highlight para mostrar visualmente a nova chegada
    setHighlight(true);
      setTimeout(() => setHighlight(false), 1000);
      return true;
    }
    return false;
  }, []);

  // Efeito para escutar eventos do websocket específicos para esta roleta
  useEffect(() => {
    const socketService = SocketService.getInstance();
    
    // Função que processa eventos de novos números
    const handleEvent = (event: any) => {
      if (!event || typeof event !== 'object') return;

      try {
        // Verificar tipo de evento (pode ser 'numero', 'roleta_update', etc)
        if (event.tipo === 'numero' || event.type === 'numero' || event.event_type === 'numero') {
          if ('numero' in event) {
            processRealtimeNumber(event.numero);
          } else if ('value' in event) {
            processRealtimeNumber(event.value);
          } else if ('number' in event) {
            processRealtimeNumber(event.number);
          } else {
            // Se não encontramos o número em um campo específico, tenta processar o próprio evento
            processRealtimeNumber(event);
          }
        }
        
        // Se o evento contém vitórias/derrotas, atualizar informações
        if (('vitorias' in event && typeof event.vitorias === 'number') || 
            ('wins' in event && typeof event.wins === 'number')) {
          
          const currentWins = ('vitorias' in event) ? event.vitorias : event.wins;
          // Se o número é diferente do atual, destacar
          if (currentWins !== wins) {
            setHighlightWins(true);
            setTimeout(() => setHighlightWins(false), 3000);
          }
        }
        
        if (('derrotas' in event && typeof event.derrotas === 'number') || 
            ('losses' in event && typeof event.losses === 'number')) {
          
          const currentLosses = ('derrotas' in event) ? event.derrotas : event.losses;
          // Se o número é diferente do atual, destacar
          if (currentLosses !== losses) {
            setHighlightLosses(true);
            setTimeout(() => setHighlightLosses(false), 3000);
          }
        }
      } catch (error) {
        console.error(`[RouletteCard] Erro ao processar evento para ${roletaNome}:`, error);
      }
    };
    
    // Inscrever para eventos globais e específicos
    socketService.subscribe('*', handleEvent);
    socketService.subscribe(name || '', handleEvent);
    
    // Se temos ID da roleta, inscrever especificamente por ID
    if (roletaId) {
      socketService.subscribe(roletaId, handleEvent);
    }
    
    // Limpar a inscrição quando o componente for desmontado
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      
      socketService.unsubscribe('*', handleEvent);
      socketService.unsubscribe(name || '', handleEvent);
      
      if (roletaId) {
        socketService.unsubscribe(roletaId, handleEvent);
      }
    };
  }, [name, roleta_nome, roletaId, roletaNome, processRealtimeNumber]);

  // Effect para atualizar o lastNumber quando o mappedNumbers mudar
  useEffect(() => {
    const combinedNumbers = getCombinedNumbers();
    if (combinedNumbers.length > 0) {
      setLastNumber(combinedNumbers[0]);
    }
  }, [mappedNumbersOverride, apiNumbers]);
  
  // Função para obter a lista combinada de números
  const getCombinedNumbers = useCallback(() => {
    // Prioridade 1: Números recebidos diretamente do WebSocket
    if (mappedNumbersOverride.length > 0) {
      return mappedNumbersOverride;
    }
    
    // Prioridade 2: Números da API
    if (Array.isArray(apiNumbers) && apiNumbers.length > 0) {
      if (typeof apiNumbers[0] === 'number') {
        return apiNumbers;
      }
      
      // Converter objetos para números
      return apiNumbers.map(numObj => {
        if (typeof numObj === 'number') return numObj;
        
        if (typeof numObj === 'object' && numObj !== null) {
          if ('numero' in numObj) {
            return typeof numObj.numero === 'number' ? numObj.numero : parseInt(String(numObj.numero), 10);
          }
          if ('value' in numObj) {
            return typeof numObj.value === 'number' ? numObj.value : parseInt(String(numObj.value), 10);
          }
          if ('number' in numObj) {
            return typeof numObj.number === 'number' ? numObj.number : parseInt(String(numObj.number), 10);
          }
        }
        
        return 0; // Fallback
      }).filter(num => !isNaN(num));
    }
    
    // Prioridade 3: Números de lastNumbers das props
    if (Array.isArray(lastNumbers) && lastNumbers.length > 0) {
      return lastNumbers;
    }
    
    return [];
  }, [mappedNumbersOverride, apiNumbers, lastNumbers]);

  // Adicionar um efeito para a detecção de dados carregados
  useEffect(() => {
    // Se não tem ID, não continuar
    if (!roletaId) {
      setIsLoading(false);
      return;
    }

    // Logica para detectar se temos dados úteis
    const hasApiData = Array.isArray(apiNumbers) && apiNumbers.length > 0;
    const hasSocketData = mappedNumbersOverride.length > 0;
    const mappedNumbersLength = getCombinedNumbers().length;
    
    const lastNumberState = lastNumber;
    
    // Log para debug
    if (DEBUG_ENABLED) {
      debugLog(`[RouletteCard] Estado do card para ${roletaNome}:`, {
        isLoading, hasApiData, hasSocketData, mappedNumbersLength, lastNumberState, apiStrategy
      });
    }
    
    // Verificar se temos algum tipo de dados e desativar loading
    if (mappedNumbersLength > 0 || hasApiData || hasSocketData) {
      if (isLoading) {
        debugLog(`[RouletteCard] FORÇANDO desativação do isLoading para ${roletaNome} - dados detectados`);
        setIsLoading(false);
      }
    }
    
    // Garantir que lastNumber seja definido se temos dados
    if (lastNumberState === null && mappedNumbersLength > 0) {
      const combinedNumbers = getCombinedNumbers();
      debugLog(`[RouletteCard] Definindo lastNumber para ${roletaNome} como ${combinedNumbers[0]}`);
      setLastNumber(combinedNumbers[0]);
    }
    
  }, [roletaId, apiNumbers, mappedNumbersOverride, isLoading, lastNumber, roletaNome, getCombinedNumbers]);

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
          logger.debug(`Recarregando dados para roleta ${displayName}`);
          const numbersSuccess = await refreshNumbers();
          const strategySuccess = await refreshStrategy();
          return { numbersSuccess, strategySuccess };
        },
        true // Forçar execução imediata
      );
      
      toast({
        title: "Dados atualizados",
        description: `Os dados da ${displayName} foram atualizados com sucesso.`,
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: `Não foi possível atualizar os dados da ${displayName}.`,
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
      className={`
        bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-xl shadow-xl p-4 transition-all duration-300
        ${highlight ? 'border-2 border-green-500' : 'border border-zinc-800'} 
        ${isBlurred ? 'backdrop-blur-sm' : ''}
        transform hover:translate-y-[-2px] hover:shadow-2xl
      `}
    >
      {/* Header do Card - Nome da Roleta */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-bold text-zinc-50 truncate">{displayName}</h3>
        <div className="flex space-x-1">
          <Button 
            variant="ghost" 
            size="sm" 
            className="p-1 h-7 w-7" 
            onClick={toggleVisibility}
            title={isBlurred ? "Mostrar" : "Ocultar"}
          >
            {isBlurred ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="p-1 h-7 w-7" 
            onClick={reloadData}
            title="Recarregar dados"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      
      {/* Últimos Números */}
      <div className={`mb-3 ${highlight ? 'animate-pulse' : ''}`}>
        <LastNumbers 
          numbers={getCombinedNumbers()} 
          isBlurred={isBlurred}
          roletaId={roletaId}
        />
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
        ) : (
          /* Sempre exibir algum conteúdo, mesmo sem dados */
          <div>
            {/* Últimos números - usar qualquer fonte de dados disponível */}
            <LastNumbers 
              numbers={
                numbers.length > 0 ? numbers : 
                mappedNumbersOverride.length > 0 ? mappedNumbersOverride : 
                mappedNumbers.length > 0 ? mappedNumbers.slice(0, 18) : 
                [] // Não gerar mais números aleatórios, melhor mostrar "Sem dados disponíveis"
              } 
              className="mb-4" 
              isBlurred={isBlurred}
            />
            
            {/* Informações de debug - mais detalhadas */}
            <div className="mb-2 text-xs text-zinc-500">
              {displayName} - ID: {roletaId || "N/A"} - Eventos: {numbers.length} | API: {mappedNumbers.length} | Override: {mappedNumbersOverride.length}
            </div>
            
            {/* Insights */}
            <div className="mb-4 text-sm text-zinc-400 italic">
              {mappedNumbers.length > 0 ? insight : "Aguardando dados da API..."}
            </div>
            
            {/* Estatísticas */}
            <div className="flex justify-between mb-4">
              <div className="flex items-center">
                <span className="text-zinc-400 mr-2">Vitórias:</span>
                <span className={winsClass}>{strategyWins || 0}</span>
              </div>
              <div className="flex items-center">
                <span className="text-zinc-400 mr-2">Derrotas:</span>
                <span className={lossesClass}>{strategyLosses || 0}</span>
              </div>
            </div>
            
            {/* Botão para gerar dados de teste */}
            {(numbers.length === 0 && mappedNumbersOverride.length === 0 && mappedNumbers.length === 0) && (
              <div className="mb-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={async (e) => {
                    e.stopPropagation();
                    // Recarregar dados reais em vez de injetar dados de teste
                    console.log(`[RouletteCard] Forçando recarregamento de dados reais para ${displayName}`);
                    
                    // Iniciar loading
                    setIsLoading(true);
                    
                    try {
                      // Chamar a função de refresh de forma assíncrona
                      const success = await refreshNumbers();
                      if (success) {
                        toast({
                          title: "Dados atualizados",
                          description: `Dados reais carregados para ${displayName}`,
                          variant: "default"
                        });
                      } else {
                        toast({
                          title: "Sem dados disponíveis",
                          description: `Não foi possível carregar dados para ${displayName}`,
                          variant: "destructive"
                        });
                      }
                    } catch (error) {
                      console.error(`Erro ao recarregar dados para ${displayName}:`, error);
                      toast({
                        title: "Erro",
                        description: "Ocorreu um erro ao tentar recarregar os dados",
                        variant: "destructive"
                      });
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  className="w-full text-sm bg-blue-800 hover:bg-blue-700 text-white"
                >
                  Recarregar dados reais
                </Button>
              </div>
            )}

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
              console.log(`[RouletteCard] Injetando número REAL de teste ${randomNumber} para ${displayName}`);
              
              // Injetar evento de teste usando o SocketService
              const socketService = SocketService.getInstance();
              socketService.injectTestEvent(displayName, randomNumber);
              
              // Atualizar o estado isLoading
              setIsLoading(false);
              
              toast({
                title: "Dados reais adicionados",
                description: `Carregado número ${randomNumber} para ${displayName}`,
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