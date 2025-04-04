import { useCallback, useEffect, useRef, useState } from 'react';
import { RouletteNumberEvent } from '@/services/EventService';
import EventService from '@/services/EventService';
import { 
  fetchRouletteLatestNumbersByName, 
  fetchRouletteStrategy,
  fetchRouletteById,
  RouletteStrategy as ApiRouletteStrategy,
  mapToCanonicalRouletteId  // Importar a função de mapeamento
} from '@/integrations/api/rouletteService';
import { toast } from '@/components/ui/use-toast';
import SocketService from '@/services/SocketService';
import axios from 'axios';
import config from '@/config/env';
import FetchService from '@/services/FetchService';

// Debug flag - set to false to disable logs in production
const DEBUG = false;

// Usar a variável de ambiente centralizada do config
const API_URL = config.apiBaseUrl;

// Configuração do axios com headers padrão
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    'bypass-tunnel-reminder': 'true'
  },
  timeout: 10000,
});

// Função auxiliar para debug
const debugLog = (...args: any[]) => {
  if (DEBUG) {
    console.log(...args);
  }
};

// Tipos locais para simplificar o uso
interface RouletteNumber {
  numero: number;
  roleta_id?: string;
  roleta_nome?: string;
  timestamp?: string;
  cor?: string; // Nova propriedade para a cor do número
}

type RouletteStrategy = ApiRouletteStrategy;

// Criar um registro global de polling para evitar duplicações
const pollingInitialized = new Set<string>();

/**
 * Função para buscar números da roleta pelo novo endpoint separado
 * @param roletaId ID da roleta
 * @param nome Nome da roleta (para mapeamento)
 * @param limit Limite de números a serem retornados
 * @returns Array de objetos RouletteNumber
 */
const fetchRouletteNumbers = async (roletaId: string, nome?: string, limit: number = 100): Promise<RouletteNumber[]> => {
  try {
    // Mapear para o ID canônico
    const canonicalId = mapToCanonicalRouletteId(roletaId, nome);
    console.log(`[useRouletteData] Buscando números para roleta ${roletaId} (canônico: ${canonicalId}) via novo endpoint...`);
    
    const response = await api.get(`/roulette-numbers/${canonicalId}?limit=${limit}`);
    
    if (response.data && Array.isArray(response.data)) {
      console.log(`[useRouletteData] Recebidos ${response.data.length} números da API para ID: ${canonicalId}`);
      return response.data;
    }
    
    console.log(`[useRouletteData] Resposta da API não é um array válido:`, response.data);
    return [];
  } catch (error: any) {
    console.error(`[useRouletteData] Erro ao buscar números da roleta:`, error.message);
    return [];
  }
};

/**
 * Processa números brutos em formato RouletteNumber
 */
const processRouletteNumbers = (numbers: number[] | any[]): RouletteNumber[] => {
  if (!Array.isArray(numbers)) return [];
  
  // Mapear para formato padrão
  return numbers.map((item) => {
    // Verificar se o item já é um objeto com número
    if (typeof item === 'object' && item !== null) {
      // Garantir que número seja um valor numérico válido
      let numeroValue: number;
      
      if (typeof item.numero === 'number' && !isNaN(item.numero)) {
        numeroValue = item.numero;
      } else if (typeof item.numero === 'string' && item.numero.trim() !== '') {
        const parsedValue = parseInt(item.numero, 10);
        numeroValue = !isNaN(parsedValue) ? parsedValue : 0;
      } else {
        numeroValue = 0;
        console.warn(`[useRouletteData] Valor inválido encontrado: ${item.numero}, usando 0 como fallback`);
      }
      
      return {
        numero: numeroValue,
        roleta_id: item.roleta_id,
        roleta_nome: item.roleta_nome,
        cor: item.cor || determinarCorNumero(numeroValue),
        timestamp: item.timestamp || new Date().toISOString()
      };
    }
    
    // Se for direto um número
    let numeroValue: number;
    if (typeof item === 'number' && !isNaN(item)) {
      numeroValue = item;
    } else if (typeof item === 'string' && item.trim() !== '') {
      const parsedValue = parseInt(item, 10);
      numeroValue = !isNaN(parsedValue) ? parsedValue : 0;
    } else {
      numeroValue = 0;
      console.warn(`[useRouletteData] Valor inválido encontrado: ${item}, usando 0 como fallback`);
    }
    
    return {
      numero: numeroValue,
      roleta_id: undefined,
      roleta_nome: undefined,
      cor: determinarCorNumero(numeroValue),
      timestamp: new Date().toISOString()
    };
  });
};

