import { ChartBar, BarChart, ArrowDown, ArrowUp, PercentIcon, ClipboardList, ChevronUp, ChevronDown } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useState, useEffect, useRef } from 'react';
import globalRouletteDataService from '../services/GlobalRouletteDataService';
import rouletteHistoryService from '../services/RouletteHistoryService';
import { getLogger } from '../services/utils/logger';
import { cn } from '../lib/utils';

// Criando um logger específico para este componente
const logger = getLogger('RouletteSidePanelStats');

// Compartilhar a mesma constante de intervalo de polling usada no RouletteFeedService
const POLLING_INTERVAL = 10000; // 10 segundos

interface RouletteSidePanelStatsProps {
  roletaNome: string;
  lastNumbers: number[];
  wins: number;
  losses: number;
  historicalNumbers: number[];
  latestNumber: number;
  highlightItems: number[];
  isOpen: boolean;
}

// Função para gerar números aleatórios para testes (apenas como último recurso)
const generateFallbackNumbers = (count: number = 20): number[] => {
  logger.warn(`Não serão gerados números aleatórios`);
  return []; // Retornar array vazio em vez de números aleatórios
};

// Buscar histórico de números da roleta do serviço centralizado
export const fetchRouletteHistoricalNumbers = async (rouletteName: string): Promise<number[]> => {
  try {
    logger.info(`Buscando dados históricos para: ${rouletteName}`);
    
    // Primeiro, tentar buscar dados detalhados com limit=1000
    logger.info(`Solicitando dados detalhados (limit=1000) para ${rouletteName}`);
    const detailedData = await globalRouletteDataService.fetchDetailedRouletteData();
    
    // Uma vez que os dados detalhados foram buscados, procurar a roleta específica
    logger.info(`Buscando roleta ${rouletteName} nos dados detalhados`);
    
    // Procurar a roleta pelo nome nos dados detalhados
    const targetDetailedRoulette = detailedData.find((roleta: any) => {
      const roletaName = roleta.nome || roleta.name || '';
      return roletaName.toLowerCase() === rouletteName.toLowerCase();
    });
    
    // Verificar a estrutura exata dos dados recebidos para diagnóstico
    if (targetDetailedRoulette) {
      logger.info(`Estrutura da roleta encontrada:`, JSON.stringify({
        id: targetDetailedRoulette.id,
        nome: targetDetailedRoulette.nome,
        numero_count: targetDetailedRoulette.numero ? targetDetailedRoulette.numero.length : 0,
        primeiro_numero: targetDetailedRoulette.numero && targetDetailedRoulette.numero.length > 0 
          ? targetDetailedRoulette.numero[0] 
          : null
      }));
    }
    
    // Se encontrou a roleta nos dados detalhados e possui array de números
    if (targetDetailedRoulette && targetDetailedRoulette.numero && Array.isArray(targetDetailedRoulette.numero)) {
      // Extrair os números considerando todas as possíveis estruturas
      const processedDetailedNumbers = targetDetailedRoulette.numero
        .map((n: any) => {
          // Se for um objeto com propriedade numero
          if (typeof n === 'object' && n !== null) {
            return Number(n.numero || n.number);
          }
          // Se for um número diretamente
          else if (typeof n === 'number') {
            return n;
          }
          // Se for uma string que pode ser convertida para número
          else if (typeof n === 'string' && !isNaN(Number(n))) {
            return Number(n);
          }
          return NaN;
        })
        .filter((n: number) => !isNaN(n) && n >= 0 && n <= 36);
      
      logger.info(`Obtidos ${processedDetailedNumbers.length} números históricos DETALHADOS para ${rouletteName}`);
      return processedDetailedNumbers;
    }
    
    // Se não encontrou nos dados detalhados, tentar nos dados normais
    logger.info(`Roleta não encontrada nos dados detalhados, tentando dados normais para ${rouletteName}`);
    
    // Obter a roleta pelo nome do serviço global 
    const targetRoulette = globalRouletteDataService.getRouletteByName(rouletteName);
    
    if (targetRoulette && targetRoulette.numero && Array.isArray(targetRoulette.numero)) {
      // Extrair os números considerando todas as possíveis estruturas
      const processedNumbers = targetRoulette.numero
        .map((n: any) => {
          // Se for um objeto com propriedade numero
          if (typeof n === 'object' && n !== null) {
            return Number(n.numero || n.number);
          }
          // Se for um número diretamente
          else if (typeof n === 'number') {
            return n;
          }
          // Se for uma string que pode ser convertida para número
          else if (typeof n === 'string' && !isNaN(Number(n))) {
            return Number(n);
          }
          return NaN;
        })
        .filter((n: number) => !isNaN(n) && n >= 0 && n <= 36);
      
      logger.info(`Obtidos ${processedNumbers.length} números históricos para ${rouletteName} do serviço global`);
      return processedNumbers;
    } else {
      logger.warn(`Roleta "${rouletteName}" não encontrada ou sem histórico de números`);
      // Se não encontrou a roleta, forçar uma atualização dos dados
      globalRouletteDataService.forceUpdate();
      return [];
    }
  } catch (error) {
    logger.error(`Erro ao buscar números históricos:`, error);
    return []; // Retorna array vazio em vez de números aleatórios
  }
};

