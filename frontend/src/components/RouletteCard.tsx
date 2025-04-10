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
import axios from 'axios';

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

// Gerenciador global de dados de roletas - usando singleton pattern
class GlobalRouletteDataManager {
  private static instance: GlobalRouletteDataManager;
  private data: any[] = [];
  private lastUpdate: number = 0;
  private updateCallbacks: Map<string, (data: any) => void> = new Map();
  private fetchPromise: Promise<any> | null = null;
  private intervalId: NodeJS.Timeout | null = null;

  private constructor() {
    // Iniciar polling imediatamente
    this.startPolling();
  }

  public static getInstance(): GlobalRouletteDataManager {
    if (!GlobalRouletteDataManager.instance) {
      GlobalRouletteDataManager.instance = new GlobalRouletteDataManager();
      console.log('[GlobalRouletteService] Inicializando serviço global de roletas');
    }
    return GlobalRouletteDataManager.instance;
  }

  // Registrar um componente para receber atualizações
  public subscribe(id: string, callback: (data: any) => void): () => void {
    console.log(`[GlobalRouletteService] Novo assinante registrado: ${id}`);
    this.updateCallbacks.set(id, callback);
    
    // Se já temos dados, notificar imediatamente
    if (this.data.length > 0) {
      callback(this.data);
    } else if (!this.fetchPromise) {
      // Forçar uma atualização se não estiver buscando dados ainda
      this.fetchData();
    }
    
    // Retornar função para cancelar inscrição
    return () => {
      this.updateCallbacks.delete(id);
      console.log(`[GlobalRouletteService] Assinante removido: ${id}`);
    };
  }

