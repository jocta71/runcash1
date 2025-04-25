import { ChartBar, BarChart, ChevronDown, Filter, X } from "lucide-react";
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import globalRouletteDataService from '../services/GlobalRouletteDataService';
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

// Criando um logger específico para este componente
const logger = getLogger('RouletteSidePanelStats');

// Atualizar o POLLING_INTERVAL para 4 segundos
const POLLING_INTERVAL = 4000; // 4 segundos (mesmo intervalo do RouletteCard)

interface RouletteSidePanelStatsProps {
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

// Interface para números de roleta
interface RouletteNumber {
  numero: number;
  timestamp: string;
}

// Tipos para os filtros
type ColorFilter = 'todos' | 'vermelho' | 'preto' | 'verde';

// Tipo para o estado de número selecionado
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

// Atualizar a função fetchRouletteHistoricalNumbers para retornar número e timestamp
export const fetchRouletteHistoricalNumbers = async (rouletteName: string): Promise<RouletteNumber[]> => {
  try {
    logger.info(`Buscando dados históricos para: ${rouletteName}`);
    
    // Primeiro, tentar buscar dados detalhados com limit=1000
    logger.info(`Solicitando dados detalhados (limit=1000) para ${rouletteName}`);
    await globalRouletteDataService.fetchDetailedRouletteData();
    
    // Uma vez que os dados detalhados foram buscados, procurar a roleta específica
    logger.info(`Buscando roleta ${rouletteName} nos dados detalhados`);
    
    // Obter todos os dados detalhados
    const detailedRoulettes = globalRouletteDataService.getAllDetailedRoulettes();
    
    // Procurar a roleta pelo nome nos dados detalhados
    const targetDetailedRoulette = detailedRoulettes.find((roleta: any) => {
      const roletaName = roleta.nome || roleta.name || '';
      return roletaName.toLowerCase() === rouletteName.toLowerCase();
    });
    
    // Se encontrou a roleta nos dados detalhados
    if (targetDetailedRoulette && targetDetailedRoulette.numero && Array.isArray(targetDetailedRoulette.numero)) {
      // Extrair números e timestamps
      const processedDetailedNumbers = targetDetailedRoulette.numero
        .map((n: any) => {
          // Converter timestamp para formato de hora (HH:MM)
          let timeString = "00:00";
          if (n.timestamp) {
            try {
              // Usar diretamente o timestamp da API
              const date = new Date(n.timestamp);
              timeString = date.getHours().toString().padStart(2, '0') + ':' + 
                         date.getMinutes().toString().padStart(2, '0');
              logger.info(`Timestamp API: ${n.timestamp} convertido para ${timeString}`);
            } catch (e) {
              logger.error("Erro ao converter timestamp:", e);
            }
          }
          
          return { 
            numero: Number(n.numero), 
            timestamp: timeString
          };
        })
        .filter((n: any) => !isNaN(n.numero) && n.numero >= 0 && n.numero <= 36);
      
      logger.info(`Obtidos ${processedDetailedNumbers.length} números históricos DETALHADOS para ${rouletteName}`);
      return processedDetailedNumbers;
    }
    
    // Se não encontrou nos dados detalhados, tentar nos dados normais
    logger.info(`Roleta não encontrada nos dados detalhados, tentando dados normais para ${rouletteName}`);
    
    // Obter a roleta pelo nome do serviço global
    const targetRoulette = globalRouletteDataService.getRouletteByName(rouletteName);
    
    if (targetRoulette && targetRoulette.numero && Array.isArray(targetRoulette.numero)) {
      // Extrair números e timestamps
      const processedNumbers = targetRoulette.numero
        .map((n: any) => {
          // Converter timestamp para formato de hora (HH:MM)
          let timeString = "00:00";
          if (n.timestamp) {
            try {
              // Usar diretamente o timestamp da API
              const date = new Date(n.timestamp);
              timeString = date.getHours().toString().padStart(2, '0') + ':' + 
                         date.getMinutes().toString().padStart(2, '0');
              logger.info(`Timestamp API: ${n.timestamp} convertido para ${timeString}`);
            } catch (e) {
              logger.error("Erro ao converter timestamp:", e);
            }
          }
          
          return { 
            numero: Number(n.numero), 
            timestamp: timeString
          };
        })
        .filter((n: any) => !isNaN(n.numero) && n.numero >= 0 && n.numero <= 36);
      
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

// Adicionar a função extractNumbers copiada do RouletteCard
// Função para extrair números da resposta da API
export const extractNumbers = (apiData: any): number[] => {
  // Array para armazenar os números
  let extractedNumbers: number[] = [];
  
  try {
    // A estrutura principal tem um campo "numero" que é um array de objetos
    if (apiData && Array.isArray(apiData.numero) && apiData.numero.length > 0) {
      logger.info(`Extraindo números a partir do campo 'numero'`);
      
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
      logger.warn(`Não foi possível extrair números. Estrutura de dados não reconhecida.`);
    } else {
      logger.info(`Extraídos ${extractedNumbers.length} números`);
    }
  } catch (err) {
    logger.error(`Erro ao extrair números:`, err);
  }
  
  return extractedNumbers;
};

// Função para processar os dados da API e identificar novos números
export const processApiData = (apiRoulette: any, currentNumbers: RouletteNumber[]): RouletteNumber[] => {
  if (!apiRoulette) return currentNumbers;
  
  // Extrair números da API
  const apiNumbers = extractNumbers(apiRoulette);
  if (apiNumbers.length === 0) return currentNumbers;
  
  logger.info(`Processando ${apiNumbers.length} números da API`);
  
  // Caso 1: Não temos números ainda - inicializar com os da API
  if (currentNumbers.length === 0) {
    logger.info(`Inicializando números (${apiNumbers.length} números)`);
    
    // Converter para o formato RouletteNumber com timestamps da API
    const numbersWithTimestamp = apiNumbers.map((num, index) => {
      // Tentar obter timestamp da API
      let timeString = "00:00";
      if (apiRoulette.numero && Array.isArray(apiRoulette.numero) && 
          apiRoulette.numero.length > index && apiRoulette.numero[index].timestamp) {
        try {
          const date = new Date(apiRoulette.numero[index].timestamp);
          timeString = date.getHours().toString().padStart(2, '0') + ':' + 
                      date.getMinutes().toString().padStart(2, '0');
        } catch (e) {
          logger.error("Erro ao converter timestamp:", e);
        }
      }
      
      return {
        numero: num,
        timestamp: timeString
      };
    });
    
    return numbersWithTimestamp;
  }
  
  // Caso 2: Verificar se o último número da API é diferente do nosso
  if (apiNumbers[0] === currentNumbers[0]?.numero) {
    // Nenhum número novo
    return currentNumbers;
  }
  
  // Caso 3: Temos números novos na API
  // Procurar por números novos que ainda não estão na nossa lista
  const newNumbers: RouletteNumber[] = [];
  const currentNumeros = currentNumbers.map(item => item.numero);
  
  // Percorrer a lista da API até encontrar um número que já temos
  for (let i = 0; i < apiNumbers.length; i++) {
    const apiNum = apiNumbers[i];
    
    // Se encontramos um número que já está na nossa lista, paramos
    if (currentNumeros.includes(apiNum)) {
      break;
    }
    
    // Obter timestamp da API para este número
    let timeString = "00:00";
    if (apiRoulette.numero && Array.isArray(apiRoulette.numero) && 
        apiRoulette.numero.length > i && apiRoulette.numero[i].timestamp) {
      try {
        const date = new Date(apiRoulette.numero[i].timestamp);
        timeString = date.getHours().toString().padStart(2, '0') + ':' + 
                    date.getMinutes().toString().padStart(2, '0');
      } catch (e) {
        logger.error("Erro ao converter timestamp:", e);
      }
    }
    
    // Adicionar o número novo à nossa lista temporária
    newNumbers.push({
      numero: apiNum,
      timestamp: timeString
    });
  }
  
  // Se encontramos números novos, atualizamos o estado
  if (newNumbers.length > 0) {
    logger.info(`${newNumbers.length} novos números: ${newNumbers.map(n => n.numero).join(', ')}`);
    
    // Adicionar os novos números no início da nossa lista
    const updatedNumbers = [...newNumbers, ...currentNumbers];
    
    // Limitar a 1000 números no máximo
    return updatedNumbers.slice(0, 1000);
  }
  
  return currentNumbers;
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

// Modificando o componente para integrar lastNumbers aos dados históricos
const RouletteSidePanelStats: React.FC<RouletteSidePanelStatsProps> = ({ 
  roletaNome, 
  lastNumbers, 
  wins, 
  losses,
  providers = [] 
}: RouletteSidePanelStatsProps) => {
  const [historicalNumbers, setHistoricalNumbers] = useState<RouletteNumber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleNumbersCount, setVisibleNumbersCount] = useState(44); // Inicializar com 30 números visíveis
  const [colorFilter, setColorFilter] = useState<ColorFilter>('todos'); // Filtro de cor
  const isInitialRequestDone = useRef(false);
  const subscriberId = useRef(uniqueId('roulette_stats_subscriber_'));
  
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

  // Função para processar os dados da roleta - otimizada para menos recálculos
  const handleApiData = useCallback(() => {
    // Obter os dados do serviço global - estes são os MESMOS dados que o RouletteCard usa
    const allRoulettes = globalRouletteDataService.getAllRoulettes();
    
    if (!allRoulettes || !Array.isArray(allRoulettes) || allRoulettes.length === 0) return;
    
    // Encontrar a roleta específica pelo nome
    const myRoulette = allRoulettes.find((roulette: any) => {
      const name = roulette.nome || roulette.name || '';
      return name.toLowerCase() === roletaNome.toLowerCase();
    });
    
    if (!myRoulette) return;
    
    // Extrair números da API apenas se a roleta for encontrada
    const apiNumbers = extractNumbers(myRoulette);
    if (apiNumbers.length === 0) return;
    
    // Verificar se é a primeira carga
    if (historicalNumbers.length === 0) {
      // Primeira carga de dados - processar todos os números
      const numbersWithTimestamp = apiNumbers.map((num, index) => {
        // Obter timestamp da API
        let timeString = "00:00";
        if (myRoulette.numero && Array.isArray(myRoulette.numero) && 
            myRoulette.numero.length > index && myRoulette.numero[index].timestamp) {
          try {
            const date = new Date(myRoulette.numero[index].timestamp);
            timeString = date.getHours().toString().padStart(2, '0') + ':' + 
                       date.getMinutes().toString().padStart(2, '0');
          } catch (e) {
            logger.error("Erro ao converter timestamp:", e);
          }
        }
        
        return {
          numero: num,
          timestamp: timeString
        };
      });
      
      setHistoricalNumbers(numbersWithTimestamp);
      setIsLoading(false);
      isInitialRequestDone.current = true;
      return;
    }
    
    // Verificação rápida: se o primeiro número for o mesmo, não precisa processar nada
    if (apiNumbers[0] === historicalNumbers[0]?.numero) return;
    
    // Processar apenas os números novos (otimizado)
    let newNumbersCount = 0;
    const firstExistingIndex = apiNumbers.findIndex(num => 
      historicalNumbers.some(hn => hn.numero === num)
    );
    
    if (firstExistingIndex === -1) {
      // Nenhum número em comum - processar todos da API
      newNumbersCount = apiNumbers.length;
    } else {
      // Processar apenas os que vêm antes do primeiro número existente
      newNumbersCount = firstExistingIndex;
    }
    
    if (newNumbersCount === 0) return;
    
    // Processar apenas os números novos
    const newNumbers: RouletteNumber[] = [];
    for (let i = 0; i < newNumbersCount; i++) {
      // Obter timestamp
      let timeString = "00:00";
      if (myRoulette.numero && Array.isArray(myRoulette.numero) && 
          myRoulette.numero.length > i && myRoulette.numero[i].timestamp) {
        try {
          const date = new Date(myRoulette.numero[i].timestamp);
          timeString = date.getHours().toString().padStart(2, '0') + ':' + 
                      date.getMinutes().toString().padStart(2, '0');
        } catch (e) {
          logger.error("Erro ao converter timestamp:", e);
        }
      }
      
      newNumbers.push({
        numero: apiNumbers[i],
        timestamp: timeString
      });
    }
    
    // Atualizar histórico com os novos números
    setHistoricalNumbers(prev => {
      const combined = [...newNumbers, ...prev];
      return combined.slice(0, 1000);
    });
    
    setIsLoading(false);
    isInitialRequestDone.current = true;
  }, [roletaNome]); // Removi historicalNumbers das dependências para evitar recálculos desnecessários

  // Efeito para assinar diretamente o globalRouletteDataService - SIMPLIFICADO
  useEffect(() => {
    logger.info(`Inicializando histórico para ${roletaNome}`);
    
    // Resetar estado
    isInitialRequestDone.current = false;
    setIsLoading(true);
    setHistoricalNumbers([]);
    
    // Primeiro, solicitar dados detalhados com limit=1000
    globalRouletteDataService.fetchDetailedRouletteData()
      .then(() => {
        logger.info(`Dados detalhados solicitados com limit=1000 para ${roletaNome}`);
        // Processar dados após a requisição
        handleApiData();
      })
      .catch(error => {
        logger.error(`Erro ao solicitar dados detalhados: ${error}`);
      });
    
    // Registrar no serviço global com verificação de throttling
    let lastUpdateTime = 0;
    const THROTTLE_TIME = 4000; // 4 segundos
    
    globalRouletteDataService.subscribe(subscriberId.current, () => {
      const now = Date.now();
      // Verificação de throttling para garantir 4s de intervalo entre atualizações
      if (now - lastUpdateTime < THROTTLE_TIME) return;
      
      lastUpdateTime = now;
      handleApiData();
    });
    
    // Limpar inscrição ao desmontar
    return () => {
      globalRouletteDataService.unsubscribe(subscriberId.current);
    };
  }, [roletaNome, handleApiData, subscriberId]);

  // Simplificar o useEffect para processar lastNumbers
  useEffect(() => {
    // Verificações rápidas para evitar processamento desnecessário
    if (!lastNumbers?.length || !isInitialRequestDone.current) return;
    if (historicalNumbers.length > 0 && lastNumbers[0] === historicalNumbers[0].numero) return;
    
    // Verificar apenas novos números uma vez
    const existingNumeros = new Set(historicalNumbers.map(item => item.numero));
    const newNumbers: RouletteNumber[] = [];
    
    // Processar apenas até encontrar um número já existente
    for (const num of lastNumbers) {
      if (existingNumeros.has(num)) break;
      
      // Adicionar novo número com timestamp atual
      const now = new Date();
      const timeString = now.getHours().toString().padStart(2, '0') + ':' + 
                      now.getMinutes().toString().padStart(2, '0');
      newNumbers.push({ numero: num, timestamp: timeString });
      
      // Adicionar ao conjunto para não processar duplicatas nesta mesma execução
      existingNumeros.add(num);
    }
    
    // Atualizar apenas se houver novos números
    if (newNumbers.length > 0) {
      setHistoricalNumbers(prev => {
        const combined = [...newNumbers, ...prev];
        return combined.slice(0, 1000);
      });
    }
  }, [lastNumbers, roletaNome, historicalNumbers]);

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
      // O filtro de provedor provavelmente depende de uma outra lógica
      // que relaciona o nome da roleta com o provedor
      // Este é apenas um placeholder
    }
    
    return filtered;
  }, [historicalNumbers, selectedColor, selectedNumber, selectedParity, selectedTime, selectedProviders]);

  // Números a serem exibidos com filtro aplicado
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

  return (
    <div className="w-full h-full bg-[#0B0B10] rounded-lg border border-gray-800/30 overflow-hidden">
      <div className="bg-[#131614] p-4 px-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <ChartBar className="h-5 w-5 text-[hsl(142.1,70.6%,45.3%)]" />
            <h3 className="text-base font-bold text-white">{roletaNome} - Estatísticas</h3>
          </div>
          <div className="text-xs text-gray-400">
            Analisando {historicalNumbers.length} rodadas
          </div>
        </div>
        
        {/* ... existing code ... */}
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center p-16">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-muted border-t-[hsl(142.1,70.6%,45.3%)]"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {/* ... existing code ... */}
        </div>
      )}
    </div>
  );
};

export default RouletteSidePanelStats;