import { TrendingUp, ChartBar, ArrowUp, Eye, EyeOff, History, Target, Percent, Star, AlertTriangle, RefreshCw, Info } from 'lucide-react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { toast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { strategies, numberGroups } from './roulette/constants';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

import type { ReactNode } from 'react';
import LastNumbers from './roulette/LastNumbers';
import WinRateDisplay from './roulette/WinRateDisplay';
import RouletteTrendChart from './roulette/RouletteTrendChart';
import SuggestionDisplay from './roulette/SuggestionDisplay';
import RouletteActionButtons from './roulette/RouletteActionButtons';
import RouletteStatsModal from './roulette/RouletteStatsModal';
import { useRouletteData } from '@/hooks/useRouletteData';
import { StrategyUpdateEvent } from '@/services/EventService';
import EventService from '@/services/EventService';
import SocketService from '@/services/SocketService';

// Debug flag - set to false to disable logs in production
const DEBUG_ENABLED = true;  // Temporariamente habilitado para depuração do fluxo de estados

// Helper function for controlled logging
const debugLog = (...args: any[]) => {
  if (DEBUG_ENABLED) {
    console.log(...args);
  }
};

// Tabela de terminais para cada número da roleta
// Importado do arquivo terminal_table.py
const TERMINAL_TABLE = {
  0: [0, 3, 6, 10, 13, 16, 20, 23, 26, 30, 33, 36],
  1: [1, 4, 7, 11, 14, 17, 21, 24, 27, 31, 34, 37],
  2: [0, 2, 5, 8, 12, 15, 18, 22, 25, 28, 32, 35],
  3: [0, 3, 6, 9, 10, 13, 16, 19, 20, 23, 26, 29, 30, 33, 36],
  4: [4, 7, 8, 10, 14, 17, 18, 20, 24, 27, 28, 30, 34, 0],
  5: [5, 6, 9, 10, 15, 16, 19, 20, 25, 26, 29, 30, 35, 36, 0],
  6: [3, 6, 9, 10, 13, 16, 19, 20, 23, 26, 29, 30, 33, 36, 0],
  7: [4, 7, 8, 10, 14, 17, 18, 20, 24, 27, 28, 30, 34, 0],
  8: [4, 7, 8, 10, 14, 17, 18, 20, 24, 27, 28, 30, 34, 0],
  9: [5, 6, 9, 10, 15, 16, 19, 20, 25, 26, 29, 30, 35, 36, 0],
  10: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
  11: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
  12: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
  13: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
  14: [4, 7, 8, 10, 14, 17, 18, 20, 24, 27, 28, 30, 34, 0],
  15: [5, 6, 9, 10, 15, 16, 19, 20, 25, 26, 29, 30, 35, 36, 0],
  16: [3, 6, 9, 10, 13, 16, 19, 20, 23, 26, 29, 30, 33, 36, 0],
  17: [4, 7, 8, 10, 14, 17, 18, 20, 24, 27, 28, 30, 34, 0],
  18: [4, 7, 8, 10, 14, 17, 18, 20, 24, 27, 28, 30, 34, 0],
  19: [5, 6, 9, 10, 15, 16, 19, 20, 25, 26, 29, 30, 35, 36, 0],
  20: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
  21: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
  22: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
  23: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
  24: [4, 7, 8, 10, 14, 17, 18, 20, 24, 27, 28, 30, 34, 0],
  25: [5, 6, 9, 10, 15, 16, 19, 20, 25, 26, 29, 30, 35, 36, 0],
  26: [3, 6, 9, 10, 13, 16, 19, 20, 23, 26, 29, 30, 33, 36, 0],
  27: [4, 7, 8, 10, 14, 17, 18, 20, 24, 27, 28, 30, 34, 0],
  28: [4, 7, 8, 10, 14, 17, 18, 20, 24, 27, 28, 30, 34, 0],
  29: [5, 6, 9, 10, 15, 16, 19, 20, 25, 26, 29, 30, 35, 36, 0],
  30: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
  31: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
  32: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
  33: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
  34: [4, 7, 8, 10, 14, 17, 18, 20, 24, 27, 28, 30, 34, 0],
  35: [5, 6, 9, 10, 15, 16, 19, 20, 25, 26, 29, 30, 35, 36, 0],
  36: [3, 6, 9, 10, 13, 16, 19, 20, 23, 26, 29, 30, 33, 36, 0]
};

