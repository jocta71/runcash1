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
  fetchRoulettes,
  fetchRoulettesWithRealNumbers
} from '@/integrations/api/rouletteService';
import { toast } from '@/components/ui/use-toast';
import SocketService from '@/services/SocketService';
import axios from 'axios';
import config from '@/config/env';
import FetchService from '@/services/FetchService';
import { RequestThrottler } from '@/services/utils/requestThrottler';
import { getLogger } from '@/services/utils/logger';
import RouletteFeedService from '@/services/RouletteFeedService';

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
let SYSTEM_INITIALIZED = false;

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
  // Estados locais
  const [numbers, setNumbers] = useState<RouletteNumber[]>([]);
  const [initialNumbers, setInitialNumbers] = useState<RouletteNumber[]>([]);
  const [newNumbers, setNewNumbers] = useState<RouletteNumber[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshLoading, setRefreshLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<RouletteStrategy | null>(null);
  const [strategyLoading, setStrategyLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [hasData, setHasData] = useState<boolean>(false);
  
  // Referência para manter o ID canônico consistente
  const canonicalIdRef = useRef<string>(mapToCanonicalRouletteId(roletaId));
  const initialLoadRef = useRef<boolean>(false);
  const socketSubscribedRef = useRef<boolean>(false);
  
  // Referência para limpeza do intervalo
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // ID para controle de polling
  const pollingIdKey = `${canonicalIdRef.current}_${limit}`;
  
  // Socket Service para comunicação em tempo real
  const socketService = useMemo(() => SocketService.getInstance(), []);
  
  // EventService para eventos
  const eventService = useMemo(() => EventService.getInstance(), []);
  
  // Adicionar referência ao RouletteFeedService para controle centralizado de requests
  const feedService = useMemo(() => RouletteFeedService.getInstance(), []);
  
  // Verifica se a roleta tem dados (números)
  const checkIfRouleteHasData = useCallback((roulette: any): boolean => {
    if (!roulette) return false;
    
    // Verificar se existe dados apenas em 'numero'
    // Se vier como 'numeros', converter para 'numero'
    if (roulette.numeros && Array.isArray(roulette.numeros) && roulette.numeros.length > 0) {
      roulette.numero = roulette.numeros;
      roulette.numeros = undefined;
    }
    
    // Verificar se temos dados no campo 'numero'
    return roulette.numero && Array.isArray(roulette.numero) && roulette.numero.length > 0;
  }, []);
  
  // Normaliza os dados da roleta para garantir que estejam no formato esperado
  const normalizeRouletteData = useCallback((data: any): RouletteNumber[] => {
    if (!data) return [];
    
    // Converter numeros para numero se necessário
    const rawNumbers = Array.isArray(data.numeros) ? data.numeros : 
                      (Array.isArray(data.numero) ? data.numero : []);
    
    // Se ainda estamos recebendo dados como "numeros", converter
    if (Array.isArray(data.numeros) && !data.numero) {
      data.numero = data.numeros;
      data.numeros = undefined;
    }
    
    return rawNumbers.map((item: any) => {
      // Se já for um objeto com 'numero', normalizar
      if (typeof item === 'object' && item !== null) {
        return {
          numero: typeof item.numero === 'number' ? item.numero : 
                (typeof item.numero === 'string' ? parseInt(item.numero, 10) : 0),
          roleta_id: item.roleta_id || roletaId,
          roleta_nome: item.roleta_nome || roletaNome,
          cor: item.cor || determinarCorNumero(item.numero || 0),
          timestamp: item.timestamp || new Date().toISOString()
        };
      }
      
      // Se for um número direto
      const numeroValue = typeof item === 'number' ? item : 
                         (typeof item === 'string' ? parseInt(item, 10) : 0);
      
      return {
        numero: numeroValue,
        roleta_id: roletaId,
        roleta_nome: roletaNome,
        cor: determinarCorNumero(numeroValue),
        timestamp: new Date().toISOString()
      };
    });
  }, [roletaId, roletaNome]);

  // Função auxiliar para buscar o ID canônico a partir do nome
  const getCanonicalIdByName = (name: string) => {
    const roleta = ROLETAS_CANONICAS.find(r => r.nome === name);
    return roleta ? roleta.id : null;
  };

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
    
    // Combinar sem duplicar números
    const numberMap = new Map();
    
    // Adicionar números iniciais ao mapa, usando o valor do número como chave
    initialNumbers.forEach(item => {
      const numeroValue = typeof item === 'object' ? item.numero : item;
      if (!numberMap.has(numeroValue)) {
        numberMap.set(numeroValue, item);
      }
    });
    
    // Adicionar novos números, substituindo os existentes se houver duplicatas
    newNumbers.forEach(item => {
      const numeroValue = typeof item === 'object' ? item.numero : item;
      if (!numberMap.has(numeroValue)) {
        numberMap.set(numeroValue, item);
      }
    });
    
    // Converter o mapa de volta para um array e ordenar por timestamp (mais recente primeiro)
    const combinedArray = Array.from(numberMap.values()).sort((a, b) => {
      // Se for objeto, comparar timestamps
      if (typeof a === 'object' && typeof b === 'object') {
        const timeA = new Date(a.timestamp || '');
        const timeB = new Date(b.timestamp || '');
        return timeB.getTime() - timeA.getTime();
      }
      // Se forem números simples, manter a ordem
      return 0;
    });
    
    console.log(`[useRouletteData] Números combinados: ${combinedArray.length} números únicos para ${roletaNome}`);
    setNumbers(combinedArray);
  }, [initialNumbers, newNumbers, roletaNome]);

  // Atualizar o estado combinado sempre que initialNumbers ou newNumbers mudar
  useEffect(() => {
    updateCombinedNumbers();
  }, [initialNumbers, newNumbers, updateCombinedNumbers]);

  // Função para extrair e processar números da API - MODIFICADA PARA USAR THROTTLER
  const loadNumbers = useCallback(async (isRefresh = false): Promise<boolean> => {
    try {
      // Se já temos dados iniciais e não é uma atualização manual, pular
      if (initialLoadRef.current && !isRefresh) {
        logger.debug(`Ignorando carregamento de números para ${roletaNome} - dados já carregados`);
        setLoading(false);
        return true;
      }
      
      if (!isRefresh) setLoading(true);
      setError(null);
      
      if (!roletaId) {
        logger.warn(`ID de roleta inválido ou vazio: "${roletaId}"`);
        setLoading(false);
        setHasData(false);
        return false;
      }
      
      // Registrar explicitamente o início do carregamento
      logger.debug(`${isRefresh ? '🔄 RECARREGANDO' : '📥 CARREGANDO'} dados para ${roletaNome} (ID: ${roletaId})`);
      
      // Usar o throttler para obter os números com controle de taxa
      const throttleKey = `roulette_numbers_${canonicalIdRef.current}`;
      
      // Subscrever para atualizações futuras
      const unsubscribe = RequestThrottler.subscribeToUpdates(throttleKey, (processedNumbers) => {
        if (processedNumbers && Array.isArray(processedNumbers) && processedNumbers.length > 0) {
          logger.debug(`Recebida atualização via throttler para ${roletaNome}: ${processedNumbers.length} números`);
          setInitialNumbers(processedNumbers);
          setHasData(true);
          initialLoadRef.current = true;
          setLoading(false);
        }
      });
      
      // Agendar a requisição
      const numerosArray = await RequestThrottler.scheduleRequest(
        throttleKey,
        async () => fetchRouletteNumbers(roletaId, roletaNome, limit),
        isRefresh // Forçar execução imediata apenas em caso de refresh manual
      );
      
      // Se não conseguimos dados do throttler, tente o cache
      if (!numerosArray || !Array.isArray(numerosArray) || numerosArray.length === 0) {
        if (rouletteDataCache.has(canonicalIdRef.current)) {
          const cachedData = rouletteDataCache.get(canonicalIdRef.current);
          if (cachedData && cachedData.length > 0) {
            logger.debug(`Usando ${cachedData.length} números do cache para ${roletaNome}`);
            setInitialNumbers(cachedData);
            setHasData(true);
            initialLoadRef.current = true;
        setLoading(false);
            return true;
          }
        }
        
        // Sem dados disponíveis
        logger.warn(`⚠️ NENHUM DADO disponível para ${roletaNome} (ID: ${roletaId})`);
        setLoading(false);  
        setHasData(false);
        initialLoadRef.current = true;
        return false;
      }
      
      return true;
    } catch (err: any) {
      logger.error(`❌ Erro ao carregar números para ${roletaNome}: ${err.message}`);
      setError(`Erro ao carregar números: ${err.message}`);
      
      setLoading(false);
      setHasData(false);
      initialLoadRef.current = true;
      return false;
    } finally {
      // Garantir que loading e refreshLoading sejam sempre definidos como false ao final
      setLoading(false);
      setRefreshLoading(false);
    }
  }, [roletaId, roletaNome, limit, canonicalIdRef.current]);
  
  // Função para extrair e processar estratégia da API - MODIFICADA PARA USAR THROTTLER
  const loadStrategy = useCallback(async (): Promise<boolean> => {
    if (!roletaId) return false;
    
    setStrategyLoading(true);
    
    try {
      // Usar o throttler para obter a estratégia com controle de taxa
      const throttleKey = `roulette_strategy_${canonicalIdRef.current}`;
      
      // Subscrever para atualizações futuras de estratégia
      const unsubscribe = RequestThrottler.subscribeToUpdates(throttleKey, (strategyData) => {
        if (strategyData) {
          logger.debug(`Recebida atualização de estratégia via throttler para ${roletaNome}`);
          setStrategy(strategyData);
          setStrategyLoading(false);
        }
      });
      
      // Agendar a requisição
      const strategyData = await RequestThrottler.scheduleRequest(
        throttleKey,
        async () => {
          logger.debug(`Extraindo estratégia para ${roletaNome} (ID: ${roletaId})...`);
          return fetchRouletteStrategy(roletaId);
        }
      );
      
      // Se não tem dados de estratégia, tenta extrair da roleta por nome ou usar o cache
      if (!strategyData) {
        // Verificar se temos no cache
        if (rouletteStrategyCache.has(canonicalIdRef.current)) {
          const cachedStrategy = rouletteStrategyCache.get(canonicalIdRef.current);
          if (cachedStrategy) {
            logger.debug(`Usando estratégia do cache para ${roletaNome}`);
            setStrategy(cachedStrategy);
            setStrategyLoading(false);
            return true;
          }
        }
        
        // Tentar obter da roleta
        const throttleKeyRoulette = `roulette_data_${canonicalIdRef.current}`;
        const roletaData = await RequestThrottler.scheduleRequest(
          throttleKeyRoulette,
          async () => fetchRouletteById(roletaId)
        );
        
        if (roletaData) {
          const derivedStrategy = {
            estado: roletaData.estado_estrategia || 'NEUTRAL',
            numero_gatilho: roletaData.numero_gatilho || null,
            terminais_gatilho: roletaData.terminais_gatilho || [],
            vitorias: roletaData.vitorias || 0,
            derrotas: roletaData.derrotas || 0,
            sugestao_display: roletaData.sugestao_display || ''
          };
          
          // Armazenar no cache
          rouletteStrategyCache.set(canonicalIdRef.current, derivedStrategy);
          
          setStrategy(derivedStrategy);
          setStrategyLoading(false);
          return true;
        }
      } else {
        // Armazenar no cache
        rouletteStrategyCache.set(canonicalIdRef.current, strategyData);
      }
      
      // Não conseguimos obter a estratégia
      if (!strategyData) {
        logger.warn(`⚠️ Nenhuma estratégia encontrada para ${roletaNome}`);
        setStrategy(null);
        setStrategyLoading(false);
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error(`❌ Erro ao extrair estratégia: ${error}`);
      setStrategyLoading(false);
      return false;
    }
  }, [roletaId, roletaNome, canonicalIdRef.current]);
  
  // useEffect para inicialização - MODIFICADO PARA USAR THROTTLER
  useEffect(() => {
    // Verificar se esta instância específica já foi inicializada para evitar carregamento duplo
    if (socketSubscribedRef.current) {
      logger.debug(`Hook já inicializado para ${roletaNome}, ignorando inicialização duplicada`);
      return;
    }
    
    // Marcar esta instância como inicializada
    socketSubscribedRef.current = true;
    
    let isActive = true;
    logger.debug(`⭐ INICIANDO CARREGAMENTO ÚNICO para ${roletaNome} (ID: ${roletaId})`);
    
    // Carregar dados iniciais
    loadNumbers();
    loadStrategy();
    
    // Cleanup
    return () => {
      isActive = false;
      logger.debug(`Componente desmontado, limpeza realizada para ${roletaNome}`);
    };
  }, [loadNumbers, loadStrategy, roletaId, roletaNome]);
  
  // ===== EVENTOS E WEBSOCKETS =====
  
  // Função para adicionar números em tempo real
  const addRealTimeNumber = useCallback((newNumberData: RouletteNumberEvent) => {
    // Verificar se o evento é para esta roleta
    if (newNumberData.roleta_id !== canonicalIdRef.current && 
        newNumberData.roleta_nome !== roletaNome) {
      return;
    }

    const newNumber: RouletteNumber = {
      numero: newNumberData.numero,
      roleta_id: newNumberData.roleta_id,
      roleta_nome: newNumberData.roleta_nome,
      timestamp: newNumberData.timestamp,
      cor: determinarCorNumero(newNumberData.numero)
    };

    logger.debug(`Adicionando número em tempo real: ${newNumber.numero} para ${newNumber.roleta_nome}`);

    // Adicionar aos novos números
    setNewNumbers(prev => {
      // Verificar se o número já existe nos novos
      const isDuplicate = prev.some(num => 
        num.numero === newNumber.numero && 
        num.timestamp === newNumber.timestamp
      );
      
      if (isDuplicate) return prev;
      
      // Adicionar o novo número ao array de novos números
      return [newNumber, ...prev];
    });

    // Também adicionar ao histórico inicial para garantir consistência
    setInitialNumbers(prev => {
      // Verificar se o número já existe no histórico
      const isDuplicate = prev.some(num => 
        num.numero === newNumber.numero && 
        num.timestamp === newNumber.timestamp
      );
      
      if (isDuplicate) return prev;
      
      // Adicionar o novo número também ao histórico
      return [newNumber, ...prev];
    });

    setHasData(true);
    setIsConnected(true);
  }, [roletaNome]);

  // Efeito para inscrever no EventService para receber atualizações em tempo real
  useEffect(() => {
    if (socketSubscribedRef.current) return;

    // Função para lidar com novos números em tempo real
    const handleNewNumber = (event: RouletteNumberEvent) => {
      if (event.roleta_id === canonicalIdRef.current || 
          event.roleta_nome === roletaNome) {
        logger.debug(`Novo número recebido via socket: ${event.numero} para ${event.roleta_nome || event.roleta_id}`);
        addRealTimeNumber(event);
      }
    };

    // Inscrever para eventos de novos números
    EventService.on('roulette:new-number', handleNewNumber);
    socketSubscribedRef.current = true;

    // Iniciar polling de baixa frequência para verificar atualizações
    if (!pollingIntervalRef.current && !pollingInitialized.has(pollingIdKey)) {
      pollingInitialized.add(pollingIdKey);
      pollingIntervalRef.current = setInterval(() => {
        // Verificar silenciosamente por novos dados sem alterar estado de loading
        const socketService = SocketService.getInstance();
        socketService.requestRouletteNumbers(canonicalIdRef.current);
      }, 5000); // 5 segundos
    }

    return () => {
      EventService.off('roulette:new-number', handleNewNumber);
      socketSubscribedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      pollingInitialized.delete(pollingIdKey);
    };
  }, [canonicalIdRef.current, roletaNome, pollingIdKey, addRealTimeNumber]);
  
  // Assinar explicitamente para atualizações da API
  useEffect(() => {
    const socketService = SocketService.getInstance();
    socketService.subscribeToRouletteEndpoint(canonicalIdRef.current, roletaNome);
    
    // Usar RouletteFeedService em vez de polling
    const rouletteFeedService = RouletteFeedService.getInstance();
    rouletteFeedService.start();
    
    return () => {
      // Não é necessário parar o serviço aqui, pois ele é gerenciado globalmente
    };
  }, [canonicalIdRef.current, roletaNome]);
  
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
  
  // Combinar todos os números (iniciais + novos) para retorno
  useEffect(() => {
    // Combinar números iniciais com novos números
    const combinedNumbers = [...newNumbers, ...initialNumbers];
    
    // Remover duplicados (pode acontecer durante ancoragem)
    const uniqueNumbers: RouletteNumber[] = [];
    const seen = new Set<string>();
    
    for (const num of combinedNumbers) {
      const key = `${num.numero}-${num.timestamp || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueNumbers.push(num);
      }
    }
    
    // Ordenar por timestamp (mais recente primeiro)
    uniqueNumbers.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime;
    });
    
    // Limitar ao tamanho solicitado
    const limitedNumbers = uniqueNumbers.slice(0, limit);
    
    // Atualizar o estado dos números
    setNumbers(limitedNumbers);
  }, [initialNumbers, newNumbers, limit]);
  
  // Registrar para obter atualizações em tempo real
  useEffect(() => {
    // Iniciar o serviço de polling único para todas as requisições
    feedService.startPolling();
    
    // Cleanup quando o componente for desmontado
    return () => {
      // Não desativamos o polling aqui, pois outros componentes podem precisar dele
      // O gerenciamento do ciclo de vida é responsabilidade do RouletteFeedService
    };
  }, [feedService]);
  
  // Buscar roletas e estratégias apenas uma vez na montagem
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        
        // Usar o serviço centralizado para buscar dados iniciais
        const roletas = await feedService.fetchInitialData();
        
        if (roletas && roletas.length > 0) {
          // Processar as roletas retornadas pelo serviço
          processInitialRoulettes(roletas);
          setLoading(false);
        } else {
          console.error('Falha ao carregar roletas iniciais');
          setError('Não foi possível carregar as roletas');
          setLoading(false);
        }
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
        setError('Erro ao carregar dados');
        setLoading(false);
      }
    };

    fetchAllData();
  }, [feedService]);
  
  // Retornar o resultado processado
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