// Interface para o resultado do hook
export interface UseRouletteDataResult {
  numbers: RouletteNumber[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  hasData: boolean;
  strategy: RouletteStrategy | null;
  strategyLoading: boolean;
  refreshNumbers: () => Promise<boolean>;
  refreshStrategy: () => Promise<boolean>;
}

/**
 * Determina a cor de um número da roleta
 */
export const determinarCorNumero = (numero: number): string => {
  if (numero === 0) return 'verde';
  
  // Números vermelhos na roleta europeia
  const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return numerosVermelhos.includes(numero) ? 'vermelho' : 'preto';
};

/**
 * Converte um número bruto para o formato RouletteNumber
 */
export const processRouletteNumber = (numero: number, timestamp?: string): RouletteNumber => {
  return {
    numero,
    roleta_id: undefined,
    roleta_nome: undefined,
    cor: determinarCorNumero(numero),
    timestamp: timestamp || new Date().toISOString()
  };
};

/**
 * Processa números de uma roleta por ID
 */
export const fetchRouletteLatestNumbers = async (roletaId: string, limit = 10): Promise<number[]> => {
  const data = await extractRouletteNumbersById(roletaId, limit);
  
  if (data && Array.isArray(data)) {
    // Extrair apenas os números do array de objetos
    const numbers = data.map((item: any) => {
      // Verificar se o item.numero é válido
      if (typeof item.numero === 'number' && !isNaN(item.numero)) {
        return item.numero;
      } else if (typeof item.numero === 'string' && item.numero.trim() !== '') {
        const parsedValue = parseInt(item.numero, 10);
        if (!isNaN(parsedValue)) return parsedValue;
      }
      // Se chegou aqui, é um valor inválido, retornar 0
      console.warn(`[API] Valor inválido de número encontrado: ${item.numero}, substituindo por 0`);
      return 0;
    });
    console.log(`[API] Processados ${numbers.length} números para roleta ID ${roletaId}:`, numbers);
    return numbers;
  }
  
  console.warn(`[API] Nenhum número encontrado para roleta ID ${roletaId}`);
  return [];
};

/**
 * Hook para obter e atualizar dados da roleta em tempo real
 * @param roletaId - ID da roleta
 * @param roletaNome - Nome da roleta (para subscrição de eventos)
 * @param limit - Limite de números a serem exibidos
 * @returns Objeto com números, estado de carregamento, erro e status de conexão
 */
export function useRouletteData(
  roletaId: string, 
  roletaNome: string, 
  limit: number = 100
): UseRouletteDataResult {
  // Estado para dados de números
  const [numbers, setNumbers] = useState<RouletteNumber[]>([]);
  const [initialNumbers, setInitialNumbers] = useState<RouletteNumber[]>([]); // Dados iniciais
  const [newNumbers, setNewNumbers] = useState<RouletteNumber[]>([]); // Novos números
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshLoading, setRefreshLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [hasData, setHasData] = useState<boolean>(false);
  
  // Estado para dados de estratégia
  const [strategy, setStrategy] = useState<RouletteStrategy | null>(null);
  const [strategyLoading, setStrategyLoading] = useState<boolean>(true);
  
  // Ref para controle de inicialização
  const initialLoadCompleted = useRef<boolean>(false);
  const initialDataLoaded = useRef<boolean>(false);
  const hookInitialized = useRef<boolean>(false);
  
  // Chave única para esta instância do hook
  const instanceKey = useRef<string>(`${roletaId}:${roletaNome}`);

  // Função para atualizar o estado numbers que combina initialNumbers e newNumbers
  const updateCombinedNumbers = useCallback(() => {
    // Combinar os novos números com os dados iniciais
    console.log(`[useRouletteData] Combinando ${newNumbers.length} novos números com ${initialNumbers.length} números iniciais para ${roletaNome}`);
    
    // Se não temos novos números, usar apenas os iniciais
    if (newNumbers.length === 0) {
      setNumbers([...initialNumbers]);
      return;
    }
    
    // Se não temos números iniciais, usar apenas os novos
    if (initialNumbers.length === 0) {
      setNumbers([...newNumbers]);
      return;
    }
    
    // Combinar, garantindo que não haja duplicações
    const combined = [...newNumbers];
    
    // Adicionar números iniciais que não estão nos novos
    initialNumbers.forEach(initialNum => {
      // Verificar se já existe nos novos números
      const exists = combined.some(newNum => 
        newNum.numero === initialNum.numero && 
        newNum.timestamp === initialNum.timestamp
      );
      
      // Se não existe, adicionar
      if (!exists) {
        combined.push(initialNum);
      }
    });
    
    console.log(`[useRouletteData] Total combinado: ${combined.length} números para ${roletaNome}`);
    setNumbers(combined);
  }, [initialNumbers, newNumbers, roletaNome]);

  // Atualizar o estado combinado sempre que initialNumbers ou newNumbers mudar
  useEffect(() => {
    updateCombinedNumbers();
  }, [initialNumbers, newNumbers, updateCombinedNumbers]);

  // Função para extrair e processar números da API - MODIFICADA PARA RESPOSTA MAIS RÁPIDA
  const loadNumbers = useCallback(async (isRefresh = false): Promise<boolean> => {
    try {
      // Se já temos dados iniciais e não é uma atualização manual, pular
      if (initialDataLoaded.current && !isRefresh) {
        console.log(`[useRouletteData] Ignorando carregamento de números para ${roletaNome} - dados já carregados`);
        setLoading(false); // GARANTIR loading false imediatamente
        return true;
      }
      
      if (!isRefresh) setLoading(true);
      setError(null);
      
      if (!roletaId) {
        console.log(`[useRouletteData] ID de roleta inválido ou vazio: "${roletaId}"`);
        setLoading(false);
        setHasData(false);
        return false;
      }
      
      // Registrar explicitamente o início do carregamento
      console.log(`[useRouletteData] ${isRefresh ? '🔄 RECARREGANDO' : '📥 CARREGANDO'} dados para ${roletaNome} (ID: ${roletaId})`);
      
      // 1. EXTRAÇÃO: Obter números brutos do novo endpoint
      let numerosArray = await fetchRouletteNumbers(roletaId, roletaNome, limit);
      
      console.log(`[useRouletteData] Resposta do endpoint de números para ${roletaNome}:`, 
        numerosArray.length > 0 ? 
        `${numerosArray.length} números, primeiro: ${numerosArray[0]?.numero}` : 
        'Sem números'
      );
      
      // Tentar obter por nome como fallback se não conseguir por ID
      if (!numerosArray || numerosArray.length === 0) {
        console.log(`[useRouletteData] Tentando obter números por nome da roleta: ${roletaNome}`);
        numerosArray = await fetchRouletteLatestNumbersByName(roletaNome, limit);
        
        // Log do resultado da busca por nome
        console.log(`[useRouletteData] Resposta da busca por nome (${roletaNome}):`, 
          numerosArray.length > 0 ? 
          `${numerosArray.length} números, primeiro: ${numerosArray[0]}` : 
          'Sem números'
        );
      }
      
      // 2. PROCESSAMENTO: Converter para formato RouletteNumber
      if (numerosArray && Array.isArray(numerosArray) && numerosArray.length > 0) {
        // Processar os números em formato adequado - não precisamos mais processar
        // se vierem do novo endpoint, pois já estão formatados
        const processedNumbers = Array.isArray(numerosArray[0]?.numero) ? 
          processRouletteNumbers(numerosArray) : 
          numerosArray as RouletteNumber[];
        
        console.log(`[useRouletteData] Dados processados para ${roletaNome}:`, {
          total: processedNumbers.length,
          primeiros: processedNumbers.slice(0, 3).map(n => n.numero)
        });
        
        // IMPORTANTE: Salvar os dados iniciais apenas uma vez ou se for refresh manual
        if (!initialDataLoaded.current || isRefresh) {
          console.log(`[useRouletteData] ${initialDataLoaded.current ? 'Atualizando' : 'Salvando pela primeira vez'} dados iniciais para ${roletaNome}: ${processedNumbers.length} números`);
          setInitialNumbers(processedNumbers);
          initialDataLoaded.current = true;
        }
        
        // NOVA ADIÇÃO: Definir loading como false IMEDIATAMENTE após ter os dados
        setLoading(false);
        setHasData(true);
        initialLoadCompleted.current = true;
        
        return true;
      } else {
        // Sem dados disponíveis
        console.warn(`[useRouletteData] ⚠️ NENHUM DADO disponível para ${roletaNome} (ID: ${roletaId})`);
        
        // NOVA ADIÇÃO: Definir loading como false mesmo sem dados
        setLoading(false);  
        setHasData(false);
        initialLoadCompleted.current = true;
                
        return false;
      }
    } catch (err: any) {
      console.error(`[useRouletteData] ❌ Erro ao carregar números para ${roletaNome}: ${err.message}`);
      setError(`Erro ao carregar números: ${err.message}`);
      
      // NOVA ADIÇÃO: Garantir que loading seja false mesmo em caso de erro
      setLoading(false);
      setHasData(false);
      initialLoadCompleted.current = true;
      return false;
    } finally {
      // Garantir que loading e refreshLoading sejam sempre definidos como false ao final
      setLoading(false);
      setRefreshLoading(false);
    }
  }, [roletaId, roletaNome, limit]);
  
  // Função para extrair e processar estratégia da API
  const loadStrategy = useCallback(async (): Promise<boolean> => {
    if (!roletaId) return false;
    
    setStrategyLoading(true);
    
    try {
      // 1. EXTRAÇÃO: Obter estratégia da API
      console.log(`[useRouletteData] Extraindo estratégia para ${roletaNome} (ID: ${roletaId})...`);
      let strategyData = await fetchRouletteStrategy(roletaId);
      
      console.log(`[useRouletteData] Resposta da API de estratégia para ${roletaNome}:`, strategyData);
      
      // Se não tem dados de estratégia, tenta extrair da roleta por nome
      if (!strategyData) {
        console.log(`[useRouletteData] Tentando extrair estratégia da roleta por nome: ${roletaNome}`);
        const roletaData = await fetchRouletteById(roletaId);
        
        console.log(`[useRouletteData] Dados da roleta obtidos:`, roletaData);
        
        if (roletaData) {
          strategyData = {
            estado: roletaData.estado_estrategia || 'NEUTRAL',
            numero_gatilho: roletaData.numero_gatilho || null,
            terminais_gatilho: roletaData.terminais_gatilho || [],
            vitorias: roletaData.vitorias || 0,
            derrotas: roletaData.derrotas || 0,
            sugestao_display: roletaData.sugestao_display || ''
          };
        }
      }
      
      // 2. PROCESSAMENTO: Atualizar estado com dados obtidos
      if (strategyData) {
        console.log(`[useRouletteData] Estratégia processada para ${roletaNome}:`, {
          estado: strategyData.estado,
          vitorias: strategyData.vitorias,
          derrotas: strategyData.derrotas
        });
        
        setStrategy(strategyData);
        setStrategyLoading(false);
        return true;
      } else {
        console.log(`[useRouletteData] ⚠️ Nenhuma estratégia encontrada para ${roletaNome}`);
        setStrategy(null);
        setStrategyLoading(false);
        return false;
      }
    } catch (error) {
      console.error(`[useRouletteData] ❌ Erro ao extrair estratégia: ${error}`);
      setStrategyLoading(false);
      return false;
    }
  }, [roletaId, roletaNome]);
  
  // useEffect para inicialização - GARANTINDO CARREGAMENTO ÚNICO
  useEffect(() => {
    // Verificar se esta instância específica já foi inicializada para evitar carregamento duplo
    if (hookInitialized.current) {
      console.log(`[useRouletteData] Hook já inicializado para ${roletaNome}, ignorando inicialização duplicada`);
      return;
    }
    
    // Marcar esta instância como inicializada
    hookInitialized.current = true;
    
    let isActive = true;
    console.log(`[useRouletteData] ⭐ INICIANDO CARREGAMENTO ÚNICO para ${roletaNome} (ID: ${roletaId})`);
    
    // Função para carregar dados iniciais
    const loadInitialData = async () => {
      if (loading && !initialDataLoaded.current) {
        try {
          console.log(`[useRouletteData] Iniciando carregamento de dados para ${roletaId} (${roletaNome})`);
          
          // Definir status de carregamento
          setLoading(true);
          setError(null);
          initialDataLoaded.current = false;
          
          // Obter o ID canônico da roleta
          const canonicalId = mapToCanonicalRouletteId(roletaId, roletaNome);
          console.log(`[useRouletteData] ID canônico para ${roletaId}: ${canonicalId}`);
          
          // Buscar dados de números diretamente - sempre buscar novos dados
          const rawNumbers = await fetchRouletteNumbers(canonicalId, roletaNome, limit);
          
          if (rawNumbers && Array.isArray(rawNumbers)) {
            // Processar números para formato padrão
            const processedNumbers = processRouletteNumbers(rawNumbers);
            console.log(`[useRouletteData] Processados ${processedNumbers.length} números para ${roletaNome}`);
            
            // Salvar os dados iniciais e atualizar a exibição
            setInitialNumbers(processedNumbers);
            setHasData(processedNumbers.length > 0);
            initialDataLoaded.current = true;
            
            // Atualizar números combinados
            updateCombinedNumbers();
          } else {
            console.error(`[useRouletteData] Erro: Dados de números inválidos para ${roletaNome}`);
            setError(`Dados de números inválidos para ${roletaNome}`);
            setHasData(false);
          }
          
          // Buscar dados de estratégia - sempre buscar dados atualizados
          await refreshStrategy();
          
        } catch (error: any) {
          console.error(`[useRouletteData] Erro no carregamento inicial para ${roletaNome}:`, error);
          setError(`Erro ao carregar dados: ${error.message || 'Erro desconhecido'}`);
          setHasData(false);
        } finally {
          // Concluir o carregamento
          setLoading(false);
          initialLoadCompleted.current = true;
        }
      }
    };
    
    // ALTERAÇÃO: Iniciar carregamento imediatamente sem atrasos
    loadInitialData();
    
    // Cleanup
    return () => {
      isActive = false;
      console.log(`[useRouletteData] Componente desmontado, limpeza realizada para ${roletaNome}`);
    };
  }, [loadNumbers, loadStrategy, roletaId, roletaNome]); // Dependências mínimas necessárias
  
  // ===== EVENTOS E WEBSOCKETS =====
  
  // Processar novos números recebidos via WebSocket - MODIFICADA PARA ATUALIZAR APENAS newNumbers
  const handleNewNumber = useCallback((event: RouletteNumberEvent) => {
    if (event.type !== 'new_number') return;
    
    // 1. EXTRAÇÃO: Obter número do evento
    const numeroRaw = event.numero;
    const numeroFormatado = typeof numeroRaw === 'string' ? parseInt(numeroRaw, 10) : numeroRaw;
    
    debugLog(`[useRouletteData] Número recebido via evento para ${roletaNome}: ${numeroFormatado}`);
    
    // 2. PROCESSAMENTO: Atualizar estado APENAS dos novos números
    setNewNumbers(prev => {
      // Verificar se o número já existe nos novos
      const isDuplicate = prev.some(num => 
        num.numero === numeroFormatado && 
        num.timestamp === event.timestamp
      );
      
      if (isDuplicate) return prev;
      
      // Processar o novo número
      const newNumber = processRouletteNumber(numeroFormatado, event.timestamp);
      
      // Adicionar o novo número APENAS ao array de novos números
      console.log(`[useRouletteData] Adicionando novo número ${numeroFormatado} ao array de NOVOS números para ${roletaNome}`);
      return [newNumber, ...prev];
    });
    
    // Atualizar estado de conexão e dados
    setHasData(true);
    setIsConnected(true);
  }, [roletaNome]);
  
  // Efeito para ancorar novos números periodicamente nos dados iniciais
  useEffect(() => {
    // Se não temos novos números, não fazer nada
    if (newNumbers.length === 0) return;
    
    // Criar um timer para ancorar os novos números nos dados iniciais a cada minuto
    const anchorTimer = setInterval(() => {
      // Ancorar os novos números nos dados iniciais
      console.log(`[useRouletteData] ANCORANDO ${newNumbers.length} novos números nos dados iniciais para ${roletaNome}`);
      
      setInitialNumbers(prev => {
        // Criar um novo array com os dados iniciais existentes
        const updatedInitialData = [...prev];
        
        // Adicionar novos números que não existem nos dados iniciais
        let numAdded = 0;
        newNumbers.forEach(newNum => {
          // Verificar se já existe nos dados iniciais
          const exists = updatedInitialData.some(initial => 
            initial.numero === newNum.numero && 
            initial.timestamp === newNum.timestamp
          );
          
          // Se não existe, adicionar
          if (!exists) {
            updatedInitialData.unshift(newNum); // Adicionar no início
            numAdded++;
          }
        });
        
        console.log(`[useRouletteData] ${numAdded} novos números ancorados nos dados iniciais para ${roletaNome}`);
        
        // Retornar os dados iniciais atualizados
        return updatedInitialData;
      });
      
      // Limpar os novos números já ancorados
      setNewNumbers([]);
    }, 30000); // Ancorar a cada 30 segundos
    
    return () => {
      clearInterval(anchorTimer);
    };
  }, [newNumbers, roletaNome]);
  
  // Subscrever para eventos via WebSocket
  useEffect(() => {
    const socketService = SocketService.getInstance();
    
    // Subscrever para eventos
    debugLog(`[useRouletteData] Inscrevendo para eventos da roleta: ${roletaNome}`);
    socketService.subscribe(roletaNome, handleNewNumber);
    
    // Atualizar status de conexão
    const isSocketConnected = socketService.isSocketConnected();
    debugLog(`[useRouletteData] Status da conexão Socket.IO: ${isSocketConnected ? 'Conectado' : 'Desconectado'}`);
    setIsConnected(isSocketConnected);
    
    // Verificar conexão uma única vez - sem polling periódico
    const connectionCheckInterval = setInterval(() => {
      const currentStatus = socketService.isSocketConnected();
      if (currentStatus !== isConnected) {
        debugLog(`[useRouletteData] Mudança no status da conexão: ${currentStatus}`);
        setIsConnected(currentStatus);
      }
    }, 10000);
    
    return () => {
      // Remover subscrição ao desmontar
      debugLog(`[useRouletteData] Removendo inscrição para eventos da roleta: ${roletaNome}`);
      socketService.unsubscribe(roletaNome, handleNewNumber);
      clearInterval(connectionCheckInterval);
    };
  }, [roletaNome, roletaId, handleNewNumber, isConnected]);
  
  // Eventos de atualização da estratégia
  useEffect(() => {
    const eventService = EventService.getInstance();
    
    // Função para processar eventos de estratégia
    const handleStrategyEvent = (event: any) => {
      // Verificar se é um evento relevante para esta roleta
      if (event.type !== 'strategy_update' || 
          (event.roleta_id !== roletaId && event.roleta_nome !== roletaNome)) {
        return;
      }
      
      // Verificar se temos dados de vitórias e derrotas
      if (event.vitorias !== undefined || event.derrotas !== undefined) {
        console.log(`[useRouletteData] Recebido evento de estratégia para ${roletaNome}:`, {
          vitorias: event.vitorias,
          derrotas: event.derrotas,
          estado: event.estado
        });
        
        // Criar uma versão atualizada da estratégia atual
        const updatedStrategy: RouletteStrategy = {
          ...strategy, // Manter valores existentes que podem não estar no evento
          estado: event.estado || (strategy?.estado || 'NEUTRAL'),
          numero_gatilho: event.numero_gatilho || strategy?.numero_gatilho || null,
          terminais_gatilho: event.terminais_gatilho || strategy?.terminais_gatilho || [],
          vitorias: event.vitorias !== undefined ? event.vitorias : (strategy?.vitorias || 0),
          derrotas: event.derrotas !== undefined ? event.derrotas : (strategy?.derrotas || 0),
          sugestao_display: event.sugestao_display || strategy?.sugestao_display || '',
        };
        
        console.log(`[useRouletteData] Atualizando estratégia para ${roletaNome}:`, updatedStrategy);
        setStrategy(updatedStrategy);
      } else {
        console.log(`[useRouletteData] Evento de estratégia sem dados de vitórias/derrotas para ${roletaNome}`);
      }
    };
    
    // Registrar o handler para eventos de estratégia
    eventService.subscribeToEvent('strategy_update', handleStrategyEvent);
    
    return () => {
      // Remover registro ao desmontar
      eventService.unsubscribeFromEvent('strategy_update', handleStrategyEvent);
    };
  }, [roletaId, roletaNome, strategy]);
  
  // ===== FUNÇÕES PÚBLICAS =====
  
  // Função para atualizar manualmente os números
  const refreshNumbers = useCallback(async (): Promise<boolean> => {
    setRefreshLoading(true);
    return await loadNumbers(true);
  }, [loadNumbers]);
  
  // Função para atualizar manualmente a estratégia
  const refreshStrategy = useCallback(async (): Promise<boolean> => {
    console.log(`[useRouletteData] Atualizando manualmente estratégia para ${roletaNome}`);
    return await loadStrategy();
  }, [roletaNome, loadStrategy]);
  
  // Retornar o resultado processado
  return {
    numbers,
    loading, // This will only be true during initial loading
    error,
    isConnected,
    hasData,
    strategy,
    strategyLoading,
    refreshNumbers,
    refreshStrategy
  };
}