// Função para obter os terminais de um número conforme a tabela (apenas os 3 primeiros)
const getTerminalsForNumber = (number: number): number[] => {
  const num = number % 37; // Garantir que está no intervalo de 0-36
  if (TERMINAL_TABLE[num]) {
    // Retornar apenas os 3 primeiros terminais da tabela
    return TERMINAL_TABLE[num].slice(0, 3);
  }
  // Fallback caso não exista o número na tabela
  return [0, 1, 2];
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
    // Se não houver dados, gerar tendência aleatória
    return Array.from({ length: 20 }, () => ({ value: Math.random() * 100 }));
  }
  
  // Calcula taxa de vitória
  const winRate = wins / total;
  
  // Gera pontos de dados de tendência baseados na taxa de vitória
  return Array.from({ length: 20 }, (_, i) => {
    // Variação aleatória para simular flutuação, mas tendendo para a taxa de vitória real
    const randomVariation = (Math.random() - 0.5) * 30;
    return { value: winRate * 100 + randomVariation };
  });
};

interface RouletteCardRealtimeProps {
  roletaId: string;
  name?: string;
  roleta_nome?: string;
  wins?: number;
  losses?: number;
}

const RouletteCardRealtime = ({ 
  roletaId,
  name, 
  roleta_nome, 
  wins = 0, 
  losses = 0
}: RouletteCardRealtimeProps) => {
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
  
  // Adicionar variável de controle para verificação do topo
  const lastTopNumberRef = useRef<number | null>(null);
  const checkIntervalRef = useRef<number | null>(null);
  
  // Verificar se o nome da roleta é válido, com fallback para roleta_nome
  const roletaNome = name || roleta_nome || "Roleta Desconhecida";
  
  // Usar o hook personalizado para obter dados em tempo real
  const { numbers, loading, error, isConnected, hasData, strategy, strategyLoading, refreshNumbers } = useRouletteData(roletaId, roletaNome);
  
  // Converter os objetos RouletteNumber para números simples para compatibilidade com componentes existentes
  const lastNumbers = useMemo(() => {
    return numbers.map(numObj => numObj.numero);
  }, [numbers]);
  
  const trend = useMemo(() => {
    return generateTrendFromWinRate(strategyWins || wins, strategyLosses || losses);
  }, [wins, losses, strategyWins, strategyLosses]);

  // Efeito para inicializar os dados da estratégia a partir do hook
  useEffect(() => {
    if (strategy && !strategyLoading) {
      debugLog(`[RouletteCardRealtime] Inicializando estado da estratégia de ${roletaNome} com dados carregados:`, strategy);
      
      // Garantir que usamos os dados da estratégia recebidos do hook
      setStrategyState(strategy.estado || 'NEUTRAL');
      setStrategyDisplay(strategy.sugestao_display || "");
      setStrategyTerminals(strategy.terminais_gatilho || []);
      setStrategyWins(strategy.vitorias || 0);
      setStrategyLosses(strategy.derrotas || 0);
      
      // Log adicional para depuração
      debugLog(`[RouletteCardRealtime] Estado definido: ${strategy.estado}, Terminais: ${strategy.terminais_gatilho}`);
      
      // Notificar o usuário sobre estratégias ativas
      if (strategy.estado === 'TRIGGER' && strategy.terminais_gatilho?.length > 0) {
        toast({
          title: `⚠️ Estratégia ativa: ${roletaNome}`,
          description: `${strategy.sugestao_display || `Apostar em: ${strategy.terminais_gatilho.join(', ')}`}`,
          variant: "default"
        });
      }
    }
  }, [strategy, strategyLoading, roletaNome]);

  // Efeito para subscrever eventos de estratégia do backend
  useEffect(() => {
    // Obter o serviço de eventos
    const eventService = EventService.getInstance();
    
    // Log para verificar se o hook está sendo montado
    debugLog(`[RouletteCardRealtime] Montando componente para ${roletaNome} (ID: ${roletaId})`);
    
    // Callback para processar eventos de estratégia
    const handleStrategyUpdate = (event: StrategyUpdateEvent) => {
      // Verificar se é um evento relevante para este componente
      if (event.type !== 'strategy_update' || 
          (event.roleta_id !== roletaId && event.roleta_nome !== roletaNome)) {
        return;
      }
      
      debugLog(`[RouletteCardRealtime] ⚠️ Evento de estratégia recebido para ${roletaNome}: ${event.estado}`);
      
      // Importante: Como este evento vem do backend, vamos marcar que já processamos o último número 
      // para que a geração local não sobrescreva esta atualização
      if (lastNumbers.length > 0) {
        lastProcessedNumberRef.current = lastNumbers[0];
      }
      
      // Atualizar os estados da estratégia com os dados do evento
      setStrategyState(event.estado);
      setStrategyDisplay(event.sugestao_display || "");
      setStrategyTerminals(event.terminais_gatilho || []);
      
      // Atualizar contadores apenas se existirem no evento
      if (typeof event.vitorias === 'number') {
        setStrategyWins(event.vitorias);
      }
      
      if (typeof event.derrotas === 'number') {
        setStrategyLosses(event.derrotas);
      }
      
      // Notificar o usuário sobre mudanças importantes na estratégia
      if (event.estado === 'TRIGGER' && event.terminais_gatilho?.length > 0) {
        toast({
          title: `⚠️ Estratégia atualizada (Backend): ${roletaNome}`,
          description: `${event.sugestao_display || `Apostar em: ${event.terminais_gatilho.join(', ')}`}`,
          variant: "default"
        });
      }
    };
    
    // Inscrever-se para eventos específicos desta roleta
    debugLog(`[RouletteCardRealtime] Inscrevendo-se para eventos de estratégia: ${roletaNome}`);
    eventService.subscribe(roletaNome, handleStrategyUpdate as any);
    
    // Também inscrever-se para o evento global
    const globalHandler = (event: any) => {
      if (event.type === 'strategy_update' && 
          (event.roleta_id === roletaId || event.roleta_nome === roletaNome)) {
        debugLog(`[RouletteCardRealtime] Recebido evento global para ${roletaNome}`);
        handleStrategyUpdate(event as StrategyUpdateEvent);
      }
    };
    
    eventService.subscribe('*', globalHandler);
    
    // Criar também subscrição com o Socket Service diretamente
    let socketHandler: any = null;
    try {
      const socketService = SocketService.getInstance();
      if (socketService) {
        debugLog(`[RouletteCardRealtime] Inscrevendo também no Socket Service: ${roletaNome}`);
        
        socketHandler = (socketEvent: any) => {
          // Verificar se é um evento de estratégia
          if (socketEvent.type === 'strategy_update' && 
              (socketEvent.roleta_id === roletaId || socketEvent.roleta_nome === roletaNome)) {
            debugLog(`[RouletteCardRealtime] Evento de estratégia via Socket para ${roletaNome}: ${socketEvent.estado}`);
            
            // Adaptar formato se necessário
            const adaptedEvent = {...socketEvent};
            if (!adaptedEvent.roleta_id && roletaId) adaptedEvent.roleta_id = roletaId;
            if (!adaptedEvent.roleta_nome && roletaNome) adaptedEvent.roleta_nome = roletaNome;
            
            handleStrategyUpdate(adaptedEvent as StrategyUpdateEvent);
          }
        };
        
        socketService.subscribe(roletaNome, socketHandler);
        
        // Adicionar subscrição para canal global também
        socketService.subscribe('global_strategy_updates', socketHandler);
      }
    } catch (e) {
      debugLog(`[RouletteCardRealtime] Erro ao se inscrever no Socket Service: ${e}`);
    }
    
    // Solicitar a estratégia atual ao montar o componente
    const requestCurrentStrategy = () => {
      try {
        debugLog(`[RouletteCardRealtime] Solicitando estratégia atual para ${roletaNome}`);
        const socketService = SocketService.getInstance();
        // Usar o método correto para verificar a conexão
        if (socketService && socketService.isSocketConnected()) {
          // Enviar um evento solicitando o estado atual da estratégia
          socketService.emit('request_strategy', {
            roleta_id: roletaId,
            roleta_nome: roletaNome
          });
        }
      } catch (e) {
        debugLog(`[RouletteCardRealtime] Erro ao solicitar estratégia atual: ${e}`);
      }
    };
    
    // Tentar obter a estratégia atual ao montar
    requestCurrentStrategy();
    
    // Limpar ao desmontar
    return () => {
      debugLog(`[RouletteCardRealtime] Desmontando componente para ${roletaNome}`);
      
      // Limpar todas as subscrições
      eventService.unsubscribe(roletaNome, handleStrategyUpdate as any);
      eventService.unsubscribe('*', globalHandler);
      
      // Tentar limpar também do socketService, se disponível
      if (socketHandler) {
        try {
          const socketService = SocketService.getInstance();
          if (socketService) {
            socketService.unsubscribe(roletaNome, socketHandler);
            socketService.unsubscribe('global_strategy_updates', socketHandler);
          }
        } catch (e) {
          // Silenciar erros na limpeza
        }
      }
    };
  }, [roletaId, roletaNome, lastNumbers]);

  // Efeito para verificar constantemente os números do topo
  useEffect(() => {
    // Função para verificar se há novos números no topo
    const checkTopNumber = () => {
      if (lastNumbers.length > 0) {
        const topNumber = lastNumbers[0];
        
        // Se o número do topo mudou desde a última verificação
        if (lastProcessedNumberRef.current !== topNumber) {
          debugLog(`[RouletteCardRealtime] Novo número do topo detectado: ${topNumber} (anterior: ${lastProcessedNumberRef.current})`);
          
          // Atualizar referência do último número processado
          lastProcessedNumberRef.current = topNumber;
          
          // Processar a estratégia para este novo número (isso será feito pelo efeito de estratégia existente)
        }
      }
    };
    
    // Verificar imediatamente ao montar
    checkTopNumber();
    
    // Configurar verificação periódica
    if (!checkIntervalRef.current) {
      debugLog(`[RouletteCardRealtime] Iniciando verificação periódica de números do topo para ${roletaNome}`);
      checkIntervalRef.current = window.setInterval(() => {
        // Forçar uma atualização dos números
        refreshNumbers();
        // Verificar após breve delay para permitir que os dados sejam carregados
        setTimeout(checkTopNumber, 300);
      }, 5000); // Verificar a cada 5 segundos
    }
    
    // Limpar ao desmontar
    return () => {
      if (checkIntervalRef.current) {
        debugLog(`[RouletteCardRealtime] Encerrando verificação periódica para ${roletaNome}`);
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [lastNumbers, roletaNome, refreshNumbers]);

  // Adicionar um hook simples para depuração das estratégias recebidas do backend
  useEffect(() => {
    if (strategyState) {
      debugLog(`[${roletaNome}] Exibindo estratégia recebida do backend: Estado=${strategyState}, Terminais=[${strategyTerminals.join(',')}]`);
    }
  }, [strategyState, strategyTerminals, roletaNome]);

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
    // Não vamos mais recarregar a página inteira
    // window.location.reload();
    
    // Em vez disso, vamos chamar a função refreshNumbers do hook
    refreshNumbers()
      .then((success) => {
        if (success) {
          toast({
            title: "Dados atualizados",
            description: "Os dados da roleta foram atualizados com sucesso.",
            variant: "default",
            duration: 2000
          });
        } else {
          toast({
            title: "Sem novos dados",
            description: "Não foi possível encontrar novos dados para esta roleta.",
            variant: "default",
            duration: 2000
          });
        }
      })
      .catch((error) => {
        toast({
          title: "Erro ao atualizar",
          description: "Ocorreu um erro ao tentar atualizar os dados da roleta.",
          variant: "destructive",
          duration: 3000
        });
        console.error("Erro ao atualizar dados:", error);
      });
  };

  // Efeito para tentar recarregar dados automaticamente em intervalos
  useEffect(() => {
    // Se não há dados e não está carregando, tentar recarregar automaticamente
    if (!hasData && !loading) {
      console.log(`[RouletteCardRealtime] Sem dados para ${roletaNome}, tentando carregar automaticamente...`);
      const reloadInterval = setInterval(() => {
        console.log(`[RouletteCardRealtime] Tentativa automática de recarregar dados para ${roletaNome}`);
        refreshNumbers()
          .then(success => {
            if (success) {
              console.log(`[RouletteCardRealtime] Dados carregados com sucesso para ${roletaNome}`);
              // Limpar o intervalo uma vez que os dados foram carregados
              clearInterval(reloadInterval);
            }
          })
          .catch(err => console.error(`[RouletteCardRealtime] Erro ao tentar recarregar dados para ${roletaNome}:`, err));
      }, 15000); // Tentar a cada 15 segundos
      
      // Limpar o intervalo quando o componente for desmontado
      return () => clearInterval(reloadInterval);
    }
  }, [hasData, loading, refreshNumbers, roletaNome]);

  // Conteúdo quando não há dados disponíveis
  const noDataContent = (
    <div className="flex flex-col items-center justify-center h-full py-8 text-center">
      <AlertTriangle size={40} className="text-yellow-500 mb-3" />
      <h3 className="text-white text-lg font-semibold mb-2">Sem Dados Disponíveis</h3>
      <p className="text-gray-400 text-sm mb-4">
        Não há números registrados no MongoDB para esta roleta.
      </p>
      <Button 
        className="flex items-center gap-2 bg-vegas-gold text-black hover:bg-vegas-gold/80"
        onClick={reloadData}
      >
        <RefreshCw size={16} />
        Recarregar
      </Button>
    </div>
  );

  // Memorize components to prevent unnecessary re-renders
  const memoizedNumbers = useMemo(() => (
    <LastNumbers numbers={lastNumbers} isLoading={loading} />
  ), [lastNumbers, loading]);

  const memoizedSuggestion = useMemo(() => (
    <SuggestionDisplay 
      suggestion={suggestion}
      selectedGroup={selectedGroup}
      isBlurred={isBlurred}
      toggleVisibility={toggleVisibility}
      numberGroups={numberGroups}
      strategyState={strategyState}
      strategyDisplay={strategyDisplay}
      strategyTerminals={strategyTerminals}
      wins={strategyWins || wins}
      losses={strategyLosses || losses}
    />
  ), [suggestion, selectedGroup, isBlurred, strategyState, strategyDisplay, strategyTerminals, strategyWins, strategyLosses, wins, losses]);

  const memoizedWinRate = useMemo(() => (
    <WinRateDisplay wins={strategyWins || wins} losses={strategyLosses || losses} />
  ), [wins, losses, strategyWins, strategyLosses]);

  const memoizedTrendChart = useMemo(() => (
    <RouletteTrendChart trend={trend} />
  ), [trend]);

  const memoizedActionButtons = useMemo(() => (
    <RouletteActionButtons 
      onDetailsClick={handleDetailsClick}
      onPlayClick={handlePlayClick}
    />
  ), []);

  // Adicionar efeito para garantir que os dados da estratégia estejam sempre atualizados
  useEffect(() => {
    if (strategyState === 'TRIGGER' && strategyTerminals && strategyTerminals.length > 0) {
      // Se temos um gatilho com terminais, atualizar a sugestão local
      setSuggestion(strategyTerminals);
      
      // Também registrar para depuração
      debugLog(`[RouletteCardRealtime] Terminais atualizados para ${roletaNome}: ${strategyTerminals.join(',')}`);
      debugLog(`[RouletteCardRealtime] Vitórias/Derrotas: ${strategyWins}/${strategyLosses}`);
    }
  }, [strategyState, strategyTerminals, roletaNome, strategyWins, strategyLosses]);

  return (
    <div className={`relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg shadow-xl overflow-hidden transition-all duration-300 hover:shadow-2xl ${isConnected ? '' : 'opacity-50'}`}>
      {/* Header */}
      <div className="flex justify-between items-center px-3 py-2 bg-gradient-to-r from-slate-800 to-slate-700">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <h3 className="text-white font-bold truncate" style={{ maxWidth: "150px" }}>{roletaNome}</h3>
          
          {/* Badge do Estado da Estratégia */}
          {strategyState && (
            <div className={`ml-2 px-2 py-0.5 text-[10px] font-semibold rounded ${
              strategyState === 'TRIGGER' ? 'bg-green-500/40 text-green-300 border border-green-500/50' : 
              strategyState === 'POST_GALE_NEUTRAL' ? 'bg-yellow-500/40 text-yellow-300 border border-yellow-500/50' : 
              strategyState === 'MORTO' ? 'bg-red-500/40 text-red-300 border border-red-500/50' : 
              'bg-blue-500/40 text-blue-300 border border-blue-500/50'
            }`}>
              {strategyState}
            </div>
          )}
        </div>
        <div className="flex space-x-1">
          <RouletteActionButtons
            onRefresh={handleRefresh}
            isLoading={loading || strategyLoading}
            onShowStats={() => setStatsOpen(true)}
          />
        </div>
      </div>
      
      {/* Content */}
      <div className="p-3">
        {/* Caso de erro ao carregar */}
        {error && (
          <div className="text-red-400 text-xs mb-2 flex items-center">
            <AlertTriangle size={12} className="mr-1"/>
            {error}
          </div>
        )}
        
        {/* Carregando */}
        {loading && (
          <div className="animate-pulse flex flex-col space-y-2">
            <div className="h-6 bg-slate-700 rounded"></div>
            <div className="grid grid-cols-5 gap-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-6 w-6 bg-slate-700 rounded-full"></div>
              ))}
            </div>
          </div>
        )}
        
        {/* Conteúdo principal */}
        {!loading && hasData && (
          <>
            {/* Últimos Números */}
            <LastNumbers numbers={lastNumbers} isBlurred={isBlurred} />
            
            {/* Adicionar nova seção para destacar os dados da estratégia */}
            {strategyState && (
              <div className="mt-2 p-2 rounded-md border border-gray-700 bg-black/30">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-white text-xs font-semibold">Dados do MongoDB</h3>
                  <span className="text-[10px] text-gray-400">ID: {roletaId.substring(0, 8)}...</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <p className="text-gray-400">Estado: <span className={`font-semibold ${
                      strategyState === 'TRIGGER' ? 'text-green-400' :
                      strategyState === 'POST_GALE_NEUTRAL' ? 'text-yellow-400' :
                      strategyState === 'MORTO' ? 'text-red-400' :
                      'text-blue-400'
                    }`}>{strategyState}</span></p>
                    <p className="text-gray-400">Nº Gatilho: <span className="font-semibold text-white">{strategy?.numero_gatilho || "N/A"}</span></p>
                  </div>
                  <div>
                    <p className="text-gray-400">Vitórias: <span className="font-semibold text-green-400">{strategyWins || 0}</span></p>
                    <p className="text-gray-400">Derrotas: <span className="font-semibold text-red-400">{strategyLosses || 0}</span></p>
                  </div>
                </div>
                <div className="mt-1.5">
                  <p className="text-gray-400 text-[11px]">Terminais: <span className="font-semibold text-white">{strategyTerminals?.join(', ') || "Nenhum"}</span></p>
                </div>
              </div>
            )}
            
            {/* Componentes de Informação */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mt-2">
              <div className="space-y-2">
                {/* Taxa de Vitória */}
                <WinRateDisplay 
                  wins={strategyWins || wins} 
                  losses={strategyLosses || losses} 
                />
                
                {/* Gráfico de Tendência */}
                <div className="bg-slate-800 p-2 rounded-md">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-gray-400 text-xs font-medium flex items-center">
                      <TrendingUp size={12} className="mr-1.5"/>
                      Tendência
                    </h3>
                    <span className="text-[10px] text-gray-500">{lastNumbers.length} jogos</span>
                  </div>
                  <RouletteTrendChart data={trend} />
                </div>
              </div>
              
              <div className="bg-slate-800 p-2 rounded-md">
                {/* Sugestões */}
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-gray-400 text-xs font-medium">
                    <Target size={12} className="inline mr-1.5"/>
                    {strategyState === 'TRIGGER' ? 'ESTRATÉGIA ATIVA' : 'Estratégia'}
                  </h3>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info size={14} className="text-gray-400 cursor-help hover:text-gray-300" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">
                        {getInsightMessage(lastNumbers, strategyWins || wins, strategyLosses || losses)}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                
                <div>
                  <SuggestionDisplay 
                    suggestion={suggestion}
                    selectedGroup={selectedGroup}
                    isBlurred={isBlurred}
                    toggleVisibility={toggleVisibility}
                    numberGroups={numberGroups}
                    strategyState={strategyState}
                    strategyDisplay={strategyDisplay}
                    strategyTerminals={strategyTerminals}
                    wins={strategyWins || wins}
                    losses={strategyLosses || losses}
                  />
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* Mensagem de Sem Dados */}
        {!loading && !hasData && (
          <div className="flex flex-col items-center justify-center py-4">
            <p className="text-gray-400 text-sm mb-2">Sem dados disponíveis</p>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleRefresh}
              className="text-xs"
            >
              <RefreshCw size={14} className="mr-1"/>
              Atualizar
            </Button>
          </div>
        )}
      </div>
      
      {/* Modal de Estatísticas */}
      <RouletteStatsModal 
        open={statsOpen} 
        onOpenChange={setStatsOpen}
        roleta={{
          nome: roletaNome,
          id: roletaId,
          numeros: lastNumbers,
        }}
        strategy={{
          estado: strategyState,
          terminais: strategyTerminals,
          vitorias: strategyWins || wins,
          derrotas: strategyLosses || losses,
          sugestao: strategyDisplay
        }}
      />
    </div>
  );
};

export default RouletteCardRealtime; 