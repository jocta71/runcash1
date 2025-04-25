import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { AlertCircle, BarChart3, PackageOpen, Loader2, Check, Copy } from 'lucide-react';
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
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { createAsaasCustomer, createAsaasSubscription, getAsaasPixQrCode, checkPaymentStatus } from '@/integrations/asaas/client';

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
  const [checkStatusInterval, setCheckStatusInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();
  
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

  // Atualizar dados do formulário quando o usuário mudar
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.username || user.name || prev.name,
        email: user.email || prev.email
      }));
    }
  }, [user]);
  
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
  
  // Handler para envio do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);
    setIsProcessingPayment(true);
    
    try {
      // Validação do formulário
      if (!formData.name || !formData.email || !formData.cpf) {
        throw new Error("Por favor, preencha todos os campos obrigatórios.");
      }
      
      // Validação simples de CPF
      const cpfClean = formData.cpf.replace(/\D/g, '');
      if (cpfClean.length !== 11) {
        throw new Error("Por favor, insira um CPF válido com 11 dígitos.");
      }
      
      // Simulação da integração com Asaas (para ambiente de desenvolvimento)
      console.log('Processando pagamento para:', formData);
      console.log('Plano selecionado:', selectedPlan);
      
      // Simulação de criação de QR code (para ambientes sem integração real)
      setTimeout(() => {
        setCheckoutStep('pix');
        // QR code de exemplo (base64)
        setQrCodeImage('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X5+//+Pj8fn79fbz1b3vd+3F9vr/9N+/HYO79sX3/5Xbb9yX+eb/fx8uybL/zvPR67/Z5l8vb9n3vz9s/b9d9ua+P2/fvn/e8/vPet8/bvnZ/jO097z+3d7XXruvb5+37bfe//drbz7fnXj+/v+/j5T/3vS/Xa3/8z+1zP5/31+392+rH9ee2z7/uulx3+V23z95e1/Xb9W7Xvn1su96Pbfz9/vzr9//92m7X/nGdq7fL9zr+fq2Xx/b8+7X/+/F979vvf3//x7X2+s/f/9j/eqyDt7+393xsn3N7PN7u37a1ta3Nb/e/n7d/7n5+f//O8fPxeP/Yzrv/87jm9rzn9d3+7/KyvXe/3r1rOz/7ufVYtudu57ztp/t7rrc5dj/vXdvjY3sfz3vW43y3fbY+3q5h993bzm6ffV3f1tXtvdfH9vH8+fZ9e9/9+HhZX/d992vYvvPl4/a+675/W+79/u38u/W7V+O39W7dc1/Pl+3aXs7vfXvcdq7b87f1sW1rt+u5Xud9W1s/7vfuY+4+b7c5cVuX927i8zG2c96e2/bX54/7OTef7Nfyfn9vG3v9vPu1/NjWp9v3PP/7sTz3xXe/v3/u5f7/t/e9j3vH+7Zz3P7Z133/+PfXfe2+/8a6W7bf3Nbe9dh2H/+6X+7X+vGxPft+3n2tW/Z1/b7W3tad+9p7+/dn7fd1+fljvf//tv99Pr9dz/W1e33vH9u2t63X+3p0rUObM7Z95/H87f9eP/d9/f7+/tze9/r6eXvty/pxfP73Nbm9ZVuT1svL5f1jvb53W9e2dWb3R7b1cnsN+/lv2+c+Hjff367z8nLfnrd91sftHPvH9d9//8fz+df5tn/u/rvtfzzW3W1/3j5bXrfX9rFfO3/ufuzbc/f9aRsj23vbHNr2j9f35+79/m1N2Mbotifcr/VxrZ+fn9fX9+/bZrutrT/2cb9sb9t+e7vm63f++Jbj+75+/f9nfHzctt2P98e2rb3u3//c5vfz7nvf+Xb/9n23dXR7ffvz8f9f62jfJrf1aX/N2/tu3/fa7/e1Zbtuu6b7fbt1fVtvtvW6rYvP/bd979trvb/v5/V+9r3vvzOerw/X4be1f1sTHsdun7c9/7r/vnz72DzwuH97bX9svvnY9rOtXdtx2z3fXvf1bFunt9feXrfHbV+9rb3X97T9cjvmui/e1/TtEbfHx329eL3v7/n8vF/T88fHz9v7Prf1YnvN2/d/7pvPNf6+X98/Xva/a3k5v+f6/Bho+8w25rZ1ZFtrXz/avrh9zvbe2343f7y8X9u3/f7H+/XcP//8utfnr+vz/vv1bR+4rkObB7f/3vftj9t3bI//sX4+v/d9fduucXvf9rl7Y7d1+Xb+9j2v67Y+t+u8/Y/Pd3z5N0q/V8c=');
        setQrCodeText('00020101021226820014br.gov.bcb.pix2560test@email.com.br5204000053039865802BR5913Fulano de Tal6008Brasilia62070503***6304C692');
        setPixLoading(false);
        
        // Simular intervalos de verificação de status
        const interval = setInterval(() => {
          console.log('Verificando status de pagamento...');
          // Simulação de confirmação de pagamento após 10 segundos
          setTimeout(() => {
            if (checkStatusInterval) {
              clearInterval(checkStatusInterval);
              setCheckStatusInterval(null);
            }
            
            // Mostrar sucesso
            setPaymentSuccess(true);
            
            toast({
              title: "Pagamento confirmado!",
              description: "Seu pagamento foi processado com sucesso.",
            });
          }, 10000);
        }, 5000);
        
        setCheckStatusInterval(interval);
      }, 2000);
    } catch (error) {
      console.error('Erro no processo de pagamento:', error);
      setPaymentError(error instanceof Error ? error.message : "Ocorreu um erro ao processar o pagamento.");
      
      if (toast) {
        toast({
          variant: "destructive",
          title: "Erro no pagamento",
          description: error instanceof Error ? error.message : "Ocorreu um erro ao processar o pagamento.",
        });
      }
    } finally {
      setIsProcessingPayment(false);
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
                  
                  {checkoutStep === 'form' && (
                    <>
                      <h2 className="text-[#00FF00] font-bold text-xl mb-6 text-center">
                        Finalizar Compra - Plano {selectedPlan === "basic" ? "Mensal" : "Anual"}
                      </h2>
                      
                      {paymentError && (
                        <Alert variant="destructive" className="mb-4">
                          <AlertTitle>Erro</AlertTitle>
                          <AlertDescription>{paymentError}</AlertDescription>
                        </Alert>
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
                      
                      <form className="space-y-4" onSubmit={handleSubmit}>
                        <div>
                          <label className="block text-white/80 mb-1 text-sm">Nome completo *</label>
                          <input 
                            type="text" 
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-md text-white focus:border-[#00FF00] focus:outline-none"
                            placeholder="Digite seu nome completo"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-white/80 mb-1 text-sm">E-mail *</label>
                          <input 
                            type="email" 
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-md text-white focus:border-[#00FF00] focus:outline-none"
                            placeholder="seuemail@exemplo.com"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-white/80 mb-1 text-sm">CPF *</label>
                          <input 
                            type="text"
                            name="cpf"
                            value={formData.cpf}
                            onChange={handleChange}
                            className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-md text-white focus:border-[#00FF00] focus:outline-none"
                            placeholder="000.000.000-00"
                            maxLength={14}
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-white/80 mb-1 text-sm">Telefone</label>
                          <input 
                            type="text"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-md text-white focus:border-[#00FF00] focus:outline-none"
                            placeholder="(00) 00000-0000"
                            maxLength={15}
                          />
                        </div>
                        
                        <Button 
                          className="w-full py-3 text-lg font-bold bg-gradient-to-r from-[#00FF00] to-[#A3FFA3] hover:from-[#00DD00] hover:to-[#8AE98A] text-black rounded-full shadow-lg shadow-green-500/20 mt-6"
                          type="submit"
                          disabled={isProcessingPayment}
                        >
                          {isProcessingPayment ? (
                            <span className="flex items-center justify-center">
                              <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" />
                              Processando...
                            </span>
                          ) : "Prosseguir para Pagamento"}
                        </Button>
                        
                        <p className="text-center text-gray-500 text-xs mt-4">
                          Processamento seguro via PIX
                        </p>
                      </form>
                    </>
                  )}
                  
                  {checkoutStep === 'pix' && (
                    <>
                      <h2 className="text-[#00FF00] font-bold text-xl mb-6 text-center">
                        Pagamento via PIX
                      </h2>
                      
                      <p className="text-white/80 mb-6 text-center">
                        Escaneie o QR Code abaixo com o aplicativo do seu banco para finalizar o pagamento
                      </p>
                      
                      {paymentError && (
                        <Alert variant="destructive" className="mb-4">
                          <AlertTitle>Erro</AlertTitle>
                          <AlertDescription>{paymentError}</AlertDescription>
                        </Alert>
                      )}
                      
                      {pixLoading ? (
                        <div className="flex justify-center my-12">
                          <Loader2 className="h-12 w-12 animate-spin text-[#00FF00]" />
                        </div>
                      ) : (
                        <>
                          {qrCodeImage && (
                            <div className="flex flex-col items-center space-y-6">
                              <div className="bg-white p-4 rounded-lg">
                                <img 
                                  src={`data:image/png;base64,${qrCodeImage}`} 
                                  alt="QR Code PIX" 
                                  className="w-48 h-48"
                                />
                              </div>
                              
                              {qrCodeText && (
                                <div className="w-full mx-auto">
                                  <p className="font-semibold mb-2 text-white/80">Ou copie o código PIX:</p>
                                  <div className="flex">
                                    <input
                                      type="text"
                                      value={qrCodeText}
                                      readOnly
                                      className="w-full bg-gray-800 border border-gray-700 rounded-l-md p-2 text-sm text-white/80"
                                    />
                                    <Button 
                                      variant="secondary"
                                      className="rounded-l-none"
                                      onClick={copyPIXCode}
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                              
                              <Alert className="bg-[#00FF00]/10 border-[#00FF00] text-[#00FF00]">
                                <AlertTitle>Importante</AlertTitle>
                                <AlertDescription className="text-white/80">
                                  Após o pagamento, esta página será atualizada automaticamente.
                                  Não feche esta página até a confirmação do pagamento.
                                </AlertDescription>
                              </Alert>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
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
                      // Atualiza a página para exibir as estatísticas
                      window.location.reload();
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