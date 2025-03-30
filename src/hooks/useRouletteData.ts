import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchRouletteLatestNumbers, fetchRouletteStrategy } from '@/integrations/api/rouletteService';
import EventService from '@/services/EventService';
import SocketService from '@/services/SocketService';
import { toast } from '@/components/ui/use-toast';

// Debug flag - set to true para facilitar depuração durante desenvolvimento
const DEBUG_ENABLED = true;

// Helper function for controlled logging
const debugLog = (...args: any[]) => {
  if (DEBUG_ENABLED) {
    console.log(...args);
  }
};

export interface RouletteNumberData {
  numero: number;
  cor: string;
  timestamp: string;
}

export interface RouletteStrategyData {
  estado: string;
  numero_gatilho: number;
  terminais_gatilho: number[];
  vitorias: number;
  derrotas: number;
  sugestao_display: string;
}

export interface UseRouletteDataResult {
  lastNumbers: number[];
  numbers: RouletteNumberData[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  hasData: boolean;
  strategy: RouletteStrategyData | null;
  strategyLoading: boolean;
  refreshNumbers: () => Promise<boolean>;
}

// Função para determinar a cor do número da roleta
const getNumberColor = (numero: number): string => {
  if (numero === 0) return 'verde';
  const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return numerosVermelhos.includes(numero) ? 'vermelho' : 'preto';
};

// Hook para buscar e gerenciar dados de uma roleta específica
export function useRouletteData(
  roletaId: string,
  roletaNome: string
): UseRouletteDataResult {
  // Estados para armazenar dados da roleta
  const [lastNumbers, setLastNumbers] = useState<number[]>([]);
  const [numbers, setNumbers] = useState<RouletteNumberData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [hasData, setHasData] = useState<boolean>(false);
  const [strategy, setStrategy] = useState<RouletteStrategyData | null>(null);
  const [strategyLoading, setStrategyLoading] = useState<boolean>(true);
  const [retryCount, setRetryCount] = useState<number>(0);
  
  // Referências para evitar efeitos colaterais nos useEffects
  const lastNumbersRef = useRef<number[]>([]);
  const eventServiceRef = useRef<EventService | null>(null);
  const socketServiceRef = useRef<SocketService | null>(null);
  const roletaIdRef = useRef<string>(roletaId);
  const roletaNomeRef = useRef<string>(roletaNome);
  
  // Inicializar serviços uma vez
  useEffect(() => {
    eventServiceRef.current = EventService.getInstance();
    socketServiceRef.current = SocketService.getInstance();
    roletaIdRef.current = roletaId;
    roletaNomeRef.current = roletaNome;
  }, [roletaId, roletaNome]);
  
  // Função para carregar os últimos números da roleta
  const loadRouletteNumbers = useCallback(async () => {
    try {
      if (!roletaId) {
        debugLog(`[useRouletteData] ID de roleta inválido: ${roletaId}`);
        setError('ID de roleta inválido');
        setLoading(false);
        return false;
      }
      
      debugLog(`[useRouletteData] Buscando números para ${roletaNome} (ID: ${roletaId})`);
      setLoading(true);
      
      // Forçar um limite maior para garantir que tenhamos dados suficientes
      const numbersData = await fetchRouletteLatestNumbers(roletaId, 20);
      
      if (numbersData && numbersData.length > 0) {
        // Formatar os números com cores e timestamps
        const formattedNumbers: RouletteNumberData[] = numbersData.map((num, index) => ({
          numero: num,
          cor: getNumberColor(num),
          timestamp: new Date(Date.now() - index * 60000).toISOString() // Timestamp aproximado para fins de visualização
        }));
        
        setNumbers(formattedNumbers);
        setLastNumbers(numbersData);
        lastNumbersRef.current = numbersData;
        setHasData(true);
        setError(null);
        debugLog(`[useRouletteData] Carregados ${formattedNumbers.length} números iniciais para ${roletaNome}`);
        setLoading(false);
        return true;
      } else if (retryCount < 3) {
        // Se não tivermos dados e ainda não tentamos muitas vezes, tentar novamente
        debugLog(`[useRouletteData] Gerando dados de fallback para ${roletaNome} após ${retryCount} tentativas`);
        setRetryCount(prev => prev + 1);
        // Tentar novamente após um breve delay
        setTimeout(() => loadRouletteNumbers(), 2000);
        return false;
      } else {
        setHasData(false);
        setLoading(false);
        setError('Sem dados disponíveis para esta roleta.');
        return false;
      }
    } catch (err: any) {
      console.error(`[useRouletteData] Erro ao carregar dados iniciais: ${err.message}`);
      setError(`Erro ao carregar dados: ${err.message}`);
      setLoading(false);
      setHasData(false);
      
      debugLog(`[useRouletteData] Gerando dados de fallback após erro para ${roletaNome}`);
      return false;
    }
  }, [roletaId, roletaNome, retryCount]);
  
  // Função para processar um novo número recebido via evento
  const processNewNumber = useCallback((numero: number) => {
    if (!numero) return;
    
    // Verificar se o número já está no topo da lista para evitar duplicação
    if (lastNumbersRef.current.length > 0 && lastNumbersRef.current[0] === numero) {
      return;
    }
    
    debugLog(`[useRouletteData] Número recebido via evento para ${roletaNome}: ${numero}`);
    
    const newNumber: RouletteNumberData = {
      numero,
      cor: getNumberColor(numero),
      timestamp: new Date().toISOString()
    };
    
    // Atualizar os arrays de números
    const updatedLastNumbers = [numero, ...lastNumbersRef.current.slice(0, 19)];
    const updatedNumbers = [newNumber, ...numbers.slice(0, 19)];
    
    setNumbers(updatedNumbers);
    setLastNumbers(updatedLastNumbers);
    lastNumbersRef.current = updatedLastNumbers;
    setHasData(true);
    
    // Notificar o usuário sobre o novo número com toast
    toast({
      title: `Novo número: ${roletaNome}`,
      description: `Número ${numero} (${getNumberColor(numero)})`,
      variant: "default",
      duration: 3000
    });
  }, [numbers, roletaNome]);
  
  // Função para atualizar os números manualmente
  const refreshNumbers = useCallback(async (): Promise<boolean> => {
    try {
      debugLog(`[useRouletteData] Atualizando números em segundo plano para ${roletaNome}`);
      const success = await loadRouletteNumbers();
      
      // Também atualizar a estratégia
      await loadRouletteStrategy();
      
      return success;
    } catch (error: any) {
      debugLog(`[useRouletteData] Erro ao atualizar números: ${error.message}`);
      return false;
    }
  }, [loadRouletteNumbers, roletaNome]);
  
  // Função para carregar a estratégia atual
  const loadRouletteStrategy = useCallback(async () => {
    if (!roletaId) return;
    
    try {
      setStrategyLoading(true);
      const strategyData = await fetchRouletteStrategy(roletaId);
      
      if (strategyData) {
        setStrategy(strategyData);
        debugLog(`[useRouletteData] Estado da estratégia carregado para ${roletaNome}`);
      } else {
        debugLog(`[useRouletteData] Nenhum dado de estratégia encontrado para ${roletaNome}`);
        setStrategy(null);
      }
    } catch (err: any) {
      console.error(`[useRouletteData] Erro ao carregar estratégia: ${err.message}`);
    } finally {
      setStrategyLoading(false);
    }
  }, [roletaId, roletaNome]);
  
  // Efeito para carregar dados iniciais
  useEffect(() => {
    loadRouletteNumbers();
    loadRouletteStrategy();
  }, [loadRouletteNumbers, loadRouletteStrategy]);
  
  // Efeito para se inscrever em eventos de novos números e atualizações de estratégia
  useEffect(() => {
    if (!eventServiceRef.current || !socketServiceRef.current) return;
    
    const eventService = eventServiceRef.current;
    const socketService = socketServiceRef.current;
    
    // Função para processar eventos
    const handleRouletteEvent = (event: any) => {
      if (!event) return;
      
      if (event.type === 'new_number' && 
          (event.roleta_id === roletaId || event.roleta_nome === roletaNome)) {
        processNewNumber(event.numero);
      } else if (event.type === 'strategy_update' && 
                (event.roleta_id === roletaId || event.roleta_nome === roletaNome)) {
        // Atualizar a estratégia quando receber um evento correspondente
        const strategyData: RouletteStrategyData = {
          estado: event.estado || 'NEUTRAL',
          numero_gatilho: event.numero_gatilho || 0,
          terminais_gatilho: event.terminais_gatilho || [],
          vitorias: event.vitorias || 0,
          derrotas: event.derrotas || 0,
          sugestao_display: event.sugestao_display || ''
        };
        
        setStrategy(strategyData);
        debugLog(`[useRouletteData] Estratégia atualizada para ${roletaNome} via evento`);
      }
    };
    
    // Inscrever-se para eventos da roleta específica
    debugLog(`[useRouletteData] Inscrevendo para eventos da roleta: ${roletaNome}`);
    eventService.subscribe(roletaNome, handleRouletteEvent as any);
    eventService.subscribe('*', handleRouletteEvent as any);
    socketService.subscribe(roletaNome, handleRouletteEvent);
    socketService.subscribe('global_strategy_updates', handleRouletteEvent);
    
    // Verificar status da conexão
    const isSocketConnected = socketService.isSocketConnected();
    debugLog(`[useRouletteData] Status da conexão Socket.IO: ${isSocketConnected ? 'Conectado' : 'Desconectado'}`);
    setIsConnected(isSocketConnected);
    
    // Ouvir mudanças no status da conexão
    const connectionStatusListener = () => {
      const currentStatus = socketService.isSocketConnected();
      debugLog(`[useRouletteData] Mudança no status da conexão: ${currentStatus}`);
      setIsConnected(currentStatus);
      
      // Se ficarmos conectados novamente mas não temos dados, tentar recarregar
      if (currentStatus && !hasData) {
        debugLog(`[useRouletteData] Conectado mas sem dados, tentando refresh para ${roletaNome}`);
        refreshNumbers();
      }
    };
    
    socketService.onConnectionStatusChange(connectionStatusListener);
    
    // Limpar inscrições ao desmontar
    return () => {
      debugLog(`[useRouletteData] Removendo inscrição para eventos da roleta: ${roletaNome}`);
      eventService.unsubscribe(roletaNome, handleRouletteEvent as any);
      eventService.unsubscribe('*', handleRouletteEvent as any);
      socketService.unsubscribe(roletaNome, handleRouletteEvent);
      socketService.unsubscribe('global_strategy_updates', handleRouletteEvent);
      socketService.offConnectionStatusChange(connectionStatusListener);
    };
  }, [roletaId, roletaNome, processNewNumber, refreshNumbers, hasData]);
  
  // Retornar os dados e funções para o componente
  return {
    lastNumbers,
    numbers,
    loading,
    error,
    isConnected,
    hasData,
    strategy,
    strategyLoading,
    refreshNumbers
  };
}