// Generate frequency data for numbers
export const generateFrequencyData = (numbers: number[]) => {
  const frequency: Record<number, number> = {};
  
  // Initialize all roulette numbers (0-36)
  for (let i = 0; i <= 36; i++) {
    frequency[i] = 0;
  }
  
  // Count frequency of each number
  numbers.forEach(num => {
    if (frequency[num] !== undefined) {
      frequency[num]++;
    }
  });
  
  // Convert to array format needed for charts
  return Object.keys(frequency).map(key => ({
    number: parseInt(key),
    frequency: frequency[parseInt(key)]
  })).sort((a, b) => a.number - b.number);
};

// Calculate hot and cold numbers
export const getHotColdNumbers = (frequencyData: {number: number, frequency: number}[]) => {
  const sorted = [...frequencyData].sort((a, b) => b.frequency - a.frequency);
  return {
    hot: sorted.slice(0, 5),  // 5 most frequent
    cold: sorted.slice(-5).reverse()  // 5 least frequent
  };
};

// Generate pie chart data for number groups
export const generateGroupDistribution = (numbers: number[]) => {
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const groups = [
    { name: "Vermelhos", value: 0, color: "#ef4444" },
    { name: "Pretos", value: 0, color: "#111827" },
    { name: "Zero", value: 0, color: "#059669" },
  ];
  
  numbers.forEach(num => {
    if (num === 0) {
      groups[2].value += 1;
    } else if (redNumbers.includes(num)) {
      groups[0].value += 1;
    } else {
      groups[1].value += 1;
    }
  });
  
  return groups;
};

// Gerar dados de média de cores por hora
export const generateColorHourlyStats = (numbers: number[]) => {
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const total = numbers.length;
  
  // Contar números por cor
  const redCount = numbers.filter(num => redNumbers.includes(num)).length;
  const blackCount = numbers.filter(num => num !== 0 && !redNumbers.includes(num)).length;
  const zeroCount = numbers.filter(num => num === 0).length;
  
  // Calcular média por hora (assumindo que temos dados de uma hora)
  // Para um cenário real, usaríamos dados com timestamps
  const redAverage = parseFloat((redCount / (total / 60)).toFixed(2));
  const blackAverage = parseFloat((blackCount / (total / 60)).toFixed(2));
  const zeroAverage = parseFloat((zeroCount / (total / 60)).toFixed(2));
  
  return [
    {
      name: "Média de vermelhos por hora",
      value: redAverage,
      color: "#ef4444",
      total: redCount,
      percentage: parseFloat(((redCount / total) * 100).toFixed(2))
    },
    {
      name: "Média de pretos por hora",
      value: blackAverage,
      color: "#111827",
      total: blackCount,
      percentage: parseFloat(((blackCount / total) * 100).toFixed(2))
    },
    {
      name: "Média de brancos por hora",
      value: zeroAverage,
      color: "#059669",
      total: zeroCount,
      percentage: parseFloat(((zeroCount / total) * 100).toFixed(2))
    }
  ];
};