  // Buscar dados de todas as roletas
  private async fetchData(): Promise<any[]> {
    // Se já estamos buscando dados, retornar a Promise existente
    if (this.fetchPromise) {
      return this.fetchPromise;
    }
    
    console.log('[GlobalRouletteService] Buscando dados atualizados da API');
    
    try {
      // Criar nova promise
      this.fetchPromise = fetch('/api/ROULETTES')
        .then(response => {
          if (!response.ok) {
            throw new Error(`Erro na API: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          if (!data || !Array.isArray(data)) {
            throw new Error('Resposta da API inválida');
          }
          
          // Atualizar dados e timestamp
          this.data = data;
          this.lastUpdate = Date.now();
          
          // Notificar todos os assinantes
          this.notifySubscribers();
          
          return data;
        })
        .catch(error => {
          console.error('[GlobalRouletteService] Erro ao buscar dados:', error);
          return this.data; // Retornar dados antigos em caso de erro
        })
        .finally(() => {
          this.fetchPromise = null;
        });
      
      return this.fetchPromise;
    } catch (error) {
      console.error('[GlobalRouletteService] Erro ao iniciar requisição:', error);
      this.fetchPromise = null;
      return this.data;
    }
  }
  
  // Notificar todos os assinantes sobre novos dados
  private notifySubscribers(): void {
    if (this.updateCallbacks.size > 0) {
      console.log(`[GlobalRouletteService] Notificando ${this.updateCallbacks.size} assinantes`);
      this.updateCallbacks.forEach(callback => {
        try {
          callback(this.data);
        } catch (error) {
          console.error('[GlobalRouletteService] Erro ao notificar assinante:', error);
        }
      });
    }
  }
  
  // Iniciar polling para atualizações periódicas
  private startPolling(interval = 8000): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    // Buscar dados imediatamente
    this.fetchData();
    
    // Configurar intervalo
    this.intervalId = setInterval(() => {
      this.fetchData();
    }, interval);
    
    console.log(`[GlobalRouletteService] Polling iniciado com intervalo de ${interval}ms`);
  }
  
  // Parar polling
  public stopPolling(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[GlobalRouletteService] Polling parado');
    }
  }
  
  // Obter dados mais recentes (sem garantia de atualização)
  public getData(): any[] {
    return this.data;
  }
  
  // Obter timestamp da última atualização
  public getLastUpdateTime(): number {
    return this.lastUpdate;
  }
}

interface RouletteCardProps {
  data: RouletteData;
  isDetailView?: boolean;
}

const RouletteCard: React.FC<RouletteCardProps> = ({ data, isDetailView = false }) => {
  // Estados
  const [lastNumber, setLastNumber] = useState<number | null>(null);
  const [recentNumbers, setRecentNumbers] = useState<number[]>([]);
  const [allNumbers, setAllNumbers] = useState<number[]>([]); // Array com todos os números, sem limite
  const [isNewNumber, setIsNewNumber] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const [updateCount, setUpdateCount] = useState(0);
  const [hasRealData, setHasRealData] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [rawRouletteData, setRawRouletteData] = useState<any>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [allRoulettesData, setAllRoulettesData] = useState<any[]>([]);
  
  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Hooks
  const navigate = useNavigate();
  const { enableSound, enableNotifications } = useRouletteSettingsStore();
  
  // Dados iniciais seguros
  const safeData = {
    id: data?.id || data?._id || 'unknown',
    name: data?.name || data?.nome || 'Roleta sem nome',
  };
  
  // ID único para este componente
  const componentId = useRef(`roulette-${safeData.id}-${Math.random().toString(36).substring(2, 9)}`).current;
  
  // Referência ao gerenciador global
  const dataManager = useMemo(() => GlobalRouletteDataManager.getInstance(), []);
  
  // Função para lidar com atualizações de dados
  const handleDataUpdate = useCallback((allRoulettes: any[]) => {
    if (!allRoulettes || !Array.isArray(allRoulettes) || allRoulettes.length === 0) return;
    
    // Armazenar todas as roletas
    setAllRoulettesData(allRoulettes);
    
    // Encontrar a roleta específica pelo ID ou nome
    const myRoulette = allRoulettes.find((roulette: any) => 
      roulette.id === safeData.id || 
      roulette._id === safeData.id || 
      roulette.name === safeData.name || 
      roulette.nome === safeData.name
    );
    
    if (!myRoulette) {
      console.warn(`[${componentId}] Roleta com ID ${safeData.id} não encontrada na resposta`);
      return;
    }
    
    // Salvar dados brutos para uso posterior
    setRawRouletteData(myRoulette);
    
    // Processar os dados da roleta
    processApiData(myRoulette);
    
    // Atualizar timestamp e contador
    setLastUpdateTime(Date.now());
    setUpdateCount(prev => prev + 1);
    setError(null);
    setLoading(false);
  }, [safeData.id, safeData.name]);
  
  // Efeito para iniciar a busca de dados
  useEffect(() => {
    // Configurar loading inicial
    setLoading(true);
    
    // Assinar atualizações do gerenciador global
    const unsubscribe = dataManager.subscribe(componentId, handleDataUpdate);
    
    // Limpar inscrição ao desmontar o componente
    return () => {
      unsubscribe();
    };
  }, [dataManager, componentId, handleDataUpdate]);
  
  // Função para verificar e processar números novos da API
  const processApiData = (apiRoulette: any) => {
    if (!apiRoulette) return false;
    
    // Extrair números da API
    const apiNumbers = extractNumbers(apiRoulette);
    if (apiNumbers.length === 0) return false;
    
    // Caso 1: Não temos números ainda - inicializar com os da API
    if (allNumbers.length === 0) {
      console.log(`[${Date.now()}] Inicializando números para ${safeData.name} (${apiNumbers.length} números)`);
      setAllNumbers(apiNumbers);
      setRecentNumbers(apiNumbers.slice(0, 20));
      setLastNumber(apiNumbers[0]);
      setHasRealData(true);
      return true;
    }
    
    // Caso 2: Verificar se o último número da API é diferente do nosso
    if (apiNumbers[0] === allNumbers[0]) {
      // Nenhum número novo
      return false;
    }
    
    // Caso 3: Temos números novos na API
    // Procurar por números novos que ainda não estão na nossa lista
    const newNumbers = [];
    
    // Percorrer a lista da API até encontrar um número que já temos
    for (let i = 0; i < apiNumbers.length; i++) {
      const apiNum = apiNumbers[i];
      
      // Se encontramos um número que já está na nossa lista, paramos
      if (allNumbers.includes(apiNum)) {
        break;
      }
      
      // Adicionar o número novo à nossa lista temporária
      newNumbers.push(apiNum);
    }
    
    // Se encontramos números novos, atualizamos o estado
    if (newNumbers.length > 0) {
      console.log(`[${Date.now()}] ${newNumbers.length} novos números para ${safeData.name}: ${newNumbers.join(', ')}`);
      
      // Adicionar os novos números no início da nossa lista
      const updatedAllNumbers = [...newNumbers, ...allNumbers];
      
      // Atualizar estados
      setAllNumbers(updatedAllNumbers);
      setRecentNumbers(updatedAllNumbers.slice(0, 20));
      setLastNumber(newNumbers[0]);
      setHasRealData(true);
      setIsNewNumber(true);
      
      // Mostrar notificação para o primeiro novo número
      showNumberNotification(newNumbers[0]);
      
      // Resetar a animação após 2 segundos
      setTimeout(() => {
        setIsNewNumber(false);
      }, 2000);
      
      return true;
    }
    
    return false;
  };

  // Função para extrair números da resposta da API
  const extractNumbers = (apiData: any): number[] => {
    // Array para armazenar os números
    let extractedNumbers: number[] = [];
    
    try {
      // A estrutura principal tem um campo "numero" que é um array de objetos
      if (apiData && Array.isArray(apiData.numero) && apiData.numero.length > 0) {
        console.log(`Extraindo números a partir do campo 'numero' para ${safeData.name}`);
        
        // Mapear cada objeto do array para extrair o número
        extractedNumbers = apiData.numero
          .map((item: any) => {
            // Cada item deve ter uma propriedade 'numero'
            if (item && typeof item === 'object' && 'numero' in item) {
              return typeof item.numero === 'number' ? item.numero : parseInt(item.numero);
            }
            return null;
          })
          .filter((n: any) => n !== null && !isNaN(n));
      } 
      // Outros formatos de dados possíveis como fallback
      else if (Array.isArray(apiData.lastNumbers) && apiData.lastNumbers.length > 0) {
        extractedNumbers = apiData.lastNumbers
          .map((n: any) => typeof n === 'number' ? n : (typeof n === 'object' && n?.numero ? n.numero : null))
          .filter((n: any) => n !== null && !isNaN(n));
      } else if (Array.isArray(apiData.numeros) && apiData.numeros.length > 0) {
        extractedNumbers = apiData.numeros
          .map((n: any) => typeof n === 'number' ? n : (typeof n === 'object' && n?.numero ? n.numero : null))
          .filter((n: any) => n !== null && !isNaN(n));
      } else if (Array.isArray(apiData.numbers) && apiData.numbers.length > 0) {
        extractedNumbers = apiData.numbers
          .map((n: any) => {
            if (typeof n === 'object' && n) {
              return n.numero || n.number || n.value;
            }
            return typeof n === 'number' ? n : null;
          })
          .filter((n: any) => n !== null && !isNaN(n));
      }
      
      // Se não encontramos números em nenhum dos formatos, log de aviso
      if (extractedNumbers.length === 0) {
        console.warn(`Não foi possível extrair números para ${safeData.name}. Estrutura de dados:`, apiData);
      } else {
        console.log(`Extraídos ${extractedNumbers.length} números para ${safeData.name}:`, extractedNumbers.slice(0, 5));
      }
    } catch (err) {
      console.error(`Erro ao extrair números para ${safeData.name}:`, err);
    }
    
    return extractedNumbers;
  };
  
  // Função para mostrar notificação de novo número
  const showNumberNotification = useCallback((newNumber: number) => {
    if (newNumber === undefined || newNumber === null) return;
    
    // Obter cor do número a partir dos dados da API
    let color = 'cinza';
    
    if (rawRouletteData && rawRouletteData.numero && rawRouletteData.numero.length > 0) {
      const matchingNumber = rawRouletteData.numero.find((n: any) => n.numero === newNumber);
      if (matchingNumber && matchingNumber.cor) {
        color = matchingNumber.cor.toLowerCase();
      }
    }
    
    // Mostrar notificação
    setToastVisible(true);
    setToastMessage(`Novo número: ${newNumber} (${color})`);
    setTimeout(() => setToastVisible(false), 3000);
    
  }, [rawRouletteData]);
  
  // Função para alternar exibição de estatísticas
  const toggleStats = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowStats(!showStats);
  };
  
  // Função para abrir detalhes da roleta
  const handleCardClick = () => {
    if (!isDetailView) {
      navigate(`/roleta/${safeData.id}`);
    }
  };
  
  // Formatar tempo relativo
  const getTimeAgo = () => {
    const seconds = Math.floor((Date.now() - lastUpdateTime) / 1000);
    if (seconds < 60) return `${seconds}s atrás`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s atrás`;
  };
  
  // Determinar a cor do número
  const getNumberColor = (num: number): string => {
    if (num === 0) return 'verde';
    
    // Números vermelhos na roleta europeia
    const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return numerosVermelhos.includes(num) ? 'vermelho' : 'preto';
  };

  return (
    <Card 
      ref={cardRef}
      className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-md cursor-pointer", 
        isNewNumber ? "border-green-500 shadow-green-200 animate-pulse" : "",
        isDetailView ? "w-full" : "w-full"
      )}
      onClick={handleCardClick}
    >
      {/* Reprodutor de áudio (invisível) */}
      <audio ref={audioRef} src="/sounds/coin.mp3" preload="auto" />
      
      <CardContent className="p-4">
        {/* Cabeçalho */}
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold truncate">{safeData.name}</h3>
          <div className="flex gap-1 items-center">
            <Badge variant={hasRealData ? "success" : "secondary"} className="text-xs">
              {loading ? "Atualizando..." : (hasRealData ? "Online" : "Sem dados")}
            </Badge>
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleStats}
              className="h-7 w-7" 
              title="Ver estatísticas"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Último número (grande) */}
        {lastNumber !== null ? (
          <div className="flex justify-center my-4">
            <div 
              className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold
                ${getNumberColor(lastNumber) === 'vermelho' ? 'bg-red-600' : 
                  getNumberColor(lastNumber) === 'preto' ? 'bg-black' : 'bg-green-600'}`}
            >
              {lastNumber}
            </div>
          </div>
        ) : (
          <div className="flex justify-center my-4">
            <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-gray-500 text-xl">
              {loading ? "..." : "?"}
            </div>
          </div>
        )}
        
        {/* Números recentes */}
        <div className="flex flex-wrap gap-1 justify-center my-3">
          {recentNumbers.length > 0 ? (
            recentNumbers.slice(0, 20).map((num, idx) => (
            <NumberDisplay 
              key={`${num}-${idx}`}
              number={num} 
              size="small" 
              highlight={idx === 0 && isNewNumber}
            />
            ))
          ) : (
            <div className="text-center text-gray-500 py-2">
              {loading ? "Carregando números..." : "Nenhum número disponível"}
            </div>
          )}
        </div>
        
        {/* Rodapé */}
        <div className="mt-3 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline" 
              size="sm"
              className="h-7 py-0 px-2"
              onClick={toggleStats}
            >
              <BarChart3 className="h-3 w-3 mr-1" />
              <span className="text-xs">Estatísticas</span>
            </Button>
          </div>
          
          <div className="flex items-center text-xs text-gray-400">
            <Timer className="h-3 w-3 mr-1" />
            <span>
              {hasRealData 
                ? `Atualizado ${getTimeAgo()}` 
                : (loading ? "Carregando..." : "Aguardando dados")}
            </span>
          </div>
        </div>
        
        {/* Indicador de sincronização */}
        <div className="mt-2 text-xs text-center text-gray-500 border-t border-gray-100 pt-1">
          Sincroniza automaticamente a cada 8s ({updateCount} atualizações)
        </div>
      </CardContent>

      {/* Painel de estatísticas */}
      {showStats && (
        <div className="mt-0 px-4 pb-4">
          <div className="bg-gray-100 p-3 rounded-lg border border-gray-200">
            <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center">
            <BarChart3 className="h-3 w-3 mr-1" />
            Estatísticas
          </h3>
          
          {/* Grid de estatísticas */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Contadores */}
              <div className="bg-white p-2 rounded shadow-sm">
                <div className="text-gray-500">Vermelho</div>
                <div className="text-gray-900 font-medium">
                {recentNumbers.filter(n => [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n)).length}
              </div>
            </div>
              <div className="bg-white p-2 rounded shadow-sm">
                <div className="text-gray-500">Preto</div>
                <div className="text-gray-900 font-medium">
                {recentNumbers.filter(n => n !== 0 && ![1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n)).length}
              </div>
            </div>
              <div className="bg-white p-2 rounded shadow-sm">
                <div className="text-gray-500">Par</div>
                <div className="text-gray-900 font-medium">
                {recentNumbers.filter(n => n !== 0 && n % 2 === 0).length}
              </div>
            </div>
              <div className="bg-white p-2 rounded shadow-sm">
                <div className="text-gray-500">Ímpar</div>
                <div className="text-gray-900 font-medium">
                {recentNumbers.filter(n => n % 2 === 1).length}
              </div>
            </div>
          </div>
          
          {/* Link para estatísticas completas */}
          <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsStatsModalOpen(true);
              }}
              className="mt-3 text-xs text-blue-600 hover:text-blue-800 flex items-center"
          >
            <PieChart className="h-3 w-3 mr-1" />
            Ver estatísticas completas
          </button>
          </div>
        </div>
      )}
      
      {/* Modal de estatísticas completas */}
      <div className={`fixed inset-0 z-50 ${isStatsModalOpen ? 'flex' : 'hidden'} items-center justify-center bg-black/70`}>
        <div className="bg-white w-11/12 max-w-6xl h-[90vh] rounded-lg overflow-y-auto">
          <div className="flex justify-between items-center p-4 border-b border-gray-200">
            <h2 className="text-xl font-bold">Estatísticas da {safeData.name}</h2>
            <button 
              onClick={() => setIsStatsModalOpen(false)}
              className="text-gray-500 hover:text-gray-700"
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