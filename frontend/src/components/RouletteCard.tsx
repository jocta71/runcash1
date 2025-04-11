import { TrendingUp, Eye, EyeOff, Target, Star, RefreshCw, ArrowUp, ArrowDown, Loader2, HelpCircle, BarChart3, ChevronDown } from 'lucide-react';
import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { toast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import RouletteSidePanelStats from './RouletteSidePanelStats';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from "@/components/ui/card";
import { RouletteData, RouletteNumberEvent } from '@/types';
import NumberDisplay from './NumberDisplay';
import { Badge } from "@/components/ui/badge";
import { PieChart, Phone, Timer, Cpu, Zap, History } from "lucide-react";
import { useRouletteSettingsStore } from '@/stores/routleteStore';
import { cn } from '@/lib/utils';
import { fetchWithCorsSupport } from '@/utils/api-helpers';
import globalRouletteDataService from '@/services/GlobalRouletteDataService';

// Debug flag - set to false to disable logs in production
const DEBUG_ENABLED = false;

// Helper function for controlled logging
const debugLog = (...args: any[]) => {
  if (DEBUG_ENABLED) {
    console.log(...args);
  }
};

// Modificando a classe GlobalRouletteDataManager para usar o serviço global
class GlobalRouletteDataManager {
  private static instance: GlobalRouletteDataManager | null = null;
  private updateCallbacks: Map<string, (data: any) => void> = new Map();
  private initialDataLoaded: boolean = false;
  
  private constructor() {
    console.log('[RouletteCard] Inicializando gerenciador de dados');
  }
  
  public static getInstance(): GlobalRouletteDataManager {
    if (!GlobalRouletteDataManager.instance) {
      GlobalRouletteDataManager.instance = new GlobalRouletteDataManager();
    }
    return GlobalRouletteDataManager.instance;
  }
  
  public subscribe(id: string, callback: (data: any) => void): () => void {
    console.log(`[RouletteCard] Novo assinante registrado: ${id}`);
    this.updateCallbacks.set(id, callback);
    
    // Usar o globalRouletteDataService para obter dados
    const currentData = globalRouletteDataService.getAllRoulettes();
    
    // Se já temos dados, notificar imediatamente
    if (currentData && currentData.length > 0) {
      callback(currentData);
      this.initialDataLoaded = true;
    } else {
      // Forçar uma atualização usando o serviço global
      globalRouletteDataService.forceUpdate();
    }
    
    // Registrar callback no serviço global para receber atualizações
    globalRouletteDataService.subscribe(id, () => {
      const rouletteData = globalRouletteDataService.getAllRoulettes();
      if (rouletteData && rouletteData.length > 0) {
        callback(rouletteData);
      }
    });
    
    // Retornar função para cancelar inscrição
    return () => {
      this.updateCallbacks.delete(id);
      globalRouletteDataService.unsubscribe(id);
      console.log(`[RouletteCard] Assinante removido: ${id}`);
    };
  }

  // Obter dados mais recentes (sem garantia de atualização)
  public getData(): any[] {
    return globalRouletteDataService.getAllRoulettes();
  }
  
  // Obter timestamp da última atualização
  public getLastUpdateTime(): number {
    return Date.now(); // Usar o timestamp atual como fallback
  }

  // Verificar se os dados iniciais foram carregados
  public isInitialized(): boolean {
    return this.initialDataLoaded;
  }
}

interface RouletteCardProps {
  data: RouletteData;
  isDetailView?: boolean;
}

// Lista de estratégias disponíveis para a roleta
const ESTRATEGIAS_ROLETA = [
  { id: 'martingale', nome: 'Martingale', descricao: 'Dobre a aposta após cada perda' },
  { id: 'dalembert', nome: 'D\'Alembert', descricao: 'Aumente a aposta em 1 unidade após perda, diminua após ganho' },
  { id: 'fibonacci', nome: 'Fibonacci', descricao: 'Siga a sequência de Fibonacci para apostas' },
  { id: 'labouchere', nome: 'Labouchère', descricao: 'Crie uma sequência de números e aposte a soma do primeiro e último' },
  { id: 'paroli', nome: 'Paroli', descricao: 'Dobre a aposta após cada vitória' },
  { id: 'colunas', nome: 'Colunas Alternadas', descricao: 'Aposte nas colunas alternando padrões' },
  { id: 'duzias', nome: 'Dúzias Progressivas', descricao: 'Aposte nas dúzias com progressão' },
];

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
  const [estrategiaSelecionada, setEstrategiaSelecionada] = useState<string>('martingale'); // Martingale selecionado por padrão
  const [showEstrategiaDropdown, setShowEstrategiaDropdown] = useState(false);
  
  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const estrategiaButtonRef = useRef<HTMLButtonElement | null>(null);
  
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
      
      // Certificar-se de limpar qualquer outro recurso de requisição
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [dataManager, componentId, handleDataUpdate]);
  
  // Efeito para mostrar notificação da estratégia selecionada por padrão
  useEffect(() => {
    // Mostrar notificação sobre a estratégia padrão selecionada
    if (enableNotifications) {
      const estrategiaPadrao = ESTRATEGIAS_ROLETA.find(e => e.id === 'martingale');
      if (estrategiaPadrao) {
        setToastVisible(true);
        setToastMessage(`Estratégia "${estrategiaPadrao.nome}" selecionada por padrão`);
        setTimeout(() => setToastVisible(false), 3000);
      }
    }
  }, [enableNotifications]); // Executar apenas uma vez após a montagem inicial
  
  // Adicionar um comentário para garantir que este é o único lugar fazendo requisições
  // Console.log para verificar se há apenas uma fonte de requisições:
  console.log('[VERIFICAÇÃO DE FONTE ÚNICA] O componente RouletteCard usa apenas GlobalRouletteDataManager para obter dados da API.');
  
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

    // Se vamos mostrar as estatísticas e ainda não as abrimos antes,
    // solicitar dados detalhados apenas neste momento
    if (!showStats) {
      // Carrega dados detalhados apenas quando necessário
      globalRouletteDataService.fetchDetailedRouletteData().then(detailedData => {
        // Procurar os dados detalhados da roleta atual
        const myDetailedRoulette = detailedData.find((roulette: any) => 
          roulette.id === safeData.id || 
          roulette._id === safeData.id || 
          roulette.name === safeData.name || 
          roulette.nome === safeData.name
        );
        
        if (myDetailedRoulette) {
          console.log(`[${componentId}] Dados detalhados carregados para ${safeData.name}`);
          // Processar os dados detalhados
          setRawRouletteData(myDetailedRoulette);
          processApiData(myDetailedRoulette);
        }
      });
    }
    
    setShowStats(!showStats);
  };
  
  // Função para abrir detalhes da roleta
  const handleCardClick = () => {
    // Removida a navegação para a página de detalhes
    return; // Não faz nada ao clicar no card
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

  // Função para selecionar uma estratégia
  const selecionarEstrategia = (estrategiaId: string) => {
    const estrategia = ESTRATEGIAS_ROLETA.find(e => e.id === estrategiaId);
    setEstrategiaSelecionada(estrategiaId);
    setShowEstrategiaDropdown(false);
    
    if (estrategia && enableNotifications) {
      setToastVisible(true);
      setToastMessage(`Estratégia "${estrategia.nome}" selecionada`);
      setTimeout(() => setToastVisible(false), 3000);
    }
  };

  // Função simplificada para alternar o dropdown de estratégia
  const toggleEstrategiaDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowEstrategiaDropdown(!showEstrategiaDropdown);
  };
  
  // Efeito para fechar o dropdown quando clicar fora
  useEffect(() => {
    if (showEstrategiaDropdown) {
      const handleClickOutside = (e: MouseEvent) => {
        if (estrategiaButtonRef.current && !estrategiaButtonRef.current.contains(e.target as Node)) {
          setShowEstrategiaDropdown(false);
        }
      };
      
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showEstrategiaDropdown]);

  return (
    <Card 
      ref={cardRef}
      className={cn(
        "relative overflow-visible transition-all duration-300 hover:shadow-md", 
        isNewNumber ? "border-green-500 shadow-green-200 animate-pulse" : "",
        isDetailView ? "w-full" : "w-full",
        showEstrategiaDropdown ? "dropdown-open z-10" : ""
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
        
        {/* Seletor de Estratégia */}
        <div className="mt-3 mb-2">
          <div className="relative">
            <button
              ref={estrategiaButtonRef}
              onClick={toggleEstrategiaDropdown}
              className="w-full flex items-center justify-between bg-black hover:bg-gray-900 text-white rounded px-3 py-2 text-sm transition-colors"
            >
              <div className="flex items-center">
                <Target className="h-3 w-3 mr-2" />
                <span>
                  {estrategiaSelecionada 
                    ? ESTRATEGIAS_ROLETA.find(e => e.id === estrategiaSelecionada)?.nome 
                    : "Selecionar estratégia"}
                </span>
              </div>
              <ChevronDown className="h-3 w-3" />
            </button>
            
            {/* Dropdown simples inline */}
            {showEstrategiaDropdown && (
              <div 
                className="absolute top-full left-0 right-0 mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-md shadow-xl p-2 text-sm"
                onClick={(e) => e.stopPropagation()}
                style={{ 
                  maxHeight: '250px', 
                  overflowY: 'auto',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)'
                }}
              >
                {ESTRATEGIAS_ROLETA.map((estrategia) => (
                  <div
                    key={estrategia.id}
                    className={`px-3 py-2 mb-1 rounded-sm hover:bg-zinc-700 cursor-pointer transition-colors ${
                      estrategiaSelecionada === estrategia.id ? "bg-zinc-700" : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      selecionarEstrategia(estrategia.id);
                    }}
                  >
                    <div className="font-medium text-white">{estrategia.nome}</div>
                    <div className="text-xs text-zinc-400">{estrategia.descricao}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Rodapé */}
        <div className="mt-2 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            {/* Espaço vazio onde estava o botão de estatísticas */}
          </div>
          
          <div className="flex items-center text-xs text-gray-400">
            {loading ? "Carregando..." : (hasRealData ? "" : "Aguardando dados")}
          </div>
        </div>
      </CardContent>

      {/* Painel de estatísticas */}
      {showStats && (
        <div className="mt-0 px-4 pb-4">
          <div className="bg-gray-100 p-3 rounded-lg border border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium text-gray-800 flex items-center">
            <BarChart3 className="h-3 w-3 mr-1" />
            Estatísticas
          </h3>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleStats}
                className="h-5 w-5 p-0" 
                title="Minimizar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                </svg>
              </Button>
            </div>
          
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
        <div className="bg-white w-1/2 h-[90vh] rounded-lg overflow-y-auto">
          <div className="flex justify-between items-center p-4 border-b border-gray-200">
            <h2 className="text-xl font-bold">Estatísticas da {safeData.name}</h2>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setIsStatsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 bg-gray-100 p-1 rounded-md"
                title="Minimizar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            <button 
              onClick={() => setIsStatsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
                title="Fechar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            </div>
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

      {/* Toast de notificação */}
      {toastVisible && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-md shadow-lg z-50 animate-fade-in">
          {toastMessage}
        </div>
      )}
    </Card>
  );
};

export default RouletteCard;