// Determine color for a roulette number
export const getRouletteNumberColor = (num: number) => {
  if (num === 0) return "bg-vegas-green text-black";
  
  // Red numbers
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  
  if (redNumbers.includes(num)) {
    return "bg-red-600 text-white";
  } else {
    return "bg-black text-white";
  }
};

// Adicionar funções para analisar distribuição por dúzias e colunas
export const generateDozenDistribution = (numbers: number[]) => {
  const groups = [
    { name: "1ª Dúzia (1-12)", value: 0, color: "#FF6B6B" },
    { name: "2ª Dúzia (13-24)", value: 0, color: "#4ECDC4" },
    { name: "3ª Dúzia (25-36)", value: 0, color: "#FFD166" },
    { name: "Zero", value: 0, color: "#059669" },
  ];
  
  numbers.forEach(num => {
    if (num === 0) {
      groups[3].value += 1;
    } else if (num >= 1 && num <= 12) {
      groups[0].value += 1;
    } else if (num >= 13 && num <= 24) {
      groups[1].value += 1;
    } else if (num >= 25 && num <= 36) {
      groups[2].value += 1;
    }
  });
  
  return groups;
};

export const generateColumnDistribution = (numbers: number[]) => {
  const groups = [
    { name: "1ª Coluna", value: 0, color: "#FF6B6B" },
    { name: "2ª Coluna", value: 0, color: "#4ECDC4" },
    { name: "3ª Coluna", value: 0, color: "#FFD166" },
    { name: "Zero", value: 0, color: "#059669" },
  ];
  
  numbers.forEach(num => {
    if (num === 0) {
      groups[3].value += 1;
    } else {
      // Calcular a coluna: números que deixam resto 1 na divisão por 3 são da 1ª coluna, 
      // resto 2 são da 2ª coluna, e resto 0 são da 3ª coluna
      const remainder = num % 3;
      if (remainder === 1) {
        groups[0].value += 1;
      } else if (remainder === 2) {
        groups[1].value += 1;
      } else if (remainder === 0) {
        groups[2].value += 1;
      }
    }
  });
  
  return groups;
};

// Componente para renderizar um número individual da roleta
interface RouletteHistoricalNumberProps {
  number: number;
  isLatest?: boolean;
  highlight?: boolean;
}

const RouletteHistoricalNumber = ({ number, isLatest = false, highlight = false }: RouletteHistoricalNumberProps) => {
  // Determina a cor do número baseado nas regras da roleta
  const getNumberColor = () => {
    if (number === 0) return "bg-green-500 text-white";
    if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(number)) {
      return "bg-red-500 text-white";
    }
    return "bg-black text-white";
  };

  return (
    <div 
      className={`
        w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
        ${getNumberColor()}
        ${isLatest ? 'ring-2 ring-yellow-400' : ''}
        ${highlight ? 'ring-2 ring-blue-400' : ''}
      `}
    >
      {number}
    </div>
  );
};

