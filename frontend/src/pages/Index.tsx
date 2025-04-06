import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Search, Wallet, Menu, MessageSquare, AlertCircle, BarChart3 } from 'lucide-react';
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
            {/* Cards de roleta à esquerda (2/3 da largura em desktop) */}
            <div className="w-full lg:w-2/3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderRouletteCards()}
              </div>
            </div>
            
            {/* Painel de estatísticas à direita (1/3 da largura em desktop) */}
            <div className="w-full lg:w-1/3 bg-gray-900 rounded-lg p-4 h-fit sticky top-4">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-green-500" />
                {selectedRoulette 
                  ? `Estatísticas: ${selectedRoulette.nome || selectedRoulette.name}`
                  : 'Estatísticas da Roleta'
                }
              </h2>
              
              {/* Conteúdo do painel de estatísticas */}
              {!selectedRoulette ? (
                <div className="text-gray-400 text-sm mb-4">
                  Selecione uma roleta para ver estatísticas detalhadas
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Estatísticas para a roleta selecionada */}
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <h3 className="text-sm font-medium text-white mb-2">Distribuição de Cores</h3>
                    
                    {/* Obter números da roleta selecionada */}
                    {(() => {
                      const numbers = Array.isArray(selectedRoulette.numero) 
                        ? selectedRoulette.numero.map(n => typeof n === 'object' && n !== null && 'numero' in n ? n.numero : n)
                        : Array.isArray(selectedRoulette.lastNumbers)
                          ? selectedRoulette.lastNumbers
                          : [];
                          
                      // Verificar se temos números válidos
                      if (!numbers || numbers.length === 0) {
                        return <p className="text-gray-400 text-sm">Nenhum dado disponível</p>;
                      }
                      
                      // Calcular estatísticas
                      const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
                      const redCount = numbers.filter(n => redNumbers.includes(Number(n))).length;
                      const blackCount = numbers.filter(n => n !== 0 && !redNumbers.includes(Number(n))).length;
                      const zeroCount = numbers.filter(n => Number(n) === 0).length;
                      const total = numbers.length;
                      
                      // Calcular porcentagens
                      const redPercent = Math.round((redCount / total) * 100) || 0;
                      const blackPercent = Math.round((blackCount / total) * 100) || 0;
                      const zeroPercent = Math.round((zeroCount / total) * 100) || 0;
                      
                      return (
                        <>
                          {/* Barra de progresso para vermelho */}
                          <div className="mb-2">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-red-500">Vermelho</span>
                              <span className="text-white">{redCount} ({redPercent}%)</span>
                            </div>
                            <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-red-600 h-full" 
                                style={{ width: `${redPercent}%` }}
                              />
                            </div>
                          </div>
                          
                          {/* Barra de progresso para preto */}
                          <div className="mb-2">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-300">Preto</span>
                              <span className="text-white">{blackCount} ({blackPercent}%)</span>
                            </div>
                            <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-gray-900 h-full" 
                                style={{ width: `${blackPercent}%` }}
                              />
                            </div>
                          </div>
                          
                          {/* Barra de progresso para zero */}
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-green-500">Zero</span>
                              <span className="text-white">{zeroCount} ({zeroPercent}%)</span>
                            </div>
                            <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-green-600 h-full" 
                                style={{ width: `${zeroPercent}%` }}
                              />
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  
                  {/* Últimos números */}
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <h3 className="text-sm font-medium text-white mb-2">Últimos Números</h3>
                    <div className="flex flex-wrap gap-1">
                      {(() => {
                        const numbers = Array.isArray(selectedRoulette.numero) 
                          ? selectedRoulette.numero.map(n => typeof n === 'object' && n !== null && 'numero' in n ? n.numero : n)
                          : Array.isArray(selectedRoulette.lastNumbers)
                            ? selectedRoulette.lastNumbers
                            : [];
                            
                        if (!numbers || numbers.length === 0) {
                          return <p className="text-gray-400 text-sm">Nenhum dado disponível</p>;
                        }
                        
                        const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
                        
                        return numbers.slice(0, 20).map((num, idx) => {
                          const numValue = Number(num);
                          const bgColor = numValue === 0 
                            ? "bg-green-600" 
                            : redNumbers.includes(numValue)
                              ? "bg-red-600"
                              : "bg-black";
                          
                          return (
                            <div 
                              key={idx} 
                              className={`${bgColor} text-white w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium`}
                            >
                              {numValue}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                  
                  {/* Outras estatísticas em grid */}
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <h3 className="text-sm font-medium text-white mb-2">Outras Estatísticas</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {(() => {
                        const numbers = Array.isArray(selectedRoulette.numero) 
                          ? selectedRoulette.numero.map(n => typeof n === 'object' && n !== null && 'numero' in n ? n.numero : n)
                          : Array.isArray(selectedRoulette.lastNumbers)
                            ? selectedRoulette.lastNumbers
                            : [];
                            
                        if (!numbers || numbers.length === 0) {
                          return <p className="text-gray-400 text-sm col-span-2">Nenhum dado disponível</p>;
                        }
                        
                        // Converter para números
                        const numArray = numbers.map(n => Number(n));
                        
                        return (
                          <>
                            <div className="bg-gray-900 p-2 rounded">
                              <div className="text-xs text-gray-400">Par</div>
                              <div className="text-sm text-white font-medium">
                                {numArray.filter(n => n !== 0 && n % 2 === 0).length}
                              </div>
                            </div>
                            <div className="bg-gray-900 p-2 rounded">
                              <div className="text-xs text-gray-400">Ímpar</div>
                              <div className="text-sm text-white font-medium">
                                {numArray.filter(n => n % 2 === 1).length}
                              </div>
                            </div>
                            <div className="bg-gray-900 p-2 rounded">
                              <div className="text-xs text-gray-400">1-18</div>
                              <div className="text-sm text-white font-medium">
                                {numArray.filter(n => n >= 1 && n <= 18).length}
                              </div>
                            </div>
                            <div className="bg-gray-900 p-2 rounded">
                              <div className="text-xs text-gray-400">19-36</div>
                              <div className="text-sm text-white font-medium">
                                {numArray.filter(n => n >= 19 && n <= 36).length}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
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