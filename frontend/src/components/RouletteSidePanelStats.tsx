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
import { useState, useEffect, useRef, useCallback } from 'react';
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
const fetchRouletteHistoricalNumbers = async (rouletteName: string) => {
  console.log(`📊 Iniciando busca por números históricos para ${rouletteName}`);
  try {
    // Tenta forçar uma atualização dos dados da roleta global
    await globalRouletteDataService.forceUpdate();
    console.log(`📊 Forçou atualização do serviço global de dados`);
    
    // Tenta buscar dados detalhados primeiro (contém mais números históricos)
    console.log(`📊 Tentando obter dados detalhados...`);
    const detailedData = await globalRouletteDataService.fetchDetailedRouletteData();
    console.log(`📊 Recebeu dados detalhados:`, detailedData ? 'Sim' : 'Não');
    
    if (detailedData && Array.isArray(detailedData)) {
      // Procura a roleta específica
      const rouletteData = detailedData.find(data => 
        data && data.casaId && data.casaId.toLowerCase() === rouletteName.toLowerCase()
      );
      
      console.log(`📊 Dados da roleta ${rouletteName} encontrados nos dados detalhados:`, rouletteData ? 'Sim' : 'Não');
      
      if (rouletteData && rouletteData.numbers && Array.isArray(rouletteData.numbers)) {
        // Filtra números válidos
        const validNumbers = rouletteData.numbers
          .filter(num => num !== null && num !== undefined && !isNaN(Number(num)))
          .map(num => Number(num));
        
        console.log(`📊 Números válidos encontrados em dados detalhados: ${validNumbers.length}`);
        
        if (validNumbers.length > 0) {
          return validNumbers.slice(0, 1000); // Limita a 1000 números
        }
      }
    }
    
    // Se não encontrou nos dados detalhados, tenta o serviço de histórico
    console.log(`📊 Tentando obter dados do serviço de histórico...`);
    const historicalNumbers = await rouletteHistoryService.fetchRouletteHistoricalNumbers(rouletteName);
    console.log(`📊 Números obtidos do serviço de histórico: ${historicalNumbers.length}`);
    
    if (historicalNumbers.length > 0) {
      return historicalNumbers.slice(0, 1000); // Limita a 1000 números
    }
    
    // Se ainda não encontrou, tenta obter dados básicos
    console.log(`📊 Tentando obter dados básicos...`);
    const basicData = await globalRouletteDataService.fetchRouletteData();
    console.log(`📊 Recebeu dados básicos:`, basicData ? 'Sim' : 'Não');
    
    if (basicData && Array.isArray(basicData)) {
      const rouletteData = basicData.find(data => 
        data && data.casaId && data.casaId.toLowerCase() === rouletteName.toLowerCase()
      );
      
      console.log(`📊 Dados da roleta ${rouletteName} encontrados nos dados básicos:`, rouletteData ? 'Sim' : 'Não');
      
      if (rouletteData && rouletteData.numbers && Array.isArray(rouletteData.numbers)) {
        const validNumbers = rouletteData.numbers
          .filter(num => num !== null && num !== undefined && !isNaN(Number(num)))
          .map(num => Number(num));
        
        console.log(`📊 Números válidos encontrados em dados básicos: ${validNumbers.length}`);
        return validNumbers.slice(0, 1000);
      }
    }
    
    console.log(`📊 Não foi possível encontrar números históricos para ${rouletteName}`);
    return [];
  } catch (error) {
    console.error(`📊 Erro ao obter números históricos:`, error);
    return [];
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
  const subscriberId = useRef<string>(`sidepanel-${roletaNome}-${Math.random().toString(36).substring(2, 9)}`);
  const isInitialRequestDone = useRef<boolean>(false);
  
  // Função para carregar dados históricos (otimizada)
  const loadHistoricalData = useCallback(async () => {
    try {
      console.log(`[RouletteSidePanelStats] Carregando histórico para ${roletaNome}...`);
      setIsLoading(true);
      
      // Buscar dados históricos da API através da função otimizada
      let apiNumbers = await fetchRouletteHistoricalNumbers(roletaNome);
      console.log(`[RouletteSidePanelStats] Total de números históricos obtidos: ${apiNumbers.length}`);
      
      // Se não conseguimos nada da API mas já temos dados, manter os atuais
      if (apiNumbers.length === 0 && historicalNumbers.length > 0 && isInitialRequestDone.current) {
        console.info(`[RouletteSidePanelStats] API sem dados, mantendo histórico atual de ${historicalNumbers.length} números`);
        setIsLoading(false);
        return;
      }
      
      // Combinar números recentes com históricos (priorizar números recentes para exibição)
      let combinedNumbers: number[] = [];
      
      // Se temos números recentes, começar com eles
      if (lastNumbers && lastNumbers.length > 0) {
        console.info(`[RouletteSidePanelStats] Iniciando com ${lastNumbers.length} números recentes`);
        combinedNumbers = [...lastNumbers];
      }
      
      // Adicionar números da API sem duplicatas
      if (apiNumbers.length > 0) {
        console.info(`[RouletteSidePanelStats] Adicionando ${apiNumbers.length} números históricos da API`);
        
        let countAdded = 0;
        apiNumbers.forEach(num => {
          if (!combinedNumbers.includes(num)) {
            combinedNumbers.push(num);
            countAdded++;
          }
        });
        
        console.info(`[RouletteSidePanelStats] Adicionados ${countAdded} números únicos da API`);
      }
      
      // Se, mesmo assim, não temos dados, verificar se já temos algo no estado atual
      if (combinedNumbers.length === 0 && historicalNumbers.length > 0) {
        console.info(`[RouletteSidePanelStats] Sem novos dados, mantendo ${historicalNumbers.length} números existentes`);
        setIsLoading(false);
        return;
      }
      
      // Se temos números combinados, usar eles (limitados a 1000)
      if (combinedNumbers.length > 0) {
        console.info(`[RouletteSidePanelStats] Atualizando estado com ${combinedNumbers.length} números combinados`);
        setHistoricalNumbers(combinedNumbers.slice(0, 1000));
      } else {
        // Último recurso: se ainda não temos nada, usar um array vazio
        console.warn(`[RouletteSidePanelStats] Sem dados disponíveis para ${roletaNome}`);
        setHistoricalNumbers([]);
      }
      
      isInitialRequestDone.current = true;
    } catch (error) {
      console.error('[RouletteSidePanelStats] Erro ao carregar dados históricos:', error);
      
      // Em caso de erro, manter os dados atuais se existirem
      if (historicalNumbers.length === 0 && lastNumbers && lastNumbers.length > 0) {
        console.info(`[RouletteSidePanelStats] Usando ${lastNumbers.length} números recentes devido a erro`);
        setHistoricalNumbers(lastNumbers);
      }
    } finally {
      setIsLoading(false);
    }
  }, [roletaNome, lastNumbers, historicalNumbers]);
  
  // Usar o serviço global para obter atualizações
  useEffect(() => {
    console.info(`Inicializando para roleta ${roletaNome}`);
    
    // Resetar o estado de inicialização se a roleta mudar
    isInitialRequestDone.current = false;
    setIsLoading(true);
    
    // Registrar no serviço global para receber atualizações
    globalRouletteDataService.subscribe(subscriberId.current, () => {
      console.info(`Recebendo atualização de dados para ${roletaNome}`);
      loadHistoricalData();
    });
    
    // Carregar dados imediatamente
    loadHistoricalData();
    
    return () => {
      // Cancelar inscrição ao desmontar
      globalRouletteDataService.unsubscribe(subscriberId.current);
    };
  }, [roletaNome, loadHistoricalData]);

  // Atualizar números quando lastNumbers mudar, sem fazer nova requisição à API
  useEffect(() => {
    if (isInitialRequestDone.current && lastNumbers && lastNumbers.length > 0) {
      console.info(`Atualizando com ${lastNumbers.length} novos números recentes`);
      
      // Combinar com os números históricos existentes
      const combinedNumbers = [...lastNumbers];
      
      historicalNumbers.forEach(num => {
        if (!combinedNumbers.includes(num)) {
          combinedNumbers.push(num);
        }
      });
      
      // Limitando a 1000 números no máximo
      setHistoricalNumbers(combinedNumbers.slice(0, 1000));
    }
  }, [lastNumbers]);
  
  const frequencyData = generateFrequencyData(historicalNumbers);
  const { hot, cold } = getHotColdNumbers(frequencyData);
  const pieData = generateGroupDistribution(historicalNumbers);
  const colorHourlyStats = generateColorHourlyStats(historicalNumbers);
  
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
          {/* Seção do Histórico */}
          <div className="w-full mt-4">
            <h3 className="text-lg font-semibold mb-2 dark:text-gray-200">
              Histórico de Números
            </h3>

            {isLoading ? (
              <div className="flex items-center justify-center w-full h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
              </div>
            ) : historicalNumbers.length > 0 ? (
              <>
                <div className="text-sm mb-2 text-gray-600 dark:text-gray-400">
                  Mostrando {historicalNumbers.length} números no histórico
                </div>
                <div
                  className="w-full grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-1 overflow-y-auto"
                  style={{ maxHeight: '400px' }}
                >
                  {historicalNumbers.map((number, index) => (
                    <div
                      key={index}
                      title={`Número ${number}`}
                      className={`w-5 h-5 flex items-center justify-center text-xs rounded-full ${
                        getRouletteNumberColor(number)
                      }`}
                    >
                      {number}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-gray-500 dark:text-gray-400 text-sm">
                Nenhum número histórico disponível para esta roleta.
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