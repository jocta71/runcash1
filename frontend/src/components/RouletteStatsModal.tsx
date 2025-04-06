import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { ChartBar, X, TrendingUp, BarChart, ArrowDown, ArrowUp, PercentIcon } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
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
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RouletteStatsModalProps {
  open: boolean;
  onClose: (open: boolean) => void;
  roletaNome: string;
  lastNumbers: number[];
  wins: number;
  losses: number;
}

// Função para gerar números históricos aleatórios
export const getHistoricalNumbers = (): number[] => {
  // Generate some random historical numbers for demonstration
  const numbers: number[] = [];
  for (let i = 0; i < 100; i++) {
    numbers.push(Math.floor(Math.random() * 37)); // 0-36 for roulette
  }
  return numbers;
};

// Buscar histórico de números da roleta
export const fetchRouletteHistoricalNumbers = async (rouletteName: string): Promise<number[]> => {
  try {
    console.log(`[API] Buscando dados históricos reais para: ${rouletteName}`);
    
    // Usar o endpoint correto da API - /api/ROULETTES em vez de /api/roulettes/history
    const response = await fetch(`/api/ROULETTES`);
    
    if (response.ok) {
      const data = await response.json();
      
      if (data && Array.isArray(data)) {
        // Encontrar a roleta específica pelo nome
        const targetRoulette = data.find((roleta: any) => {
          const roletaName = roleta.nome || roleta.name || '';
          return roletaName.toLowerCase() === rouletteName.toLowerCase();
        });
        
        if (targetRoulette) {
          // Obter números da roleta encontrada (podem estar em campo numero ou numeros)
          const numbers = Array.isArray(targetRoulette.numero) 
            ? targetRoulette.numero 
            : Array.isArray(targetRoulette.numeros) 
              ? targetRoulette.numeros 
              : [];
          
          // Processar os números encontrados
          const processedNumbers = numbers.map(
            (n: any) => typeof n === 'object' && n !== null ? 
              (n.numero !== undefined ? Number(n.numero) : Number(n)) : 
              Number(n)
          ).filter((n: number) => !isNaN(n));
          
          console.log(`[API] Obtidos ${processedNumbers.length} números reais para ${rouletteName}`);
          return processedNumbers;
        } else {
          console.log(`[API] Roleta "${rouletteName}" não encontrada nos dados retornados`);
        }
      } else {
        console.log(`[API] Resposta inválida da API: dados não são um array`);
      }
    } else {
      console.log(`[API] Erro na resposta da API: ${response.status} ${response.statusText}`);
    }
    
    console.log(`[API] Sem dados históricos para ${rouletteName}, retornando array vazio`);
    return [];
  } catch (error) {
    console.error(`[API] Erro ao buscar números históricos:`, error);
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

const RouletteStatsModal = ({ 
  open, 
  onClose, 
  roletaNome, 
  lastNumbers, 
  wins, 
  losses 
}: RouletteStatsModalProps) => {
  const [historicalNumbers, setHistoricalNumbers] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const loadHistoricalData = async () => {
      if (open) {
        setIsLoading(true);
        
        try {
          console.log(`[Modal] Buscando histórico real para ${roletaNome}...`);
          // Buscar dados históricos da API
          let apiNumbers = await fetchRouletteHistoricalNumbers(roletaNome);
          
          // Se houver lastNumbers nas props, garantir que eles estão incluídos
          if (lastNumbers && lastNumbers.length > 0) {
            console.log(`[Modal] Combinando ${lastNumbers.length} números recentes com ${apiNumbers.length} números históricos`);
            // Combinar lastNumbers com os números históricos, removendo duplicatas
            const combinedNumbers = [...lastNumbers];
            apiNumbers.forEach(num => {
              if (!combinedNumbers.includes(num)) {
                combinedNumbers.push(num);
              }
            });
            
            console.log(`[Modal] Total após combinação: ${combinedNumbers.length} números`);
            setHistoricalNumbers(combinedNumbers);
          } 
          else if (apiNumbers.length > 0) {
            // Se não temos lastNumbers mas temos dados da API
            console.log(`[Modal] Usando apenas números da API: ${apiNumbers.length}`);
            setHistoricalNumbers(apiNumbers);
          } 
          else {
            // Se não temos nenhum dado, usar apenas os números recentes (ou array vazio)
            console.log(`[Modal] Sem dados históricos, usando apenas números recentes: ${(lastNumbers || []).length}`);
            setHistoricalNumbers(lastNumbers || []);
          }
        } catch (error) {
          console.error('[Modal] Erro ao carregar dados históricos:', error);
          // Em caso de erro, usar apenas os números recentes em vez de gerar aleatórios
          setHistoricalNumbers(lastNumbers || []);
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    loadHistoricalData();
  }, [open, roletaNome, lastNumbers]);
  
  const frequencyData = generateFrequencyData(historicalNumbers);
  const { hot, cold } = getHotColdNumbers(frequencyData);
  const pieData = generateGroupDistribution(historicalNumbers);
  const colorHourlyStats = generateColorHourlyStats(historicalNumbers);
  
  const winRate = (wins / (wins + losses)) * 100;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[95vw] md:max-w-[95vw] lg:max-w-[95vw] h-[95vh] max-h-[95vh] p-0 gap-0 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#00ff00] flex items-center text-xl md:text-2xl px-4 pt-4">
            <BarChart className="mr-3" /> Estatísticas da {roletaNome}
          </DialogTitle>
          <DialogDescription className="text-sm md:text-base px-4">
            {isLoading ? (
              "Carregando dados históricos..."
            ) : (
              `Análise detalhada dos últimos ${historicalNumbers.length} números e tendências`
            )}
          </DialogDescription>
        </DialogHeader>
        
        <DialogClose className="absolute right-4 md:right-6 top-4 md:top-6 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground text-[#00ff00]">
          <X className="h-6 w-6" />
          <span className="sr-only">Fechar</span>
        </DialogClose>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 lg:gap-8 p-4 md:p-6 lg:p-8">
          {/* Historical Numbers Section */}
          <div className="p-4 md:p-6 rounded-lg border border-[#00ff00]/20 bg-vegas-black-light">
            <h3 className="text-[#00ff00] flex items-center text-base md:text-lg mb-3 font-bold">
              <BarChart className="mr-2 h-5 w-5" /> Histórico de Números (Mostrando: {Math.min(historicalNumbers.length, 1000)})
            </h3>
            <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-15 lg:grid-cols-20 xl:grid-cols-25 gap-1 max-h-[700px] overflow-y-auto p-3">
              {historicalNumbers.slice(0, 1000).map((num, idx) => (
                <div 
                  key={idx} 
                  className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-xs font-medium ${getRouletteNumberColor(num)}`}
                >
                  {num}
                </div>
              ))}
            </div>
          </div>

          {/* Win Rate Chart */}
          <div className="glass-card p-4 md:p-6 space-y-3 md:space-y-5">
            <h3 className="text-lg md:text-xl font-semibold flex items-center">
              <PercentIcon size={20} className="text-[#00ff00] mr-2" /> Taxa de Vitória
            </h3>
            <div className="h-60 md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Vitórias", value: wins },
                      { name: "Derrotas", value: losses }
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
          
          {/* Frequency Chart */}
          <div className="glass-card p-4 md:p-6 space-y-3 md:space-y-5">
            <h3 className="text-lg md:text-xl font-semibold flex items-center">
              <ChartBar size={20} className="text-[#00ff00] mr-2" /> Frequência de Números
            </h3>
            <div className="h-60 md:h-80">
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
          
          {/* Distribution Pie Chart */}
          <div className="glass-card p-4 md:p-6 space-y-3 md:space-y-5">
            <h3 className="text-lg md:text-xl font-semibold flex items-center">
              <ChartBar size={20} className="text-[#00ff00] mr-2" /> Distribuição por Cor
            </h3>
            <div className="h-60 md:h-80">
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
          
          {/* Hot & Cold Numbers */}
          <div className="glass-card p-4 md:p-6 space-y-3 md:space-y-5 col-span-1 lg:col-span-2 xl:col-span-3">
            <h3 className="text-lg md:text-xl font-semibold">Números Quentes & Frios</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="p-4 md:p-5 bg-vegas-darkgray rounded-lg">
                <h4 className="text-base md:text-lg font-semibold flex items-center text-red-500 mb-3">
                  <ArrowUp size={18} className="mr-2" /> Números Quentes (Mais Frequentes)
                </h4>
                <div className="flex flex-wrap gap-3 md:gap-4">
                  {hot.map((item, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full ${getRouletteNumberColor(item.number)} flex items-center justify-center text-sm md:text-base font-medium`}>
                        {item.number}
                      </div>
                      <span className="text-vegas-gold text-sm md:text-base">({item.frequency}x)</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="p-4 md:p-5 bg-vegas-darkgray rounded-lg">
                <h4 className="text-base md:text-lg font-semibold flex items-center text-blue-500 mb-3">
                  <ArrowDown size={18} className="mr-2" /> Números Frios (Menos Frequentes)
                </h4>
                <div className="flex flex-wrap gap-3 md:gap-4">
                  {cold.map((item, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full ${getRouletteNumberColor(item.number)} flex items-center justify-center text-sm md:text-base font-medium`}>
                        {item.number}
                      </div>
                      <span className="text-vegas-gold text-sm md:text-base">({item.frequency}x)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Média de cores por hora */}
          <div className="glass-card p-4 md:p-6 space-y-3 md:space-y-5 col-span-1 lg:col-span-2 xl:col-span-3">
            <h3 className="text-lg md:text-xl font-semibold">Média de cores por hora</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {colorHourlyStats.map((stat, index) => (
                <div key={`color-stat-${index}`} className="bg-gray-100/10 rounded-md p-4">
                  <div className="flex items-center mb-2">
                    <div 
                      className="w-10 h-10 rounded-md mr-3 flex items-center justify-center" 
                      style={{ backgroundColor: stat.color === "#111827" ? "black" : stat.color }}
                    >
                      <div className="w-6 h-6 rounded-full border-2 border-white"></div>
                    </div>
                    <div>
                      <p className="text-base font-medium">{stat.name}</p>
                      <p className="text-sm text-gray-400">Total de {stat.total} <span className="bg-gray-800 text-sm px-2 py-0.5 rounded ml-1">{stat.percentage}%</span> {stat.color === "#ef4444" ? "vermelhos" : stat.color === "#111827" ? "pretos" : "brancos"} no dia selecionado</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Exportar versão inline/painel do componente sem o Dialog wrapper
export const RouletteSidePanelStats = ({ 
  roletaNome, 
  lastNumbers, 
  wins, 
  losses 
}: Omit<RouletteStatsModalProps, 'open' | 'onClose'>) => {
  const [historicalNumbers, setHistoricalNumbers] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const loadHistoricalData = async () => {
      setIsLoading(true);
      
      try {
        console.log(`[SidePanel] Buscando histórico real para ${roletaNome}...`);
        // Buscar dados históricos da API
        let apiNumbers = await fetchRouletteHistoricalNumbers(roletaNome);
        
        // Se houver lastNumbers nas props, garantir que eles estão incluídos
        if (lastNumbers && lastNumbers.length > 0) {
          console.log(`[SidePanel] Combinando ${lastNumbers.length} números recentes com ${apiNumbers.length} números históricos`);
          // Combinar lastNumbers com os números históricos, removendo duplicatas
          const combinedNumbers = [...lastNumbers];
          apiNumbers.forEach(num => {
            if (!combinedNumbers.includes(num)) {
              combinedNumbers.push(num);
            }
          });
          
          console.log(`[SidePanel] Total após combinação: ${combinedNumbers.length} números`);
          setHistoricalNumbers(combinedNumbers);
        } 
        else if (apiNumbers.length > 0) {
          // Se não temos lastNumbers mas temos dados da API
          console.log(`[SidePanel] Usando apenas números da API: ${apiNumbers.length}`);
          setHistoricalNumbers(apiNumbers);
        } 
        else {
          // Se não temos nenhum dado, usar apenas os números recentes (ou array vazio)
          console.log(`[SidePanel] Sem dados históricos, usando apenas números recentes: ${(lastNumbers || []).length}`);
          setHistoricalNumbers(lastNumbers || []);
        }
      } catch (error) {
        console.error('[SidePanel] Erro ao carregar dados históricos:', error);
        // Em caso de erro, usar apenas os números recentes em vez de gerar aleatórios
        setHistoricalNumbers(lastNumbers || []);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadHistoricalData();
  }, [roletaNome, lastNumbers]);
  
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
        <div className="grid grid-cols-1 gap-4 p-4">
          {/* Historical Numbers Section - MODIFICADO PARA MOSTRAR 1000 NÚMEROS */}
          <div className="p-4 rounded-lg border border-[#00ff00]/20 bg-vegas-black-light">
            <h3 className="text-[#00ff00] flex items-center text-base font-bold mb-3">
              <BarChart className="mr-2 h-5 w-5" /> Histórico de Números (Mostrando: {Math.min(historicalNumbers.length, 1000)})
            </h3>
            <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-15 gap-1 max-h-[400px] overflow-y-auto p-3">
              {historicalNumbers.slice(0, 1000).map((num, idx) => (
                <div 
                  key={idx} 
                  className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-xs font-medium ${getRouletteNumberColor(num)}`}
                >
                  {num}
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
          
          {/* Hot & Cold Numbers */}
          <div className="glass-card p-4 space-y-3">
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
          <div className="glass-card p-4 space-y-3">
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
          
          {/* Média de cores por hora */}
          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-medium text-white mb-3">Média de cores por hora</h3>
            <div className="grid grid-cols-1 gap-3">
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

export default RouletteStatsModal;

