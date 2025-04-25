import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { AlertCircle, BarChart3, PackageOpen } from 'lucide-react';
import RouletteCard from '@/components/RouletteCard';
import RouletteCardSkeleton from '@/components/RouletteCardSkeleton';
import Layout from '@/components/Layout';
import { RouletteRepository } from '../services/data/rouletteRepository';
import { RouletteData } from '@/types';
import EventService from '@/services/EventService';
import { RequestThrottler } from '@/services/utils/requestThrottler';
import RouletteSidePanelStats from '@/components/RouletteSidePanelStats';
import RouletteSidePanelSkeleton from '@/components/RouletteSidePanelSkeleton';
import RouletteFilterBar from '@/components/RouletteFilterBar';
import { extractProviders } from '@/utils/rouletteProviders';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

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

// Adicionar o estilo CSS inline para o componente radio
const radioInputStyles = `
.radio-input input {
  display: none;
}

.radio-input label {
  --border-color: #a1b0d8;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  min-width: 5rem;
  margin: 1rem;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  position: relative;
  align-items: center;
  background-color: #191a1f;
}

.radio-input input:checked + label {
  --border-color: #00FF00;
  border-color: var(--border-color);
  border-width: 2px;
}

.radio-input label:hover {
  --border-color: #00FF00;
  border-color: var(--border-color);
}

.radio-input {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-direction: column;
  width: 100%;
  margin-bottom: 1.5rem;
}

.circle {
  display: inline-block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #2a2a35;
  margin-right: 0.5rem;
  position: relative;
}

.radio-input input:checked + label span.circle::before {
  content: "";
  display: inline;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: #00FF00;
  width: 15px;
  height: 15px;
  border-radius: 50%;
}

.text {
  display: flex;
  align-items: center;
  color: white;
}

.price {
  display: flex;
  flex-direction: column;
  text-align: right;
  font-weight: bold;
  color: white;
}

.small {
  font-size: 10px;
  color: #a0a0a7;
  font-weight: 100;
}

.info {
  position: absolute;
  display: inline-block;
  font-size: 11px;
  background-color: #00FF00;
  border-radius: 20px;
  padding: 1px 9px;
  top: 0;
  transform: translateY(-50%);
  right: 5px;
  color: black;
  font-weight: bold;
}
`;

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
  
  // Novos estados para o checkout
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("basic"); // 'basic' é o padrão (mensal)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  
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

  // Renderiza skeletons para os cards de roleta
  const renderRouletteSkeletons = () => {
    return Array(12).fill(0).map((_, index) => (
      <RouletteCardSkeleton key={index} />
    ));
  };

  return (
    <Layout preloadData={true}>
      {/* Container principal com posicionamento relativo para permitir sobreposição */}
      <div className="container mx-auto px-4 pt-4 md:pt-8 min-h-[80vh] relative">
        {/* Mensagem de erro */}
        {error && (
          <div className="bg-red-900/30 border border-red-500 p-4 mb-6 rounded-lg flex items-center z-50 relative">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-100">{error}</p>
          </div>
        )}
        
        {/* Layout em esqueleto em segundo plano (com opacidade reduzida) */}
        <div className="flex flex-col lg:flex-row gap-6 opacity-60">
          {/* Cards de roleta à esquerda em modo esqueleto */}
          <div className="w-full lg:w-1/2">
            {/* Filtro de roletas em skeleton */}
            <div className="mb-4 p-4 bg-[#131614] rounded-lg border border-gray-800/30">
              <div className="flex justify-between items-center">
                <div className="h-8 w-32 bg-gray-800 rounded animate-pulse"></div>
                <div className="h-8 w-20 bg-gray-800 rounded animate-pulse"></div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {renderRouletteSkeletons()}
            </div>
          </div>
          
          {/* Painel lateral em modo esqueleto */}
          <div className="w-full lg:w-1/2">
            <RouletteSidePanelSkeleton />
          </div>
        </div>
        
        {/* Botão centralizado que sobrepõe os esqueletos */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-[#131614]/80 p-10 rounded-xl backdrop-blur-lg shadow-2xl border border-gray-800/50 text-center max-w-xl w-full">
            <h2 className="text-[#00FF00] font-bold text-xl mb-6">Acesse nossas estatísticas exclusivas</h2>
            <p className="text-white/80 mb-6">Escolha um plano agora e desbloqueie acesso completo às melhores análises de roletas em tempo real</p>
            
            {/* From Uiverse.io by andrew-demchenk0 */}
            <style>
              {`
                .wrapper {
                  position: relative;
                  display: flex;
                  flex-direction: row;
                  gap: 10px;
                  justify-content: center;
                  margin-bottom: 20px;
                }
                
                .card {
                  position: relative;
                  width: 150px;
                  height: 100px;
                  background: #111118;
                  border-radius: 10px;
                  transition: all 0.3s;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                }
                
                .card:hover {
                  transform: scale(1.05);
                }
                
                .input {
                  position: absolute;
                  top: 0;
                  left: 0;
                  height: 100%;
                  width: 100%;
                  cursor: pointer;
                  appearance: none;
                  border: 1px solid #333;
                  border-radius: 10px;
                  z-index: 10;
                  box-shadow: 1px 1px 10px rgba(0,0,0,0.5),
                              -1px -1px 10px rgba(255,255,255,0.05);
                }
                
                .input + .check::before {
                  content: "";
                  position: absolute;
                  top: 12px;
                  right: 12px;
                  width: 16px;
                  height: 16px;
                  border: 2px solid #555;
                  border-radius: 50%;
                  background-color: #111;
                }
                
                .input:checked + .check::after {
                  content: '';
                  position: absolute;
                  top: 16px;
                  right: 16px;
                  width: 8px;
                  height: 8px;
                  background-color: #00FF00;
                  border-radius: 50%;
                }
                
                .input[value="premium"]:checked + .check::after {
                  background-color: #00FF00;
                }
                
                .input[value="basic"]:checked,
                .input[value="premium"]:checked {
                  border: 1.5px solid #00FF00;
                }
                
                .label {
                  color: #fff;
                  position: relative;
                  z-index: 0;
                  width: 80%;
                  text-align: left;
                }
                
                .label .title {
                  font-weight: 900;
                  font-size: 15px;
                  letter-spacing: 1.5px;
                  margin-bottom: 8px;
                }
                
                .label .price {
                  font-size: 20px;
                  font-weight: 900;
                }
                
                .label .span {
                  color: #999;
                  font-weight: 700;
                  font-size: 15px;
                }
              `}
            </style>
            
            <div className="wrapper">
              <div className="card">
                <input 
                  className="input" 
                  type="radio" 
                  name="card" 
                  value="basic" 
                  defaultChecked 
                  onChange={() => setSelectedPlan("basic")}
                />
                <span className="check"></span>
                <label className="label">
                  <div className="title">MENSAL</div>
                  <div className="price">
                    <span className="span">R$</span>
                    49
                    <span className="span">/mês</span>
                  </div>
                </label>
              </div>
              <div className="card">
                <input 
                  className="input" 
                  type="radio" 
                  name="card" 
                  value="premium" 
                  onChange={() => setSelectedPlan("premium")}
                />
                <span className="check"></span>
                <label className="label">
                  <div className="title">ANUAL</div>
                  <div className="price">
                    <span className="span">R$</span>
                    99
                    <span className="span">/ano</span>
                  </div>
                </label>
              </div>
            </div>
            
            <Button 
              onClick={() => setShowCheckout(true)}
              className="px-8 py-6 text-lg font-bold bg-gradient-to-r from-[#00FF00] to-[#A3FFA3] hover:from-[#00DD00] hover:to-[#8AE98A] text-black rounded-full shadow-lg shadow-green-500/20 mt-6"
            >
              <PackageOpen className="mr-2 h-5 w-5" />
              Escolher Plano
            </Button>
            
            {/* Formulário de Checkout */}
            {showCheckout && !paymentSuccess && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="bg-[#131614] rounded-xl shadow-2xl border border-gray-800 max-w-md w-full p-6 relative overflow-y-auto max-h-[90vh]">
                  <button 
                    onClick={() => setShowCheckout(false)} 
                    className="absolute top-3 right-3 text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                  
                  <h2 className="text-[#00FF00] font-bold text-xl mb-6 text-center">
                    Finalizar Compra - Plano {selectedPlan === "basic" ? "Mensal" : "Anual"}
                  </h2>
                  
                  {paymentError && (
                    <div className="mb-4 bg-red-900/30 border border-red-500 p-3 rounded-lg text-red-100">
                      <p className="text-sm">{paymentError}</p>
                    </div>
                  )}
                  
                  <div className="mb-6 bg-[#0d0d0d] p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white/80">Plano:</span>
                      <span className="text-white font-bold">
                        {selectedPlan === "basic" ? "Mensal" : "Anual"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">Valor:</span>
                      <span className="text-[#00FF00] font-bold">
                        {selectedPlan === "basic" ? "R$ 49,00" : "R$ 99,00"}
                      </span>
                    </div>
                  </div>
                  
                  <form className="space-y-4" onSubmit={(e) => {
                    e.preventDefault();
                    setIsProcessingPayment(true);
                    setPaymentError(null);
                    
                    // Simulação de integração com Asaas
                    setTimeout(() => {
                      // Em uma implementação real, aqui seria feita a chamada para API
                      setIsProcessingPayment(false);
                      // Exemplo de tratamento de sucesso
                      setPaymentSuccess(true);
                      
                      // Ou exemplo de tratamento de erro
                      // setPaymentError("Não foi possível processar o pagamento. Verifique os dados e tente novamente.");
                    }, 2000);
                  }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white/80 mb-1 text-sm">Nome completo</label>
                        <input 
                          type="text" 
                          className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-md text-white focus:border-[#00FF00] focus:outline-none"
                          placeholder="Digite seu nome completo"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-white/80 mb-1 text-sm">CPF/CNPJ</label>
                        <input 
                          type="text" 
                          className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-md text-white focus:border-[#00FF00] focus:outline-none"
                          placeholder="000.000.000-00"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white/80 mb-1 text-sm">E-mail</label>
                        <input 
                          type="email" 
                          className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-md text-white focus:border-[#00FF00] focus:outline-none"
                          placeholder="seuemail@exemplo.com"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-white/80 mb-1 text-sm">Telefone</label>
                        <input 
                          type="tel" 
                          className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-md text-white focus:border-[#00FF00] focus:outline-none"
                          placeholder="(00) 00000-0000"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-white/80 mb-1 text-sm">Endereço</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-md text-white focus:border-[#00FF00] focus:outline-none"
                        placeholder="Rua, número, complemento"
                        required
                      />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-white/80 mb-1 text-sm">CEP</label>
                        <input 
                          type="text" 
                          className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-md text-white focus:border-[#00FF00] focus:outline-none"
                          placeholder="00000-000"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-white/80 mb-1 text-sm">Cidade/UF</label>
                        <input 
                          type="text" 
                          className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-md text-white focus:border-[#00FF00] focus:outline-none"
                          placeholder="Cidade/UF"
                        />
                      </div>
                    </div>
                    
                    <Button 
                      className="w-full py-3 text-lg font-bold bg-gradient-to-r from-[#00FF00] to-[#A3FFA3] hover:from-[#00DD00] hover:to-[#8AE98A] text-black rounded-full shadow-lg shadow-green-500/20 mt-6"
                      type="submit"
                      disabled={isProcessingPayment}
                    >
                      {isProcessingPayment ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processando...
                        </span>
                      ) : "Prosseguir para Pagamento"}
                    </Button>
                    
                    <p className="text-center text-gray-500 text-xs mt-4">
                      Você será redirecionado para a plataforma segura de pagamento do Asaas.
                    </p>
                  </form>
                </div>
              </div>
            )}
            
            {/* Tela de sucesso no pagamento */}
            {paymentSuccess && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="bg-[#131614] rounded-xl shadow-2xl border border-gray-800 max-w-md w-full p-6 relative text-center">
                  <div className="text-[#00FF00] text-6xl mb-4">✓</div>
                  <h2 className="text-[#00FF00] font-bold text-xl mb-2">Pagamento Realizado com Sucesso!</h2>
                  <p className="text-white/80 mb-6">Seu plano {selectedPlan === "basic" ? "Mensal" : "Anual"} foi ativado.</p>
                  <p className="text-white/60 mb-8 text-sm">Você receberá um e-mail com os detalhes da sua compra.</p>
                  
                  <Button 
                    onClick={() => {
                      setPaymentSuccess(false);
                      setShowCheckout(false);
                      // Aqui você pode adicionar lógica para redirecionar para área de membros
                    }}
                    className="w-full py-3 text-lg font-bold bg-gradient-to-r from-[#00FF00] to-[#A3FFA3] hover:from-[#00DD00] hover:to-[#8AE98A] text-black rounded-full shadow-lg shadow-green-500/20"
                  >
                    Acessar Estatísticas
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Index;