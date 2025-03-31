import { useState, useEffect, useCallback, useRef } from 'react';
import SocketService from '@/services/SocketService';
import { RouletteNumberEvent } from '@/services/EventService';
import EventService from '@/services/EventService';
import { fetchRouletteLatestNumbers, fetchRouletteStrategy, RouletteStrategy as ApiRouletteStrategy } from '@/integrations/api/rouletteService';
import { toast } from '@/components/ui/use-toast';

// Debug flag - set to true para facilitar depuração durante desenvolvimento
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
 * Função auxiliar para determinar a cor de um número da roleta
 */
const determinarCorNumero = (numero: number): string => {
  if (numero === 0) return 'verde';
  
  // Números vermelhos na roleta europeia
  const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return numerosVermelhos.includes(numero) ? 'vermelho' : 'preto';
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
  const [numbers, setNumbers] = useState<RouletteNumber[]>([]);
  const [loading, setLoading] = useState<boolean>(true); // Only for initial loading
  const [refreshLoading, setRefreshLoading] = useState<boolean>(false); // For refresh operations
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [hasData, setHasData] = useState<boolean>(false);
  const [strategy, setStrategy] = useState<RouletteStrategy | null>(null);
  const [strategyLoading, setStrategyLoading] = useState<boolean>(true);
  const [retryCount, setRetryCount] = useState<number>(0);
  const maxRetries = 3;
  const initialLoadCompleted = useRef<boolean>(false);
  
  // Carregar números iniciais da API - Somente na montagem inicial
  useEffect(() => {
    // Só carregamos dados iniciais uma vez
    if (initialLoadCompleted.current) return;
    
    const loadInitialData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!roletaId) {
          debugLog(`[useRouletteData] ID de roleta inválido: ${roletaId}`);
          setLoading(false);
          setHasData(false);
          return;
        }
        
        debugLog(`[useRouletteData] Buscando números para ${roletaNome} (ID: ${roletaId})`);
        const numerosArray = await fetchRouletteLatestNumbers(roletaId, limit);
        
        if (numerosArray && Array.isArray(numerosArray) && numerosArray.length > 0) {
          const formattedNumbers: RouletteNumber[] = numerosArray.map((numero, index) => {
            const now = new Date();
            const timestamp = new Date(now.getTime() - (index * 60000)).toISOString();
            
            return {
              numero,
              cor: determinarCorNumero(numero),
              timestamp
            };
          });
          
          setNumbers(formattedNumbers);
          setHasData(true);
          setRetryCount(0);
          initialLoadCompleted.current = true;
          debugLog(`[useRouletteData] Carregados ${formattedNumbers.length} números iniciais para ${roletaNome}`);
        } else {
          // Não usar dados de fallback, apenas indicar que não há dados
          setHasData(false);
          setRetryCount(prev => prev + 1);
          
          if (retryCount >= maxRetries) {
            debugLog(`[useRouletteData] Sem dados disponíveis após ${retryCount} tentativas para ${roletaNome}`);
            initialLoadCompleted.current = true;
          }
        }
      } catch (err: any) {
        console.error(`[useRouletteData] Erro ao carregar dados iniciais: ${err.message}`);
        setError(`Erro ao carregar dados: ${err.message}`);
        setHasData(false);
        
        if (retryCount >= maxRetries) {
          debugLog(`[useRouletteData] Máximo de tentativas atingido para ${roletaNome}`);
          initialLoadCompleted.current = true;
        } else {
          setRetryCount(prev => prev + 1);
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, [roletaId, roletaNome, limit, retryCount, maxRetries]);
  
  // Handler para novos números - Adiciona sem recarregar tudo
  const handleNewNumber = useCallback((event: RouletteNumberEvent) => {
    if (event.type !== 'new_number') return;
    
    const numero = typeof event.numero === 'string' ? parseInt(event.numero, 10) : event.numero;
    debugLog(`[useRouletteData] Número recebido via evento para ${roletaNome}: ${numero}`);
    
    setNumbers(prev => {
      const isDuplicate = prev.some(num => 
        num.numero === numero && 
        num.timestamp === event.timestamp
      );
      
      if (isDuplicate) {
        return prev;
      }
      
      const newNumber: RouletteNumber = {
        numero,
        cor: determinarCorNumero(numero),
        timestamp: event.timestamp || new Date().toISOString()
      };
      
      // Adicionar ao topo sem recarregar toda a lista
      const updatedNumbers = [newNumber, ...prev].slice(0, limit);
      return updatedNumbers;
    });
    
    setHasData(true);
    setIsConnected(true);
  }, [roletaNome, limit]);
  
  // Função para atualizar manualmente os números - Não afeta o estado de loading principal
  const refreshNumbers = useCallback(async () => {
    debugLog(`[useRouletteData] Atualizando números em segundo plano para ${roletaNome}`);
    setRefreshLoading(true);
    
    try {
      const latestNumbers = await fetchRouletteLatestNumbers(roletaId, limit);
      
      if (latestNumbers && latestNumbers.length > 0) {
        const formattedNumbers: RouletteNumber[] = latestNumbers.map((numero, index) => {
          // Usar timestamps relativos baseados no índice (mais recente primeiro)
          const now = new Date();
          const timestamp = new Date(now.getTime() - (index * 60000)).toISOString();
          
          return {
            numero,
            cor: determinarCorNumero(numero),
            timestamp
          };
        });
        
        // Atualizar sem disparar loading UI
        setNumbers(formattedNumbers);
        setHasData(true);
        return true;
      }
      return false;
    } catch (error: any) {
      debugLog(`[useRouletteData] Erro ao atualizar números: ${error.message}`);
      return false;
    } finally {
      setRefreshLoading(false);
    }
  }, [roletaId, roletaNome, limit]);
  
  // Função para buscar e atualizar a estratégia
  const fetchAndUpdateStrategy = useCallback(async () => {
    if (!roletaId) return false;
    
    setStrategyLoading(true);
    
    try {
      debugLog(`[useRouletteData] Buscando estratégia para ${roletaNome}...`);
      const strategyData = await fetchRouletteStrategy(roletaId);
      
      if (strategyData) {
        debugLog(`[useRouletteData] Estratégia obtida para ${roletaNome}:`, {
          estado: strategyData.estado,
          vitorias: strategyData.vitorias,
          derrotas: strategyData.derrotas
        });
        
        setStrategy(strategyData);
        setStrategyLoading(false);
        return true;
      } else {
        debugLog(`[useRouletteData] Nenhuma estratégia encontrada para ${roletaNome}`);
        // Definir estado para indicar que não temos dados, em vez de usar valores simulados
        setStrategy(null);
        setStrategyLoading(false);
        return false;
      }
    } catch (error) {
      console.error(`[useRouletteData] Erro ao buscar estratégia: ${error}`);
      setStrategyLoading(false);
      return false;
    }
  }, [roletaId, roletaNome]);
  
  // Subscrever para eventos da roleta e configurar atualização periódica
  useEffect(() => {
    const socketService = SocketService.getInstance();
    
    // Subscrever para eventos
    debugLog(`[useRouletteData] Inscrevendo para eventos da roleta: ${roletaNome}`);
    socketService.subscribe(roletaNome, handleNewNumber);
    
    // Atualizar status de conexão
    const isSocketConnected = socketService.isSocketConnected();
    debugLog(`[useRouletteData] Status da conexão Socket.IO: ${isSocketConnected ? 'Conectado' : 'Desconectado'}`);
    setIsConnected(isSocketConnected);
    
    // Solicitar dados iniciais de estratégia
    if (isSocketConnected && roletaId) {
      console.log(`[useRouletteData] Solicitando estratégia inicial para ${roletaNome}`);
      socketService.sendMessage({
        type: 'get_strategy',
        roleta_id: roletaId,
        roleta_nome: roletaNome
      });
    }
    
    // Configurar atualização periódica de estratégia
    const strategyUpdateInterval = setInterval(() => {
      if (socketService.isSocketConnected() && roletaId) {
        console.log(`[useRouletteData] Atualizando estratégia periodicamente para ${roletaNome}`);
        socketService.sendMessage({
          type: 'get_strategy',
          roleta_id: roletaId,
          roleta_nome: roletaNome,
          forceUpdate: true
        });
      }
    }, 30000); // Atualizar a cada 30 segundos
    
    // Função para verificar e atualizar status da conexão periodicamente
    const connectionCheckInterval = setInterval(() => {
      const currentStatus = socketService.isSocketConnected();
      if (currentStatus !== isConnected) {
        debugLog(`[useRouletteData] Mudança no status da conexão: ${currentStatus}`);
        setIsConnected(currentStatus);
      }
      
      // Se a conexão está OK mas não temos dados, tentar refresh
      if (currentStatus && !hasData && !loading) {
        debugLog(`[useRouletteData] Conectado mas sem dados, tentando refresh para ${roletaNome}`);
        refreshNumbers();
        
        // Também solicitar dados de estratégia
        socketService.sendMessage({
          type: 'get_strategy',
          roleta_id: roletaId,
          roleta_nome: roletaNome
        });
      }
    }, 10000);
    
    return () => {
      // Remover subscrição ao desmontar
      debugLog(`[useRouletteData] Removendo inscrição para eventos da roleta: ${roletaNome}`);
      socketService.unsubscribe(roletaNome, handleNewNumber);
      clearInterval(connectionCheckInterval);
      clearInterval(strategyUpdateInterval);
    };
  }, [roletaNome, roletaId, handleNewNumber, hasData, loading, isConnected]);

  // Função para atualizar manualmente a estratégia
  const refreshStrategy = useCallback(async () => {
    console.log(`[useRouletteData] Atualizando manualmente estratégia para ${roletaNome}`);
    
    try {
      const strategyData = await fetchRouletteStrategy(roletaId);
      if (strategyData) {
        console.log(`[useRouletteData] Estratégia atualizada para ${roletaNome}:`, {
          vitorias: strategyData.vitorias,
          derrotas: strategyData.derrotas,
          estado: strategyData.estado
        });
        setStrategy(strategyData);
        return true;
      }
      // Se não há dados, definir strategy como null para indicar ausência de dados
      setStrategy(null);
      return false;
    } catch (error) {
      console.error(`[useRouletteData] Erro ao atualizar estratégia: ${error}`);
      return false;
    }
  }, [roletaId, roletaNome]);
  
  // Eventos de atualização da estratégia
  useEffect(() => {
    const handleStrategyEvent = (event: any) => {
      // Verificar se é um evento para a roleta atual
      if (event.type === 'strategy_update' && 
          (event.roleta_id === roletaId || event.roleta_nome === roletaNome)) {
        
        console.log(`[useRouletteData] Recebido evento de estratégia para ${roletaNome}:`, {
          vitorias: event.vitorias,
          derrotas: event.derrotas,
          estado: event.estado
        });
        
        if (event.vitorias !== undefined || event.derrotas !== undefined) {
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
        }
      }
    };
    
    // Registrar o handler para eventos de estratégia
    const eventService = EventService.getInstance();
    eventService.subscribeToEvent('strategy_update', handleStrategyEvent);
    
    return () => {
      // Remover registro ao desmontar
      eventService.unsubscribeFromEvent('strategy_update', handleStrategyEvent);
    };
  }, [roletaId, roletaNome, strategy]);

  // Solicitar estratégia assim que obtiver os primeiros números
  useEffect(() => {
    if (numbers.length > 0 && !strategyLoading && !strategy) {
      console.log(`[useRouletteData] Números carregados, solicitando estratégia para ${roletaNome}`);
      fetchAndUpdateStrategy();
    }
  }, [numbers.length, strategyLoading, strategy, roletaNome, fetchAndUpdateStrategy]);
  
  return {
    numbers,
    loading, // This will only be true during initial loading
    error,
    isConnected,
    hasData,
    strategy,
    strategyLoading,
    refreshNumbers,
    refreshStrategy // Nova função para atualizar manualmente a estratégia
  };
}