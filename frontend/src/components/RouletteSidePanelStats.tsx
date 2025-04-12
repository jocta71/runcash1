import { ChartBar, BarChart, ArrowDown, ArrowUp, PercentIcon } from "lucide-react";
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

// Criando um logger específico para este componente
const logger = getLogger('RouletteSidePanelStats');

// Compartilhar a mesma constante de intervalo de polling usada no RouletteFeedService
const POLLING_INTERVAL = 10000; // 10 segundos

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
    return "bg-red-600 text-white";
  } else {
    return "bg-black text-white";
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

// Implementar o mesmo método do RouletteCard para gerenciar dados
// Adicionando a classe GlobalRouletteDataManager que o RouletteCard usa
class GlobalRouletteDataManager {
  private static instance: GlobalRouletteDataManager | null = null;
  private updateCallbacks: Map<string, (data: any) => void> = new Map();
  private initialDataLoaded: boolean = false;
  
  private constructor() {
    logger.info('[RouletteSidePanelStats] Inicializando gerenciador de dados para histórico');
  }
  
  public static getInstance(): GlobalRouletteDataManager {
    if (!GlobalRouletteDataManager.instance) {
      GlobalRouletteDataManager.instance = new GlobalRouletteDataManager();
    }
    return GlobalRouletteDataManager.instance;
  }
  
  public subscribe(id: string, callback: (data: any) => void): () => void {
    logger.info(`[RouletteSidePanelStats] Novo assinante de histórico registrado: ${id}`);
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
      logger.info(`[RouletteSidePanelStats] Assinante de histórico removido: ${id}`);
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

// Modificando o componente para integrar lastNumbers aos dados históricos
const RouletteSidePanelStats = ({ 
  roletaNome, 
  lastNumbers, 
  wins, 
  losses 
}: RouletteSidePanelStatsProps) => {
  const [historicalNumbers, setHistoricalNumbers] = useState<RouletteNumber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const subscriberId = useRef<string>(`sidepanel-${roletaNome}-${Math.random().toString(36).substring(2, 9)}`);
  const isInitialRequestDone = useRef<boolean>(false);
  
  // Referência ao gerenciador de dados (mesmo usado pelo RouletteCard)
  const dataManager = useMemo(() => GlobalRouletteDataManager.getInstance(), []);
  
  // Função para processar os dados da roleta (mesma do RouletteCard)
  const handleApiData = useCallback((allRoulettes: any[]) => {
    if (!allRoulettes || !Array.isArray(allRoulettes) || allRoulettes.length === 0) return;
    
    // Encontrar a roleta específica pelo nome
    const myRoulette = allRoulettes.find((roulette: any) => 
      roulette.nome === roletaNome || 
      roulette.name === roletaNome
    );
    
    if (!myRoulette) {
      logger.warn(`Roleta com nome ${roletaNome} não encontrada na resposta`);
      return;
    }
    
    // Extrair números
    const apiNumbers = extractNumbers(myRoulette);
    logger.info(`Obtidos ${apiNumbers.length} números de ${roletaNome} via gerenciador global`);
    
    // Verificar se é a primeira carga ou se temos números novos
    if (historicalNumbers.length === 0) {
      // Primeira carga de dados
      const numbersWithTimestamp = apiNumbers.map((num, index) => {
        // Tentar obter timestamp da API
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
      logger.info(`Histórico inicial carregado: ${numbersWithTimestamp.length} números`);
    } else {
      // Temos dados, verificar se há números novos
      // Verificar se o primeiro número da API é diferente do nosso
      if (apiNumbers[0] === historicalNumbers[0]?.numero) {
        logger.info(`Sem novos números para processar`);
        return;
      }
      
      // Procurar por números novos (mesmo método do RouletteCard)
      const newNumbers: RouletteNumber[] = [];
      const currentNumeros = historicalNumbers.map(item => item.numero);
      
      // Percorrer a lista da API até encontrar um número que já temos
      for (let i = 0; i < apiNumbers.length; i++) {
        const apiNum = apiNumbers[i];
        
        // Se encontramos um número que já está na nossa lista, paramos
        if (currentNumeros.includes(apiNum)) {
          break;
        }
        
        // Obter timestamp da API para este número
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
        
        // Adicionar o número novo à nossa lista temporária
        newNumbers.push({
          numero: apiNum,
          timestamp: timeString
        });
      }
      
      // Se encontramos números novos, atualizamos o estado
      if (newNumbers.length > 0) {
        logger.info(`Adicionando ${newNumbers.length} novos números via gerenciador global: ${newNumbers.map(n => n.numero).join(', ')}`);
        
        // Adicionar os novos números no início da nossa lista
        setHistoricalNumbers(prev => {
          const combined = [...newNumbers, ...prev];
          // Limitar a 1000 números no máximo
          return combined.slice(0, 1000);
        });
      }
    }
    
    setIsLoading(false);
    isInitialRequestDone.current = true;
  }, [roletaNome, historicalNumbers]);
  
  // Efeito para usar o GlobalRouletteDataManager (como o RouletteCard faz)
  useEffect(() => {
    logger.info(`Inicializando historico para ${roletaNome} usando GlobalRouletteDataManager`);
    
    // Resetar o estado de inicialização se a roleta mudar
    isInitialRequestDone.current = false;
    setIsLoading(true);
    
    // Limpar o histórico ao mudar de roleta para evitar exibir dados da roleta anterior
    setHistoricalNumbers([]);
    
    // Assinar atualizações do gerenciador global
    const unsubscribe = dataManager.subscribe(subscriberId.current, handleApiData);
    
    // Limpar inscrição ao desmontar o componente
    return () => {
      unsubscribe();
    };
  }, [roletaNome, dataManager, handleApiData, subscriberId]);
  
  // Manter o useEffect para processar lastNumbers quando eles mudam
  useEffect(() => {
    // Se lastNumbers está vazio, não fazer nada
    if (!lastNumbers || lastNumbers.length === 0 || !isInitialRequestDone.current) {
      return;
    }
    
    logger.info(`Processando ${lastNumbers.length} números recentes de RouletteCard`);
    
    // Converter lastNumbers para o formato RouletteNumber
    const lastNumbersWithTime = lastNumbers.map((num, idx) => {
      // Obter timestamp atual para os números recentes
      const now = new Date();
      const timeString = now.getHours().toString().padStart(2, '0') + ':' + 
                     now.getMinutes().toString().padStart(2, '0');
      return { numero: num, timestamp: timeString };
    });
    
    // Verificar se o primeiro número já existe no início do histórico
    if (historicalNumbers.length > 0 && lastNumbers[0] === historicalNumbers[0].numero) {
      logger.info(`Primeiro número recente ${lastNumbers[0]} já está no histórico, ignorando`);
      return;
    }
    
    // Identificar apenas os números realmente novos (mesmo método do RouletteCard)
    const newNumbers: RouletteNumber[] = [];
    const currentNumeros = historicalNumbers.map(item => item.numero);
    
    // Percorrer a lista de números recentes até encontrar um número que já temos
    for (let i = 0; i < lastNumbersWithTime.length; i++) {
      const newNum = lastNumbersWithTime[i];
      
      // Se encontramos um número que já está no histórico, paramos
      if (currentNumeros.includes(newNum.numero)) {
        break;
      }
      
      // Adicionar o número novo à nossa lista
      newNumbers.push(newNum);
    }
    
    // Se temos números novos, atualizar o histórico
    if (newNumbers.length > 0) {
      logger.info(`Adicionando ${newNumbers.length} novos números recentes ao histórico: ${newNumbers.map(n => n.numero).join(', ')}`);
      
      // Adicionar os novos números no início do histórico
      setHistoricalNumbers(prev => {
        const combined = [...newNumbers, ...prev];
        // Limitar a 1000 números no máximo
        return combined.slice(0, 1000);
      });
    }
  }, [lastNumbers, roletaNome]);

  const frequencyData = generateFrequencyData(historicalNumbers.map(n => n.numero));
  const { hot, cold } = getHotColdNumbers(frequencyData);
  const pieData = generateGroupDistribution(historicalNumbers.map(n => n.numero));
  const colorHourlyStats = generateColorHourlyStats(historicalNumbers.map(n => n.numero));
  
  const winRate = (wins / (wins + losses)) * 100;

  return (
    <div className="w-full bg-gray-900 rounded-lg overflow-y-auto max-h-screen">
      <div className="p-4">
        <h2 className="text-[#00ff00] flex items-center text-xl font-bold mb-2">
          <BarChart className="mr-3" /> Estatísticas da {roletaNome}
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          {isLoading ? (
            "Carregando dados históricos..."
          ) : (
            `Análise detalhada dos últimos ${historicalNumbers.length} números e tendências`
          )}
        </p>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00ff00]"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          {/* Historical Numbers Section - Ocupa a largura total em todas as telas */}
          <div className="p-4 rounded-lg border border-[#00ff00]/20 bg-vegas-black-light md:col-span-2">
            <h3 className="text-[#00ff00] flex items-center text-base font-bold mb-3">
              <BarChart className="mr-2 h-5 w-5" /> Histórico de Números (Mostrando: {historicalNumbers.length})
            </h3>
            <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-15 lg:grid-cols-20 gap-1 max-h-[200px] overflow-y-auto p-3">
              {historicalNumbers.map((n, idx) => (
                <div 
                  key={idx} 
                  className="flex flex-col items-center mb-2"
                >
                  <div className={`w-8 h-8 flex items-center justify-center text-sm font-medium ${getRouletteNumberColor(n.numero)}`}>
                    {n.numero}
                  </div>
                  <div className="text-[9px] text-gray-400 mt-1">
                    {n.timestamp}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Distribution Pie Chart */}
          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center">
              <ChartBar size={20} className="text-[#00ff00] mr-2" /> Distribuição por Cor
            </h3>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    fill="#00ff00"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Win Rate Chart */}
          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center">
              <PercentIcon size={20} className="text-[#00ff00] mr-2" /> Taxa de Vitória
            </h3>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Vitórias", value: wins || 1 },
                      { name: "Derrotas", value: losses || 1 }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    fill="#00ff00"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    <Cell key="wins" fill="#00ff00" />
                    <Cell key="losses" fill="#ef4444" />
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Hot & Cold Numbers */}
          <div className="glass-card p-4 space-y-3 md:col-span-2">
            <h3 className="text-sm font-medium text-white mb-3">Números Quentes & Frios</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-2 bg-vegas-darkgray rounded-lg">
                <h4 className="text-xs font-medium text-red-500 mb-2 flex items-center">
                  <ArrowUp size={18} className="mr-2" /> Números Quentes
                </h4>
                <div className="flex flex-wrap gap-2">
                  {hot.map((item, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <div className={`w-7 h-7 rounded-full ${getRouletteNumberColor(item.number)} flex items-center justify-center text-xs font-medium`}>
                        {item.number}
                      </div>
                      <span className="text-vegas-gold text-xs">({item.frequency}x)</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="p-2 bg-vegas-darkgray rounded-lg">
                <h4 className="text-xs font-medium text-blue-500 mb-2 flex items-center">
                  <ArrowDown size={18} className="mr-2" /> Números Frios
                </h4>
                <div className="flex flex-wrap gap-2">
                  {cold.map((item, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <div className={`w-7 h-7 rounded-full ${getRouletteNumberColor(item.number)} flex items-center justify-center text-xs font-medium`}>
                        {item.number}
                      </div>
                      <span className="text-vegas-gold text-xs">({item.frequency}x)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Frequency Chart */}
          <div className="glass-card p-4 space-y-3 md:col-span-2">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center">
              <ChartBar size={20} className="text-[#00ff00] mr-2" /> Frequência de Números
            </h3>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={frequencyData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="number" stroke="#ccc" tick={{fontSize: 12}} />
                  <YAxis stroke="#ccc" tick={{fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#222', borderColor: '#00ff00' }} 
                    labelStyle={{ color: '#00ff00' }}
                  />
                  <Bar dataKey="frequency" fill="#00ff00" />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Média de cores por hora */}
          <div className="glass-card p-4 space-y-3 md:col-span-2">
            <h3 className="text-sm font-medium text-white mb-3">Média de cores por hora</h3>
            <div className="grid grid-cols-3 gap-3">
              {colorHourlyStats.map((stat, index) => (
                <div key={`color-stat-${index}`} className="bg-gray-100/10 rounded-md p-3">
                  <div className="flex items-center">
                    <div 
                      className="w-8 h-8 rounded-md mr-3 flex items-center justify-center" 
                      style={{ backgroundColor: stat.color === "#111827" ? "black" : stat.color }}
                    >
                      <div className="w-5 h-5 rounded-full border-2 border-white"></div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{stat.name}</p>
                      <p className="text-xs text-gray-400">Total de {stat.total} <span className="bg-gray-800 text-xs px-1.5 py-0.5 rounded ml-1">{stat.percentage}%</span></p>
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