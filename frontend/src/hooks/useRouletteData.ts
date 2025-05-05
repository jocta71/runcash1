import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { RouletteNumberEvent } from '@/services/EventService';
import EventService from '@/services/EventService';
import { 
  fetchRouletteLatestNumbersByName, 
  fetchRouletteStrategy,
  fetchRouletteById,
  RouletteStrategy as ApiRouletteStrategy,
  mapToCanonicalRouletteId,
  ROLETAS_CANONICAS,
  fetchRouletteNumbersById,
  fetchRoulettesWithRealNumbers
} from '@/integrations/api/rouletteService';
import SocketService from '@/services/SocketService';
import axios from 'axios';
import config from '@/config/env';
import { RequestThrottler } from '@/services/utils/requestThrottler';
import { getLogger } from '@/services/utils/logger';
import UnifiedRouletteClient from '@/services/UnifiedRouletteClient';

// Logger específico para este componente
const logger = getLogger('RouletteData');

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

// Mapa para armazenar os dados mais recentes de cada roleta
const rouletteDataCache: Map<string, RouletteNumber[]> = new Map();

// Mapa para armazenar os dados de estratégia mais recentes de cada roleta
const rouletteStrategyCache: Map<string, RouletteStrategy> = new Map();

// Flag global para controlar a inicialização única do sistema
const SYSTEM_INITIALIZED = false;

// Interface para definir a estrutura dos dados da roleta
export interface RouletteDataSummary {
  redCount: number;
  blackCount: number;
  zeroCount: number;
  redPercentage: number;
  blackPercentage: number;
  zeroPercentage: number;
  evenCount: number;
  oddCount: number;
  evenPercentage: number;
  oddPercentage: number;
  dozenCounts: [number, number, number];
  dozenPercentages: [number, number, number];
  mostFrequentNumbers: Array<{number: number, count: number}>;
  leastFrequentNumbers: Array<{number: number, count: number}>;
  lastResults: number[];
}

// Adicionar validação para garantir propriedades obrigatórias nos números da roleta  
const validateRouletteNumbers = (numbers: any[]): boolean => {
  if (!Array.isArray(numbers) || numbers.length === 0) return false;
  
  // Verificar se o primeiro item tem a estrutura esperada
  const firstItem = numbers[0];
  
  // Se for um objeto, verificar propriedades esperadas
  if (typeof firstItem === 'object' && firstItem !== null) {
    // Verificar se tem pelo menos uma das propriedades chave
    const hasNumero = 'numero' in firstItem && (typeof firstItem.numero === 'number' || !isNaN(parseInt(firstItem.numero)));
    const hasCor = 'cor' in firstItem && typeof firstItem.cor === 'string';
    const hasTimestamp = 'timestamp' in firstItem && typeof firstItem.timestamp === 'string';
    
    return hasNumero && (hasCor || hasTimestamp);
  }
  
  // Se for um número ou string convertível para número
  return typeof firstItem === 'number' || (typeof firstItem === 'string' && !isNaN(parseInt(firstItem)));
};

/**
 * Função para buscar números da roleta pelo endpoint único
 */
