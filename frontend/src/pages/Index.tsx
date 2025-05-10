import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { AlertCircle, PackageOpen, Loader2, Copy } from 'lucide-react';
import Layout from '@/components/Layout';
import RouletteCard from '@/components/RouletteCard';
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
import SubscriptionRequired from '@/components/SubscriptionRequired';
import RouletteCardSkeleton from '@/components/RouletteCardSkeleton';
import UnifiedRouletteClient from '@/services/UnifiedRouletteClient';
import EventBus from '../services/EventBus';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useThrottledFetch } from '@/hooks/useThrottledFetch';

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

interface KnownRoulette {
  id: string;
  nome: string;
  ultima_atualizacao: string;
}

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

const formatCPF = (value: string) => {
  const cleanValue = value.replace(/\D/g, '');
  
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

const formatPhone = (value: string) => {
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
  
  const [showCheckout, setShowCheckout] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  
  const [checkoutStep, setCheckoutStep] = useState<'form' | 'pix'>('form');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cpf: '',
    phone: ''
  });
  
  const [pixLoading, setPixLoading] = useState(false);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [qrCodeText, setQrCodeText] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [checkStatusInterval, setCheckStatusInterval] = useState<NodeJS.Timeout | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [historicalDataReady, setHistoricalDataReady] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
  const { currentSubscription, currentPlan } = useSubscription();
  const hasActivePlan = useMemo(() => {
    return currentSubscription?.status?.toLowerCase() === 'active' || 
           currentSubscription?.status?.toLowerCase() === 'ativo';
  }, [currentSubscription]);
  
  const isMounted = useRef(true);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const navigate = useNavigate();
  
  const MAX_WAIT_TIME = 15000;
  const checkDataIntervalId = useRef<number | null>(null);
  const waitTimeoutId = useRef<number | null>(null);
  const unifiedClient = useRef<UnifiedRouletteClient>(UnifiedRouletteClient.getInstance());
  
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
    
    EventService.getInstance().subscribe('roleta_exists', handleRouletteExists);
    
    console.log('[Index] Listener para evento roleta_exists registrado');
    
    return () => {
      EventService.getInstance().unsubscribe('roleta_exists', handleRouletteExists);
      console.log('[Index] Listener para evento roleta_exists removido');
    };
  }, []);
  
  useEffect(() => {
    const checkForRoulettes = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const unifiedClient = UnifiedRouletteClient.getInstance();
        
        if (!unifiedClient) {
          throw new Error('Cliente de roletas não disponível');
        }

        if (typeof unifiedClient.checkStatus === 'function') {
          const status = unifiedClient.checkStatus();
          if (!status.isReady) {
            console.log('Cliente de roletas não está pronto, tentando inicializar...');
            if (typeof unifiedClient.init === 'function') {
              await unifiedClient.init();
            }
          }
        }

        console.log('Aguardando dados das roletas...');
        
        if (typeof unifiedClient.getAllRoulettes === 'function') {
          const cachedRoulettes = unifiedClient.getAllRoulettes();
          if (cachedRoulettes && Array.isArray(cachedRoulettes) && cachedRoulettes.length > 0) {
            console.log(`Recebidas ${cachedRoulettes.length} roletas do cache do cliente`);
            processRoulettes(cachedRoulettes);
            return;
          }
        }

        console.log('Buscando roletas via API...');
        const fetchedRoulettes = await RequestThrottler.scheduleRequest(
          'index_roulettes',
          async () => {
            const response = await RouletteRepository.fetchAllRoulettesWithNumbers();
            console.log(`✅ ${response.length} roletas encontradas`);
            return response;
          }
        );
        
        if (fetchedRoulettes && Array.isArray(fetchedRoulettes) && fetchedRoulettes.length > 0) {
          console.log(`Recebidas ${fetchedRoulettes.length} roletas via API`);
          processRoulettes(fetchedRoulettes);
        } else {
          throw new Error('Não foi possível obter roletas');
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido ao buscar roletas';
        console.error('Erro ao carregar roletas:', errorMsg);
        setError(`Falha ao carregar roletas: ${errorMsg}`);
        setIsLoading(false);
      }
    };
    
    checkForRoulettes();
    
    const handleRouletteDataUpdate = (eventData: any) => {
      if (eventData && Array.isArray(eventData.roulettes)) {
        console.log(`Recebidas ${eventData.roulettes.length} roletas atualizadas`);
        processRoulettes(eventData.roulettes);
      }
    };
    
    try {
      EventBus.on('roulettes_loaded', handleRouletteDataUpdate);
    } catch (e) {
      console.error('[Index] Erro ao inscrever-se em eventos do EventBus:', e);
    }
    
    return () => {
      try {
        if (checkDataIntervalId.current) {
          window.clearInterval(checkDataIntervalId.current);
          checkDataIntervalId.current = null;
        }
        
        if (waitTimeoutId.current) {
          window.clearTimeout(waitTimeoutId.current);
          waitTimeoutId.current = null;
        }
        
        EventBus.off('roulettes_loaded', handleRouletteDataUpdate);
      } catch (e) {
        console.error('[Index] Erro no cleanup de eventos:', e);
      }
    };
  }, []);
  
  const mergeRoulettes = useCallback((apiRoulettes: RouletteData[], knownRoulettes: RouletteData[]): RouletteData[] => {
    const merged: Record<string, RouletteData> = {};
    
    apiRoulettes.forEach(roulette => {
      merged[roulette.id] = roulette;
    });
    
    knownRoulettes.forEach(known => {
      if (merged[known.id]) {
        console.log(`[Index] Roleta já existe na API: ${known.nome} (ID: ${known.id})`);
        return;
      }
      
      console.log(`[Index] Adicionando roleta conhecida ausente na API: ${known.nome} (ID: ${known.id})`);
      
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
  
  useEffect(() => {
    if (roulettes.length > 0 && !selectedRoulette && !isLoading) {
      console.log('[Index] Selecionando uma roleta automaticamente');
      
      const roletaComDados = roulettes.find(roleta => {
        const temNumeros = (
          (Array.isArray(roleta.numero) && roleta.numero.length > 0) || 
          (Array.isArray(roleta.lastNumbers) && roleta.lastNumbers.length > 0) ||
          (Array.isArray(roleta.numeros) && roleta.numeros.length > 0)
        );
        return temNumeros;
      });
      
      setSelectedRoulette(roletaComDados || roulettes[0]);
    }
  }, [roulettes, selectedRoulette, isLoading]);
  
  const loadRouletteData = useCallback(async () => {
    if (!isMounted.current) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
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
        const merged = mergeRoulettes(result, knownRoulettes);
        setRoulettes(merged);
        
        if (result.length > 0) {
          setKnownRoulettes(prev => mergeRoulettes(prev, result));
        }
        
        setDataFullyLoaded(true);
      } else {
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
      
      if (knownRoulettes.length > 0) {
        setRoulettes(knownRoulettes);
        setDataFullyLoaded(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [knownRoulettes, mergeRoulettes]);

  useEffect(() => {
    const scheduleUpdate = () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      updateTimeoutRef.current = setTimeout(() => {
        loadRouletteData();
      }, 60000);
    };
    
    loadRouletteData();
    
    const safetyTimeout = setTimeout(() => {
      if (!dataFullyLoaded && isMounted.current) {
        console.log('[Index] 🔄 Liberando tela após timeout de segurança');
        setDataFullyLoaded(true);
        setIsLoading(false);
        
        const unifiedClient = UnifiedRouletteClient.getInstance();
        const availableRoulettes = unifiedClient.getAllRoulettes();
        
        if (availableRoulettes && availableRoulettes.length > 0) {
          console.log(`[Index] 🔄 Obtidas ${availableRoulettes.length} roletas do UnifiedRouletteClient`);
          setRoulettes(availableRoulettes);
          setFilteredRoulettes(availableRoulettes);
        }
      }
    }, 10000);
    
    const updateInterval = setInterval(() => {
        if (isMounted.current) {
          scheduleUpdate();
          
          const unifiedClient = UnifiedRouletteClient.getInstance();
          const availableRoulettes = unifiedClient.getAllRoulettes();
          
          if (availableRoulettes && availableRoulettes.length > 0 && 
              (!roulettes.length || roulettes.length < availableRoulettes.length)) {
            console.log(`[Index] 🔄 Atualizando com ${availableRoulettes.length} roletas do UnifiedRouletteClient`);
            setRoulettes(availableRoulettes);
            setFilteredRoulettes(availableRoulettes);
            setDataFullyLoaded(true);
            setIsLoading(false);
          }
        }
    }, 30000);
    
    const unifiedClient = UnifiedRouletteClient.getInstance();
    const unsubscribe = unifiedClient.on('update', (updateData) => {
      if (Array.isArray(updateData) && updateData.length > 0) {
        console.log(`[Index] 🔄 Recebido evento 'update' com ${updateData.length} roletas`);
        setRoulettes(updateData);
        setFilteredRoulettes(updateData);
        setDataFullyLoaded(true);
        setIsLoading(false);
      }
    });
    
    return () => {
      isMounted.current = false;
      clearTimeout(safetyTimeout);
      clearInterval(updateInterval);
      unsubscribe();
      
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [loadRouletteData, dataFullyLoaded, mergeRoulettes, roulettes.length]);
  
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

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;
    let checkDataIntervalId: NodeJS.Timeout | null = null;
    
    const loadHistoricalData = async () => {
      try {
        const unifiedClient = UnifiedRouletteClient.getInstance();
        
        const timeoutPromise = new Promise<void>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('Timeout ao carregar histórico'));
          }, 10000);
        });
        
        if (typeof unifiedClient.loadHistoricalData === 'function') {
          try {
            await Promise.race([
              unifiedClient.loadHistoricalData(),
              timeoutPromise
            ]);
          } catch (err) {
            console.warn('[Index] Timeout ao carregar histórico:', err);
          } finally {
            if (timeoutId) clearTimeout(timeoutId);
          }
        }
        
        const checkForRoulettes = () => {
          const availableRoulettes = unifiedClient.getAllRoulettes();
          console.log(`[Index] Verificando dados de roletas: ${availableRoulettes.length} roletas disponíveis`);
          
          if (availableRoulettes.length > 0) {
            if (isMounted) {
              setHistoricalDataReady(true);
              if (checkDataIntervalId) clearInterval(checkDataIntervalId);
            }
          }
        };
        
        checkForRoulettes();
        
        checkDataIntervalId = setInterval(checkForRoulettes, 1000);
        
      } catch (err) {
        console.error('[Index] Erro ao carregar dados históricos:', err);
        if (isMounted) {
          setHistoricalDataReady(true);
        }
      }
    };
    
    loadHistoricalData();
    
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        console.log('[Index] Safety timeout acionado, forçando renderização');
        setHistoricalDataReady(true);
      }
    }, 15000);
    
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (checkDataIntervalId) clearInterval(checkDataIntervalId);
      clearTimeout(safetyTimeout);
    };
  }, []);
  
  const renderRouletteCards = () => {
    if (!historicalDataReady) {
      return renderRouletteSkeletons();
    }
    
    if (!Array.isArray(filteredRoulettes) || filteredRoulettes.length === 0) {
      console.log('[DEBUG] Não há roletas para renderizar. Array vazio ou inválido:', filteredRoulettes);
      return null;
    }
    
    console.log(`[DEBUG] Renderizando ${filteredRoulettes.length} roletas disponíveis`);
    
    const allRoulettes = filteredRoulettes;

    return allRoulettes.map(roulette => {
      const rouletteId = roulette.id || roulette._id || '';
      const rouletteName = roulette.nome || roulette.name || 'Roleta sem nome';
      
      let numbers: number[] = [];
      
      if (Array.isArray(roulette.numeros)) {
        numbers = roulette.numeros;
      } else if (Array.isArray(roulette.lastNumbers)) {
        numbers = roulette.lastNumbers;
      } else if (Array.isArray(roulette.numero)) {
        numbers = roulette.numero.map((n: any) => 
          typeof n === 'object' && n !== null && 'numero' in n ? n.numero : Number(n)
        ).filter((n: any) => !isNaN(n));
      }
      
      console.log(`[DEBUG] Roleta ${rouletteId} (${rouletteName}): ${numbers.length} números`);
      
      return (
        <div 
          key={rouletteId} 
          className={`cursor-pointer transition-all rounded-xl ${selectedRoulette?.id === rouletteId ? 'border-2 border-green-500 shadow-lg shadow-green-500/20' : 'p-0.5'}`}
          onClick={() => setSelectedRoulette(roulette)}
        >
          <RouletteCard roulette={roulette} />
        </div>
      );
    });
  };
  
  const renderPagination = () => {
    if (!Array.isArray(roulettes) || roulettes.length === 0) {
      return null;
    }
    
    const filteredRoulettes = roulettes;
    
    const totalPages = Math.ceil(filteredRoulettes.length / itemsPerPage);
    
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

  const handleRouletteFilter = (filtered: RouletteData[]) => {
    setFilteredRoulettes(filtered);
  };

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

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.username || prev.name,
        email: user.email || prev.email
      }));
    }
  }, [user]);
  
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

      const planId = "basic";
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

      const pixData = await getAsaasPixQrCode(subscription.paymentId);
      
      if (!pixData) {
        setPaymentError('Erro ao gerar QR code PIX');
        setPixLoading(false);
        return;
      }

      setQrCodeImage(pixData.qrCodeImage);
      setQrCodeText(pixData.qrCodeText);
      setPaymentId(subscription.paymentId);
      setCheckoutStep('pix');
      
      const stopChecking = checkPaymentStatus(
        subscription.paymentId,
        (payment) => {
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
          
          navigate('/dashboard');
        },
        (error) => {
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

  const checkPaymentStatusManually = async (id: string | null) => {
    if (!id) return;
    
    try {
      setVerifyingPayment(true);
      const payment = await findAsaasPayment(id, true);
      
      if (['CONFIRMED', 'RECEIVED', 'AVAILABLE', 'BILLING_AVAILABLE'].includes(payment.status)) {
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

  useEffect(() => {
    return () => {
      if (checkStatusInterval) {
        clearInterval(checkStatusInterval);
      }
    };
  }, [checkStatusInterval]);

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
    <Layout>
      <div className="container mx-auto px-4 pt-4 md:pt-8 min-h-[80vh] relative">
        <h1 className="text-2xl font-bold mb-4">
          Dashboard de Roletas
        </h1>
        
        {isLoading && (
          <div className="flex justify-center items-center p-4">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 rounded-full border-t-transparent"></div>
            <span className="ml-2">Carregando dados das roletas...</span>
          </div>
        )}
        
        {error && (
          <div className="p-4 mb-4 bg-red-100 border border-red-300 rounded-md text-red-800">
            <p className="font-semibold">Erro ao carregar dados:</p>
            <p>{error}</p>
            <button 
              className="mt-2 px-3 py-1 bg-red-200 hover:bg-red-300 rounded-md"
              onClick={() => window.location.reload()}
            >
              Tentar novamente
            </button>
          </div>
        )}
        
        {!isLoading && !error && roulettes.length === 0 && (
          <div className="p-4 mb-4 bg-yellow-100 border border-yellow-300 rounded-md text-yellow-800">
            <p className="font-semibold">Nenhuma roleta disponível no momento.</p>
            <p>Estamos tentando conectar aos servidores. Por favor, aguarde alguns instantes ou tente novamente mais tarde.</p>
            <p className="mt-2 text-sm">Se o problema persistir, verifique sua conexão à internet.</p>
            <button 
              className="mt-2 px-3 py-1 bg-yellow-200 hover:bg-yellow-300 rounded-md"
              onClick={() => {
                setIsLoading(true);
                setError(null);
                const client = UnifiedRouletteClient.getInstance();
                client.connectStream();
                setTimeout(() => {
                  setIsLoading(false);
                  loadRouletteData();
                }, 3000);
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}
        
        <SubscriptionRequired />
        
        <style>{radioInputStyles}</style>
        
        <div className="relative">
          <div className={`flex flex-col lg:flex-row gap-6 ${!hasActivePlan ? 'opacity-60' : ''}`}>
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
            
            <div className="w-full lg:w-1/2">
              {selectedRoulette ? (
                <RouletteSidePanelStats
                  roletaId={selectedRoulette.id || ''}
                  roletaNome={selectedRoulette.nome || selectedRoulette.name || 'Roleta'}
                  lastNumbers={Array.isArray(selectedRoulette.lastNumbers) ? selectedRoulette.lastNumbers : []}
                  wins={typeof selectedRoulette.vitorias === 'number' ? selectedRoulette.vitorias : 0}
                  losses={typeof selectedRoulette.derrotas === 'number' ? selectedRoulette.derrotas : 0}
                  providers={[]}
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
        </div>
      </div>
    </Layout>
  );
};

export default Index;