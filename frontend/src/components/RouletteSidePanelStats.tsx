import { ChartBar, BarChart, ArrowDown, ArrowUp, PercentIcon, ChevronUp, ChevronDown } from "lucide-react";
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

// Função para gerar números aleatórios para testes (apenas como último recurso)
const generateFallbackNumbers = (count: number = 20): number[] => {
  logger.warn(`Não serão gerados números aleatórios`);
  return []; // Retornar array vazio em vez de números aleatórios
};

// Buscar histórico de números da roleta do serviço centralizado
export const fetchRouletteHistoricalNumbers = async (rouletteName: string): Promise<number[]> => {
  try {
    logger.info(`Buscando dados históricos para: ${rouletteName}`);
    
    // Forçar a requisição com limit=1000 para esta roleta específica
    logger.info(`Solicitando dados detalhados (limit=1000) para ${rouletteName}`);
    // Garantir que fetchDetailedRouletteData seja chamado com força
    const detailedData = await globalRouletteDataService.fetchDetailedRouletteData();
    
    logger.info(`Dados detalhados recebidos, total de roletas: ${detailedData.length}`);
    
    // Procurar a roleta pelo nome nos dados detalhados
    const targetDetailedRoulette = detailedData.find((roleta: any) => {
      const roletaName = roleta.nome || roleta.name || '';
      return roletaName.toLowerCase() === rouletteName.toLowerCase();
    });
    
    // Verificar a estrutura exata dos dados recebidos para diagnóstico
    if (targetDetailedRoulette) {
      const numeroCount = targetDetailedRoulette.numero ? targetDetailedRoulette.numero.length : 0;
      logger.info(`Roleta '${rouletteName}' encontrada com ${numeroCount} números históricos`);
      
      // Debug detalhado dos dados recebidos
      if (numeroCount > 0) {
        const amostra = targetDetailedRoulette.numero.slice(0, 5);
        logger.info(`Amostra dos primeiros 5 números: ${JSON.stringify(amostra)}`);
      }
    } else {
      logger.warn(`Roleta '${rouletteName}' NÃO encontrada nos dados detalhados!`);
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
      
      logger.info(`Processados ${processedDetailedNumbers.length} números válidos para ${rouletteName}`);
      return processedDetailedNumbers;
    }
    
    // Se não encontrou nos dados detalhados, tentar nos dados normais
    logger.info(`Tentando buscar dados normais para ${rouletteName}`);
    
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
      
      logger.info(`Obtidos ${processedNumbers.length} números do serviço global para ${rouletteName}`);
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

const RouletteSidePanelStats = ({ 
  roletaNome, 
  lastNumbers, 
  wins, 
  losses 
}: RouletteSidePanelStatsProps) => {
  const [historicalNumbers, setHistoricalNumbers] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100); // Exibir 100 números por página
  const subscriberId = useRef<string>(`sidepanel-${roletaNome}-${Math.random().toString(36).substring(2, 9)}`);
  const isInitialRequestDone = useRef<boolean>(false);

  // Calcular o número total de páginas
  const totalPages = Math.ceil(historicalNumbers.length / itemsPerPage);
  
  // Calcular índices de início e fim para a paginação
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, historicalNumbers.length);
  
  // Obter os números da página atual
  const currentNumbers = historicalNumbers.slice(startIndex, endIndex);
  
  // Navegação entre páginas
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  // Toggle função para expandir/recolher o histórico
  const toggleHistoryExpanded = () => {
    const newExpandedState = !isHistoryExpanded;
    setIsHistoryExpanded(newExpandedState);
    console.log(`[SidePanelStats] Estado expandido alterado para: ${newExpandedState}`);
    
    // Ao expandir, mostrar mais números por página
    if (newExpandedState) {
      setItemsPerPage(1000); // Aumentado para 1000 para mostrar mais números
    } else {
      setItemsPerPage(100);
    }
    
    // Forçar uma atualização ao expandir para garantir que todos os números sejam exibidos
    if (newExpandedState) {
      setCurrentPage(1); // Voltar para a primeira página ao expandir
      setTimeout(() => {
        // Forçar recarga dos dados históricos
        loadHistoricalData();
        // Forçar atualização do componente
        globalRouletteDataService.fetchDetailedRouletteData();
      }, 100);
    }
  };
  
  // Função para carregar dados históricos
  const loadHistoricalData = async () => {
    try {
      logger.info(`Buscando histórico para ${roletaNome}...`);
      
      // Solicitar atualização de dados detalhados antes de buscar os números
      await globalRouletteDataService.fetchDetailedRouletteData().catch(err => {
        logger.error(`Erro ao buscar dados detalhados: ${err.message}`);
      });
      
      // Buscar dados históricos usando a função atualizada
      let apiNumbers = await fetchRouletteHistoricalNumbers(roletaNome);
      
      logger.info(`Resultados da busca: ${apiNumbers.length} números obtidos da API`);
      
      if (apiNumbers.length === 0 && isInitialRequestDone.current) {
        logger.info(`Sem novos dados disponíveis, mantendo estado atual`);
        return;
      }
      
      // Se houver lastNumbers nas props, garantir que eles estão incluídos no início
      if (lastNumbers && lastNumbers.length > 0) {
        logger.info(`Combinando ${lastNumbers.length} números recentes com ${apiNumbers.length} números históricos`);
        
        // IMPORTANTE: Não remover duplicatas para manter a sequência histórica intacta
        // Apenas garantir que os números recentes estejam no início
        const combinedNumbers = [...lastNumbers, ...apiNumbers];
        
        logger.info(`Total após combinação sem remover duplicatas: ${combinedNumbers.length} números`);
        
        // Limitando a 1000 números no máximo
        setHistoricalNumbers(combinedNumbers.slice(0, 1000));
      } 
      else if (apiNumbers.length > 0) {
        // Se não temos lastNumbers mas temos dados da API
        logger.info(`Usando apenas números da API: ${apiNumbers.length}`);
        // Limitando a 1000 números no máximo
        setHistoricalNumbers(apiNumbers.slice(0, 1000));
      } 
      else {
        // Se não temos nenhum dado, usar apenas os números recentes (ou array vazio)
        logger.info(`Sem dados históricos, usando apenas números recentes: ${(lastNumbers || []).length}`);
        setHistoricalNumbers(lastNumbers || []);
      }
      
      isInitialRequestDone.current = true;
    } catch (error) {
      logger.error('Erro ao carregar dados históricos:', error);
      // Em caso de erro, usar apenas os números recentes em vez de gerar aleatórios
      setHistoricalNumbers(lastNumbers || []);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Usar o serviço global para obter atualizações
  useEffect(() => {
    logger.info(`Inicializando para roleta ${roletaNome}`);
    
    // Resetar o estado de inicialização se a roleta mudar
    isInitialRequestDone.current = false;
    setIsLoading(true);
    
    // ID único para assinatura de dados detalhados
    const detailedSubscriberId = `${subscriberId.current}-detailed`;
    
    // Função para carregar dados completos da roleta
    const loadCompleteRouletteData = async () => {
      try {
        logger.info(`Carregando dados COMPLETOS para roleta ${roletaNome}`);
        
        // 1. Forçar uma busca de dados detalhados com limit=1000, ignorando o cache
        await globalRouletteDataService.fetchDetailedRouletteData(true);
        
        // 2. Carregar dados históricos
        await loadHistoricalData();
        
        // 3. Exibir todos os números (até 1000) ao inicializar
        setIsHistoryExpanded(true);
        setItemsPerPage(1000);
        
        logger.info(`Dados completos carregados para roleta ${roletaNome}`);
      } catch (error) {
        logger.error(`Erro ao carregar dados completos: ${error}`);
        setIsLoading(false);
      }
    };
    
    // Registrar no serviço global para receber atualizações de dados normais
    globalRouletteDataService.subscribe(subscriberId.current, () => {
      logger.info(`Recebendo atualização de dados normais para ${roletaNome}`);
      loadHistoricalData();
    });
    
    // Registrar especificamente para receber atualizações de dados detalhados
    globalRouletteDataService.subscribeToDetailedData(detailedSubscriberId, () => {
      logger.info(`Recebendo atualização de dados DETALHADOS para ${roletaNome}`);
      loadHistoricalData();
    });
    
    // Carregar dados completos imediatamente quando a roleta for selecionada
    loadCompleteRouletteData();
    
    return () => {
      // Cancelar inscrições ao desmontar
      globalRouletteDataService.unsubscribe(subscriberId.current);
      globalRouletteDataService.unsubscribe(detailedSubscriberId);
    };
  }, [roletaNome]); // Dependência apenas na roleta

  // Atualizar números quando lastNumbers mudar, sem fazer nova requisição à API
  useEffect(() => {
    if (isInitialRequestDone.current && lastNumbers && lastNumbers.length > 0) {
      logger.info(`Atualizando com ${lastNumbers.length} novos números recentes`);
      
      // IMPORTANTE: Manter duplicatas para preservar a sequência histórica
      // Apenas garantir que números recentes venham primeiro
      const combinedNumbers = [...lastNumbers, ...historicalNumbers];
      
      logger.info(`Total após atualização com novos números: ${combinedNumbers.length}`);
      
      // Limitando a 1000 números no máximo
      setHistoricalNumbers(combinedNumbers.slice(0, 1000));
    }
  }, [lastNumbers]);
  
  const frequencyData = generateFrequencyData(historicalNumbers);
  const { hot, cold } = getHotColdNumbers(frequencyData);
  const pieData = generateGroupDistribution(historicalNumbers);
  const colorHourlyStats = generateColorHourlyStats(historicalNumbers);
  
  const winRate = (wins / (wins + losses)) * 100;

  // Atualizar o número de itens por página
  const handleItemsPerPageChange = (newValue: number) => {
    setItemsPerPage(newValue);
    // Ajustar a página atual para que o usuário não perca a posição
    const newTotalPages = Math.ceil(historicalNumbers.length / newValue);
    if (currentPage > newTotalPages) {
      setCurrentPage(newTotalPages);
    }
  };

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
          {/* Histórico de Números section */}
          <div className="w-full mb-2 px-1">
            <div className="flex flex-row justify-between items-center mb-2">
              <div className="text-sm text-white">Histórico de Números</div>
              <button
                onClick={toggleHistoryExpanded}
                className={`text-xs px-2 py-1 rounded-md flex items-center gap-1 transition-colors
                          ${isHistoryExpanded ? 'bg-vegas-red/90 hover:bg-vegas-red' : 'bg-vegas-red hover:bg-vegas-red/90'}`}
              >
                {isHistoryExpanded ? "Recolher" : "Expandir"}
                {isHistoryExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {historicalNumbers.length > 0 ? (
              <div
                className={`grid gap-1 w-full ${
                  isHistoryExpanded 
                    ? 'grid-cols-10 md:grid-cols-14 lg:grid-cols-18 max-h-[800px]' 
                    : 'grid-cols-6 md:grid-cols-9 lg:grid-cols-12 max-h-[300px]'
                } overflow-y-auto p-2 border border-gray-800 rounded-md`}
              >
                {(isHistoryExpanded ? historicalNumbers : historicalNumbers.slice(0, 100)).map((number, index) => (
                  <div
                    key={`${number}-${index}`}
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium
                              ${getRouletteNumberColor(number)}`}
                  >
                    {number}
                  </div>
                ))}
                
                {!isHistoryExpanded && historicalNumbers.length > 100 && (
                  <div className="col-span-full text-center mt-2 text-sm text-vegas-gold">
                    Mostrando 100 de {historicalNumbers.length} números. Clique em "Expandir" para ver todos.
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-2 text-gray-400 text-sm">
                Nenhum histórico de números disponível
              </div>
            )}
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