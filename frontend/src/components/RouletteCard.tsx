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
        ? data.numero 
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
    Array.isArray(safeData.lastNumbers) && safeData.lastNumbers.length > 0 
      ? Number(safeData.lastNumbers[0]) 
      : null
  );
  
  const [recentNumbers, setRecentNumbers] = useState<number[]>(
    Array.isArray(safeData.lastNumbers) 
      ? safeData.lastNumbers.map(n => Number(n)) 
      : []
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
        
        // Limitar a 20 números para exibição no card (antes era 1000)
        return combined.slice(0, 39);
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
      // Adicionar o novo número ao início e manter até 20 números (antes era 1000)
      return [newNumber, ...prevNumbers].slice(0, 20);
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

  // IMPORTANTE: Garantir inscrição correta no evento global de números
  useEffect(() => {
    if (!safeData.id) {
      console.warn('[RouletteCard] ID da roleta inválido, não é possível se inscrever em eventos');
      return;
    }

    console.log(`[RouletteCard] Inscrevendo para eventos da roleta: ${safeData.name} (${safeData.id})`);
    
    // Função para processar novos números
    const handleNewNumber = (event: RouletteNumberEvent) => {
      // Verificar se o evento pertence a esta roleta específica
      // Comparar todos os identificadores possíveis para maior segurança
      const eventId = String(event.roleta_id || '');
      const cardId = String(safeData.id || '');
      const cardName = String(safeData.name || '').toLowerCase();
      const eventName = String(event.roleta_nome || '').toLowerCase();
      
      const matchesId = eventId === cardId;
      const matchesName = cardName && eventName && cardName === eventName;
      
      if (matchesId || matchesName) {
        console.log(`[RouletteCard] Evento de número corresponde a esta roleta (${safeData.name})`, event);
        processRealtimeNumber(event);
      } else {
        console.log(`[RouletteCard] Ignorando evento para outra roleta: ${event.roleta_nome} (${event.roleta_id})`);
      }
    };
    
    // Inscrição para receber qualquer atualização de número novo
    EventService.getInstance().subscribe('new_number', handleNewNumber);
    
    // Se inscrever diretamente no canal desta roleta específica
    if (safeData.name) {
      EventService.getInstance().subscribe(safeData.name, handleNewNumber);
    }
    
    // Inicializar o RouletteFeedService - será gerenciado globalmente
    if (safeData.id) {
      const rouletteFeedService = RouletteFeedService.getInstance();
      // Não precisa iniciar o serviço aqui, ele é iniciado na página principal
    }

    return () => {
      // Limpar inscrições ao desmontar
      EventService.getInstance().unsubscribe('new_number', handleNewNumber);
      if (safeData.name) {
        EventService.getInstance().unsubscribe(safeData.name, handleNewNumber);
      }
    };
  }, [safeData.id, safeData.name]);

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
              {updateCount > 0 ? `${updateCount} atualizações` : (hasRealData ? "Aguardando..." : "Sem dados")}
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
          {recentNumbers.slice(0, isDetailView ? 40 : 10).map((num, idx) => (
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
              {updateCount > 0 ? `${updateCount} atualizações` : 'Sem atualizações'}
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

export default RouletteCard;