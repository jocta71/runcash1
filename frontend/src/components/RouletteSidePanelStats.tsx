import { ChartBar, BarChart, ArrowDown, ArrowUp, PercentIcon, ChevronDown, Filter, X } from "lucide-react";
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
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import globalRouletteDataService from '../services/GlobalRouletteDataService';
import rouletteHistoryService from '../services/RouletteHistoryService';
import { getLogger } from '../services/utils/logger';
import { uniqueId } from 'lodash';

// Criando um logger específico para este componente
const logger = getLogger('RouletteSidePanelStats');

// Atualizar o POLLING_INTERVAL para 4 segundos
const POLLING_INTERVAL = 4000; // 4 segundos (mesmo intervalo do RouletteCard)

interface RouletteSidePanelStatsProps {
  roletaNome: string;
  lastNumbers: number[];
  wins: number;
  losses: number;
}

// Modificar a interface para incluir timestamp
interface RouletteNumber {
  numero: number;
  timestamp: string;
}

// Tipo para filtros de cor
type ColorFilter = 'todos' | 'vermelho' | 'preto' | 'verde';
type ParityFilter = 'todas' | 'par' | 'impar';
type NumberFilter = number | null;
type TimeFilter = number | null; // em minutos

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
    return "text-white bg-[#FF1D46]";
  } else {
    return "text-white bg-[#292524]";
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

// Modificando o componente para integrar lastNumbers aos dados históricos
const RouletteSidePanelStats: React.FC<RouletteSidePanelStatsProps> = ({ 
  roletaNome, 
  lastNumbers, 
  wins, 
  losses 
}: RouletteSidePanelStatsProps) => {
  const [historicalNumbers, setHistoricalNumbers] = useState<RouletteNumber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleNumbersCount, setVisibleNumbersCount] = useState(44); // Inicializar com 30 números visíveis
  const [colorFilter, setColorFilter] = useState<ColorFilter>('todos'); // Filtro de cor
  const [parityFilter, setParityFilter] = useState<ParityFilter>('todas'); // Filtro de paridade
  const [numberFilter, setNumberFilter] = useState<NumberFilter>(null); // Filtro de número
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(null); // Filtro de tempo
  const [showFilters, setShowFilters] = useState(false); // Controla a visibilidade dos filtros avançados
  const isInitialRequestDone = useRef(false);
  const subscriberId = useRef(uniqueId('roulette_stats_subscriber_'));
  
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

  // Função para filtrar números por paridade
  const handleFilterByParity = (parity: ParityFilter) => {
    setParityFilter(parity);
    setVisibleNumbersCount(30);
  };

  // Função para filtrar por número específico
  const handleFilterByNumber = (number: NumberFilter) => {
    setNumberFilter(number);
    setVisibleNumbersCount(30);
  };

  // Função para filtrar por tempo
  const handleFilterByTime = (minutes: TimeFilter) => {
    setTimeFilter(minutes);
    setVisibleNumbersCount(30);
  };

  // Função para limpar todos os filtros
  const handleClearAllFilters = () => {
    setColorFilter('todos');
    setParityFilter('todas');
    setNumberFilter(null);
    setTimeFilter(null);
    setVisibleNumbersCount(44);
  };

  // Verificar se um número é par ou ímpar
  const checkParity = (numero: number): ParityFilter => {
    if (numero === 0) return 'todas'; // Zero não é considerado par nem ímpar
    return numero % 2 === 0 ? 'par' : 'impar';
  };

  // Verificar se um número está dentro do filtro de tempo
  const isWithinTimeFilter = (timestamp: string): boolean => {
    if (!timeFilter) return true;
    
    const now = new Date();
    const [hours, minutes] = timestamp.split(':').map(Number);
    const eventTime = new Date();
    eventTime.setHours(hours, minutes, 0, 0);
    
    // Se a hora do evento for maior que a hora atual, assumimos que é do dia anterior
    if (eventTime > now) {
      eventTime.setDate(eventTime.getDate() - 1);
    }
    
    const diffMs = now.getTime() - eventTime.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    return diffMinutes <= timeFilter;
  };

  // Filtrar números com todos os filtros aplicados
  const filteredNumbers = useMemo(() => {
    return historicalNumbers.filter(item => {
      // Filtro de cor
      const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
      let passesColorFilter = true;
      
      if (colorFilter === 'verde') passesColorFilter = item.numero === 0;
      else if (colorFilter === 'vermelho') passesColorFilter = redNumbers.includes(item.numero);
      else if (colorFilter === 'preto') passesColorFilter = item.numero !== 0 && !redNumbers.includes(item.numero);
      
      // Filtro de paridade
      let passesParityFilter = true;
      if (parityFilter !== 'todas') {
        passesParityFilter = checkParity(item.numero) === parityFilter;
      }
      
      // Filtro de número específico
      let passesNumberFilter = true;
      if (numberFilter !== null) {
        passesNumberFilter = item.numero === numberFilter;
      }
      
      // Filtro de tempo
      let passesTimeFilter = true;
      if (timeFilter !== null) {
        passesTimeFilter = isWithinTimeFilter(item.timestamp);
      }
      
      return passesColorFilter && passesParityFilter && passesNumberFilter && passesTimeFilter;
    });
  }, [historicalNumbers, colorFilter, parityFilter, numberFilter, timeFilter]);

  // Números a serem exibidos com filtro aplicado
  const visibleNumbers = filteredNumbers.slice(0, visibleNumbersCount);

  const frequencyData = generateFrequencyData(historicalNumbers.map(n => n.numero));
  const { hot, cold } = getHotColdNumbers(frequencyData);
  const pieData = generateGroupDistribution(historicalNumbers.map(n => n.numero));
  const colorHourlyStats = generateColorHourlyStats(historicalNumbers.map(n => n.numero));
  
  const winRate = (wins / (wins + losses)) * 100;

  return (
    <div className="w-full rounded-lg overflow-y-auto max-h-screen">
      <div className="p-5 border-b border-gray-800 bg-opacity-40">
        <h2 className="text-white flex items-center text-xl font-bold mb-3">
          <BarChart className="mr-3 text-vegas-green h-6 w-6" /> Estatísticas da {roletaNome}
        </h2>
        <p className="text-sm text-gray-400">
          {isLoading ? (
            ""
          ) : (
            `Análise detalhada dos últimos ${historicalNumbers.length} números e tendências`
          )}
        </p>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center p-16">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-700 border-t-vegas-green"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5">
          {/* Seção de filtros avançados */}
          <div className="md:col-span-2 p-5 rounded-xl border border-gray-700 bg-opacity-50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-vegas-green" />
                <h3 className="text-sm font-medium text-white">Filtros avançados</h3>
              </div>
              
              <div className="flex items-center gap-2">
                {(colorFilter !== 'todos' || parityFilter !== 'todas' || numberFilter !== null || timeFilter !== null) && (
                  <button 
                    onClick={handleClearAllFilters}
                    className="flex items-center gap-1 py-1 px-2 text-xs bg-black bg-opacity-50 text-gray-400 hover:text-white rounded-md transition-all duration-200"
                  >
                    <X size={12} /> Limpar filtros
                  </button>
                )}
                
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-1 py-1 px-2 text-xs bg-vegas-green hover:bg-[#05C77F] text-black font-medium rounded-md transition-all duration-200"
                >
                  {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
                </button>
              </div>
            </div>
            
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
                {/* Filtro por número */}
                <div>
                  <div className="text-xs text-gray-400 mb-2">Por número</div>
                  <div className="grid grid-cols-9 gap-1 max-h-[200px] overflow-y-auto p-2 bg-black bg-opacity-30 rounded-md">
                    <button 
                      onClick={() => handleFilterByNumber(null)}
                      className={`w-8 h-8 text-xs rounded-md transition-all ${
                        numberFilter === null 
                          ? 'bg-vegas-green text-black font-medium' 
                          : 'bg-black bg-opacity-70 text-white hover:bg-opacity-50'
                      }`}
                    >
                      Todos
                    </button>
                    {[...Array(37)].map((_, i) => (
                      <button 
                        key={i} 
                        onClick={() => handleFilterByNumber(i)}
                        className={`w-8 h-8 text-xs rounded-md transition-all ${
                          numberFilter === i 
                            ? (i === 0 
                                ? 'bg-vegas-green text-black font-medium' 
                                : getRouletteNumberColor(i)) 
                            : (i === 0 
                                ? 'bg-vegas-green bg-opacity-20 text-white hover:bg-opacity-70' 
                                : `bg-black bg-opacity-70 text-white hover:bg-opacity-50`)
                        }`}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Filtro por cores */}
                <div>
                  <div className="text-xs text-gray-400 mb-2">Por cores</div>
                  <div className="flex flex-col space-y-2">
                    <button
                      onClick={() => handleFilterByColor('todos')}
                      className={`px-3 py-2 text-xs rounded-md transition-all ${
                        colorFilter === 'todos' 
                          ? 'bg-vegas-green text-black font-medium' 
                          : 'bg-black bg-opacity-70 text-white hover:bg-opacity-50'
                      }`}
                    >
                      Todas as cores
                    </button>
                    <button
                      onClick={() => handleFilterByColor('vermelho')}
                      className={`px-3 py-2 text-xs rounded-md transition-all ${
                        colorFilter === 'vermelho' 
                          ? 'bg-[#FF1D46] text-white font-medium' 
                          : 'bg-black bg-opacity-70 text-white hover:bg-opacity-50'
                      }`}
                    >
                      <div className="flex items-center">
                        <span className="mr-2 w-2 h-2 rounded-full bg-red-600"></span> Vermelhos
                      </div>
                    </button>
                    <button
                      onClick={() => handleFilterByColor('preto')}
                      className={`px-3 py-2 text-xs rounded-md transition-all ${
                        colorFilter === 'preto' 
                          ? 'bg-[#292524] text-white font-medium' 
                          : 'bg-black bg-opacity-70 text-white hover:bg-opacity-50'
                      }`}
                    >
                      <div className="flex items-center">
                        <span className="mr-2 w-2 h-2 rounded-full bg-gray-900"></span> Pretos
                      </div>
                    </button>
                    <button
                      onClick={() => handleFilterByColor('verde')}
                      className={`px-3 py-2 text-xs rounded-md transition-all ${
                        colorFilter === 'verde' 
                          ? 'bg-vegas-green text-black font-medium' 
                          : 'bg-black bg-opacity-70 text-white hover:bg-opacity-50'
                      }`}
                    >
                      <div className="flex items-center">
                        <span className="mr-2 w-2 h-2 rounded-full bg-green-600"></span> Zero
                      </div>
                    </button>
                  </div>
                </div>
                
                {/* Filtro por paridade */}
                <div>
                  <div className="text-xs text-gray-400 mb-2">Por paridade</div>
                  <div className="flex flex-col space-y-2">
                    <button
                      onClick={() => handleFilterByParity('todas')}
                      className={`px-3 py-2 text-xs rounded-md transition-all ${
                        parityFilter === 'todas' 
                          ? 'bg-vegas-green text-black font-medium' 
                          : 'bg-black bg-opacity-70 text-white hover:bg-opacity-50'
                      }`}
                    >
                      Todas
                    </button>
                    <button
                      onClick={() => handleFilterByParity('par')}
                      className={`px-3 py-2 text-xs rounded-md transition-all ${
                        parityFilter === 'par' 
                          ? 'bg-vegas-green text-black font-medium' 
                          : 'bg-black bg-opacity-70 text-white hover:bg-opacity-50'
                      }`}
                    >
                      Pares
                    </button>
                    <button
                      onClick={() => handleFilterByParity('impar')}
                      className={`px-3 py-2 text-xs rounded-md transition-all ${
                        parityFilter === 'impar' 
                          ? 'bg-vegas-green text-black font-medium' 
                          : 'bg-black bg-opacity-70 text-white hover:bg-opacity-50'
                      }`}
                    >
                      Ímpares
                    </button>
                  </div>
                </div>
                
                {/* Filtro por tempo */}
                <div>
                  <div className="text-xs text-gray-400 mb-2">Por tempo</div>
                  <div className="flex flex-col space-y-2">
                    <button
                      onClick={() => handleFilterByTime(null)}
                      className={`px-3 py-2 text-xs rounded-md transition-all ${
                        timeFilter === null 
                          ? 'bg-vegas-green text-black font-medium' 
                          : 'bg-black bg-opacity-70 text-white hover:bg-opacity-50'
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => handleFilterByTime(1)}
                      className={`px-3 py-2 text-xs rounded-md transition-all ${
                        timeFilter === 1 
                          ? 'bg-vegas-green text-black font-medium' 
                          : 'bg-black bg-opacity-70 text-white hover:bg-opacity-50'
                      }`}
                    >
                      Último 1 min
                    </button>
                    <button
                      onClick={() => handleFilterByTime(5)}
                      className={`px-3 py-2 text-xs rounded-md transition-all ${
                        timeFilter === 5 
                          ? 'bg-vegas-green text-black font-medium' 
                          : 'bg-black bg-opacity-70 text-white hover:bg-opacity-50'
                      }`}
                    >
                      Últimos 5 min
                    </button>
                    <button
                      onClick={() => handleFilterByTime(30)}
                      className={`px-3 py-2 text-xs rounded-md transition-all ${
                        timeFilter === 30 
                          ? 'bg-vegas-green text-black font-medium' 
                          : 'bg-black bg-opacity-70 text-white hover:bg-opacity-50'
                      }`}
                    >
                      Últimos 30 min
                    </button>
                    <button
                      onClick={() => handleFilterByTime(60)}
                      className={`px-3 py-2 text-xs rounded-md transition-all ${
                        timeFilter === 60 
                          ? 'bg-vegas-green text-black font-medium' 
                          : 'bg-black bg-opacity-70 text-white hover:bg-opacity-50'
                      }`}
                    >
                      Última 1 hora
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Historical Numbers Section */}
          <div className="p-5 rounded-xl border border-gray-700 bg-opacity-50 md:col-span-2">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
              <h3 className="text-white flex items-center text-base font-bold">
                <BarChart className="mr-2 h-5 w-5 text-vegas-green" /> Histórico de Números 
                <span className="ml-2 text-xs font-normal text-vegas-green">
                  (Mostrando {visibleNumbers.length} de {filteredNumbers.length})
                </span>
              </h3>
            </div>
            
            {visibleNumbers.length > 0 ? (
              <div className="flex flex-wrap gap-2 p-4 border border-gray-700 rounded-xl" style={{ backgroundColor: 'rgb(19 22 20 / var(--tw-bg-opacity, 1))' }}>
                {visibleNumbers.map((n, idx) => (
                  <div 
                    key={idx} 
                    className="flex flex-col items-center mb-2 w-11"
                  >
                    <div className={`w-9 h-9 flex items-center justify-center text-sm font-medium rounded-md border border-gray-700 ${getRouletteNumberColor(n.numero)} hover:scale-110 transition-transform duration-200`}>
                      {n.numero}
                    </div>
                    <div className="text-[9px] text-gray-400 mt-1">
                      {n.timestamp}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex justify-center items-center h-[200px] rounded-xl text-gray-400" style={{ backgroundColor: 'rgb(19 22 20 / var(--tw-bg-opacity, 1))' }}>
                Nenhum número encontrado com o filtro selecionado
              </div>
            )}
            
            {visibleNumbersCount < filteredNumbers.length && (
              <div className="flex justify-center mt-5">
                <button 
                  onClick={handleShowMore} 
                  className="flex items-center gap-2 py-2.5 px-6 text-sm bg-vegas-green hover:bg-[#05C77F] text-black font-medium rounded-md transition-all duration-200 transform hover:-translate-y-0.5"
                >
                  Mostrar Mais {filteredNumbers.length - visibleNumbersCount} Números <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Distribution Pie Chart */}
          <div className="p-5 space-y-4 bg-opacity-50 border border-gray-700 rounded-xl">
            <h3 className="text-sm font-medium text-white flex items-center">
              <ChartBar size={20} className="text-vegas-green mr-2" /> Distribuição por Cor
            </h3>
            <div className="h-[220px] pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="white"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0,0,0,0.8)', 
                      borderColor: '#059669',
                      borderRadius: '8px'
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Win Rate Chart */}
          <div className="p-5 space-y-4 bg-opacity-50 border border-gray-700 rounded-xl">
            <h3 className="text-sm font-medium text-white flex items-center">
              <PercentIcon size={20} className="text-vegas-green mr-2" /> Taxa de Vitória
            </h3>
            <div className="h-[220px] pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Vitórias", value: wins || 1 },
                      { name: "Derrotas", value: losses || 1 }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    fill="white"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    <Cell key="wins" fill="#059669" stroke="transparent" />
                    <Cell key="losses" fill="#ef4444" stroke="transparent" />
                  </Pie>
                  <Legend verticalAlign="bottom" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0,0,0,0.8)', 
                      borderColor: '#059669',
                      borderRadius: '8px'
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Hot & Cold Numbers */}
          <div className="p-5 space-y-4 md:col-span-2 bg-opacity-50 border border-gray-700 rounded-xl">
            <h3 className="text-sm font-medium text-white flex items-center">
              <ChartBar size={20} className="text-vegas-green mr-2" /> Números Quentes & Frios
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-gray-800" style={{ backgroundColor: 'rgb(19 22 20 / var(--tw-bg-opacity, 1))' }}>
                <h4 className="text-xs font-medium text-red-400 mb-3 flex items-center">
                  <ArrowUp size={18} className="mr-2" /> Números Quentes
                </h4>
                <div className="flex flex-wrap gap-3">
                  {hot.map((item, i) => (
                    <div key={i} className="flex items-center space-x-2 group transition-transform duration-200 hover:scale-105">
                      <div className={`w-8 h-8 rounded-md ${getRouletteNumberColor(item.number)} flex items-center justify-center text-xs font-medium border border-gray-700`}>
                        {item.number}
                      </div>
                      <span className="text-vegas-green text-xs font-medium">({item.frequency}x)</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="p-4 rounded-xl border border-gray-800" style={{ backgroundColor: 'rgb(19 22 20 / var(--tw-bg-opacity, 1))' }}>
                <h4 className="text-xs font-medium text-blue-400 mb-3 flex items-center">
                  <ArrowDown size={18} className="mr-2" /> Números Frios
                </h4>
                <div className="flex flex-wrap gap-3">
                  {cold.map((item, i) => (
                    <div key={i} className="flex items-center space-x-2 group transition-transform duration-200 hover:scale-105">
                      <div className={`w-8 h-8 rounded-md ${getRouletteNumberColor(item.number)} flex items-center justify-center text-xs font-medium border border-gray-700`}>
                        {item.number}
                      </div>
                      <span className="text-vegas-green text-xs font-medium">({item.frequency}x)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Frequency Chart */}
          <div className="p-5 space-y-4 md:col-span-2 bg-opacity-50 border border-gray-700 rounded-xl">
            <h3 className="text-sm font-medium text-white flex items-center">
              <ChartBar size={20} className="text-vegas-green mr-2" /> Frequência de Números
            </h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={frequencyData} margin={{ top: 10, right: 10, left: 10, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis 
                    dataKey="number" 
                    stroke="#ccc" 
                    tick={{fontSize: 11}}
                    tickLine={false}
                    axisLine={{stroke: '#333'}}
                  />
                  <YAxis 
                    stroke="#ccc" 
                    tick={{fontSize: 11}}
                    tickLine={false}
                    axisLine={{stroke: '#333'}}
                    width={30}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0,0,0,0.8)', 
                      borderColor: '#059669', 
                      borderRadius: '8px'
                    }} 
                    labelStyle={{ color: 'white' }}
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                  />
                  <Bar 
                    dataKey="frequency" 
                    fill="#059669"
                    radius={[4, 4, 0, 0]}
                    animationDuration={1500}
                  />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Média de cores por hora */}
          <div className="p-5 space-y-4 md:col-span-2 bg-opacity-50 border border-gray-700 rounded-xl">
            <h3 className="text-sm font-medium text-white flex items-center">
              <ChartBar size={20} className="text-vegas-green mr-2" /> Média de cores por hora
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {colorHourlyStats.map((stat, index) => (
                <div key={`color-stat-${index}`} className="bg-black bg-opacity-30 border border-gray-800 rounded-xl p-4 transition-shadow duration-200">
                  <div className="flex items-center">
                    <div 
                      className="w-10 h-10 rounded-lg mr-3 flex items-center justify-center" 
                      style={{ backgroundColor: stat.color === "#111827" ? "black" : stat.color }}
                    >
                      <div className="w-6 h-6 rounded-full border-2 border-white"></div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{stat.name}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Total de {stat.total} 
                        <span className="bg-black bg-opacity-60 text-xs px-2 py-0.5 rounded-full ml-2 text-vegas-green">
                          {stat.percentage}%
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouletteSidePanelStats; 