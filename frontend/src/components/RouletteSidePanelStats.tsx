import { ChartBar, BarChart, ChevronDown, Filter, X } from "lucide-react";
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import UnifiedRouletteClient from '../services/UnifiedRouletteClient';
import { getLogger } from '../services/utils/logger';
import { uniqueId } from 'lodash';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import NumberDisplay from './NumberDisplay';
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import axios from 'axios';

// Criando um logger específico para este componente
const logger = getLogger('RouletteSidePanelStats');

interface RouletteSidePanelStatsProps {
  roletaId: string;
  roletaNome: string;
  lastNumbers: number[];
  wins: number;
  losses: number;
  providers?: RouletteProvider[];
}

export interface RouletteProvider {
  id: string;
  name: string;
}

// Modificar a interface para incluir timestamp
interface RouletteNumber {
  numero: number;
  timestamp: string;
}

// Tipo para filtros de cor
type ColorFilter = 'todos' | 'vermelho' | 'preto' | 'verde';

// Novo estado para controlar número selecionado
type SelectedNumberState = number | null;

// Ordem dos números em uma roleta de cassino europeia
const ROULETTE_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

// Mapear regiões da roleta
const ROULETTE_REGIONS = [
  { name: "Região 1 (0-9)", numbers: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { name: "Região 2 (10-19)", numbers: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19] },
  { name: "Região 3 (20-29)", numbers: [20, 21, 22, 23, 24, 25, 26, 27, 28, 29] },
  { name: "Região 4 (30-36)", numbers: [30, 31, 32, 33, 34, 35, 36] },
];

// Função para gerar números aleatórios para testes (apenas como último recurso)
const generateFallbackNumbers = (count: number = 20): number[] => {
  logger.warn(`Não serão gerados números aleatórios`);
  return []; // Retornar array vazio em vez de números aleatórios
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

// Tema comum para os gráficos Recharts - Estilo Shadcn
const chartTheme = {
  backgroundColor: 'hsl(224 71% 4%)',
  textColor: 'hsl(213 31% 91%)',
  fontSize: 14,
  // Cores do tema shadcn/ui
  colors: {
    primary: 'hsl(142.1 70.6% 45.3%)',
    muted: 'hsl(215.4 16.3% 56.9%)',
    background: 'hsl(224 71% 4%)',
    foreground: 'hsl(213 31% 91%)',
    accent: 'hsl(210 40% 96.1%)',
    red: 'hsl(0 72.2% 50.6%)',
    green: 'hsl(142.1 70.6% 45.3%)',
    blue: 'hsl(217.2 91.2% 59.8%)',
    destructive: 'hsl(0 62.8% 30.6%)',
    border: 'hsl(216 34% 17%)',
    card: 'hsl(224 71% 4%)',
    cardForeground: 'hsl(213 31% 91%)',
  }
};

// Generate pie chart data for number groups
export const generateGroupDistribution = (numbers: number[]) => {
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const groups = [
    { name: "Vermelhos", value: 0, color: "hsl(0 72.2% 50.6%)" },
    { name: "Pretos", value: 0, color: "hsl(220 14% 20%)" },
    { name: "Zero", value: 0, color: "hsl(142.1 70.6% 45.3%)" },
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
  
  // Garantir que grupos vazios tenham pelo menos valor 1 para exibição
  groups.forEach(group => {
    if (group.value === 0) group.value = 1;
  });
  
  return groups;
};

// Gerar dados de média de cores por hora
export const generateColorHourlyStats = (numbers: number[]) => {
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const total = numbers.length || 1; // Evitar divisão por zero
  
  // Contar números por cor
  const redCount = numbers.filter(num => redNumbers.includes(num)).length;
  const blackCount = numbers.filter(num => num !== 0 && !redNumbers.includes(num)).length;
  const zeroCount = numbers.filter(num => num === 0).length;
  
  // Calcular média por hora (assumindo que temos dados de uma hora)
  const redAverage = parseFloat((redCount / (total / 60)).toFixed(2));
  const blackAverage = parseFloat((blackCount / (total / 60)).toFixed(2));
  const zeroAverage = parseFloat((zeroCount / (total / 60)).toFixed(2));
  
  return [
    {
      name: "Vermelhos",
      value: redAverage,
      color: "hsl(0 72.2% 50.6%)",
      total: redCount,
      percentage: parseFloat(((redCount / total) * 100).toFixed(1))
    },
    {
      name: "Pretos",
      value: blackAverage,
      color: "hsl(220 14% 20%)",
      total: blackCount,
      percentage: parseFloat(((blackCount / total) * 100).toFixed(1))
    },
    {
      name: "Zero",
      value: zeroAverage,
      color: "hsl(142.1 70.6% 45.3%)",
      total: zeroCount,
      percentage: parseFloat(((zeroCount / total) * 100).toFixed(1))
    }
  ];
};

// Função para gerar dados de frequência por região da roleta
export const generateRouletteRegionData = (numbers: number[]) => {
  const regionFrequency = ROULETTE_REGIONS.map(region => {
    const count = numbers.filter(num => region.numbers.includes(num)).length;
    return {
      name: region.name,
      count,
      percentage: numbers.length > 0 ? (count / numbers.length) * 100 : 0
    };
  });

  return regionFrequency;
};

// Função para gerar heatmap da roleta
export const generateRouletteHeatmap = (numbers: number[]) => {
  // Inicializar contagem para cada número da roleta
  const frequency: Record<number, number> = {};
  ROULETTE_NUMBERS.forEach(num => {
    frequency[num] = 0;
  });
  
  // Contar ocorrências
  numbers.forEach(num => {
    if (frequency[num] !== undefined) {
      frequency[num]++;
    }
  });
  
  // Encontrar o valor máximo para normalização
  const maxFrequency = Math.max(...Object.values(frequency), 1);
  
  // Criar dados para a visualização
  return ROULETTE_NUMBERS.map(num => {
    const count = frequency[num] || 0;
    const intensity = maxFrequency > 0 ? count / maxFrequency : 0;
    
    // Determinar cor para o número
    let color;
    if (num === 0) {
      // Verde para zero
      color = `hsl(142.1, 70.6%, ${45 + (intensity * 30)}%)`;
    } else if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num)) {
      // Vermelho com intensidade baseada na frequência
      color = `hsl(0, 72.2%, ${50 + (intensity * 30)}%)`;
    } else {
      // Preto com intensidade baseada na frequência
      color = `hsl(220, 14%, ${20 + (intensity * 20)}%)`;
    }
    
    return {
      number: num,
      count,
      percentage: numbers.length > 0 ? (count / numbers.length) * 100 : 0,
      intensity,
      color
    };
  });
};

