import { useState, useEffect, useCallback, useRef } from 'react';
import SocketService from '@/services/SocketService';
import { RouletteNumberEvent } from '@/services/EventService';
import EventService from '@/services/EventService';
import { fetchRouletteLatestNumbers, fetchRouletteStrategy, RouletteStrategy as ApiRouletteStrategy } from '@/integrations/api/rouletteService';
import { toast } from '@/components/ui/use-toast';

// Debug flag - set to false to disable logs in production
const DEBUG_ENABLED = true;

// Helper function for controlled logging
const debugLog = (...args: any[]) => {
  if (DEBUG_ENABLED) {
    console.log(...args);
  }
};

// Interface para número da roleta
export interface RouletteNumber {
  numero: number;
  cor: string;
  timestamp: string;
}

// Interface para o estado da estratégia - usando a mesma definição da API
export type RouletteStrategy = ApiRouletteStrategy;

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
    cor: determinarCorNumero(numero),
    timestamp: timestamp || new Date().toISOString()
  };
};

/**
 * Processa um array de números brutos para o formato RouletteNumber[]
 */
export const processRouletteNumbers = (numeros: number[], timestamps?: string[]): RouletteNumber[] => {
  return numeros.map((numero, index) => {
    const timestamp = timestamps && timestamps[index] 
      ? timestamps[index] 
      : new Date(new Date().getTime() - (index * 60000)).toISOString();
    
    return processRouletteNumber(numero, timestamp);
  });
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
  limit: number = 500
): UseRouletteDataResult {
  // Estado para dados de números
  const [numbers, setNumbers] = useState<RouletteNumber[]>([]);
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
  
  // ===== CARREGAMENTO DE DADOS INICIAIS =====
  
  // Função para extrair e processar números da API
  const loadNumbers = useCallback(async (isRefresh = false): Promise<boolean> => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);
      
      if (!roletaId) {
        debugLog(`[useRouletteData] ID de roleta inválido: ${roletaId}`);
        setLoading(false);
        setHasData(false);
        return false;
      }
      
      // 1. EXTRAÇÃO: Obter números brutos da API
      debugLog(`[useRouletteData] Extraindo números para ${roletaNome} (ID: ${roletaId})`);
      let numerosArray = await fetchRouletteLatestNumbers(roletaId, limit);
      
      // Tentar obter por nome como fallback se não conseguir por ID
      if (!numerosArray || numerosArray.length === 0) {
        debugLog(`[useRouletteData] Tentando obter números por nome da roleta: ${roletaNome}`);
        numerosArray = await fetchRouletteLatestNumbersByName(roletaNome, limit);
      }
      
      // 2. PROCESSAMENTO: Converter para formato RouletteNumber
      if (numerosArray && Array.isArray(numerosArray) && numerosArray.length > 0) {
        // Processar os números em formato adequado
        const processedNumbers = processRouletteNumbers(numerosArray);
        
        // Atualizar estado
        setNumbers(processedNumbers);
        setHasData(true);
        initialLoadCompleted.current = true;
        
        debugLog(`[useRouletteData] Processados ${processedNumbers.length} números para ${roletaNome}`);
        return true;
      } else {
        // Sem dados disponíveis
        setHasData(false);
        initialLoadCompleted.current = true;
        
        debugLog(`[useRouletteData] Sem dados disponíveis para ${roletaNome}`);
        return false;
      }
    } catch (err: any) {
      console.error(`[useRouletteData] Erro ao carregar números: ${err.message}`);
      setError(`Erro ao carregar números: ${err.message}`);
      setHasData(false);
      initialLoadCompleted.current = true;
      return false;
    } finally {
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
      debugLog(`[useRouletteData] Extraindo estratégia para ${roletaNome}...`);
      let strategyData = await fetchRouletteStrategy(roletaId);
      
      // Se não tem dados de estratégia, tenta extrair da roleta por nome
      if (!strategyData) {
        debugLog(`[useRouletteData] Tentando extrair estratégia da roleta por nome: ${roletaNome}`);
        const roletaData = await fetchRouletteById(roletaId);
        
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
        debugLog(`[useRouletteData] Estratégia processada para ${roletaNome}:`, {
          estado: strategyData.estado,
          vitorias: strategyData.vitorias,
          derrotas: strategyData.derrotas
        });
        
        setStrategy(strategyData);
        setStrategyLoading(false);
        return true;
      } else {
        debugLog(`[useRouletteData] Nenhuma estratégia encontrada para ${roletaNome}`);
        setStrategy(null);
        setStrategyLoading(false);
        return false;
      }
    } catch (error) {
      console.error(`[useRouletteData] Erro ao extrair estratégia: ${error}`);
      setStrategyLoading(false);
      return false;
    }
  }, [roletaId, roletaNome]);
  
  // useEffect para inicialização - SIMPLIFICADO, REMOVIDO POLLING
  useEffect(() => {
    let isActive = true;
    
    // Função para carregar dados uma única vez
    const loadInitialData = async () => {
      if (!isActive) return;
      
      try {
        await loadNumbers();
        await loadStrategy();
      } catch (error) {
        console.error('[useRouletteData] Erro ao carregar dados iniciais:', error);
      }
    };
    
    // Carregar dados apenas uma vez na inicialização
    loadInitialData();
    
    // Cleanup
    return () => {
      isActive = false;
    };
  }, [loadNumbers, loadStrategy]);
  
  // ===== EVENTOS E WEBSOCKETS =====
  
  // Processar novos números recebidos via WebSocket
  const handleNewNumber = useCallback((event: RouletteNumberEvent) => {
    if (event.type !== 'new_number') return;
    
    // 1. EXTRAÇÃO: Obter número do evento
    const numeroRaw = event.numero;
    const numeroFormatado = typeof numeroRaw === 'string' ? parseInt(numeroRaw, 10) : numeroRaw;
    
    debugLog(`[useRouletteData] Número recebido via evento para ${roletaNome}: ${numeroFormatado}`);
    
    // 2. PROCESSAMENTO: Atualizar estado com o novo número
    setNumbers(prev => {
      // Verificar se o número já existe
      const isDuplicate = prev.some(num => 
        num.numero === numeroFormatado && 
        num.timestamp === event.timestamp
      );
      
      if (isDuplicate) return prev;
      
      // Processar o novo número
      const newNumber = processRouletteNumber(numeroFormatado, event.timestamp);
      
      // Adicionar ao início da lista e manter o limite
      const updatedNumbers = [newNumber, ...prev].slice(0, limit);
      return updatedNumbers;
    });
    
    // Atualizar estado de conexão e dados
    setHasData(true);
    setIsConnected(true);
  }, [roletaNome, limit]);
  
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