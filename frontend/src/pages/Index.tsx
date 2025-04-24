import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { AlertCircle, BarChart3, LockKeyhole } from 'lucide-react';
import RouletteCard from '@/components/RouletteCard';
import Layout from '@/components/Layout';
import { RouletteRepository } from '../services/data/rouletteRepository';
import { RouletteData } from '@/types';
import EventService from '@/services/EventService';
import { RequestThrottler } from '@/services/utils/requestThrottler';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { DialogTrigger } from '@/components/ui/dialog';
import RouletteSidePanelStats from '@/components/RouletteSidePanelStats';
import RouletteFilterBar from '@/components/RouletteFilterBar';
import { extractProviders } from '@/utils/rouletteProviders';
import PlanProtectedFeature from '@/components/PlanProtectedFeature';
import { PlanType } from '@/types/plans';
import { useUser } from '@/hooks/useUser';

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
  const [filteredRoulettes, setFilteredRoulettes] = useState<RouletteData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [knownRoulettes, setKnownRoulettes] = useState<RouletteData[]>([]);
  const [dataFullyLoaded, setDataFullyLoaded] = useState<boolean>(false);
  const [selectedRoulette, setSelectedRoulette] = useState<RouletteData | null>(null);
  const [historicalNumbers, setHistoricalNumbers] = useState<number[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;
  const [showDrawOverlay, setShowDrawOverlay] = useState(false);
  const [routeChanged, setRouteChanged] = useState(false);
  const [routeTimer, setRouteTimer] = useState(10);
  const [visibleTooltipId, setVisibleTooltipId] = useState<string | null>(null);
  const { user } = useUser();
  
  // Referência para controlar se o componente está montado
  const isMounted = useRef(true);

  // Referência para timeout de atualização
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Planos disponíveis para upgrade
  const availablePlans = useMemo(() => [
    {
      id: 'free',
      type: PlanType.FREE,
      name: 'Gratuito',
      description: 'Acesso básico',
      price: 0,
      features: ['Visão limitada dos dados', 'Sem acesso a roletas premium']
    },
    {
      id: 'basic',
      type: PlanType.BASIC,
      name: 'Básico',
      description: 'Para jogadores casuais',
      price: 29.90,
      features: ['Acesso a todas as roletas', 'Estatísticas básicas', 'Histórico completo de números']
    },
    {
      id: 'premium',
      type: PlanType.PREMIUM,
      name: 'Premium',
      description: 'Para jogadores sérios',
      price: 69.90,
      features: ['Tudo do plano Básico', 'Análises avançadas', 'Alertas personalizados', 'Suporte prioritário']
    },
    {
      id: 'pro',
      type: PlanType.PRO,
      name: 'Pro',
      description: 'Para profissionais',
      price: 149.90,
      features: ['Tudo do plano Premium', 'API de integração', 'Dados em tempo real', 'Análises preditivas', 'Suporte 24/7']
    }
  ], []);
  
  // Plano atual do usuário
  const currentPlan = useMemo(() => {
    if (!user) return null;
    return {
      type: user.planType || PlanType.FREE
    };
  }, [user]);
  
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
  
  // Simplificar para usar diretamente as roletas
  // const filteredRoulettes = roulettes; // Remover esta linha
  
  // Efeito para inicializar o estado filteredRoulettes com todas as roletas
  useEffect(() => {
    setFilteredRoulettes(roulettes);
  }, [roulettes]);
  
  const topRoulettes = useMemo(() => {
    return [...roulettes].sort((a, b) => {
      const aWinRate = a.vitorias / (a.vitorias + a.derrotas) * 100 || 0;
      const bWinRate = b.vitorias / (b.vitorias + b.derrotas) * 100 || 0;
      return bWinRate - aWinRate;
    }).slice(0, 3);
  }, [roulettes]);

  // Função para renderizar os cards de roleta
  const renderRouletteCards = () => {
    if (!Array.isArray(filteredRoulettes) || filteredRoulettes.length === 0) {
      return (
        <div className="col-span-full text-center py-8">
          <p className="text-muted-foreground">Nenhuma roleta disponível com os filtros atuais.</p>
        </div>
      );
    }

    // Log para depuração
    console.log(`[Index] Renderizando ${filteredRoulettes.length} roletas disponíveis`);
    
    // Mais logs para depuração - mostrar o total de roletas
    console.log(`[Index] Exibindo todas as ${filteredRoulettes.length} roletas disponíveis`);
    
    // MODIFICAÇÃO CRÍTICA: Mostrar todas as roletas sem paginação
    const allRoulettes = filteredRoulettes;
    
    console.log(`[Index] Exibindo todas as ${allRoulettes.length} roletas disponíveis`);

    return allRoulettes.map(roulette => {
      // Garantir que temos números válidos
      let safeNumbers: number[] = [];
      
      // Tentar extrair números do campo numero
      if (Array.isArray(roulette.numero)) {
        safeNumbers = roulette.numero
          .filter(item => item !== null && item !== undefined)
          .map(item => {
            // Aqui sabemos que item não é null ou undefined após o filtro
            const nonNullItem = item as any; // Tratar como any para evitar erros de tipo
            // Se for um objeto com a propriedade numero
            if (typeof nonNullItem === 'object' && 'numero' in nonNullItem) {
              return nonNullItem.numero;
            }
            // Se for um número diretamente
            return nonNullItem;
          });
      } 
      // Tentar extrair de lastNumbers se ainda estiver vazio
      else if (Array.isArray(roulette.lastNumbers) && roulette.lastNumbers.length > 0) {
        safeNumbers = roulette.lastNumbers;
      } 
      // Tentar extrair de numeros se ainda estiver vazio
      else if (Array.isArray(roulette.numeros) && roulette.numeros.length > 0) {
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
  
  // Componente de Skeleton para os cards de roleta
  const RouletteCardSkeleton = () => (
    <div className="bg-[#131614] border border-gray-800 rounded-xl h-64 animate-pulse flex flex-col p-4">
      <div className="flex justify-between items-center mb-3">
        <div className="h-5 w-32 bg-gray-700 rounded"></div>
        <div className="h-4 w-16 bg-gray-700 rounded"></div>
      </div>
      <div className="flex flex-wrap gap-1 justify-center my-4 p-3 border border-gray-700/50 rounded-xl bg-[#0f110f] flex-1">
        <div className="flex flex-wrap gap-2 justify-center items-center w-full h-full">
          {[...Array(15)].map((_, i) => (
            <div key={i} className="h-7 w-7 bg-gray-700 rounded-full"></div>
          ))}
        </div>
      </div>
      <div className="flex justify-between mt-2">
        <div className="h-4 w-20 bg-gray-700 rounded"></div>
        <div className="h-4 w-20 bg-gray-700 rounded"></div>
      </div>
    </div>
  );
  
  // Função para renderizar skeletons enquanto carrega
  const renderSkeletons = () => {
    return [...Array(12)].map((_, i) => (
      <RouletteCardSkeleton key={i} />
    ));
  };

  // Função para renderizar a paginação
  const renderPagination = () => {
    if (!Array.isArray(roulettes) || roulettes.length === 0) {
      return null;
    }
    
    // Usar todas as roletas diretamente, sem filtro
    const filteredRoulettes = roulettes;
    
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

  // Função para lidar com o filtro de roletas
  const handleRouletteFilter = (filtered: RouletteData[]) => {
    setFilteredRoulettes(filtered);
  };

  return (
    <Layout preloadData={true}>
      <div className="container mx-auto px-4 pt-4 md:pt-8">
        {/* Cabeçalho removido completamente */}
        
        {/* Mensagem de erro */}
        {error && (
          <div className="bg-red-900/30 border border-red-500 p-4 mb-6 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-100">{error}</p>
          </div>
        )}
        
        {/* Estado de carregamento */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {renderSkeletons()}
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Cards de roleta à esquerda */}
            <div className="w-full lg:w-1/2">
              {/* Adicionar barra de filtro acima dos cards de roleta */}
              <RouletteFilterBar 
                roulettes={roulettes}
                onFilter={handleRouletteFilter}
                onRefresh={loadRouletteData}
              />
              
              <PlanProtectedFeature
                featureId="view_roulette_cards"
                requiredPlan={PlanType.BASIC}
                lockedMessage="Os cartões de roleta completos só estão disponíveis para assinantes. Faça upgrade do seu plano para visualizar todos os dados."
                placeholderContent={
                  <div className="w-full bg-[#131111] p-6 rounded-xl border border-gray-700/50 text-center">
                    <div className="flex flex-col items-center justify-center py-12">
                      <LockKeyhole className="h-16 w-16 text-red-500 mb-6" />
                      <h3 className="text-xl font-semibold mb-3 text-white">Acesso Bloqueado</h3>
                      <p className="text-gray-400 mb-6 max-w-lg mx-auto">
                        Os cartões de roleta completos só estão disponíveis para assinantes. 
                        Faça upgrade do seu plano para visualizar todas as roletas em tempo real.
                      </p>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="default" size="lg" className="bg-vegas-gold hover:bg-vegas-gold/80 text-black px-8">
                            Fazer Upgrade
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-vegas-darkgray text-white border-vegas-black">
                          <DialogHeader>
                            <DialogTitle>Faça upgrade do seu plano</DialogTitle>
                            <DialogDescription className="text-gray-400">
                              Escolha um plano para desbloquear recursos adicionais
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="grid gap-4 py-4">
                            {availablePlans
                              .filter(plan => plan.type !== PlanType.FREE && (currentPlan ? plan.type > currentPlan.type : true))
                              .map(plan => (
                                <div key={plan.id} className="flex items-center justify-between border border-gray-700 rounded-md p-4">
                                  <div>
                                    <h4 className="font-medium">{plan.name}</h4>
                                    <p className="text-sm text-gray-400">{plan.description}</p>
                                    <ul className="mt-2 text-xs text-gray-300">
                                      {plan.features.slice(0, 3).map((feature, i) => (
                                        <li key={i} className="flex items-center">
                                          <span className="mr-1 text-vegas-gold">✓</span> {feature}
                                        </li>
                                      ))}
                                      {plan.features.length > 3 && (
                                        <li className="text-gray-400">+ {plan.features.length - 3} mais recursos</li>
                                      )}
                                    </ul>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-bold text-vegas-gold">
                                      {plan.price.toLocaleString('pt-BR', { 
                                        style: 'currency', 
                                        currency: 'BRL' 
                                      })}
                                      <span className="text-xs text-gray-400">/mês</span>
                                    </p>
                                    <Button 
                                      variant="default" 
                                      size="sm" 
                                      className="mt-2 bg-vegas-gold hover:bg-vegas-gold/80 text-black"
                                    >
                                      Escolher
                                    </Button>
                                  </div>
                                </div>
                              ))}
                          </div>
                          
                          <DialogFooter>
                            <p className="text-xs text-gray-400">
                              <AlertCircle className="inline-block h-3 w-3 mr-1" />
                              Os valores serão cobrados mensalmente até o cancelamento.
                            </p>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      {/* Amostra gratuita de cards de roleta em versão bloqueada - Agora usando o skeleton */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-10 opacity-50">
                        {[...Array(8)].map((_, i) => (
                          <RouletteCardSkeleton key={i} />
                        ))}
                      </div>
                    </div>
                  </div>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {renderRouletteCards()}
                </div>
              </PlanProtectedFeature>
            </div>
            
            {/* Painel de estatísticas à direita - USANDO VERSÃO SEM POPUP */}
            <div className="w-full lg:w-1/2">
              {selectedRoulette ? (
                <RouletteSidePanelStats
                  roletaNome={selectedRoulette.nome || selectedRoulette.name || 'Roleta Selecionada'}
                  lastNumbers={selectedRoulette.lastNumbers || selectedRoulette.numero || []}
                  wins={typeof selectedRoulette.vitorias === 'number' ? selectedRoulette.vitorias : 0}
                  losses={typeof selectedRoulette.derrotas === 'number' ? selectedRoulette.derrotas : 0}
                  providers={extractProviders(roulettes)}
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
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Index;