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
    <div className="w-full rounded-lg overflow-y-auto max-h-screen border-l border-border">
      <div className="p-5 border-b border-gray-800 bg-opacity-40">
        <h2 className="text-white flex items-center text-xl font-bold mb-3">
          <BarChart className="mr-3 text-vegas-green h-6 w-6" /> Estatísticas da {roletaNome}
        </h2>
        <p className="text-sm text-gray-400">
          {isLoading ? (
            ""
          ) : (
            ""
          )}
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
                    {visibleNumbers.map((n, idx) => (
                      <div 
                        key={`${n.numero}-${idx}`} 
                        className="relative cursor-pointer transition-transform hover:scale-110"
                        onClick={() => handleNumberSelection(n.numero)}
                      >
                        <NumberDisplay 
                          number={n.numero} 
                          size="medium" 
                          highlight={highlightedNumber === n.numero}
                        />
                        <div className="text-xs text-gray-400 text-center mt-1">{n.timestamp}</div>
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
                  Nenhum número encontrado
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