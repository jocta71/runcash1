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
  // Obter referência ao serviço de feed centralizado
  const feedService = useMemo(() => {
    // Verificar se o sistema já foi inicializado globalmente
    if (window.isRouletteSystemInitialized && window.isRouletteSystemInitialized()) {
      debugLog('[RouletteCard] Usando sistema de roletas já inicializado');
      // Recuperar o serviço do sistema global
      return window.getRouletteSystem 
        ? window.getRouletteSystem().rouletteFeedService 
        : RouletteFeedService.getInstance();
    }
    
    // Fallback para o comportamento padrão
    debugLog('[RouletteCard] Sistema global não detectado, usando instância padrão');
    return RouletteFeedService.getInstance();
  }, []);
  
  // DEBUG: Verificar formato dos dados recebidos
  useEffect(() => {
    if (data) {
      console.log(`[DEBUG] Dados recebidos para ${data.name || data.nome || 'roleta desconhecida'} (ID: ${data.id || 'unknown'}):`);
      
      if (Array.isArray(data.numero) && data.numero.length > 0) {
        console.log(`[DEBUG] Roleta ${data.name || data.nome}: ${data.numero.length} números disponíveis`);
        
        // Mostrar até 5 números mais recentes para verificação
        const recentNumbers = data.numero.slice(0, 5);
        console.log(`[DEBUG] Números recentes para ${data.name || data.nome}:`, 
          recentNumbers.map(n => typeof n === 'object' ? `${n.numero}` : `${n}`).join(', ')
        );
      } else {
        console.warn(`[DEBUG] Roleta ${data.name || data.nome}: sem números disponíveis`);
      }
    }
  }, [data]);
  
  // Garantir que data é um objeto válido com valores padrão seguros
  const safeData = useMemo(() => {
    // Se data for null ou undefined, retornar objeto vazio com valores padrão
    if (!data) {
      console.warn('[RouletteCard] Dados inválidos: null ou undefined');
      return {
        id: 'unknown',
        name: 'Roleta não identificada',
        lastNumbers: [],
      };
    }
    
    // Certifique-se de que lastNumbers é sempre um array válido
    const lastNumbers = Array.isArray(data.lastNumbers) 
      ? data.lastNumbers 
      : Array.isArray(data.numero) 
        ? data.numero.map(n => typeof n === 'object' && n !== null ? n.numero : n).filter(Boolean)
        : [];
    
    return {
      ...data,
      id: data.id || data._id || 'unknown',
      name: data.name || data.nome || 'Roleta sem nome',
      lastNumbers,
    };
  }, [data]);
  
  // Usar safeData em vez de data diretamente para inicializar os estados
  const [lastNumber, setLastNumber] = useState<number | null>(
    getInitialLastNumber(safeData)
  );
  
  const [recentNumbers, setRecentNumbers] = useState<number[]>(
    getInitialRecentNumbers(safeData)
  );
  
  const [isNewNumber, setIsNewNumber] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const [hasRealData, setHasRealData] = useState(recentNumbers.length > 0);
  const cardRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasInitialized = useRef(false);
  const socketService = SocketService.getInstance();
  const { enableSound, enableNotifications } = useRouletteSettingsStore();
  const navigate = useNavigate();
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [showStats, setShowStats] = useState(false); // Estado para controlar exibição das estatísticas

  console.log(`[RouletteCard] Inicializando card para ${safeData.name} (${safeData.id}) com ${Array.isArray(safeData.lastNumbers) ? safeData.lastNumbers.length : 0} números`);

  // Função para alternar exibição de estatísticas
  const toggleStats = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowStats(!showStats);
  };

  // Função para processar um novo número em tempo real
  const processRealtimeNumber = (newNumberEvent: RouletteNumberEvent) => {
    // Logs para debug
    console.log(`[RouletteCard] Processando novo número para ${safeData.name}:`, newNumberEvent);
    
    // Ignorar atualizações muito frequentes (menos de 3 segundos entre elas)
    // exceto se estivermos ainda sem dados reais
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTime;
    const isInitialData = !hasRealData && (
      (Array.isArray(newNumberEvent.numero) && newNumberEvent.numero.length > 0) || 
      (typeof newNumberEvent.numero === 'number')
    );
    
    // Se não for dados iniciais e a atualização for muito recente, ignorar
    if (!isInitialData && timeSinceLastUpdate < 3000) {
      console.log(`[RouletteCard] Ignorando atualização muito frequente para ${safeData.name} (${timeSinceLastUpdate}ms)`);
      return;
    }
    
    // Verificar se é um array de números
    if (Array.isArray(newNumberEvent.numero)) {
      console.log(`[RouletteCard] Recebido array de números para ${safeData.name}:`, newNumberEvent.numero);
      
      // Extrair os números do array (verificando se são válidos)
      const validNumbers = newNumberEvent.numero
        .map(n => typeof n === 'object' && n !== null ? n.numero : n)
        .filter(n => typeof n === 'number' && !isNaN(n));
      
      if (validNumbers.length === 0) {
        console.warn('[RouletteCard] Array de números não contém valores válidos:', newNumberEvent);
        return;
      }
      
      // Verificar se já temos esses números no estado atual
      if (!isInitialData && validNumbers.every(num => recentNumbers.includes(num))) {
        console.log(`[RouletteCard] Ignorando números já conhecidos para ${safeData.name}`);
        return;
      }
      
      // Usar o primeiro número (mais recente) para update
      const newNumber = validNumbers[0];
      
      // Atualizar o último número apenas se for diferente do atual
      if (lastNumber !== newNumber) {
        setLastNumber(newNumber);
        setLastUpdateTime(now);
        setHasRealData(true);
        
        // Incrementar contador de atualizações apenas para novos números reais
        setUpdateCount(prev => prev + 1);
        
        // Ativar efeito visual de novo número
        setIsNewNumber(true);
        
        // Desativar efeito após 1.5 segundos
        setTimeout(() => {
          setIsNewNumber(false);
        }, 1500);
      }
      
      // Atualizar a lista de números recentes
      setRecentNumbers(prev => {
        // Verificar se prevNumbers é um array válido
        if (!Array.isArray(prev)) {
          return validNumbers;
        }
        
        // Verificar se há novos números (que não estejam na lista atual)
        const hasNewNumbers = validNumbers.some(num => !prev.includes(num));
        
        if (!hasNewNumbers) {
          return prev; // Não atualizar se não há números novos
        }
        
        // Combinar os novos números com os existentes, removendo duplicatas
        const combined = [...validNumbers];
        
        // Adicionar números antigos que não estão na nova lista
        prev.forEach(oldNum => {
          if (!combined.includes(oldNum)) {
            combined.push(oldNum);
          }
        });
        
        // Limitar a 26 números para exibição no card
        return combined.slice(0, 26);
      });
      
      // Notificações e som - apenas para novos números
      if (lastNumber !== newNumber) {
        if (enableSound && audioRef.current) {
          audioRef.current.play().catch(e => console.log('Erro ao tocar áudio:', e));
        }
        
        if (enableNotifications) {
          toast({
            title: `Novo número: ${newNumber}`,
            description: `${safeData.name}: ${newNumber}`,
            variant: "default"
          });
        }
      }
      
      return;
    }
    
    // Caso seja um número único (comportamento original)
    if (typeof newNumberEvent.numero !== 'number' || isNaN(newNumberEvent.numero)) {
      console.warn('[RouletteCard] Número inválido recebido:', newNumberEvent);
      return;
    }

    console.log(`[RouletteCard] Processando número ${newNumberEvent.numero} para ${safeData.name}`);
    const newNumber = newNumberEvent.numero;
    
    // Verificar se o número é realmente novo
    const isReallyNew = lastNumber !== newNumber && !recentNumbers.includes(newNumber);
    
    // Se não for novo e não estivermos sem dados, ignorar
    if (!isReallyNew && hasRealData) {
      console.log(`[RouletteCard] Ignorando número repetido ${newNumber} para ${safeData.name}`);
      return;
    }
    
    // Atualizar o último número
    setLastNumber(prevLastNumber => {
      // Se o número for igual ao último, não fazer nada
      if (prevLastNumber === newNumber) return prevLastNumber;
      
      console.log(`[RouletteCard] Atualizando último número de ${prevLastNumber} para ${newNumber}`);
      // Se for um número diferente, atualizar
      setLastUpdateTime(now);
      setHasRealData(true);
      return newNumber;
    });

    // Atualizar a lista de números recentes
    setRecentNumbers(prevNumbers => {
      // Verificar se prevNumbers é um array válido
      if (!Array.isArray(prevNumbers)) {
        console.warn('[RouletteCard] prevNumbers não é um array:', prevNumbers);
        return [newNumber]; // Retornar array só com o novo número
      }
      
      // Evitar duplicação do mesmo número em sequência
      if (prevNumbers.length > 0 && prevNumbers[0] === newNumber) {
        return prevNumbers;
      }
      
      console.log(`[RouletteCard] Adicionando ${newNumber} à lista de números recentes`);
      // Adicionar o novo número ao início e manter até 26 números
      return [newNumber, ...prevNumbers].slice(0, 26);
    });

    // Incrementar contador apenas para novos números
    if (isReallyNew) {
      setUpdateCount(prev => prev + 1);
      
      // Ativar efeito visual de novo número
      setIsNewNumber(true);
      
      // Tocar som se habilitado
      if (enableSound && audioRef.current) {
        audioRef.current.play().catch(e => console.log('Erro ao tocar áudio:', e));
      }
      
      // Mostrar notificação se habilitado
      if (enableNotifications) {
        toast({
          title: `Novo número: ${newNumber}`,
          description: `${safeData.name}: ${newNumber}`,
          variant: "default"
        });
      }
      
      // Desativar efeito após 1.5 segundos
      setTimeout(() => {
        setIsNewNumber(false);
      }, 1500);
    }
  };

  // Efeito para se inscrever nos eventos de atualização de dados do feed service
  useEffect(() => {
    const handleDataUpdated = (updateData: any) => {
      // Obter dados mais recentes do cache do feedService
      const freshData = feedService.getRouletteData(safeData.id);
      
      if (freshData) {
        // Se encontrarmos dados novos no cache, processá-los
        const newNumbers = Array.isArray(freshData.numero) 
          ? freshData.numero 
          : Array.isArray(freshData.numero) 
            ? freshData.numero 
            : [];
          
        if (newNumbers.length > 0) {
          // Verificar se temos números novos comparando com os que já temos
          const existingNumbers = recentNumbers;
          
          if (newNumbers.length !== existingNumbers.length) {
            console.log(`[RouletteCard] Atualizando números para ${safeData.name} a partir do cache centralizado`);
            
            // Converter para o formato esperado pelo processador de eventos
            const numberEvent: RouletteNumberEvent = {
              type: 'new_number',
              roleta_id: safeData.id,
              roleta_nome: safeData.name,
              numero: newNumbers.map(n => typeof n === 'object' ? n.numero : n),
              timestamp: new Date().toISOString()
            };
            
            // Processar os novos números
            processRealtimeNumber(numberEvent);
          }
        }
      }
    };
    
    // Inscrever-se nos eventos do feed service
    EventService.on('roulette:data-updated', handleDataUpdated);
    
    // Fazer uma verificação inicial para pegar os dados mais recentes
    const initialData = feedService.getRouletteData(safeData.id);
    if (initialData) {
      handleDataUpdated({timestamp: new Date().toISOString()});
    }
    
    // Limpeza ao desmontar
    return () => {
      EventService.off('roulette:data-updated', handleDataUpdated);
    };
  }, [feedService, safeData.id, safeData.name, recentNumbers]);
  
  // Ao montar o componente, verificar dados no cache em vez de fazer novas requisições
  useEffect(() => {
    // Verificar se já temos dados no cache ou se há números disponíveis nos dados da roleta
    if (recentNumbers.length === 0) {
      // Primeiro verificar se temos números diretamente nos dados da roleta
      if (safeData.numbers && Array.isArray(safeData.numbers) && safeData.numbers.length > 0) {
        console.log(`[RouletteCard] Usando números da propriedade .numbers para ${safeData.name}`);
        
        // Extrair os números do array de números
        const extractedNumbers = safeData.numbers
          .map(n => typeof n === 'object' && n !== null ? (n.number || n.numero) : n)
          .filter(n => typeof n === 'number' && !isNaN(n));
        
        if (extractedNumbers.length > 0) {
          setLastNumber(extractedNumbers[0]);
          setRecentNumbers(extractedNumbers);
          setHasRealData(true);
          return;
        }
      }
      
      // Verificar os dados no cache da roleta como fallback
      const cachedData = feedService.getRouletteData(safeData.id);
      
      if (cachedData && Array.isArray(cachedData.numero) && cachedData.numero.length > 0) {
        console.log(`[RouletteCard] Usando dados do cache para ${safeData.name}`);
        
        // Extrair os números do format de objeto
        const numbers = cachedData.numero.map(n => 
          typeof n === 'object' ? n.numero : n
        ).filter(n => typeof n === 'number' && !isNaN(n));
        
        if (numbers.length > 0) {
          setLastNumber(numbers[0]);
          setRecentNumbers(numbers);
          setHasRealData(true);
        }
      }
      // Removendo a solicitação direta para evitar múltiplas requisições
      // Agora apenas o LiveRoulettePage inicializará o serviço
    }
  }, [feedService, safeData.id, safeData.name, safeData.numbers, recentNumbers]);

  // Função de callback para processar atualizações recebidas do serviço
  const handleRouletteUpdate = useCallback((updatedData: any) => {
    console.log(`[RouletteCard] handleRouletteUpdate chamado para ${safeData.name}`, updatedData);
    
    if (!updatedData || !safeData || !safeData.id) {
      return; // Ignorar dados inválidos
    }
    
    // Ver se os dados são um array ou um objeto único
    if (Array.isArray(updatedData)) {
      // Encontrar dados específicos para esta roleta no array
      const roletaData = updatedData.find((r: any) => 
        r.id === safeData.id || 
        r._id === safeData.id ||
        r.name === safeData.name ||
        r.nome === safeData.name
      );
      
      if (roletaData) {
        processRouletteData(roletaData);
      }
    } else if (typeof updatedData === 'object' && updatedData !== null) {
      // Se for um objeto (roleta única), verificar se é para esta roleta
      if (
        updatedData.id === safeData.id ||
        updatedData._id === safeData.id ||
        updatedData.name === safeData.name ||
        updatedData.nome === safeData.name
      ) {
        processRouletteData(updatedData);
      }
    }
    
    // Função para processar os dados de uma roleta
    function processRouletteData(roletaData: any) {
      console.log(`[RouletteCard] Processando dados para ${safeData.name}:`, roletaData);
      
      // Processar números recebidos
      if (Array.isArray(roletaData.numero) && roletaData.numero.length > 0) {
        // Extrair números do array de objetos
        const extractedNumbers = roletaData.numero.map(item => {
          if (typeof item === 'object' && item !== null && 'numero' in item) {
            return item.numero;
          }
          return typeof item === 'number' ? item : null;
        }).filter(num => num !== null && !isNaN(num as number));
        
        console.log(`[RouletteCard] Números extraídos para ${safeData.name}:`, extractedNumbers);
        
        if (extractedNumbers.length === 0) {
          return; // Sem números válidos
        }
        
        // Verificar se temos números novos
        const newLastNumber = extractedNumbers[0] as number;
        const hasNewLastNumber = newLastNumber !== lastNumber;
        
        if (hasNewLastNumber) {
          console.log(`[RouletteCard] Atualizando último número para ${safeData.name}: ${lastNumber} -> ${newLastNumber}`);
          setLastNumber(newLastNumber);
          setLastUpdateTime(Date.now());
          
          // Ativar efeito visual de novo número
          setIsNewNumber(true);
          setTimeout(() => setIsNewNumber(false), 1500);
          
          // Incrementar contador de atualizações
          setUpdateCount(prev => prev + 1);
        }
        
        // Atualizar a lista completa de números recentes
        setRecentNumbers(prev => {
          // Verificar se temos números novos para evitar renderizações desnecessárias
          const currentFirstNumber = prev.length > 0 ? prev[0] : null;
          const newFirstNumber = extractedNumbers[0];
          
          if (currentFirstNumber === newFirstNumber && prev.length >= extractedNumbers.length) {
            // Se o primeiro número é o mesmo e temos pelo menos a mesma quantidade de números,
            // provavelmente não há atualização real
            return prev;
          }
          
          // Combinar números novos com existentes, sem duplicatas, limitando ao tamanho máximo
          const combinedNumbers = [...extractedNumbers];
          
          // Adicionar números antigos que não estão na nova lista
          prev.forEach(oldNum => {
            if (!combinedNumbers.includes(oldNum)) {
              combinedNumbers.push(oldNum);
            }
          });
          
          // Limitar a 26 números para exibição
          const limitedNumbers = combinedNumbers.slice(0, 26);
          console.log(`[RouletteCard] Lista de números atualizada para ${safeData.name}:`, limitedNumbers);
          return limitedNumbers;
        });
        
        // Definir que temos dados reais
        setHasRealData(true);
      }
    }
  }, [safeData, lastNumber]);

  // Inscrever para receber atualizações quando o componente montar
  useEffect(() => {
    if (feedService && safeData && safeData.id) {
      console.log(`[RouletteCard] Inscrevendo para atualizações em tempo real: ${safeData.name}`);
      feedService.subscribe(handleRouletteUpdate);
      
      // Limpar inscrição quando componente desmontar
      return () => {
        console.log(`[RouletteCard] Cancelando inscrição de atualizações: ${safeData.name}`);
        feedService.unsubscribe(handleRouletteUpdate);
      };
    }
  }, [feedService, safeData, handleRouletteUpdate]);

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
          <h3 className="text-lg font-semibold truncate">{safeData.name}</h3>
          <div className="flex gap-1 items-center">
            <Badge variant="outline" className="bg-muted text-xs">
              {updateCount > 0 ? `${updateCount} atualizações` : (hasRealData || recentNumbers.length > 0 ? "Aguardando..." : "Sem dados")}
            </Badge>
            
            {/* Botão para abrir modal de estatísticas */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleStats}
              className="h-7 w-7" 
              title="Ver estatísticas detalhadas"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Número atual - Removido para que não apareça em tamanho grande */}
        <div className="my-4"></div>
        
        {/* Últimos números - Mostrando todos com o mesmo tamanho */}
        <div className="flex flex-wrap gap-1 justify-center my-3">
          {recentNumbers.slice(0, 26).map((num, idx) => (
            <NumberDisplay 
              key={`${num}-${idx}`}
              number={num} 
              size="small" 
              highlight={idx === 0 && isNewNumber}
            />
          ))}
        </div>
        
        {/* Botões de ação */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline" 
              size="sm"
              className="bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300"
              onClick={toggleStats}
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              <span className="text-xs">Estatísticas</span>
            </Button>
          </div>
          
          <div className="flex items-center text-xs text-gray-400">
            <Timer className="h-3 w-3 mr-1" />
            <span>
              {updateCount > 0 ? `${updateCount} atualizações` : (recentNumbers.length > 0 ? 'Aguardando...' : 'Sem atualizações')}
            </span>
          </div>
        </div>
      </CardContent>

      {/* Painel de estatísticas */}
      {showStats && (
        <div className="mt-4 bg-gray-800 p-3 rounded-lg border border-gray-700">
          <h3 className="text-sm font-medium text-green-500 mb-2 flex items-center">
            <BarChart3 className="h-3 w-3 mr-1" />
            Estatísticas
          </h3>
          
          {/* Grid de estatísticas */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Contadores */}
            <div className="bg-gray-900 p-2 rounded">
              <div className="text-gray-400">Vermelho</div>
              <div className="text-white font-medium">
                {recentNumbers.filter(n => [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n)).length}
              </div>
            </div>
            <div className="bg-gray-900 p-2 rounded">
              <div className="text-gray-400">Preto</div>
              <div className="text-white font-medium">
                {recentNumbers.filter(n => n !== 0 && ![1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n)).length}
              </div>
            </div>
            <div className="bg-gray-900 p-2 rounded">
              <div className="text-gray-400">Par</div>
              <div className="text-white font-medium">
                {recentNumbers.filter(n => n !== 0 && n % 2 === 0).length}
              </div>
            </div>
            <div className="bg-gray-900 p-2 rounded">
              <div className="text-gray-400">Ímpar</div>
              <div className="text-white font-medium">
                {recentNumbers.filter(n => n % 2 === 1).length}
              </div>
            </div>
            <div className="bg-gray-900 p-2 rounded">
              <div className="text-gray-400">1-18</div>
              <div className="text-white font-medium">
                {recentNumbers.filter(n => n >= 1 && n <= 18).length}
              </div>
            </div>
            <div className="bg-gray-900 p-2 rounded">
              <div className="text-gray-400">19-36</div>
              <div className="text-white font-medium">
                {recentNumbers.filter(n => n >= 19 && n <= 36).length}
              </div>
            </div>
          </div>
          
          {/* Últimos 8 números em linha */}
          <div className="mt-3">
            <div className="text-xs text-gray-400 mb-1">Últimos 8 números</div>
            <div className="flex flex-wrap gap-1">
              {recentNumbers.slice(0, 8).map((num, idx) => {
                const bgColor = num === 0 
                  ? "bg-green-600" 
                  : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num)
                    ? "bg-red-600"
                    : "bg-black";
                
                return (
                  <div 
                    key={idx} 
                    className={`${bgColor} text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium`}
                  >
                    {num}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Link para estatísticas completas */}
          <button 
            onClick={() => setIsStatsModalOpen(true)}
            className="mt-3 text-xs text-green-500 hover:text-green-400 flex items-center"
          >
            <PieChart className="h-3 w-3 mr-1" />
            Ver estatísticas completas
          </button>
        </div>
      )}
      
      {/* Modal de estatísticas completas */}
      <div className={`fixed inset-0 z-50 ${isStatsModalOpen ? 'flex' : 'hidden'} items-center justify-center bg-black/70`}>
        <div className="bg-gray-900 w-11/12 max-w-6xl h-[90vh] rounded-lg overflow-y-auto">
          <div className="flex justify-between items-center p-4 border-b border-gray-800">
            <h2 className="text-[#00ff00] text-xl font-bold">Estatísticas da {safeData.name}</h2>
            <button 
              onClick={() => setIsStatsModalOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4">
            <RouletteSidePanelStats
              roletaNome={safeData.name}
              lastNumbers={recentNumbers}
              wins={0}
              losses={0}
            />
          </div>
        </div>
      </div>
    </Card>
  );
};

// Funções auxiliares para inicialização segura dos dados
function getInitialLastNumber(data: any): number | null {
  try {
    // Verificar se temos lastNumbers
    if (Array.isArray(data.lastNumbers) && data.lastNumbers.length > 0) {
      const number = data.lastNumbers[0];
      return typeof number === 'number' ? number : null;
    }
    
    // Verificar se temos a propriedade 'numero' que pode ser um array
    if (Array.isArray(data.numero) && data.numero.length > 0) {
      const firstItem = data.numero[0];
      
      // Verificar se o primeiro item é um objeto com propriedade 'numero'
      if (typeof firstItem === 'object' && firstItem !== null && 'numero' in firstItem) {
        return typeof firstItem.numero === 'number' ? firstItem.numero : null;
      }
      
      // Ou se é um número diretamente
      return typeof firstItem === 'number' ? firstItem : null;
    }
    
    return null;
  } catch (error) {
    console.error('[RouletteCard] Erro ao processar número inicial:', error);
    return null;
  }
}

function getInitialRecentNumbers(data: any): number[] {
  try {
    // Verificar se temos algum array de números disponível
    if (Array.isArray(data.lastNumbers) && data.lastNumbers.length > 0) {
      return data.lastNumbers.slice(0, 20).filter(n => typeof n === 'number');
    }
    
    // Verificar se temos a propriedade 'numero' que pode ser um array
    if (Array.isArray(data.numero) && data.numero.length > 0) {
      // Verificar se os elementos são objetos com propriedade 'numero' ou números diretos
      return data.numero
        .map(n => {
          if (typeof n === 'object' && n !== null && 'numero' in n) {
            return n.numero;
          }
          return typeof n === 'number' ? n : null;
        })
        .filter(n => n !== null && !isNaN(n))
        .slice(0, 20);
    }
    
    // Se não encontramos nenhum número, retornar array vazio
    return [];
  } catch (error) {
    console.error('[RouletteCard] Erro ao processar números iniciais:', error);
    return [];
  }
}

export default RouletteCard;