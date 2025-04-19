import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Search, Wallet, Menu, MessageSquare, AlertCircle, BarChart3, ArrowUp, ArrowDown, X, ChartBar, BarChart, Percent, CircleX, Share, Home, Sparkles, RefreshCw, MonitorSmartphone, ExternalLink, ChevronRight } from 'lucide-react';
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
import { fetchRouletteHistoricalNumbers, generateFrequencyData, getHotColdNumbers, generateGroupDistribution, generateColorHourlyStats, getRouletteNumberColor } from '@/components/RouletteSidePanelStats';
import RouletteSidePanelStats from '@/components/RouletteSidePanelStats';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import LiveRoulettesDisplay from '@/components/roulette/LiveRoulettesDisplay';
import RouletteMiniStats from '@/components/RouletteMiniStats';
import { ProviderFilter } from '@/components/ProviderFilter';
import { ProviderInfoCard } from '@/components/ProviderInfoCard';
import { Features } from '@/components/Features';

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

const Index = () => {
  // Remover o estado de busca
  // const [search, setSearch] = useState("");
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;
  
  // Novo estado para filtro de provedor
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showProviderInfo, setShowProviderInfo] = useState(false);
  
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
  
  // Efeito para atualizar selectedRoulette quando roulettes for carregado ou alterado
  useEffect(() => {
    // Se já temos roletas carregadas e nenhuma roleta está selecionada, selecione a primeira
    if (roulettes.length > 0 && !selectedRoulette && !isLoading) {
      console.log('[Index] Selecionando uma roleta automaticamente');
      
      // Tentar encontrar uma roleta que tenha números/dados
      const roletaComDados = roulettes.find(roleta => {
        const temNumeros = (
          (Array.isArray(roleta.numero) && roleta.numero.length > 0) || 
          (Array.isArray(roleta.lastNumbers) && roleta.lastNumbers.length > 0) ||
          (Array.isArray(roleta.numeros) && roleta.numeros.length > 0)
        );
        return temNumeros;
      });
      
      // Se encontrou uma roleta com dados, selecione-a, caso contrário use a primeira
      setSelectedRoulette(roletaComDados || roulettes[0]);
    }
  }, [roulettes, selectedRoulette, isLoading]);
  
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
  
  // Extrair a lista de provedores disponíveis
  const availableProviders = useMemo(() => {
    if (!Array.isArray(roulettes) || roulettes.length === 0) {
      return [];
    }
    
    // Extrair provedores únicos
    const providers = Array.from(new Set(
      roulettes
        .filter(roulette => roulette.provedor) // Filtrar roletas que têm provedor definido
        .map(roulette => roulette.provedor as string) // Mapear para o nome do provedor
    )).sort(); // Ordenar alfabeticamente
    
    return providers;
  }, [roulettes]);
  
  // Filtrar roletas pelo provedor selecionado
  const filteredRoulettes = useMemo(() => {
    if (!Array.isArray(roulettes) || roulettes.length === 0) {
      return [];
    }
    
    // Se não houver provedor selecionado, retornar todas as roletas
    if (!selectedProvider) {
      return roulettes;
    }
    
    // Filtrar roletas pelo provedor selecionado
    return roulettes.filter(roulette => 
      roulette.provedor === selectedProvider
    );
  }, [roulettes, selectedProvider]);
  
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

    // Log para depuração
    console.log(`[Index] Renderizando ${roulettes.length} roletas disponíveis`);

    // Usar roletas filtradas pelo provedor
    let roulettesToRender = filteredRoulettes;
    
    // Mais logs para depuração - mostrar o total de roletas
    console.log(`[Index] Exibindo ${roulettesToRender.length} roletas (filtradas por provedor: ${selectedProvider || 'todos'})`);
    
    // MODIFICAÇÃO CRÍTICA: Mostrar todas as roletas sem paginação
    const allRoulettes = roulettesToRender;
    
    console.log(`[Index] Exibindo todas as ${allRoulettes.length} roletas disponíveis`);

    return allRoulettes.map(roulette => {
      // Garantir que temos números válidos
      let safeNumbers: number[] = [];
      
      if (Array.isArray(roulette.numero) && roulette.numero.length > 0) {
        safeNumbers = roulette.numero
          .filter(n => n !== null && n !== undefined)
          .map(n => {
            // Já filtramos null e undefined acima, então agora é seguro fazer o cast
            const value = n as (number | {numero: number});
            if (typeof value === 'object' && 'numero' in value) {
              return value.numero;
            }
            return value as number;
          });
      } else if (Array.isArray(roulette.lastNumbers) && roulette.lastNumbers.length > 0) {
        safeNumbers = roulette.lastNumbers;
      } else if (Array.isArray(roulette.numeros) && roulette.numeros.length > 0) {
        safeNumbers = roulette.numeros;
      }
      
      return (
        <div 
          key={roulette.id} 
          className={`cursor-pointer transition-all rounded-xl ${selectedRoulette?.id === roulette.id ? 'border-2 border-green-500 shadow-lg shadow-green-500/20' : 'p-0.5'}`}
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
  
  // Função para renderizar a paginação
  const renderPagination = () => {
    if (!Array.isArray(roulettes) || roulettes.length === 0) {
      return null;
    }
    
    // Usar todas as roletas diretamente, sem filtro
    let filteredRoulettes = roulettes;
    
    const totalPages = Math.ceil(filteredRoulettes.length / itemsPerPage);
    
    // Sempre mostrar a paginação se houver roletas
    // Removida a condição que ocultava a paginação quando havia apenas uma página
    
    return (
      <div className="flex justify-center mt-8 gap-2 mb-8 bg-gray-800 p-3 rounded-lg shadow-lg">
        <button 
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className={`px-4 py-2 rounded-md ${currentPage === 1 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
        >
          Anterior
        </button>
        
        <div className="flex items-center bg-gray-700 rounded-md px-4">
          <span className="text-white font-bold">Página {currentPage} de {totalPages || 1}</span>
        </div>
        
        <button 
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages || 1))}
          disabled={currentPage === totalPages}
          className={`px-4 py-2 rounded-md ${currentPage === totalPages ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
        >
          Próxima
        </button>
      </div>
    );
  };

  // Handler para cliques em funcionalidades
  const handleFeatureClick = (featureId: string) => {
    console.log(`Funcionalidade clicada: ${featureId}`);
    // Aqui seria implementada a lógica para cada funcionalidade
    // Por enquanto, apenas exibir uma mensagem no console
  };

  return (
    <Layout preloadData={true}>
      <div className="container mx-auto px-4 pt-4 md:pt-8">
        {/* Barra de filtros */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Roletas Disponíveis</h1>
          
          <div className="flex gap-4">
            {/* Filtro de Provedor */}
            {availableProviders.length > 0 && (
              <div className="flex items-center gap-2">
                <ProviderFilter 
                  providers={availableProviders}
                  selectedProvider={selectedProvider}
                  onSelectProvider={(provider) => {
                    setSelectedProvider(provider);
                    setShowProviderInfo(!!provider);
                  }}
                />
                
                {selectedProvider && (
                  <Button
                    variant="outline"
                    className="text-gray-300 border-gray-700 hover:bg-gray-800"
                    onClick={() => setShowProviderInfo(!showProviderInfo)}
                  >
                    {showProviderInfo ? 'Ocultar Informações' : 'Mostrar Informações'}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Informações do provedor (quando selecionado) */}
        {selectedProvider && showProviderInfo && (
          <div className="mb-6">
            <ProviderInfoCard providerName={selectedProvider} />
          </div>
        )}
        
        {/* Mensagem de erro */}
        {error && (
          <div className="bg-red-900/30 border border-red-500 p-4 mb-6 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-100">{error}</p>
          </div>
        )}
        
        {/* Estado de carregamento */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="bg-[#1e1e24] animate-pulse rounded-xl h-64"></div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Coluna esquerda: Cards de roleta */}
            <div className="w-full lg:w-1/2">
              {filteredRoulettes.length === 0 && !isLoading && !error ? (
                <div className="bg-[#1e1e24] p-6 rounded-lg text-center">
                  <p className="text-gray-400">Nenhuma roleta encontrada para o provedor selecionado.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-4">
                  {renderRouletteCards()}
                </div>
              )}
            </div>
            
            {/* Coluna direita com duas seções: estatísticas e funcionalidades */}
            <div className="w-full lg:w-1/2 space-y-6">
              {/* Painel de estatísticas */}
              {selectedRoulette ? (
                <RouletteSidePanelStats
                  roletaNome={selectedRoulette.nome || selectedRoulette.name || 'Roleta Selecionada'}
                  lastNumbers={selectedRoulette.lastNumbers || selectedRoulette.numero || []}
                  wins={typeof selectedRoulette.vitorias === 'number' ? selectedRoulette.vitorias : 0}
                  losses={typeof selectedRoulette.derrotas === 'number' ? selectedRoulette.derrotas : 0}
                />
              ) : (
                <div className="w-full bg-gray-900 rounded-lg p-6 text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-[#00ff00] opacity-50" />
                  <h3 className="text-lg font-medium text-white mb-2">Estatísticas da Roleta</h3>
                  <p className="text-sm text-gray-400">
                    Selecione uma roleta para ver estatísticas detalhadas
                  </p>
                </div>
              )}
              
              {/* Funcionalidades sugeridas */}
              <Features onFeatureClick={handleFeatureClick} />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Index;