const RouletteSidePanelStats = ({ 
  roletaNome, 
  lastNumbers, 
  wins, 
  losses,
  historicalNumbers,
  latestNumber,
  highlightItems,
  isOpen,
}: RouletteSidePanelStatsProps) => {
  const [expanded, setExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'numbers' | 'dozens' | 'columns'>('numbers');
  const numbersPerPage = 100;
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const subscriberId = useRef<string>(`sidepanel-${roletaNome}-${Math.random().toString(36).substring(2, 9)}`);
  const isInitialRequestDone = useRef<boolean>(false);
  
  useEffect(() => {
    const fetchHistoricalNumbers = async () => {
      try {
        setIsLoading(true);
        // Obter histórico de números da API
        const history = await rouletteHistoryService.fetchHistory(roletaNome, 1000);
        
        // Atualizar estado com os números obtidos
        if (history?.numbers?.length) {
          // setHistoricalNumbers(history.numbers);
          isInitialRequestDone.current = true;
        }
      } catch (error) {
        getLogger().error(`Erro ao obter histórico para ${roletaNome}`, error);
      } finally {
        setIsLoading(false);
      }
    };

    // Inicializar com dados históricos
    if (!isInitialRequestDone.current) {
      fetchHistoricalNumbers();
    }

    // Configurar assinatura para atualizações em tempo real
    const handleUpdate = (data: any) => {
      if (data.roletaNome === roletaNome && data.type === 'number') {
        // Adicionar novo número ao estado
        // setHistoricalNumbers(prev => [data.number, ...prev]);
      }
    };

    // Registrar assinante
    const unsubscribe = rouletteHistoryService.subscribe(subscriberId.current, handleUpdate);

    // Limpar assinatura ao desmontar
    return () => {
      unsubscribe();
    };
  }, [roletaNome]);
  
  // Calcula a frequência de cada número
  const calculateFrequency = (numbers: number[]) => {
    const frequency: Record<number, number> = {};
    
    // Inicializa contador para todos os números de 0 a 36
    for (let i = 0; i <= 36; i++) {
      frequency[i] = 0;
    }
    
    // Incrementa contador para cada ocorrência
    numbers.forEach(num => {
      frequency[num]++;
    });
    
    return frequency;
  };

  // Calcula números quentes e frios
  const getHotAndColdNumbers = (numbers: number[]) => {
    const frequency = calculateFrequency(numbers);
    
    // Converte para array de objetos { number, frequency }
    const frequencyArray = Object.entries(frequency).map(([number, freq]) => ({
      number: parseInt(number),
      frequency: freq
    }));
    
    // Ordena por frequência (decrescente para quentes, crescente para frios)
    const sortedDesc = [...frequencyArray].sort((a, b) => b.frequency - a.frequency);
    const sortedAsc = [...frequencyArray].sort((a, b) => a.frequency - b.frequency);
    
    // Retorna os 5 mais quentes e 5 mais frios
    return {
      hot: sortedDesc.slice(0, 5),
      cold: sortedAsc.slice(0, 5)
    };
  };

  // Calcula dados para gráfico de frequência
  const generateFrequencyData = (numbers: number[]) => {
    const frequency = calculateFrequency(numbers);
    
    return Object.entries(frequency).map(([number, freq]) => ({
      number: parseInt(number),
      frequency: freq
    }));
  };

  // Calcula dados para gráfico de pizza (distribuição por cor)
  const generatePieData = (numbers: number[]) => {
    let red = 0;
    let black = 0;
    let green = 0;
    
    numbers.forEach(num => {
      if (num === 0) {
        green++;
      } else if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num)) {
        red++;
      } else {
        black++;
      }
    });
    
    return [
      { name: "Vermelho", value: red, color: "#ef4444" },
      { name: "Preto", value: black, color: "#111827" },
      { name: "Zero", value: green, color: "#10b981" }
    ];
  };
  
  const frequencyData = generateFrequencyData(historicalNumbers);
  const { hot, cold } = getHotColdNumbers(frequencyData);
  const pieData = generateGroupDistribution(historicalNumbers);
  const colorHourlyStats = generateColorHourlyStats(historicalNumbers);
  
  const winRate = (wins / (wins + losses)) * 100;
  
  // Renderiza os modos de visualização diferentes
  const renderContent = () => {
    if (!expanded) {
      return (
        <div className="grid grid-cols-5 gap-1 mt-2">
          {historicalNumbers.slice(0, 20).map((num, index) => (
            <RouletteHistoricalNumber
              key={index}
              number={num}
              isLatest={index === 0}
              highlight={highlightItems.includes(num)}
            />
          ))}
        </div>
      );
    }

    if (viewMode === 'numbers') {
      // Mostrar números com paginação
      const startIndex = (currentPage - 1) * numbersPerPage;
      const endIndex = Math.min(startIndex + numbersPerPage, historicalNumbers.length);
      const currentPageNumbers = historicalNumbers.slice(startIndex, endIndex);
      
      return (
        <div>
          <div className="grid grid-cols-10 gap-1 mt-2">
            {currentPageNumbers.map((num, index) => (
              <RouletteHistoricalNumber
                key={index}
                number={num}
                isLatest={index === 0 && currentPage === 1}
                highlight={highlightItems.includes(num)}
              />
            ))}
          </div>
          <div className="flex justify-between items-center mt-4 text-sm">
            <div>
              Mostrando {startIndex + 1}-{endIndex} de {historicalNumbers.length} números
            </div>
            <div className="flex space-x-2">
              <button 
                className={`px-3 py-1 rounded ${currentPage === 1 ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-500 text-white'}`}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </button>
              <button 
                className={`px-3 py-1 rounded ${currentPage === Math.ceil(historicalNumbers.length / numbersPerPage) ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-500 text-white'}`}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(historicalNumbers.length / numbersPerPage)))}
                disabled={currentPage === Math.ceil(historicalNumbers.length / numbersPerPage)}
              >
                Próximo
              </button>
            </div>
          </div>
        </div>
      );
    } else if (viewMode === 'dozens') {
      const dozenData = generateDozenDistribution(historicalNumbers);
      return (
        <div className="mt-4">
          <div className="mb-4">
            <h3 className="text-lg font-medium">Distribuição por Dúzias</h3>
            <p className="text-sm text-gray-500">Análise dos últimos {historicalNumbers.length} números</p>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-4">
            {dozenData.map((group, index) => (
              <div key={index} className="bg-gray-100 p-3 rounded-lg text-center">
                <div className="text-sm font-medium">{group.name}</div>
                <div className="text-2xl font-bold mt-1">{group.value}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {((group.value / historicalNumbers.length) * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dozenData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8">
                  {dozenData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    } else if (viewMode === 'columns') {
      const columnData = generateColumnDistribution(historicalNumbers);
      return (
        <div className="mt-4">
          <div className="mb-4">
            <h3 className="text-lg font-medium">Distribuição por Colunas</h3>
            <p className="text-sm text-gray-500">Análise dos últimos {historicalNumbers.length} números</p>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-4">
            {columnData.map((group, index) => (
              <div key={index} className="bg-gray-100 p-3 rounded-lg text-center">
                <div className="text-sm font-medium">{group.name}</div>
                <div className="text-2xl font-bold mt-1">{group.value}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {((group.value / historicalNumbers.length) * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={columnData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8">
                  {columnData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }
  };
  
  return (
    <div className={cn(
      "flex-col border bg-white rounded-md",
      isOpen ? "flex" : "hidden",
    )}>
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          <span>Histórico</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            className="p-1 hover:bg-gray-100 rounded"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="p-3">
        {expanded && (
          <div className="mb-3 border-b pb-2">
            <div className="flex space-x-2">
              <button 
                className={`px-3 py-1 rounded ${viewMode === 'numbers' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                onClick={() => setViewMode('numbers')}
              >
                Números
              </button>
              <button 
                className={`px-3 py-1 rounded ${viewMode === 'dozens' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                onClick={() => setViewMode('dozens')}
              >
                Dúzias
              </button>
              <button 
                className={`px-3 py-1 rounded ${viewMode === 'columns' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                onClick={() => setViewMode('columns')}
              >
                Colunas
              </button>
            </div>
          </div>
        )}
        {renderContent()}
      </div>
    </div>
  );
};

export default RouletteSidePanelStats; 