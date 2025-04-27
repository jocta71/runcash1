import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { AlertCircle, PackageOpen, Loader2, Copy } from 'lucide-react';
import RouletteCard from '@/components/RouletteCard';
import Layout from '@/components/Layout';
import { RouletteRepository } from '../services/data/rouletteRepository';
import { RouletteData } from '@/types';
import EventService, { RouletteNumberEvent, StrategyUpdateEvent } from '@/services/EventService';
import { RequestThrottler } from '@/services/utils/requestThrottler';
import RouletteSidePanelStats from '@/components/RouletteSidePanelStats';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { 
  createAsaasCustomer, 
  createAsaasSubscription, 
  getAsaasPixQrCode, 
  findAsaasPayment, 
  checkPaymentStatus,
  SubscriptionResponse
} from '@/integrations/asaas/client';
import { useSubscription } from '@/context/SubscriptionContext';



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

// Função para formatar CPF
const formatCPF = (value: string) => {
  // Remove todos os caracteres não numéricos
  const cleanValue = value.replace(/\D/g, '');
  
  // Aplica a máscara do CPF: XXX.XXX.XXX-XX
  if (cleanValue.length <= 3) {
    return cleanValue;
  } else if (cleanValue.length <= 6) {
    return `${cleanValue.slice(0, 3)}.${cleanValue.slice(3)}`;
  } else if (cleanValue.length <= 9) {
    return `${cleanValue.slice(0, 3)}.${cleanValue.slice(3, 6)}.${cleanValue.slice(6)}`;
  } else {
    return `${cleanValue.slice(0, 3)}.${cleanValue.slice(3, 6)}.${cleanValue.slice(6, 9)}-${cleanValue.slice(9, 11)}`;
  }
};