// Determine color for a roulette number
export const getRouletteNumberColor = (num: number) => {
  if (num === 0) return "bg-[hsl(142.1,70.6%,45.3%)] text-white";
  
  // Red numbers
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  
  if (redNumbers.includes(num)) {
    return "text-white bg-[hsl(0,72.2%,50.6%)]";
  } else {
    return "text-white bg-[hsl(220,14%,20%)]";
  }
};

// Adicionar estilos CSS para a animação da roleta
const rouletteStyles = {
  table: {
    rotateAnimation: `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `,
    rotateSlow: {
      animation: 'spin 60s linear infinite',
    },
    pocketOuter: {
      background: 'radial-gradient(circle at center, #463F30 0%, #2c2416 100%)'
    },
    borderGold: {
      background: 'linear-gradient(to bottom, #ffd700, #b8860b)'
    }
  }
};

const RouletteSidePanelStats: React.FC<RouletteSidePanelStatsProps> = ({ 
  roletaId,
  roletaNome, 
  lastNumbers, 
  wins, 
  losses,
  providers = [] 
}: RouletteSidePanelStatsProps) => {
  const [historicalNumbers, setHistoricalNumbers] = useState<RouletteNumber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleNumbersCount, setVisibleNumbersCount] = useState(44);
  const [colorFilter, setColorFilter] = useState<ColorFilter>('todos');
  const isInitialRequestDone = useRef(false);

  // Obter instância do UnifiedClient
  const unifiedClient = UnifiedRouletteClient.getInstance();
  
  // Estados para os filtros avançados
  const [hasActiveFilters, setHasActiveFilters] = useState(false);
  const [selectedColor, setSelectedColor] = useState('todas');
  const [selectedNumber, setSelectedNumber] = useState<SelectedNumberState>(null);
  const [selectedParity, setSelectedParity] = useState('todas');
  const [selectedTime, setSelectedTime] = useState('todos');
  const [selectedProvider, setSelectedProvider] = useState('todos');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  
  // Novo estado para controlar apenas o destaque visual dos números
  const [highlightedNumber, setHighlightedNumber] = useState<SelectedNumberState>(null);

  // <<< NOVOS ESTADOS para a IA >>>
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  
  const componentInstanceId = useRef(uniqueId('panel-stats-')).current;

  // Esta função será chamada pelo listener do 'update' do UnifiedClient
  const processRouletteUpdate = useCallback((updatedRouletteData: any) => {
    if (!updatedRouletteData || !Array.isArray(updatedRouletteData.numero)) {
        logger.warn('Dados de atualização inválidos recebidos', updatedRouletteData);
        return;
    }

    // Extrair números e timestamps da atualização
    const apiNumbersWithTimestamp: RouletteNumber[] = updatedRouletteData.numero.map((item: any) => {
        let timeString = "00:00";
        if (item.timestamp) {
          try {
                const date = new Date(item.timestamp);
            timeString = date.getHours().toString().padStart(2, '0') + ':' + 
                       date.getMinutes().toString().padStart(2, '0');
          } catch (e) {
            logger.error("Erro ao converter timestamp:", e);
          }
        }
        return {
            numero: Number(item.numero),
          timestamp: timeString
        };
    }).filter((n: any) => !isNaN(n.numero) && n.numero >= 0 && n.numero <= 36);
      
    if (apiNumbersWithTimestamp.length === 0) {
        logger.info('Nenhum número válido na atualização recebida.');
      return;
    }
    
    setHistoricalNumbers(currentNumbers => {
        // Lógica para adicionar apenas números *novos* ao histórico existente
        const currentNumerosSet = new Set(currentNumbers.map(n => n.numero + '_' + n.timestamp)); // Usar timestamp para diferenciar
        const newNumbersToAdd: RouletteNumber[] = [];

        for (const apiNum of apiNumbersWithTimestamp) {
            const uniqueKey = apiNum.numero + '_' + apiNum.timestamp;
            // Adiciona apenas se for realmente novo (não presente no estado atual)
            // e se o número anterior na lista da API não for igual ao primeiro número atual
            // (evita adicionar o mesmo número várias vezes se a API enviar repetido)
            if (!currentNumerosSet.has(uniqueKey) && apiNum.numero !== currentNumbers[0]?.numero) {
                 newNumbersToAdd.push(apiNum);
                 // Adiciona ao set para evitar duplicatas dentro do mesmo lote de atualização
                 currentNumerosSet.add(uniqueKey); 
    } else {
                 // Se encontrarmos um número que já existe ou é o mesmo que o último, paramos de adicionar deste lote
                 break; 
            }
        }

        if (newNumbersToAdd.length > 0) {
            logger.info(`${newNumbersToAdd.length} novos números recebidos via atualização para ${roletaNome}: ${newNumbersToAdd.map(n => n.numero).join(', ')}`);
            const updatedNumbers = [...newNumbersToAdd, ...currentNumbers];
            return updatedNumbers.slice(0, 1000); // Limitar a 1000 números
        }

        // Se não há números novos, retorna o estado atual sem modificação
        return currentNumbers;
    });

  }, [roletaNome]);

  useEffect(() => {
    logger.info(`Inicializando ou atualizando painel para ${roletaNome}`);
    setIsLoading(true);
    isInitialRequestDone.current = false; // Resetar flag ao mudar de roleta
    setHistoricalNumbers([]); // Limpar números da roleta anterior

    // 1. Tentar obter dados pré-carregados do UnifiedClient
    const preloadedData = unifiedClient.getPreloadedHistory(roletaNome);

    if (preloadedData && preloadedData.length > 0) {
      logger.info(`Usando ${preloadedData.length} números pré-carregados para ${roletaNome}`);
      setHistoricalNumbers(preloadedData);
      setIsLoading(false);
      isInitialRequestDone.current = true;
    } else {
      // Se não houver dados pré-carregados, aguardar a busca inicial do UnifiedClient
      // ou as atualizações em tempo real. Não faremos busca específica aqui.
      logger.warn(`Nenhum histórico pré-carregado encontrado para ${roletaNome}. Aguardando busca inicial ou atualizações...`);
      // Podemos manter isLoading=true até receber o primeiro 'update' ou 'initialHistoryLoaded'
      // Ou definir isLoading=false e mostrar mensagem "Carregando histórico..."
      setIsLoading(false); // Vamos parar o loading e confiar nas atualizações
       isInitialRequestDone.current = true; // Consideramos 'feito' para não re-executar
    }

    // 2. Assinar eventos 'update' do UnifiedClient para atualizações em tempo real
    const handleUpdate = (updatedData: any) => {
        // O evento 'update' pode conter dados de uma roleta ou um array de todas
        let myRouletteUpdate: any = null;

        if (Array.isArray(updatedData)) {
            // Se for um array, encontrar a roleta específica
            myRouletteUpdate = updatedData.find(r => (r.name || r.nome)?.toLowerCase() === roletaNome.toLowerCase());
        } else if (updatedData && typeof updatedData === 'object') {
            // Se for um objeto único, verificar se é da roleta atual
             const currentRouletteName = updatedData.name || updatedData.nome || '';
             if (currentRouletteName.toLowerCase() === roletaNome.toLowerCase()) {
                 myRouletteUpdate = updatedData;
             }
        }

        // Se encontramos dados para a roleta atual, processá-los
        if (myRouletteUpdate) {
            logger.info(`Recebido 'update' para ${roletaNome}`);
             if (!isInitialRequestDone.current) {
                 // Se for a primeira atualização e não tínhamos dados pré-carregados
                 logger.info(`Primeira atualização recebida para ${roletaNome}, preenchendo histórico inicial.`);
                 // Poderia usar os dados completos da atualização aqui, se disponíveis
                 // Mas vamos confiar na lógica de `processRouletteUpdate` para adicionar
                 setIsLoading(false);
                 isInitialRequestDone.current = true;
             }
            processRouletteUpdate(myRouletteUpdate);
        }
    };
    
    // Assinar também o evento que sinaliza o fim do carregamento inicial (opcional, mas bom)
    const handleInitialHistoryLoaded = (allHistoryData: Map<string, RouletteNumber[]>) => {
        logger.info(`Evento 'initialHistoryLoaded' recebido.`);
         const initialDataForThisRoulette = allHistoryData.get(roletaNome);
         if (initialDataForThisRoulette && historicalNumbers.length === 0) { // Só preenche se ainda não tivermos
             logger.info(`Preenchendo histórico com dados de 'initialHistoryLoaded' para ${roletaNome}`);
             setHistoricalNumbers(initialDataForThisRoulette);
         }
         setIsLoading(false); // Garantir que o loading pare aqui
         isInitialRequestDone.current = true;
    };
    
     const handleInitialHistoryError = (error: any) => {
         logger.error(`Erro ao carregar histórico inicial reportado pelo UnifiedClient:`, error);
         setIsLoading(false); // Parar o loading mesmo em caso de erro
         isInitialRequestDone.current = true;
     };

    // Registrar listeners
    const unsubscribeUpdate = unifiedClient.on('update', handleUpdate);
    const unsubscribeInitialLoad = unifiedClient.on('initialHistoryLoaded', handleInitialHistoryLoaded);
    const unsubscribeInitialError = unifiedClient.on('initialHistoryError', handleInitialHistoryError);

    // Limpar inscrição ao desmontar ou mudar de roleta
    return () => {
      logger.info(`Desmontando listener para ${roletaNome}`);
      unsubscribeUpdate();
      unsubscribeInitialLoad();
      unsubscribeInitialError();
    };
  }, [roletaNome, unifiedClient, processRouletteUpdate]);

  // Função para mostrar mais números
  const handleShowMore = () => {
    // Calcular dinamicamente quantos números mostrar com base no total disponível
    const incremento = Math.min(50, Math.max(20, Math.floor(filteredNumbers.length * 0.1)));
    setVisibleNumbersCount(prev => Math.min(prev + incremento, filteredNumbers.length));
  };

  // Função para filtrar números por cor
  const handleFilterByColor = (color: ColorFilter) => {
    setColorFilter(color);
    // Ao mudar o filtro, resetamos a contagem para evitar páginas vazias
    setVisibleNumbersCount(30);
  };

  // Filtrar números pela cor selecionada
  const filteredNumbers = useMemo(() => {
    let filtered = [...historicalNumbers];
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    
    // 1. Filtro por cor
    if (selectedColor !== 'todas') {
      filtered = filtered.filter(item => {
        if (selectedColor === 'verde') return item.numero === 0;
        if (selectedColor === 'vermelho') return redNumbers.includes(item.numero);
        if (selectedColor === 'preto') return item.numero !== 0 && !redNumbers.includes(item.numero);
        return true;
      });
    }
    
    // 2. Filtro por número
    if (selectedNumber !== null) {
      filtered = filtered.filter(item => item.numero === selectedNumber);
    }
    
    // 3. Filtro por paridade
    if (selectedParity !== 'todas') {
      filtered = filtered.filter(item => {
        if (item.numero === 0) return false; // Zero não é par nem ímpar
        const isPar = item.numero % 2 === 0;
        return selectedParity === 'par' ? isPar : !isPar;
      });
    }
    
    // 4. Filtro por tempo/minuto
    if (selectedTime !== 'todos') {
      const minuteValue = parseInt(selectedTime, 10);
      if (!isNaN(minuteValue)) {
        filtered = filtered.filter(item => {
          // Extrair minuto do timestamp
          const minute = parseInt(item.timestamp.split(':')[1]);
          // Verificar se o minuto do timestamp é igual ao valor selecionado
          return minute === minuteValue;
        });
      }
    }
    
    // 5. Filtro por provedor
    if (selectedProviders.length > 0) {
      // Implementar lógica de filtro por provedor se necessário
    }
    
    return filtered;
  }, [historicalNumbers, selectedColor, selectedNumber, selectedParity, selectedTime, selectedProviders]);

  const visibleNumbers = filteredNumbers.slice(0, visibleNumbersCount);

  const frequencyData = generateFrequencyData(historicalNumbers.map(n => n.numero));
  const { hot, cold } = getHotColdNumbers(frequencyData);
  const pieData = generateGroupDistribution(historicalNumbers.map(n => n.numero));
  const colorHourlyStats = generateColorHourlyStats(historicalNumbers.map(n => n.numero));
  
  const winRate = (wins / (wins + losses)) * 100;

  // Opções para o filtro de números
  const numberOptions = [
    { value: 'todos', label: 'Todos' },
    { value: '0', label: '0' },
    ...Array.from({ length: 36 }, (_, i) => ({
      value: String(i + 1),
      label: String(i + 1)
    }))
  ];

  // Opções para o filtro de tempo
  const timeOptions = [
    { value: 'todos', label: 'Todos' },
    ...Array.from({ length: 60 }, (_, i) => ({
      value: String(i),
      label: String(i)
    }))
  ];

  // Handler para o filtro de cor
  const handleColorChange = (value: string) => {
    setSelectedColor(value as ColorFilter);
    let color: 'red' | 'black' | 'green' | null = null;
    
    switch (value) {
      case 'vermelho':
        color = 'red';
        break;
      case 'preto':
        color = 'black';
        break;
      case 'verde':
        color = 'green';
        break;
      case 'todas':
      default:
        color = null;
    }
    
    // Atualizar também o filtro de cor simples para manter compatibilidade
    setColorFilter(value as ColorFilter);
    checkActiveFilters();
  };

  // Handler para o filtro de número
  const handleNumberChange = (value: string) => {
    // Atualizar apenas o filtro, mantendo o destaque visual intacto
    setSelectedNumber(value === 'todos' ? null : parseInt(value, 10));
    // Não alterar o highlightedNumber aqui
    checkActiveFilters();
  };

  // Handler para o filtro de paridade
  const handleParityChange = (value: string) => {
    setSelectedParity(value);
    checkActiveFilters();
  };

  // Handler para o filtro de tempo
  const handleTimeChange = (value: string) => {
    setSelectedTime(value);
    checkActiveFilters();
  };

  // Handler para o filtro de provedor
  const handleProviderChange = (value: string) => {
    setSelectedProvider(value);
    
    if (value === 'todos') {
      setSelectedProviders([]);
    } else {
      setSelectedProviders([value]);
    }
    
    checkActiveFilters();
  };

  // Verificar se há filtros ativos
  const checkActiveFilters = () => {
    const hasFilters = 
      selectedColor !== 'todas' || 
      selectedNumber !== null || 
      selectedParity !== 'todas' || 
      selectedTime !== 'todos' || 
      selectedProvider !== 'todos' ||
      selectedProviders.length > 0;
    
    setHasActiveFilters(hasFilters);
  };

  // Limpar todos os filtros
  const handleClearAllFilters = () => {
    setSelectedColor('todas');
    setSelectedNumber(null);
    setSelectedParity('todas');
    setSelectedTime('todos');
    setSelectedProvider('todos');
    setSelectedProviders([]);
    setColorFilter('todos');
    
    setHasActiveFilters(false);
  };

  // Gerar dados de heatmap da roleta baseado no histórico
  const rouletteHeatmap = useMemo(() => 
    generateRouletteHeatmap(historicalNumbers.map(n => n.numero)), 
    [historicalNumbers]
  );
  
  // Gerar dados de regiões da roleta
  const rouletteRegionData = useMemo(() => 
    generateRouletteRegionData(historicalNumbers.map(n => n.numero)), 
    [historicalNumbers]
  );

  // Função para alternar a seleção de número para destaque visual
  const handleNumberSelection = (num: number) => {
    // Se o número já está destacado, limpa o destaque, senão destaca o número
    setHighlightedNumber(prevNumber => prevNumber === num ? null : num);
  };

  // <<< NOVA FUNÇÃO para chamar a API da IA >>>
  const handleAskAI = useCallback(async () => {
    if (!aiQuery.trim() || !roletaId) {
      setAiError("Por favor, digite sua pergunta e certifique-se que uma roleta está selecionada.");
      return;
    }
    
    logger.info(`[${componentInstanceId}] Enviando pergunta para IA sobre roleta ${roletaId}: ${aiQuery}`);
    setIsAiLoading(true);
    setAiResponse(null); // Limpa resposta anterior
    setAiError(null); // Limpa erro anterior

    try {
      const response = await axios.post('/api/ai/query', { 
        query: aiQuery, 
        roletaId: roletaId // Envia o ID da roleta
      });
      
      if (response.data && response.data.response) {
        setAiResponse(response.data.response);
      } else {
        throw new Error("Resposta inesperada da API de IA");
      }

    } catch (error: any) {
      logger.error("Erro ao chamar a API de IA:", error);
      setAiError(error.response?.data?.message || error.message || "Ocorreu um erro ao consultar a IA.");
      setAiResponse(null); // Garante que não haja resposta em caso de erro
    } finally {
      setIsAiLoading(false);
    }
  }, [aiQuery, roletaId, componentInstanceId]); // Adicionar dependências

  return (
    <div className="w-full rounded-lg overflow-y-auto max-h-screen border-l border-border">
      <div className="p-5 border-b border-gray-800 bg-opacity-40">
        <h2 className="text-white flex items-center text-xl font-bold mb-3">
          <BarChart className="mr-3 text-vegas-green h-6 w-6" /> Estatísticas da {roletaNome}
        </h2>
        <p className="text-sm text-gray-400">
          {isLoading ? "Carregando histórico..." : (historicalNumbers.length === 0 ? "Nenhum histórico disponível." : "")}
        </p>
      </div>
      
      {/* Nova seção de filtros avançados */}
      <div className="space-y-4 p-5 border-b border-gray-800">
        {/* Cabeçalho e botão limpar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-vegas-gold" />
            <h3 className="text-sm font-medium text-white">Filtros de roleta</h3>
          </div>
          
          {hasActiveFilters && (
            <Button 
              onClick={handleClearAllFilters}
              variant="ghost" 
              size="sm"
              className="h-7 px-2 text-xs text-gray-400 hover:text-white"
            >
              <X size={14} className="mr-1" />
              Limpar filtros
            </Button>
          )}
        </div>
        
        {/* Filtros em row com dropdowns */}
        <div className="flex w-full space-x-2 bg-card p-1">
          {/* Filtro por cor */}
          <div className="flex-1">
            <div className="text-xs text-gray-400 mb-1 px-2">Por cores</div>
            <Select value={selectedColor} onValueChange={handleColorChange}>
              <SelectTrigger className="w-full bg-card border border-border text-white h-10">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-white">
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="vermelho">
                  <div className="flex items-center">
                    <span className="mr-2 w-2 h-2 rounded-full bg-red-600"></span> Vermelhos
                  </div>
                </SelectItem>
                <SelectItem value="preto">
                  <div className="flex items-center">
                    <span className="mr-2 w-2 h-2 rounded-full bg-gray-900"></span> Pretos
                  </div>
                </SelectItem>
                <SelectItem value="verde">
                  <div className="flex items-center">
                    <span className="mr-2 w-2 h-2 rounded-full bg-green-600"></span> Zero
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por número */}
          <div className="flex-1">
            <div className="text-xs text-gray-400 mb-1 px-2">Por número</div>
            <Select value={selectedNumber === null ? 'todos' : String(selectedNumber)} onValueChange={handleNumberChange}>
              <SelectTrigger className="w-full bg-card border border-border text-white h-10">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-white max-h-[200px] overflow-y-auto">
                {numberOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por paridade */}
          <div className="flex-1">
            <div className="text-xs text-gray-400 mb-1 px-2">Por paridade</div>
            <Select value={selectedParity} onValueChange={handleParityChange}>
              <SelectTrigger className="w-full bg-card border border-border text-white h-10">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-white">
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="par">Pares</SelectItem>
                <SelectItem value="impar">Ímpares</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por provedor */}
          <div className="flex-1">
            <div className="text-xs text-gray-400 mb-1 px-2">Por provedor</div>
            <Select value={selectedProvider} onValueChange={handleProviderChange}>
              <SelectTrigger className="w-full bg-card border border-border text-white h-10">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-white max-h-[200px] overflow-y-auto">
                <SelectItem value="todos">Todos</SelectItem>
                {providers.map(provider => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por tempo */}
          <div className="flex-1">
            <div className="text-xs text-gray-400 mb-1 px-2">Por minuto</div>
            <Select value={selectedTime} onValueChange={handleTimeChange}>
              <SelectTrigger className="w-full bg-card border border-border text-white h-10">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-white max-h-[200px] overflow-y-auto">
                {timeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* <<< NOVA SEÇÃO: Interação com IA >>> */}
      <Card className="m-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center text-white">
            {/* Ícone de IA (exemplo, pode ser outro) */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-vegas-gold" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" /></svg>
            Perguntar à IA RunCash sobre {roletaNome}
          </CardTitle>
          <CardDescription className="text-xs">Faça perguntas sobre estatísticas, padrões ou probabilidades desta roleta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder={`Ex: Quais os 3 números mais frequentes nos últimos 500 giros desta roleta (${roletaNome})?`}
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            rows={3}
            disabled={isAiLoading}
            className="bg-input border-border placeholder:text-muted-foreground/70 text-sm"
          />
          <Button 
            onClick={handleAskAI} 
            disabled={isAiLoading || !aiQuery.trim()}
            size="sm"
            className="w-full bg-vegas-gold hover:bg-vegas-gold/90 text-black"
          >
            {isAiLoading ? "Analisando..." : "Enviar Pergunta"}
          </Button>
          
          {/* Área de Resposta / Loading / Erro */}
          <div className="mt-4 p-3 border border-dashed border-border rounded-md min-h-[80px] bg-background/50">
            {isAiLoading && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4 bg-muted/40" />
                <Skeleton className="h-4 w-1/2 bg-muted/40" />
                <Skeleton className="h-4 w-5/6 bg-muted/40" />
              </div>
            )}
            {aiError && (
              <p className="text-sm text-red-500">Erro: {aiError}</p>
            )}
            {aiResponse && !isAiLoading && (
              // Usar um componente para renderizar markdown seria ideal aqui
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{aiResponse}</p>
            )}
            {!aiResponse && !isAiLoading && !aiError && (
              <p className="text-xs text-muted-foreground text-center italic">A resposta da IA aparecerá aqui.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center p-16">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-muted border-t-[hsl(142.1,70.6%,45.3%)]"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {/* Historical Numbers Section */}
          <Card className="md:col-span-2">
            <CardHeader className="p-2 pb-0 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium flex items-center">
                  <BarChart className="mr-1 h-4 w-4 text-[hsl(142.1,70.6%,45.3%)]" /> 
                  Histórico de Números
                </CardTitle>
                <CardDescription className="text-[10px] text-muted-foreground">
                  {visibleNumbers.length} de {filteredNumbers.length} números
                </CardDescription>
              </div>
              {visibleNumbersCount < filteredNumbers.length && (
                <Button 
                  onClick={handleShowMore} 
                  variant="ghost" 
                  size="sm"
                  className="h-6 flex items-center gap-1 text-xs border border-border"
                >
                  +{filteredNumbers.length - visibleNumbersCount} <ChevronDown className="h-3 w-3" />
                </Button>
              )}
            </CardHeader>
            
            <CardContent className="p-0 pb-1">
            {visibleNumbers.length > 0 ? (
                <ScrollArea className="h-[300px]">
                  <div className="flex flex-wrap p-3 gap-2">
                    {filteredNumbers.map((n, idx) => (
                      // Formatar o timestamp dentro do JSX
                      <div 
                        key={`${n.numero}-${n.timestamp}-${idx}`} 
                        className="relative cursor-pointer transition-transform hover:scale-110"
                        onClick={() => handleNumberSelection(n.numero)}
                      >
                        <NumberDisplay 
                          number={n.numero} 
                          size="medium" 
                          highlight={highlightedNumber === n.numero}
                        />
                        <div className="text-xs text-gray-400 text-center mt-1">
                          {(() => {
                            // Lógica de formatação movida para cá
                            try {
                                const date = new Date(n.timestamp); 
                                if (!isNaN(date.getTime())) {
                                    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                                }
                            } catch (e) { /* Ignora erro */ }
                            return "--:--"; // Retorna padrão em caso de erro ou data inválida
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Separador e indicações de grupos de números */}
                  <div className="px-3 py-1">
                    <Separator className="my-2" />
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-[#FF1D46]"></div>
                        <span>Vermelhos: {visibleNumbers.filter(n => [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n.numero)).length}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-[#292524]"></div>
                        <span>Pretos: {visibleNumbers.filter(n => n.numero !== 0 && ![1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n.numero)).length}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>Zero: {visibleNumbers.filter(n => n.numero === 0).length}</span>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
            ) : (
                <div className="flex justify-center items-center h-[300px] text-[hsl(215.4,16.3%,56.9%)]">
                  {filteredNumbers.length === 0 && hasActiveFilters ? "Nenhum número corresponde aos filtros." : "Nenhum histórico encontrado."}
                </div>
            )}
            </CardContent>
          </Card>

          {/* Distribution Pie Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <ChartBar size={18} className="text-[hsl(142.1,70.6%,45.3%)] mr-2" /> 
                Distribuição por Cor
              </CardTitle>
            </CardHeader>
            
            <CardContent>
              {/* Adicionar legenda de cores na parte superior */}
              <div className="flex justify-center space-x-5 mb-4">
                {pieData.map((entry, index) => (
                  <div key={`color-legend-${index}`} className="flex items-center">
                    <div 
                      className="w-3 h-3 mr-2 rounded-sm" 
                      style={{ backgroundColor: entry.color }}
                    ></div>
                    <span className="text-sm text-[hsl(215.4,16.3%,56.9%)]">{entry.name}</span>
                  </div>
                ))}
              </div>
              <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                      outerRadius={75}
                      innerRadius={45}
                    fill="white"
                    dataKey="value"
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="hsl(224,71%,4%)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                        backgroundColor: 'hsl(224,71%,4%/0.95)', 
                        borderColor: 'hsl(142.1,70.6%,45.3%)',
                        borderRadius: '6px',
                        fontSize: '13px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        padding: '8px 12px'
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            </CardContent>
          </Card>
          
          {/* Roulette Heatmap Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <ChartBar size={18} className="text-[hsl(142.1,70.6%,45.3%)] mr-2" /> 
                Mapa de Calor da Roleta
              </CardTitle>
              <CardDescription>
                Distribuição de frequência na roleta
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <style>
                {`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                  
                  .roulette-spin {
                    animation: spin 120s linear infinite;
                  }
                  
                  .roulette-spin:hover {
                    animation-play-state: paused;
                  }
                  
                  .pocket {
                    transition: filter 0.3s ease;
                  }
                  
                  .pocket:hover {
                    filter: brightness(1.5) !important;
                    z-index: 10;
                  }
                `}
              </style>
              
              <div className="h-[320px] relative">
                <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                  <div className="w-[280px] h-[280px] relative">
                    {/* SVG principal para a roleta e gráfico de frequência */}
                    <svg width="280" height="280" viewBox="0 0 280 280">
                      <defs>
                        <radialGradient id="frequencyGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                          <stop offset="0%" stopColor="#006600" stopOpacity="0.8" />
                          <stop offset="100%" stopColor="#006600" stopOpacity="0.3" />
                        </radialGradient>
                      </defs>
                      
                      {/* Grid circular (eixos radiais) */}
                      {Array.from({ length: 12 }).map((_, i) => {
                        const angle = (i * 30) * (Math.PI / 180);
                        const x2 = 140 + 130 * Math.cos(angle);
                        const y2 = 140 + 130 * Math.sin(angle);
                        return (
                          <line 
                            key={`grid-line-${i}`}
                            x1="140" 
                            y1="140" 
                            x2={x2} 
                            y2={y2} 
                            stroke="#888888" 
                            strokeWidth="0.5" 
                            strokeDasharray="2,2"
                            opacity="0.3"
                          />
                        );
                      })}
                      
                      {/* Círculos concêntricos para o grid */}
                      {[25, 50, 75, 100, 125].map((radius, i) => (
                        <circle
                          key={`grid-circle-${i}`}
                          cx="140"
                          cy="140"
                          r={radius * 130 / 130}
                          fill="none"
                          stroke="#888888"
                          strokeWidth="0.5"
                          strokeDasharray="2,2"
                          opacity="0.3"
                        />
                      ))}
                      
                      {/* Renderizar o gráfico de frequência como polígono preenchido */}
                      {(() => {
                        // Calcular valor máximo para normalização
                        const maxValue = Math.max(...rouletteHeatmap.map(item => item.count), 1);
                        const scaleFactor = 110 / maxValue; // 130 é o raio máximo, deixar margem
                        
                        // Calcular pontos do polígono
                        const points = rouletteHeatmap.map((item, index) => {
                          const angle = (index * (360 / ROULETTE_NUMBERS.length)) * (Math.PI / 180);
                          const radius = item.count * scaleFactor;
                          const x = 140 + radius * Math.cos(angle - Math.PI/2); // -90 graus para alinhar
                          const y = 140 + radius * Math.sin(angle - Math.PI/2);
                          return `${x},${y}`;
                        });
                        
                        // Fechar o polígono
                        points.push(points[0]);
                        
                        return (
                          <polygon
                            points={points.join(' ')}
                            fill="url(#frequencyGradient)"
                            stroke="#006600"
                            strokeWidth="1"
                            opacity="0.75"
                          />
                        );
                      })()}
                      
                      {/* Anel externo com cores da roleta */}
                      {ROULETTE_NUMBERS.map((num, index) => {
                        const segmentAngle = 360 / ROULETTE_NUMBERS.length;
                        const startAngle = index * segmentAngle - 90; // -90 para alinhar com o topo
                        const endAngle = (index + 1) * segmentAngle - 90;
                        
                        // Converter para radianos
                        const startRad = (startAngle) * (Math.PI / 180);
                        const endRad = (endAngle) * (Math.PI / 180);
                        
                        // Determinar a cor (alternando entre vermelho e preto, zero é verde)
                        let color = "hsl(220,14%,20%)"; // Preto (padrão)
                        if (num === 0) {
                          color = "hsl(142.1,70.6%,45.3%)"; // Verde para zero
                        } else if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num)) {
                          color = "hsl(0,72.2%,50.6%)"; // Vermelho
                        }
                        
                        // Calcular pontos do arco externo
                        const outerRadius = 130;
                        const innerRadius = 110;
                        const x1 = 140 + outerRadius * Math.cos(startRad);
                        const y1 = 140 + outerRadius * Math.sin(startRad);
                        const x2 = 140 + outerRadius * Math.cos(endRad);
                        const y2 = 140 + outerRadius * Math.sin(endRad);
                        const x3 = 140 + innerRadius * Math.cos(endRad);
                        const y3 = 140 + innerRadius * Math.sin(endRad);
                        const x4 = 140 + innerRadius * Math.cos(startRad);
                        const y4 = 140 + innerRadius * Math.sin(startRad);
                        
                        // Calcular a posição do texto do número
                        const midAngle = (startAngle + endAngle) / 2;
                        const midRad = midAngle * (Math.PI / 180);
                        const textRadius = 120;
                        const textX = 140 + textRadius * Math.cos(midRad);
                        const textY = 140 + textRadius * Math.sin(midRad);
                        
                        return (
                          <g key={`roulette-segment-${num}`}>
                            {/* Segmento da roleta */}
                            <path
                              d={`M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 0 0 ${x4} ${y4} Z`}
                              fill={color}
                              stroke="#333"
                              strokeWidth="0.5"
                            />
                            
                            {/* Número rotacionado */}
                            <g transform={`translate(${textX}, ${textY}) rotate(${midAngle + 90})`}>
                              <text
                                x="0"
                                y="0"
                      fill="white"
                                fontSize="10"
                                fontWeight="bold"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                style={{ 
                                  textShadow: '0px 1px 1px rgba(0,0,0,0.7)',
                                  pointerEvents: 'none'
                                }}
                              >
                                {num}
                              </text>
                            </g>
                          </g>
                        );
                      })}
                      
                      {/* Círculos interno e externo (bordas) */}
                      <circle cx="140" cy="140" r="110" fill="none" stroke="black" strokeWidth="2" />
                      <circle cx="140" cy="140" r="130" fill="none" stroke="black" strokeWidth="2" />
                      
                      {/* Círculo principal para o centro */}
                      <circle 
                        cx="140" 
                        cy="140" 
                        r="40" 
                        fill="#1a1a1a" 
                        stroke="#333" 
                        strokeWidth="1"
                      />
                      
                      {/* Texto no centro */}
                      <text
                        x="140"
                        y="140"
                        fill="#00c853"
                        fontSize="12"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        Roleta
                      </text>
                      
                      {/* Marcador de escala y para valores de frequência */}
                      <g transform="translate(20, 140)">
                        {[0, 25, 50, 75, 100, 125].map((value, i) => (
                          <g key={`y-label-${i}`}>
                            <line 
                              x1="-5" 
                              y1={-value * 130 / 130} 
                              x2="0" 
                              y2={-value * 130 / 130} 
                              stroke="#888" 
                              strokeWidth="1" 
                            />
                            <text
                              x="-8"
                              y={-value * 130 / 130}
                              fill="#888"
                              fontSize="8"
                              textAnchor="end"
                              dominantBaseline="middle"
                            >
                              {value}
                            </text>
                          </g>
                        ))}
                      </g>
                    </svg>
                    
                    {/* Indicador de número no topo */}
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1 w-2 h-8 z-10">
                      <div className="w-full h-full flex flex-col items-center">
                        <div className="w-2 h-6 bg-white"></div>
                        <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-t-white border-l-transparent border-r-transparent"></div>
                      </div>
                    </div>
                  </div>
            </div>
          </div>
              
              {/* Legenda de estatísticas */}
              <div className="mt-4 text-center text-sm text-gray-400">
                <p>O gráfico mostra a frequência de cada número (área verde), com o máximo em {rouletteHeatmap.reduce((a, b) => a.count > b.count ? a : b).count} ocorrências.</p>
              </div>
              
              {/* Legenda de regiões */}
              <div className="mt-8 grid grid-cols-2 gap-3">
                {rouletteRegionData.map((region, index) => (
                  <div key={`region-${index}`} className="flex items-center bg-gradient-to-r from-transparent to-[hsla(224,71%,8%,0.4)] rounded p-2">
                    <div className="w-4 h-4 mr-2 rounded-full" 
                         style={{ 
                           background: `radial-gradient(circle at center, hsl(142.1,70.6%,${45 + (region.percentage / 2)}%) 0%, hsl(142.1,70.6%,25%) 100%)`,
                           boxShadow: `0 0 ${5 + (region.percentage / 15)}px hsl(142.1,70.6%,45.3%)`
                         }}></div>
                    <div>
                      <span className="text-xs font-medium text-[hsl(213,31%,91%)]">
                        {region.name}
                      </span>
                      <div className="text-[10px] text-[hsl(215.4,16.3%,66.9%)]">
                        {region.count} números ({region.percentage.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* Hot and Cold Numbers Section */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <ChartBar size={18} className="text-[hsl(142.1,70.6%,45.3%)] mr-2" /> 
                Números Quentes e Frios
              </CardTitle>
            </CardHeader>
            
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {hot.map((item, i) => (
                  <div 
                    key={i} 
                    className="flex items-center space-x-2 group transition-transform duration-200 hover:scale-105 cursor-pointer"
                    onClick={() => handleNumberSelection(item.number)}
                  >
                    <div className="relative">
                      <NumberDisplay 
                        number={item.number} 
                        size="medium" 
                        highlight={highlightedNumber === item.number}
                      />
                    </div>
                    <Badge variant="secondary" className="text-[hsl(142.1,70.6%,45.3%)]">
                      {item.frequency}x
                    </Badge>
                  </div>
                ))}
              </div>
              
              <div className="flex flex-wrap gap-3">
                {cold.map((item, i) => (
                  <div 
                    key={i} 
                    className="flex items-center space-x-2 group transition-transform duration-200 hover:scale-105 cursor-pointer"
                    onClick={() => handleNumberSelection(item.number)}
                  >
                    <div className="relative">
                      <NumberDisplay 
                        number={item.number} 
                        size="medium" 
                        highlight={highlightedNumber === item.number}
                      />
                    </div>
                    <Badge variant="secondary" className="text-[hsl(142.1,70.6%,45.3%)]">
                      {item.frequency}x
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default RouletteSidePanelStats;