const fetchRouletteNumbers = async (roletaId: string, nome?: string, limit: number = 100): Promise<RouletteNumber[]> => {
  try {
    // Validar parâmetros
    if (!roletaId) {
      console.error(`[useRouletteData] ID de roleta inválido ou vazio: "${roletaId}"`);
      return [];
    }

    // Mapeamento para o ID canônico
    const canonicalId = mapToCanonicalRouletteId(roletaId);
    logger.debug(`Buscando números para roleta ${roletaId} (nome: ${nome || 'desconhecido'}, canônico: ${canonicalId})`);
    
    // Usar o RequestThrottler para evitar múltiplas requisições simultâneas
    const throttleKey = `roulette_numbers_${canonicalId}`;
    const numbers = await RequestThrottler.scheduleRequest(
      throttleKey,
      async () => fetchRouletteNumbersById(canonicalId, limit)
    );
    
    if (numbers && Array.isArray(numbers) && numbers.length > 0) {
      logger.debug(`✅ Recebidos ${numbers.length} números da API para ID: ${canonicalId}`);
      // Armazenar no cache
      rouletteDataCache.set(canonicalId, numbers);
      return numbers;
    }
    
    logger.warn(`⚠️ Resposta da API não é um array válido para ID: ${canonicalId}`);
    
    // Tentar novamente com fallback para nome da roleta
    if (nome) {
      logger.debug(`Tentando fallback para nome: ${nome}`);
      const throttleKeyByName = `roulette_numbers_name_${nome}`;
      const numbersByName = await RequestThrottler.scheduleRequest(
        throttleKeyByName,
        async () => fetchRouletteLatestNumbersByName(nome, limit)
      );
      
      if (numbersByName && Array.isArray(numbersByName) && numbersByName.length > 0) {
        logger.debug(`✅ Recebidos ${numbersByName.length} números pelo nome: ${nome}`);
        // Armazenar no cache
        rouletteDataCache.set(nome, numbersByName);
        return numbersByName;
      }
    }
    
    // Verificar se temos no cache
    if (rouletteDataCache.has(canonicalId)) {
      logger.debug(`Usando ${rouletteDataCache.get(canonicalId)?.length} números do cache para ${canonicalId}`);
      return rouletteDataCache.get(canonicalId) || [];
    }
    
    return [];
  } catch (error: any) {
    logger.error(`❌ Erro ao buscar números da roleta ${nome || roletaId}:`, error.message);
    
    // Tentar usar cache em caso de erro
    const canonicalId = mapToCanonicalRouletteId(roletaId);
    if (rouletteDataCache.has(canonicalId)) {
      logger.debug(`Usando cache após erro para ${canonicalId}`);
      return rouletteDataCache.get(canonicalId) || [];
    }
    
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
  // Estado para os números da roleta
  const [numbers, setNumbers] = useState<RouletteNumber[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [hasData, setHasData] = useState<boolean>(false);
  
  // Estado para estratégia da roleta
  const [strategy, setStrategy] = useState<RouletteStrategy | null>(null);
  const [strategyLoading, setStrategyLoading] = useState<boolean>(false);
  
  // Refs para controle  
  const canonicalId = useMemo(() => mapToCanonicalRouletteId(roletaId), [roletaId]);
  const pollingRef = useRef<number | null>(null);
  const isInitialized = useRef<boolean>(false);
  const isMounted = useRef<boolean>(true);
  const effectRunCount = useRef<number>(0);
  
  // Referência para controle de eventos
  const eventUnsubscribe = useRef<() => void | null>(null);
  
  // Obtém o cliente unificado para roletas
  const unifiedClient = useMemo(() => UnifiedRouletteClient.getInstance(), []);
  
  // Função para converter ID da roleta para o formato canônico
  const getCanonicalIdByName = (name: string) => {
    // Buscar na lista de roletas canônicas
    for (const [key, value] of Object.entries(ROLETAS_CANONICAS)) {
      if (value.toLowerCase() === name.toLowerCase()) {
        return key;
      }
    }
    return null; // Não encontrou correspondência
  };
  
  // Função para buscar estratégia da roleta
  const fetchStrategyData = useCallback(async (): Promise<boolean> => {
    if (!canonicalId) return false;
    
    try {
      // Verificar se já temos no cache
      if (rouletteStrategyCache.has(canonicalId)) {
        setStrategy(rouletteStrategyCache.get(canonicalId) || null);
        return true;
      }
      
      setStrategyLoading(true);
      const strategyData = await fetchRouletteStrategy(canonicalId);
      
      if (strategyData) {
        setStrategy(strategyData);
        rouletteStrategyCache.set(canonicalId, strategyData);
          return true;
      }
      
        return false;
    } catch (e) {
      console.error(`Erro ao carregar estratégia para ${canonicalId}:`, e);
      return false;
    } finally {
      setStrategyLoading(false);
    }
  }, [canonicalId]);
  
  // Função para atualização imediata dos números da roleta
  const refreshNumbers = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      
      // Usar o UnifiedRouletteClient para obter dados mais recentes
      unifiedClient.forceUpdate();
      
      // Buscar dados específicos da roleta atual
      const data = await fetchRouletteNumbers(canonicalId, roletaNome, limit);
      
      // Processar os números
      if (data && data.length > 0) {
        const processedNumbers = processRouletteNumbers(data);
        setNumbers(processedNumbers);
        setHasData(true);
          return true;
      }
      
        return false;
    } catch (err: any) {
      logger.error(`❌ Erro ao atualizar roleta ${roletaNome}:`, err.message);
      setError(`Erro ao atualizar dados: ${err.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, [canonicalId, roletaNome, limit, unifiedClient]);
  
  // Função para atualizar dados de estratégia
  const refreshStrategy = useCallback(async (): Promise<boolean> => {
    return await fetchStrategyData();
  }, [fetchStrategyData]);
  
  // Efeito para inicializar o hook e configurar event listeners
  useEffect(() => {
    isMounted.current = true;
    effectRunCount.current += 1;
    const runCount = effectRunCount.current;
    
    logger.debug(`[${runCount}] Inicializando hook para roleta ${canonicalId} (${roletaNome})`);
    
    // Função para processar novos números da roleta
    const handleNewNumber = (event: RouletteNumberEvent) => {
      // Validar se o evento é para esta roleta
      if (!event || !isMounted.current) return;
      
      const eventRouletteId = event.roletaId?.toLowerCase();
      const eventRouteName = event.nome?.toLowerCase();
      const currentRouletteId = canonicalId.toLowerCase();
      const currentRouletteName = roletaNome.toLowerCase();
      
    // Verificar se o evento é para esta roleta
      const isForThisRoulette = 
        eventRouletteId === currentRouletteId || 
        eventRouteName === currentRouletteName;
      
      if (!isForThisRoulette) return;
      
      logger.debug(`Recebido novo número ${event.numero} para roleta ${event.nome || event.roletaId}`);
      
      // Processar o número
      const newNumber = processRouletteNumber(event.numero, event.timestamp);
      
      // Atualizar estado com o novo número (adicionando ao início do array)
      setNumbers(prev => {
        // Criar um novo array, incluindo o novo número no início
        const updatedNumbers = [newNumber, ...prev];
        
        // Limitar ao tamanho máximo
        if (updatedNumbers.length > limit) {
          return updatedNumbers.slice(0, limit);
        }
        
        return updatedNumbers;
    });

    setHasData(true);
    };
    
    // Função para processar eventos de estratégia
    const handleStrategyEvent = (event: any) => {
      if (!event || !event.data || !isMounted.current) return;
      
      const strategyData = event.data;
      
      // Verificar se a estratégia é para esta roleta
      if (strategyData.roletaId === canonicalId ||
          strategyData.roleta_id === canonicalId) {
        
        logger.debug(`Nova estratégia recebida para ${canonicalId}`);
        setStrategy(strategyData);
        rouletteStrategyCache.set(canonicalId, strategyData);
      }
    };
    
    // Conectar aos eventos
    eventUnsubscribe.current = EventService.subscribe('new-roulette-number', handleNewNumber);
    EventService.subscribe('strategy-update', handleStrategyEvent);
    
    // Registrar no sistema de eventos global
    EventService.emit('roulette-hook:initialized', {
      roletaId: canonicalId,
      nome: roletaNome,
      timestamp: new Date().toISOString()
    });
    
    // Observar status de conexão
    const handleConnectionChange = (status: any) => {
      if (!isMounted.current) return;
      setIsConnected(!!status.connected);
    };
    
    // Subscrever para mudanças de status
    EventService.subscribe('socket:status-changed', handleConnectionChange);
    
    // Registrar no UnifiedRouletteClient para receber dados em tempo real
    const unsubscribeFromUnified = unifiedClient.on('update', (data) => {
      if (!isMounted.current) return;
      
      // Se os dados forem um array, buscar a roleta específica
      if (Array.isArray(data)) {
        const relevantRoulette = data.find(r => 
          r.id === canonicalId || 
          r.id === roletaId || 
          (r.name && r.name.toLowerCase() === roletaNome.toLowerCase())
        );
        
        if (relevantRoulette && relevantRoulette.numbers) {
          // Atualizar com os números desta roleta
          const processedNumbers = processRouletteNumbers(relevantRoulette.numbers);
          setNumbers(processedNumbers);
          setHasData(true);
        }
      }
    });
    
    // Configurar recebimento de status de conexão
    const handleStreamStatus = (status: any) => {
      if (!isMounted.current) return;
      setIsConnected(status.isStreamConnected || false);
    };
    
    const unsubscribeFromStatus = unifiedClient.on('connect', handleStreamStatus);
    
    // Conectar ao stream se não estiver conectado
    if (!unifiedClient.getStatus().isStreamConnected) {
      unifiedClient.connectStream();
    }
    
    // Função para buscar todos os dados iniciais
    const fetchAllData = async () => {
      try {
        setLoading(true);
        
        // 1. Buscar os números atuais
        const numbersData = await fetchRouletteNumbers(canonicalId, roletaNome, limit);
        
        // Processar e atualizar
        if (numbersData && numbersData.length > 0) {
          const processedNumbers = processRouletteNumbers(numbersData);
          setNumbers(processedNumbers);
          setHasData(true);
        } else {
          // Se não encontrou, verificar se o cliente unificado tem os dados
          const allRoulettes = unifiedClient.getAllRoulettes();
          const relevantRoulette = allRoulettes.find(r => 
            r.id === canonicalId || 
            r.id === roletaId || 
            (r.name && r.name.toLowerCase() === roletaNome.toLowerCase())
          );
          
          if (relevantRoulette && relevantRoulette.numbers) {
            // Atualizar com os números desta roleta
            const processedNumbers = processRouletteNumbers(relevantRoulette.numbers);
            setNumbers(processedNumbers);
            setHasData(true);
          }
        }
        
        // 2. Buscar estratégia
        await fetchStrategyData();
        
        setError(null);
        isInitialized.current = true;
      } catch (err: any) {
        console.error(`Erro ao carregar dados da roleta ${roletaNome}:`, err);
        setError(`Falha ao carregar dados: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    // Executar busca inicial
    fetchAllData();
    
    // Cleanup
    return () => {
      logger.debug(`Desmontando hook para roleta ${canonicalId}`);
      isMounted.current = false;
      
      // Limpar event listeners
      if (eventUnsubscribe.current) {
        eventUnsubscribe.current();
      }
      
      EventService.unsubscribe('strategy-update', handleStrategyEvent);
      EventService.unsubscribe('socket:status-changed', handleConnectionChange);
      
      // Cancelar polling se houver
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      
      // Cancelar inscrições no UnifiedRouletteClient
      unsubscribeFromUnified();
      unsubscribeFromStatus();
      
      // Notificar sistema sobre desmontagem
      EventService.emit('roulette-hook:unmounted', {
        roletaId: canonicalId,
        nome: roletaNome,
        timestamp: new Date().toISOString()
      });
    };
  }, [canonicalId, roletaNome, limit, unifiedClient]);
  
  return {
    numbers,
    loading,
    error,
    isConnected,
    hasData,
    strategy,
    strategyLoading,
    refreshNumbers,
    refreshStrategy
  };
}

// Hook para obter todas as roletas com números reais
export function useRoulettesWithRealNumbers() {
  const [roulettes, setRoulettes] = useState<RouletteData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await fetchRoulettesWithRealNumbers();
        setRoulettes(data);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Erro ao buscar roletas com números reais');
        console.error('[useRoulettesWithRealNumbers] Erro:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  return { roulettes, loading, error };
}

/**
 * Hook para verificar se o sistema de roletas está inicializado
 * agora usando o sistema centralizado no main.tsx
 */
export function useRouletteSystemStatus(): { isInitialized: boolean; services: any } {
  // Verificar se o sistema global está inicializado
  const isInitialized = typeof window !== 'undefined' && 
    window.ROULETTE_SYSTEM_INITIALIZED === true;
  
  // Obter serviços através da API global
  const services = typeof window !== 'undefined' && window.getRouletteSystem 
    ? window.getRouletteSystem() 
    : null;
  
  return { 
    isInitialized,
    services
  };
}