// Função para formatar telefone
const formatPhone = (value: string) => {
  // Remove todos os caracteres não numéricos
  const cleanValue = value.replace(/\D/g, '');
  
  if (cleanValue.length <= 2) {
    return cleanValue;
  } else if (cleanValue.length <= 7) {
    return `(${cleanValue.slice(0, 2)}) ${cleanValue.slice(2)}`;
  } else {
    return `(${cleanValue.slice(0, 2)}) ${cleanValue.slice(2, 7)}-${cleanValue.slice(7, 11)}`;
  }
};

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
  
  // Estados para o formulário de pagamento
  const [checkoutStep, setCheckoutStep] = useState<'form' | 'pix'>('form');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cpf: '',
    phone: ''
  });
  
  // Estados para o QR code PIX
  const [pixLoading, setPixLoading] = useState(false);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [qrCodeText, setQrCodeText] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [checkStatusInterval, setCheckStatusInterval] = useState<NodeJS.Timeout | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
  const { currentSubscription, currentPlan } = useSubscription();
  const hasActivePlan = useMemo(() => {
    return currentSubscription?.status?.toLowerCase() === 'active' || 
           currentSubscription?.status?.toLowerCase() === 'ativo';
  }, [currentSubscription]);
  
  // Referência para controlar se o componente está montado
  const isMounted = useRef(true);

  // Referência para timeout de atualização
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const navigate = useNavigate();
  
  // Escutar eventos de roletas existentes para persistência
  useEffect(() => {
    const handleRouletteExists = (event: RouletteNumberEvent | StrategyUpdateEvent) => {
      if (!event || !event.roleta_id) {
        console.log('[Index] Evento roleta_exists recebido sem ID válido:', event);
        return;
      }
      
      console.log(`[Index] Evento roleta_exists recebido para: ${event.roleta_nome} (ID: ${event.roleta_id})`);
      
      const rouletteData: RouletteData = {
        id: event.roleta_id,
        nome: event.roleta_nome,
        name: event.roleta_nome,
        numeros: [],
        lastNumbers: []
      };
      
      setKnownRoulettes(prev => {
        const updated = [...prev, rouletteData];
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
    const handleHistoricalDataLoaded = (event: RouletteNumberEvent | StrategyUpdateEvent) => {
      const data = event as unknown as { success: boolean; count?: number };
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
    } catch (err: Error | unknown) {
      console.error('❌ Erro ao buscar roletas:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(`Erro ao buscar roletas: ${errorMessage}`);
      
      // Fallback para roletas conhecidas
      if (knownRoulettes.length > 0) {
        setRoulettes(knownRoulettes);
        setDataFullyLoaded(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [knownRoulettes, mergeRoulettes]);

  // Efeito para inicialização e atualização periódica
  useEffect(() => {
    // Agendar atualizações periódicas
    const scheduleUpdate = () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      updateTimeoutRef.current = setTimeout(() => {
        // Recarregar dados
        loadRouletteData();
      }, 60000); // A cada 60 segundos
    };
    
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
    
    // Programar atualização periódica
    const updateInterval = setInterval(() => {
        if (isMounted.current) {
          scheduleUpdate();
        }
    }, 60000); // 60 segundos
    
    // Limpeza ao desmontar
    return () => {
      isMounted.current = false;
      clearTimeout(safetyTimeout);
      clearInterval(updateInterval);
      
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [loadRouletteData, dataFullyLoaded, mergeRoulettes]);
  
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
      return null;
    }
    
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
            const nonNullItem = item as unknown; // Usar unknown em vez de any
            // Se for um objeto com a propriedade numero
            if (typeof nonNullItem === 'object' && nonNullItem !== null && 'numero' in nonNullItem) {
              return (nonNullItem as {numero: number}).numero;
            }
            // Se for um número diretamente
            return Number(nonNullItem);
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
      <div key={index} className="relative overflow-visible transition-all duration-300 backdrop-filter bg-opacity-40 bg-[#131614] border border-gray-800/30 rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center">
            <div className="h-6 w-36 bg-gray-800 rounded animate-pulse"></div>
          </div>
          <div className="h-5 w-16 bg-gray-800 rounded-full animate-pulse"></div>
        </div>
        
        <div className="flex flex-wrap gap-1 justify-center my-5 p-3 rounded-xl border border-gray-700/20 bg-[#131111]">
          {[...Array(8)].map((_, idx) => (
            <div 
              key={idx} 
              className="w-6 h-6 rounded-full bg-gray-800 animate-pulse"
            ></div>
          ))}
        </div>
      </div>
    ));
  };

  // Atualizar dados do formulário quando o usuário mudar
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.username || prev.name,
        email: user.email || prev.email
      }));
    }
  }, [user]);
  
  // Função para processar o pagamento via Asaas
  const handlePayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    try {
      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado!",
          variant: "destructive"
        });
        return;
      }
      
      setPixLoading(true);
      setPaymentError(null);

      // Criar ou buscar cliente no Asaas
      const customerData = {
        name: formData.name || user.username || 'Cliente',
        email: formData.email || user.email,
        cpfCnpj: formData.cpf || '',
        mobilePhone: formData.phone || '',
        userId: user.id
      };
      
      const customerId = await createAsaasCustomer(customerData);
      
      if (!customerId) {
        setPaymentError('Erro ao criar cliente no Asaas');
        setPixLoading(false);
        return;
      }

      // Criar assinatura ou pagamento único
      const planId = selectedPlan;
      const userId = user.id;
      const paymentMethod = 'PIX';

      const subscription = await createAsaasSubscription(
        planId,
        userId,
        customerId,
        paymentMethod
      );
      
      if (!subscription || !subscription.paymentId) {
        setPaymentError('Erro ao criar assinatura');
        setPixLoading(false);
        return;
      }

      // Obter QR code PIX
      const pixData = await getAsaasPixQrCode(subscription.paymentId);
      
      if (!pixData) {
        setPaymentError('Erro ao gerar QR code PIX');
        setPixLoading(false);
        return;
      }

      // Atualizar estados com os dados do pagamento
      setQrCodeImage(pixData.qrCodeImage);
      setQrCodeText(pixData.qrCodeText);
      setPaymentId(subscription.paymentId);
      setCheckoutStep('pix');
      
      // Iniciar verificação periódica do status do pagamento
      const stopChecking = checkPaymentStatus(
        subscription.paymentId,
        (payment) => {
          // Pagamento confirmado com sucesso
          if (checkStatusInterval) {
            clearInterval(checkStatusInterval);
            setCheckStatusInterval(null);
          }
          
          setPaymentSuccess(true);
          setShowCheckout(false);
          setIsPaymentModalOpen(false);
          
          toast({
            title: "Pagamento confirmado!",
            description: "Seu pagamento foi confirmado com sucesso."
          });
          
          // Redirecionar para a página de dashboard
          navigate('/dashboard');
        },
        (error) => {
          // Erro ao verificar pagamento
          console.error('Erro ao verificar status:', error);
          toast({
            title: "Erro na verificação",
            description: error.message || "Erro ao verificar pagamento",
            variant: "destructive"
          });
        }
      );
      
      setPixLoading(false);
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      setPaymentError(typeof error === 'string' ? error : 'Erro ao processar pagamento');
      setPixLoading(false);
    }
  };

  // Função para verificar manualmente o status do pagamento
  const checkPaymentStatusManually = async (id: string | null) => {
    if (!id) return;
    
    try {
      setVerifyingPayment(true);
      const payment = await findAsaasPayment(id, true); // Forçar atualização
      
      if (['CONFIRMED', 'RECEIVED', 'AVAILABLE', 'BILLING_AVAILABLE'].includes(payment.status)) {
        // Pagamento confirmado
        if (checkStatusInterval) {
          clearInterval(checkStatusInterval);
          setCheckStatusInterval(null);
        }
        
        setPaymentSuccess(true);
        setShowCheckout(false);
        
        toast({
          title: "Pagamento confirmado!",
          description: "Seu pagamento foi confirmado com sucesso."
        });
        
        // Redirecionar para a página de dashboard
        navigate('/dashboard');
      } else {
        toast({
          title: "Verificação de pagamento",
          description: "Ainda não identificamos seu pagamento. Por favor, aguarde ou tente novamente em alguns instantes."
        });
      }
      setVerifyingPayment(false);
    } catch (error) {
      console.error('Erro ao verificar status do pagamento:', error);
      toast({
        title: "Erro",
        description: "Erro ao verificar pagamento",
        variant: "destructive"
      });
      setVerifyingPayment(false);
    }
  };

  // Função para copiar o código PIX
  const copyPIXCode = () => {
    if (qrCodeText && toast) {
      navigator.clipboard.writeText(qrCodeText)
        .then(() => {
          toast({
            title: "Código copiado!",
            description: "O código PIX foi copiado para a área de transferência.",
          });
        })
        .catch(err => {
          console.error('Erro ao copiar código:', err);
        });
    }
  };

  // Limpar intervalos quando o componente for desmontado
  useEffect(() => {
    return () => {
      if (checkStatusInterval) {
        clearInterval(checkStatusInterval);
      }
    };
  }, [checkStatusInterval]);

  // Handler para mudanças no formulário
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'cpf') {
      setFormData(prev => ({ ...prev, [name]: formatCPF(value) }));
    } else if (name === 'phone') {
      setFormData(prev => ({ ...prev, [name]: formatPhone(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  return (
    <Layout
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      chatOpen={chatOpen}
      setChatOpen={setChatOpen}
    >
      <div className="container mx-auto px-4 pt-4 md:pt-8 min-h-[80vh] relative">
        {/* Mensagem de erro */}
        {error && (
          <div className="bg-red-900/30 border border-red-500 p-4 mb-6 rounded-lg flex items-center z-50 relative">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-100">{error}</p>
          </div>
        )}
        
        {/* Layout principal */}
        <div className={`flex flex-col lg:flex-row gap-6 ${!hasActivePlan ? 'opacity-60' : ''}`}>
          {/* Cards de roleta à esquerda */}
          <div className="w-full lg:w-1/2">
            <div className="mb-4 p-4 bg-[#131614] rounded-lg border border-gray-800/30">
              <div className="flex justify-between items-center">
                <div className={`${!hasActivePlan ? 'h-8 w-32 bg-gray-800 rounded animate-pulse' : 'text-white font-bold'}`}>
                  {hasActivePlan ? 'Roletas Disponíveis' : ''}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {isLoading ? renderRouletteSkeletons() : renderRouletteCards()}
            </div>
          </div>
          
          {/* Painel lateral */}
          <div className="w-full lg:w-1/2">
            {selectedRoulette ? (
              <RouletteSidePanelStats
                roletaNome={selectedRoulette.nome || selectedRoulette.name || 'Roleta'}
                lastNumbers={Array.isArray(selectedRoulette.lastNumbers) ? selectedRoulette.lastNumbers : []}
                wins={typeof selectedRoulette.vitorias === 'number' ? selectedRoulette.vitorias : 0}
                losses={typeof selectedRoulette.derrotas === 'number' ? selectedRoulette.derrotas : 0}
                providers={[]} // Se houver uma lista de provedores disponível, passe aqui
              />
            ) : isLoading ? (
              <div className="bg-[#131614] rounded-lg border border-gray-800/30 p-8 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-muted border-t-[hsl(142.1,70.6%,45.3%)] mb-4"></div>
                <p className="text-gray-400">Carregando estatísticas...</p>
              </div>
            ) : (
              <div className="bg-[#131614] rounded-lg border border-gray-800/30 p-4 flex items-center justify-center h-48">
                <p className="text-gray-400">Selecione uma roleta para ver suas estatísticas</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Sobreposição do seletor de planos - apenas para quem não tem plano */}
        {!hasActivePlan && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="bg-[#131614]/80 p-10 rounded-xl backdrop-blur-lg shadow-2xl border border-gray-800/50 text-center max-w-xl w-full">
              <h2 className="text-[#00FF00] font-bold text-xl mb-6">Acesse nossas estatísticas exclusivas</h2>
              <p className="text-white/80 mb-6">Escolha um plano agora e desbloqueie acesso completo às melhores análises de roletas em tempo real</p>
              
              {/* Seletor de planos com design moderno */}
              <div className="flex flex-col items-center mb-6">
                <style>{radioInputStyles}</style>
                
                {/* Cards de planos */}
                <div className="flex flex-wrap justify-center w-full gap-4 mb-8">
                  {/* Card do Plano Mensal */}
                  <div 
                    className={`w-full md:w-5/12 bg-[#18181f] border-2 rounded-xl shadow-lg overflow-hidden transition-all hover:shadow-green-500/20 cursor-pointer ${selectedPlan === "basic" ? "border-[#00FF00] shadow-md shadow-green-500/20" : "border-gray-800/50 hover:border-gray-700"}`}
                    onClick={() => setSelectedPlan("basic")}
                  >
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-white">Mensal</h3>
                        <div className="flex items-center">
                          <div className={`w-5 h-5 rounded-full border border-gray-600 mr-3 flex items-center justify-center ${selectedPlan === "basic" ? "bg-[#00FF00] border-green-500" : "bg-transparent"}`}>
                            {selectedPlan === "basic" && <div className="w-3 h-3 rounded-full bg-white"></div>}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-3xl font-bold text-white mb-2">
                        R$49<span className="text-sm text-gray-400">/mês</span>
                      </div>
                      
                      <div className="text-sm text-gray-400 mb-4">
                        Renovação mensal automática
                      </div>
                    </div>
                  </div>
                  
                  {/* Card do Plano Anual */}
                  <div 
                    className={`w-full md:w-5/12 bg-[#18181f] border-2 rounded-xl shadow-lg overflow-hidden transition-all hover:shadow-green-500/20 cursor-pointer ${selectedPlan === "premium" ? "border-[#00FF00] shadow-md shadow-green-500/20" : "border-gray-800/50 hover:border-gray-700"}`}
                    onClick={() => setSelectedPlan("premium")}
                  >
                    <div className="absolute top-0 right-0 bg-[#00FF00] text-black text-xs font-bold px-3 py-1 rounded-bl-lg">
                      MELHOR OPÇÃO
                    </div>
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-white">Anual</h3>
                        <div className="flex items-center">
                          <div className={`w-5 h-5 rounded-full border border-gray-600 mr-3 flex items-center justify-center ${selectedPlan === "premium" ? "bg-[#00FF00] border-green-500" : "bg-transparent"}`}>
                            {selectedPlan === "premium" && <div className="w-3 h-3 rounded-full bg-white"></div>}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-3xl font-bold text-white mb-2">
                        R$99<span className="text-sm text-gray-400">/ano</span>
                      </div>
                      
                      <div className="text-sm text-gray-400 mb-4">
                        Economia de R$489 por ano
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Botão de ação */}
              <Button
                onClick={() => setShowCheckout(true)}
                className="bg-[#00FF00] hover:bg-[#00CC00] text-black font-bold py-3 px-6 rounded-lg w-full text-center transition-all transform hover:scale-105"
              >
                Escolher Plano
              </Button>
              
              {/* Modal de checkout */}
              {showCheckout && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
                  <div className="bg-[#131614] rounded-xl shadow-2xl border border-gray-800/50 max-w-md w-full overflow-hidden">
                    {checkoutStep === 'form' ? (
                      <>
                        <div className="p-6 border-b border-gray-800">
                          <h3 className="text-xl font-bold text-white">Complete sua compra</h3>
                          <p className="text-gray-400 text-sm mt-1">
                            {selectedPlan === 'basic' ? 'Plano Mensal - R$49/mês' : 'Plano Anual - R$99/ano'}
                          </p>
                        </div>
                        
                        <form onSubmit={handlePayment} className="p-6 space-y-4">
                          {paymentError && (
                            <Alert variant="destructive" className="mb-4">
                              <AlertCircle className="h-4 w-4" />
                              <AlertTitle>Erro no pagamento</AlertTitle>
                              <AlertDescription>{paymentError}</AlertDescription>
                            </Alert>
                          )}
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Nome completo</label>
                            <input
                              type="text"
                              name="name"
                              value={formData.name}
                              onChange={handleChange}
                              required
                              className="w-full px-4 py-2 rounded-lg bg-[#1E1E24] border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                            <input
                              type="email"
                              name="email"
                              value={formData.email}
                              onChange={handleChange}
                              required
                              className="w-full px-4 py-2 rounded-lg bg-[#1E1E24] border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">CPF</label>
                            <input
                              type="text"
                              name="cpf"
                              value={formData.cpf}
                              onChange={handleChange}
                              placeholder="000.000.000-00"
                              required
                              className="w-full px-4 py-2 rounded-lg bg-[#1E1E24] border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Telefone</label>
                            <input
                              type="text"
                              name="phone"
                              value={formData.phone}
                              onChange={handleChange}
                              placeholder="(00) 00000-0000"
                              required
                              className="w-full px-4 py-2 rounded-lg bg-[#1E1E24] border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                          </div>
                          
                          <div className="flex justify-end space-x-3 mt-6">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setShowCheckout(false)}
                              className="border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white"
                            >
                              Cancelar
                            </Button>
                            
                            <Button
                              type="submit"
                              disabled={isProcessingPayment}
                              className="bg-[#00FF00] hover:bg-[#00CC00] text-black font-bold"
                            >
                              {isProcessingPayment ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Processando...
                                </>
                              ) : (
                                'Pagar com PIX'
                              )}
                            </Button>
                          </div>
                        </form>
                      </>
                    ) : (
                      <>
                        <div className="p-6 border-b border-gray-800">
                          <h3 className="text-xl font-bold text-white">Pagamento via PIX</h3>
                          <p className="text-gray-400 text-sm mt-1">
                            Escaneie o QR code ou copie o código para pagar
                          </p>
                        </div>
                        
                        <div className="p-6">
                          {pixLoading ? (
                            <div className="flex flex-col items-center justify-center py-8">
                              <Loader2 className="h-10 w-10 text-[#00FF00] animate-spin mb-4" />
                              <p className="text-white">Gerando QR Code PIX...</p>
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-col items-center mb-6">
                                {qrCodeImage && (
                                  <img 
                                    src={qrCodeImage} 
                                    alt="QR Code PIX" 
                                    className="w-48 h-48 bg-white p-2 rounded-lg"
                                  />
                                )}
                                
                                <div className="mt-4 text-center">
                                  <p className="text-sm text-gray-400 mb-2">
                                    Use o aplicativo do seu banco para escanear o QR code
                                  </p>
                                  
                                  <div className="relative">
                                    <div className="border border-gray-700 bg-[#1E1E24] rounded-lg p-3 text-sm text-gray-300 max-w-xs overflow-hidden overflow-ellipsis whitespace-nowrap">
                                      {qrCodeText && qrCodeText.substring(0, 30)}...
                                    </div>
                                    
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={copyPIXCode}
                                      className="absolute top-1 right-1 h-8 px-2 bg-transparent hover:bg-gray-800 border-0"
                                    >
                                      <Copy className="h-4 w-4 text-gray-400" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="border-t border-gray-800 pt-4 mt-4 text-center">
                                <p className="text-sm text-gray-400 mb-4">
                                  Após o pagamento, você será redirecionado automaticamente
                                </p>
                                
                                <div className="flex justify-center space-x-3">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowCheckout(false)}
                                    className="border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white"
                                  >
                                    Cancelar
                                  </Button>
                                  
                                  <Button
                                    type="button"
                                    disabled={verifyingPayment}
                                    onClick={() => checkPaymentStatusManually(paymentId)}
                                    className="bg-[#00FF00] hover:bg-[#00CC00] text-black font-bold"
                                  >
                                    {verifyingPayment ? (
                                      <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Verificando...
                                      </>
                                    ) : (
                                      'Já paguei'
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    )}
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