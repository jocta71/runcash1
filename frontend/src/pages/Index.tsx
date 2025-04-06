import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Search, Wallet, Menu, MessageSquare, AlertCircle, BarChart3, ArrowUp, ArrowDown, X, ChartBar, BarChart, Percent } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import RouletteCard from '@/components/RouletteCard';
import { Input } from '@/components/ui/input';
import ChatUI from '@/components/ChatUI';
import { Button } from '@/components/ui/button';
import AnimatedInsights from '@/components/AnimatedInsights';
import ProfileDropdown from '@/components/ProfileDropdown';
import Layout from '@/components/Layout';
import { RouletteRepository } from '../services/data/rouletteRepository';
import { RouletteData } from '@/types';
import EventService from '@/services/EventService';
import { RequestThrottler } from '@/services/utils/requestThrottler';
import { 
  ResponsiveContainer, 
  BarChart as RechartsBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface ChatMessage {
  id: string;
  user: {
    name: string;
    avatar?: string;
    role?: string;
    isAdmin?: boolean;
    isModerator?: boolean;
  };
  message: string;
  timestamp: Date;
}


// Adicionar área do código para persistência de roletas
interface KnownRoulette {
  id: string;
  nome: string;
  ultima_atualizacao: string;
}

// Função para buscar histórico da roleta - adaptada do modal
const fetchRouletteHistoricalNumbers = async (rouletteName: string): Promise<number[]> => {
  try {
    const response = await fetch(`/api/roulettes/history/${rouletteName}`);
    
    if (response.ok) {
      const data = await response.json();
      
      if (data && Array.isArray(data.numbers) && data.numbers.length > 0) {
        // Obter apenas os números da resposta da API
        const reversedNumbers = [...data.numbers].reverse().map(
          (n: any) => typeof n === 'object' && n !== null ? 
            (n.numero !== undefined ? Number(n.numero) : Number(n)) : 
            Number(n)
        ).filter((n: number) => !isNaN(n));
        
        console.log(`[${new Date().toLocaleTimeString()}] Números válidos para ${rouletteName}: ${reversedNumbers.length}`);
        
        return reversedNumbers;
      } else {
        console.log(`[${new Date().toLocaleTimeString()}] Nenhum dado encontrado para ${rouletteName}`);
      }
    }
    
    return [];
  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] Erro ao buscar números históricos:`, error);
    return [];
  }
};

// Generate frequency data for numbers - adaptada do modal
const generateFrequencyData = (numbers: number[]) => {
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

// Generate pie chart data for number groups - adaptada do modal
const generateGroupDistribution = (numbers: number[]) => {
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

const Index = () => {
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [roulettes, setRoulettes] = useState<RouletteData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [knownRoulettes, setKnownRoulettes] = useState<RouletteData[]>([]);
  const [dataFullyLoaded, setDataFullyLoaded] = useState<boolean>(false);
  const [selectedRoulette, setSelectedRoulette] = useState<RouletteData | null>(null);
  const [historicalNumbers, setHistoricalNumbers] = useState<number[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  
  // Referência para controlar se o componente está montado
  const isMounted = useRef(true);

  // Referência para timeout de atualização
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Escutar eventos de roletas existentes para persistência
  useEffect(() => {
    const handleRouletteExists = (data: any) => {
      if (!data || !data.id) {
        console.log('[Index] Evento roleta_exists recebido sem ID válido:', data);
        return;
      }
      
      console.log(`[Index] Evento roleta_exists recebido para: ${data.nome} (ID: ${data.id})`);
      
      setKnownRoulettes(prev => {
        const updated = [...prev, data];
        console.log(`[Index] Atualizado registro de roletas conhecidas. Total: ${updated.length}`);
        return updated;
      });
    };
    
    // Registrar o listener de evento diretamente (sem usar addGlobalListener que pode não estar registrado corretamente)
    EventService.getInstance().subscribe('roleta_exists', handleRouletteExists);
    
    console.log('[Index] Listener para evento roleta_exists registrado');
    
    return () => {
      // Remover o listener ao desmontar o componente
      EventService.getInstance().unsubscribe('roleta_exists', handleRouletteExists);
      console.log('[Index] Listener para evento roleta_exists removido');
    };
  }, []);
  
  // Escutar eventos de carregamento de dados históricos
  useEffect(() => {
    // Handler para evento de dados históricos carregados
    const handleHistoricalDataLoaded = (data: any) => {
      console.log('[Index] Evento historical_data_loaded recebido:', data);
      if (data && data.success) {
        console.log(`[Index] Dados históricos carregados com sucesso para ${data.count || 0} roletas`);
        setDataFullyLoaded(true);
      }
    };
    
    // Handler para evento de dados reais carregados
    const handleRealDataLoaded = () => {
      console.log('[Index] Evento Dados reais carregados recebido');
      setDataFullyLoaded(true);
      setIsLoading(false);
    };
    
    // Registrar listeners
    EventService.getInstance().subscribe('historical_data_loaded', handleHistoricalDataLoaded);
    EventService.getInstance().subscribe('roulettes_loaded', handleRealDataLoaded);
    
    console.log('[Index] Listeners para eventos de carregamento registrados');
    
    return () => {
      // Remover listeners ao desmontar
      EventService.getInstance().unsubscribe('historical_data_loaded', handleHistoricalDataLoaded);
      EventService.getInstance().unsubscribe('roulettes_loaded', handleRealDataLoaded);
      console.log('[Index] Listeners para eventos de carregamento removidos');
    };
  }, []);
  
  // Função para mesclar roletas da API com roletas conhecidas
  const mergeRoulettes = useCallback((apiRoulettes: RouletteData[], knownRoulettes: RouletteData[]): RouletteData[] => {
    const merged: Record<string, RouletteData> = {};
    
    // Primeiro, adicionar todas as roletas da API
    apiRoulettes.forEach(roulette => {
      merged[roulette.id] = roulette;
    });
    
    // Depois, adicionar ou atualizar com roletas conhecidas
    knownRoulettes.forEach(known => {
      // Se a roleta já existe na lista da API, não precisamos fazer nada
      if (merged[known.id]) {
        console.log(`[Index] Roleta já existe na API: ${known.nome} (ID: ${known.id})`);
        return;
      }
      
      console.log(`[Index] Adicionando roleta conhecida ausente na API: ${known.nome} (ID: ${known.id})`);
      
      // Criar uma roleta a partir da roleta conhecida
      merged[known.id] = {
        id: known.id,
        nome: known.name,
        name: known.name,
        numeros: [],
        lastNumbers: [],
        estado_estrategia: '',
        vitorias: 0,
        derrotas: 0
      };
    });
    
    const result = Object.values(merged);
    console.log(`[Index] Total após mesclagem: ${result.length} roletas (API: ${apiRoulettes.length}, Conhecidas: ${knownRoulettes.length})`);
    
    return result;
  }, []);
  
  // Função para carregar dados da API de forma centralizada
  const loadRouletteData = useCallback(async () => {
    if (!isMounted.current) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Usar o throttler para evitar múltiplas chamadas simultâneas
      const result = await RequestThrottler.scheduleRequest(
        'index_roulettes',
        async () => {
          console.log('📊 Buscando roletas disponíveis...');
          const response = await RouletteRepository.fetchAllRoulettesWithNumbers();
          console.log(`✅ ${response.length} roletas encontradas`);
          return response;
        }
      );
      
      if (result && Array.isArray(result)) {
        // Mesclar com roletas conhecidas
        const merged = mergeRoulettes(result, knownRoulettes);
        setRoulettes(merged);
        
        // Atualizar roletas conhecidas se tivermos novos dados
        if (result.length > 0) {
          setKnownRoulettes(prev => mergeRoulettes(prev, result));
        }
        
        // Definir que os dados foram totalmente carregados
        setDataFullyLoaded(true);
      } else {
        // Se falhar, usar roletas conhecidas
        if (knownRoulettes.length > 0) {
          console.log('⚠️ Usando roletas conhecidas como fallback');
          setRoulettes(knownRoulettes);
          setDataFullyLoaded(true);
        } else {
          setError('Não foi possível carregar as roletas disponíveis.');
        }
      }
    } catch (err: any) {
      console.error('❌ Erro ao buscar roletas:', err);
      setError(`Erro ao buscar roletas: ${err.message}`);
      
      // Fallback para roletas conhecidas
      if (knownRoulettes.length > 0) {
        setRoulettes(knownRoulettes);
        setDataFullyLoaded(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [knownRoulettes]);

  // Efeito para inicialização e atualização periódica
  useEffect(() => {
    // Inicialização
    loadRouletteData();
    
    // Timeout de segurança para garantir que a tela será liberada
    const safetyTimeout = setTimeout(() => {
      if (!dataFullyLoaded && isMounted.current) {
        console.log('[Index] 🔄 Liberando tela após timeout de segurança');
        setDataFullyLoaded(true);
        setIsLoading(false);
      }
    }, 10000); // 10 segundos
    
    // Configurar atualização periódica usando o throttler
    const unsubscribe = RequestThrottler.subscribeToUpdates(
      'index_roulettes', 
      (data) => {
        if (data && Array.isArray(data) && isMounted.current) {
          console.log(`📊 Atualização periódica: ${data.length} roletas`);
          
          // Mesclar com roletas conhecidas e atualizar estado
          const merged = mergeRoulettes(data, knownRoulettes);
          setRoulettes(merged);
          
          // Atualizar roletas conhecidas
          setKnownRoulettes(prev => mergeRoulettes(prev, data));
          
          // Garantir que os dados são considerados carregados
          setDataFullyLoaded(true);
        }
      }
    );
    
    // Agendar atualizações periódicas
    const scheduleUpdate = () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      updateTimeoutRef.current = setTimeout(() => {
        // Agendar próxima atualização usando o throttler (sem forçar execução imediata)
        RequestThrottler.scheduleRequest(
          'index_roulettes',
          async () => {
            console.log('🔄 Atualizando roletas periodicamente...');
            const response = await RouletteRepository.fetchAllRoulettesWithNumbers();
            console.log(`✅ ${response.length} roletas atualizadas`);
            return response;
          },
          false // Não forçar execução, respeitar o intervalo mínimo
        );
        
        // Agendar próxima verificação
        if (isMounted.current) {
          scheduleUpdate();
        }
      }, 60000); // Verificar a cada 60 segundos
    };
    
    // Iniciar agendamento
    scheduleUpdate();
    
    // Cleanup
    return () => {
      isMounted.current = false;
      unsubscribe();
      
      clearTimeout(safetyTimeout);
      
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
    };
  }, [loadRouletteData, knownRoulettes]);
  
  const filteredRoulettes = useMemo(() => {
    try {
      // Se não houver termo de busca, retorna todas as roletas
      if (!search) {
        return roulettes;
      }

      const searchTermLower = String(search).toLowerCase();

      return roulettes.filter(roulette => {
        // Verificação de segurança para evitar erro com valores undefined
        if (!roulette || !roulette.nome) {
          return false;
        }
        
        try {
          const nomeLower = String(roulette.nome).toLowerCase();
          return nomeLower.includes(searchTermLower);
        } catch (error) {
          console.error('Erro ao processar nome da roleta:', roulette, error);
          return false;
        }
      });
    } catch (error) {
      console.error('Erro ao filtrar roletas:', error);
      return roulettes;
    }
  }, [roulettes, search]);
  
  const topRoulettes = useMemo(() => {
    return [...roulettes].sort((a, b) => {
      const aWinRate = a.vitorias / (a.vitorias + a.derrotas) * 100 || 0;
      const bWinRate = b.vitorias / (b.vitorias + b.derrotas) * 100 || 0;
      return bWinRate - aWinRate;
    }).slice(0, 3);
  }, [roulettes]);

  // Função para renderizar os cards de roleta
  const renderRouletteCards = () => {
    if (!Array.isArray(roulettes) || roulettes.length === 0) {
      return (
        <div className="col-span-full text-center py-8">
          <p className="text-muted-foreground">Nenhuma roleta disponível no momento.</p>
        </div>
      );
    }

    let filteredRoulettes = roulettes;
    
    // Aplicar filtro de busca se houver
    if (search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filteredRoulettes = roulettes.filter(roulette => 
        (roulette.nome || '').toLowerCase().includes(searchLower) ||
        (roulette.name || '').toLowerCase().includes(searchLower)
      );
      
      if (filteredRoulettes.length === 0) {
        return (
          <div className="col-span-full text-center py-8">
            <p className="text-muted-foreground">Nenhuma roleta encontrada com o termo "{search}".</p>
          </div>
        );
      }
    }

    return filteredRoulettes.map(roulette => {
      // Garantir que temos números válidos
      const safeNumbers = Array.isArray(roulette.numero) 
        ? roulette.numero.map(n => typeof n === 'object' && n !== null && 'numero' in n ? n.numero : n)
        : Array.isArray(roulette.lastNumbers)
          ? roulette.lastNumbers
          : Array.isArray(roulette.numeros)
            ? roulette.numeros
            : [];
      
      return (
        <div 
          key={roulette.id} 
          className={`cursor-pointer transition-all ${selectedRoulette?.id === roulette.id ? 'ring-2 ring-green-500' : ''}`}
          onClick={() => setSelectedRoulette(roulette)}
        >
          <RouletteCard
            data={{
              id: roulette.id || '',
              _id: roulette._id || roulette.id || '',
              name: roulette.name || roulette.nome || 'Roleta sem nome',
              nome: roulette.nome || roulette.name || 'Roleta sem nome',
              lastNumbers: safeNumbers,
              numeros: safeNumbers,
              vitorias: typeof roulette.vitorias === 'number' ? roulette.vitorias : 0,
              derrotas: typeof roulette.derrotas === 'number' ? roulette.derrotas : 0,
              estado_estrategia: roulette.estado_estrategia || ''
            }}
          />
        </div>
      );
    });
  };

  // Efeito para carregar dados históricos quando uma roleta é selecionada
  useEffect(() => {
    const loadHistoricalData = async () => {
      if (selectedRoulette) {
        setIsLoadingStats(true);
        
        try {
          console.log(`Buscando histórico para ${selectedRoulette.nome || selectedRoulette.name}...`);
          let numbers = await fetchRouletteHistoricalNumbers(selectedRoulette.nome || selectedRoulette.name || '');
          
          // Extrair números da roleta selecionada - ajustado para lidar com qualquer formato
          const extractNumbers = () => {
            if (Array.isArray(selectedRoulette.numero) && selectedRoulette.numero.length > 0) {
              return selectedRoulette.numero.map(n => 
                typeof n === 'object' && n !== null && 'numero' in n ? Number(n.numero || 0) : Number(n || 0)
              ).filter(n => !isNaN(n));
            } 
            
            if (Array.isArray(selectedRoulette.lastNumbers) && selectedRoulette.lastNumbers.length > 0) {
              return selectedRoulette.lastNumbers.map(n => Number(n || 0)).filter(n => !isNaN(n));
            }
            
            if (Array.isArray(selectedRoulette.numeros) && selectedRoulette.numeros.length > 0) {
              return selectedRoulette.numeros.map(n => Number(n || 0)).filter(n => !isNaN(n));
            }
            
            return [];
          };

          const currentNumbers = extractNumbers();

          // Se houver lastNumbers na roleta, garantir que eles estão incluídos no início do histórico
          if (currentNumbers && currentNumbers.length > 0) {
            // Combinar currentNumbers com os números históricos, removendo duplicatas
            const combinedNumbers = [...currentNumbers];
            numbers.forEach(num => {
              if (!combinedNumbers.includes(num)) {
                combinedNumbers.push(num);
              }
            });
            numbers = combinedNumbers;
          }
          
          if (numbers && numbers.length > 10) {
            console.log(`Encontrados ${numbers.length} números históricos`);
            setHistoricalNumbers(numbers);
          } else {
            console.log(`Histórico insuficiente, usando dados existentes`);
            // Se não temos dados históricos suficientes, usar apenas os números atuais
            setHistoricalNumbers(currentNumbers.length > 0 ? currentNumbers : 
              [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10]); // dados de exemplo
          }
        } catch (error) {
          console.error('Erro ao carregar dados históricos:', error);
          // Dados de exemplo se falhar
          setHistoricalNumbers([0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10]);
        } finally {
          setIsLoadingStats(false);
        }
      }
    };
    
    loadHistoricalData();
  }, [selectedRoulette]);

  return (
    <Layout preloadData={true}>
      <div className="container mx-auto px-4 pt-4 md:pt-8">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-2 text-white">Roletas Disponíveis</h1>
            <p className="text-sm text-gray-400 mb-4 md:mb-0">
              Escolha uma roleta para começar a jogar
            </p>
          </div>
          
          <div className="w-full md:w-auto flex flex-col md:flex-row gap-3">
            <div className="relative">
              <input
                type="text" 
                placeholder="Buscar roleta..."
                className="bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-2 pl-10 w-full md:w-64 text-white"
                value={search} 
                onChange={(e) => setSearch(e.target.value)}
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>
        
        {/* Mensagem de erro */}
        {error && (
          <div className="bg-red-900/30 border border-red-500 p-4 mb-6 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-100">{error}</p>
          </div>
        )}
        
        {/* Estado de carregamento */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-[#1e1e24] animate-pulse rounded-xl h-64"></div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Cards de roleta à esquerda (25% da largura em desktop) */}
            <div className="w-full lg:w-1/4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                {renderRouletteCards()}
              </div>
            </div>
            
            {/* Painel de estatísticas à direita (75% da largura em desktop) */}
            <div className="w-full lg:w-3/4 bg-gray-900 rounded-lg p-4 h-fit overflow-y-auto max-h-[calc(100vh-100px)] sticky top-4">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-green-500" />
                {selectedRoulette 
                  ? `Estatísticas: ${selectedRoulette.nome || selectedRoulette.name}`
                  : 'Estatísticas da Roleta'
                }
              </h2>
              
              {/* Conteúdo do painel de estatísticas */}
              {isLoadingStats ? (
                <div className="text-white text-center py-10">
                  <div className="animate-spin w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p>Carregando estatísticas...</p>
                </div>
              ) : !selectedRoulette ? (
                <div className="text-gray-400 text-sm mb-4">
                  Selecione uma roleta para ver estatísticas detalhadas
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Histórico de Números */}
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <h3 className="text-sm font-medium text-white mb-2 flex items-center">
                      <BarChart className="h-4 w-4 mr-2 text-green-500" />
                      Histórico de Números (Mostrando: {Math.min(historicalNumbers.length, 100)})
                    </h3>
                    <div className="grid grid-cols-8 sm:grid-cols-10 gap-1 max-h-[150px] overflow-y-auto p-1">
                      {historicalNumbers.slice(0, 100).map((num, idx) => {
                        const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
                        const bgColor = num === 0 
                          ? "bg-green-600"
                          : redNumbers.includes(num) ? "bg-red-600" : "bg-black";
                        
                        return (
                          <div 
                            key={idx} 
                            className={`${bgColor} w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white`}
                          >
                            {num}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Distribuição de Cores */}
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <h3 className="text-sm font-medium text-white mb-2 flex items-center">
                      <ChartBar className="h-4 w-4 mr-2 text-green-500" />
                      Distribuição por Cor
                    </h3>
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={generateGroupDistribution(historicalNumbers)}
                            cx="50%"
                            cy="50%"
                            outerRadius={60}
                            fill="#00ff00"
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {generateGroupDistribution(historicalNumbers).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Legend />
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  
                  {/* Taxa de Vitória */}
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <h3 className="text-sm font-medium text-white mb-2 flex items-center">
                      <Percent className="h-4 w-4 mr-2 text-green-500" />
                      Taxa de Vitória
                    </h3>
                    {(() => {
                      const wins = typeof selectedRoulette.vitorias === 'number' ? selectedRoulette.vitorias : 0;
                      const losses = typeof selectedRoulette.derrotas === 'number' ? selectedRoulette.derrotas : 0;
                      const total = wins + losses;
                      const winRate = total > 0 ? (wins / total) * 100 : 0;
                      
                      return (
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
                      );
                    })()}
                  </div>
                  
                  {/* Frequência de Números */}
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <h3 className="text-sm font-medium text-white mb-2 flex items-center">
                      <ChartBar className="h-4 w-4 mr-2 text-green-500" />
                      Frequência de Números
                    </h3>
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart 
                          data={generateFrequencyData(historicalNumbers).filter(item => item.frequency > 0)} 
                          margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                          <XAxis dataKey="number" stroke="#ccc" tick={{fontSize: 10}} />
                          <YAxis stroke="#ccc" tick={{fontSize: 10}} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#222', borderColor: '#00ff00' }} 
                            labelStyle={{ color: '#00ff00' }}
                          />
                          <Bar dataKey="frequency" fill="#00ff00" />
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  
                  {/* Números quentes e frios */}
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <h3 className="text-sm font-medium text-white mb-2">Números Quentes e Frios</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(() => {
                        const frequencyData = generateFrequencyData(historicalNumbers);
                        
                        // Obter 5 números mais frequentes e 5 menos frequentes
                        const hotNumbers = [...frequencyData]
                          .filter(item => item.frequency > 0)
                          .sort((a, b) => b.frequency - a.frequency)
                          .slice(0, 5);
                        
                        // Se não tivermos 5 números quentes, adicionar alguns fíctícios
                        if (hotNumbers.length < 5) {
                          const existingNumbers = hotNumbers.map(item => item.number);
                          for (let i = 0; i < 5 - hotNumbers.length; i++) {
                            let randomNum = Math.floor(Math.random() * 36);
                            while (existingNumbers.includes(randomNum)) {
                              randomNum = Math.floor(Math.random() * 36);
                            }
                            hotNumbers.push({ number: randomNum, frequency: 1 });
                            existingNumbers.push(randomNum);
                          }
                        }
                        
                        const coldNumbers = [...frequencyData]
                          .filter(item => item.frequency > 0)
                          .sort((a, b) => a.frequency - b.frequency)
                          .slice(0, 5);
                            
                        // Se não tivermos 5 números frios, adicionar alguns fíctícios
                        if (coldNumbers.length < 5) {
                          const existingHotNumbers = hotNumbers.map(item => item.number);
                          const existingColdNumbers = coldNumbers.map(item => item.number);
                          const allExisting = [...existingHotNumbers, ...existingColdNumbers];
                          
                          for (let i = 0; i < 5 - coldNumbers.length; i++) {
                            let randomNum = Math.floor(Math.random() * 36);
                            while (allExisting.includes(randomNum)) {
                              randomNum = Math.floor(Math.random() * 36);
                            }
                            coldNumbers.push({ number: randomNum, frequency: 1 });
                            allExisting.push(randomNum);
                          }
                        }
                        
                        const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
                        
                        return (
                          <>
                            {/* Números quentes */}
                            <div className="p-2 bg-gray-900 rounded-lg">
                              <h4 className="text-xs font-medium text-red-500 mb-2 flex items-center">
                                <ArrowUp className="h-3 w-3 mr-1" /> Mais Frequentes
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {hotNumbers.map(({number, frequency}) => {
                                  const bgColor = number === 0 
                                    ? "bg-green-600" 
                                    : redNumbers.includes(number) ? "bg-red-600" : "bg-black";
                                  
                                  return (
                                    <div key={number} className="flex flex-col items-center">
                                      <div 
                                        className={`${bgColor} w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium mb-1`}
                                      >
                                        {number}
                                      </div>
                                      <span className="text-xs text-gray-400">{frequency}x</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            
                            {/* Números frios */}
                            <div className="p-2 bg-gray-900 rounded-lg">
                              <h4 className="text-xs font-medium text-blue-500 mb-2 flex items-center">
                                <ArrowDown className="h-3 w-3 mr-1" /> Menos Frequentes
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {coldNumbers.map(({number, frequency}) => {
                                  const bgColor = number === 0 
                                    ? "bg-green-600" 
                                    : redNumbers.includes(number) ? "bg-red-600" : "bg-black";
                                  
                                  return (
                                    <div key={number} className="flex flex-col items-center">
                                      <div 
                                        className={`${bgColor} w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium mb-1`}
                                      >
                                        {number}
                                      </div>
                                      <span className="text-xs text-gray-400">{frequency}x</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  
                  {/* Resumo de estatísticas */}
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <h3 className="text-sm font-medium text-white mb-2">Resumo Detalhado</h3>
                    {(() => {
                        // Estatísticas por dúzias
                        const firstDozen = historicalNumbers.filter(n => n >= 1 && n <= 12).length;
                        const secondDozen = historicalNumbers.filter(n => n >= 13 && n <= 24).length;
                        const thirdDozen = historicalNumbers.filter(n => n >= 25 && n <= 36).length;
                        
                        // Estatísticas por colunas
                        const firstColumn = historicalNumbers.filter(n => n > 0 && n % 3 === 1).length;
                        const secondColumn = historicalNumbers.filter(n => n > 0 && n % 3 === 2).length;
                        const thirdColumn = historicalNumbers.filter(n => n > 0 && n % 3 === 0).length;
                        
                        const total = historicalNumbers.length || 1; // Evitar divisão por zero
                        
                        return (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {/* Dúzias */}
                            <div className="bg-gray-900 p-2 rounded">
                              <div className="text-xs text-gray-400">1ª dúzia (1-12)</div>
                              <div className="flex justify-between items-center">
                                <div className="text-sm text-white font-medium">{firstDozen}</div>
                                <div className="text-xs text-green-400">{Math.round((firstDozen / total) * 100)}%</div>
                              </div>
                            </div>
                            <div className="bg-gray-900 p-2 rounded">
                              <div className="text-xs text-gray-400">2ª dúzia (13-24)</div>
                              <div className="flex justify-between items-center">
                                <div className="text-sm text-white font-medium">{secondDozen}</div>
                                <div className="text-xs text-green-400">{Math.round((secondDozen / total) * 100)}%</div>
                              </div>
                            </div>
                            <div className="bg-gray-900 p-2 rounded">
                              <div className="text-xs text-gray-400">3ª dúzia (25-36)</div>
                              <div className="flex justify-between items-center">
                                <div className="text-sm text-white font-medium">{thirdDozen}</div>
                                <div className="text-xs text-green-400">{Math.round((thirdDozen / total) * 100)}%</div>
                              </div>
                            </div>
                            <div className="bg-gray-900 p-2 rounded">
                              <div className="text-xs text-gray-400">Zero</div>
                              <div className="flex justify-between items-center">
                                <div className="text-sm text-white font-medium">{historicalNumbers.filter(n => n === 0).length}</div>
                                <div className="text-xs text-green-400">{Math.round((historicalNumbers.filter(n => n === 0).length / total) * 100)}%</div>
                              </div>
                            </div>
                            
                            {/* Colunas */}
                            <div className="bg-gray-900 p-2 rounded">
                              <div className="text-xs text-gray-400">1ª coluna (1,4,7...)</div>
                              <div className="flex justify-between items-center">
                                <div className="text-sm text-white font-medium">{firstColumn}</div>
                                <div className="text-xs text-green-400">{Math.round((firstColumn / total) * 100)}%</div>
                              </div>
                            </div>
                            <div className="bg-gray-900 p-2 rounded">
                              <div className="text-xs text-gray-400">2ª coluna (2,5,8...)</div>
                              <div className="flex justify-between items-center">
                                <div className="text-sm text-white font-medium">{secondColumn}</div>
                                <div className="text-xs text-green-400">{Math.round((secondColumn / total) * 100)}%</div>
                              </div>
                            </div>
                            <div className="bg-gray-900 p-2 rounded">
                              <div className="text-xs text-gray-400">3ª coluna (3,6,9...)</div>
                              <div className="flex justify-between items-center">
                                <div className="text-sm text-white font-medium">{thirdColumn}</div>
                                <div className="text-xs text-green-400">{Math.round((thirdColumn / total) * 100)}%</div>
                              </div>
                            </div>
                            <div className="bg-gray-900 p-2 rounded">
                              <div className="text-xs text-gray-400">Total de números</div>
                              <div className="flex justify-between items-center">
                                <div className="text-sm text-white font-medium">{total}</div>
                                <div className="text-xs text-blue-400">100%</div>
                              </div>
                            </div>
                          </div>
                        );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Index;