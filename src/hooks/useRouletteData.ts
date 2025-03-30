import { useState, useEffect, useRef, useCallback } from 'react';
import EventService, { StrategyUpdateEvent } from '@/services/EventService';
import SocketService from '@/services/SocketService';
import { v4 as uuidv4 } from 'uuid';

// Enable logs for debugging
const DEBUG_ENABLED = true;

// Controlled logging function
const debugLog = (...args: any[]) => {
  if (DEBUG_ENABLED) {
    console.log(...args);
  }
};

// Interface para um número de roleta
export interface RouletteNumber {
  id: string;
  roleta_id: string;
  numero: number;
  timestamp: number;
  cor?: string;
}

// Interface para o estado de estratégia da roleta
export interface RouletteStrategy {
  estado: string;
  estado_display: string;
  terminais_gatilho: number[];
  vitorias: number;
  derrotas: number;
}

// Interface para o retorno do hook
export interface UseRouletteDataResult {
  numbers: RouletteNumber[];
  loading: boolean;
  error: Error | null;
  isConnected: boolean;
  hasData: boolean;
  refreshNumbers: () => Promise<void>;
  strategy: RouletteStrategy | null;
  strategyLoading: boolean;
}

// Função para gerar dados fictícios quando não há conexão
const generateFallbackNumbers = (roletaId: string, count: number = 20): RouletteNumber[] => {
  const numbers: RouletteNumber[] = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    // Gerar um número aleatório entre 0 e 36
    const numero = Math.floor(Math.random() * 37);
    
    // Determinar a cor
    let cor = 'green';
    if (numero > 0) {
      cor = numero % 2 === 0 ? 'black' : 'red';
    }
    
    // Adicionar o número
    numbers.push({
      id: uuidv4(),
      roleta_id: roletaId,
      numero,
      // Os números mais antigos têm timestamps menores
      timestamp: now - (count - i) * 30000, // 30 segundos entre cada número
      cor
    });
  }
  
  return numbers;
};

/**
 * Hook para obter e gerenciar dados em tempo real de uma roleta específica
 */
export function useRouletteData(
  roletaId: string,
  roletaNome: string
): UseRouletteDataResult {
  // Estado para os números da roleta
  const [numbers, setNumbers] = useState<RouletteNumber[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasData, setHasData] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // Estado para a estratégia
  const [strategy, setStrategy] = useState<RouletteStrategy | null>(null);
  const [strategyLoading, setStrategyLoading] = useState<boolean>(true);
  
  // Referências para event listeners para limpeza adequada
  const eventListenersRef = useRef<string[]>([]);
  const socketListenersRef = useRef<string[]>([]);
  
  // Verificar se temos um ID de roleta válido
  if (!roletaId) {
    debugLog(`[useRouletteData] ID de roleta inválido: ${roletaId}`);
    throw new Error('ID de roleta é obrigatório');
  }
  
  // Função para buscar números iniciais
  const fetchInitialNumbers = useCallback(async () => {
    if (!roletaId) return;
    
    debugLog(`[useRouletteData] Buscando números para ${roletaNome} (ID: ${roletaId})`);
    setLoading(true);
    
    try {
      // Tentar obter do backend
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
      const response = await fetch(`${apiUrl}/api/numbers/${roletaId}`);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar números: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 0) {
        // Formatar os dados recebidos
        const formattedNumbers = data.map((num: any) => ({
          id: num.id || uuidv4(),
          roleta_id: roletaId,
          numero: num.numero,
          timestamp: num.timestamp || Date.now(),
          cor: num.cor || getColorForNumber(num.numero)
        }));
        
        // Ordenar por timestamp (mais recente primeiro)
        formattedNumbers.sort((a, b) => b.timestamp - a.timestamp);
        
        debugLog(`[useRouletteData] Carregados ${formattedNumbers.length} números iniciais para ${roletaNome}`);
        setNumbers(formattedNumbers);
        setHasData(true);
      } else if (retryCount < 2) {
        // Tentar novamente após um curto atraso (max 2 tentativas)
        debugLog(`[useRouletteData] Gerando dados de fallback para ${roletaNome} após ${retryCount} tentativas`);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchInitialNumbers();
        }, 1000);
      } else {
        // Usar dados gerados aleatoriamente como fallback
        const fallbackNumbers = generateFallbackNumbers(roletaId);
        setNumbers(fallbackNumbers);
        setHasData(true);
      }
    } catch (err: any) {
      console.error(`[useRouletteData] Erro ao carregar dados iniciais: ${err.message}`);
      
      // Gerar dados fictícios em caso de erro
      debugLog(`[useRouletteData] Gerando dados de fallback após erro para ${roletaNome}`);
      const fallbackNumbers = generateFallbackNumbers(roletaId);
      setNumbers(fallbackNumbers);
      setHasData(true);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [roletaId, roletaNome, retryCount]);
  
  // Função para lidar com novos números recebidos
  const handleNewNumber = useCallback((eventData: any) => {
    debugLog(`[useRouletteData] Número recebido via evento para ${roletaNome}: ${eventData.numero}`);
    
    if (eventData.roleta_id !== roletaId) {
      return; // Ignorar eventos de outras roletas
    }
    
    // Verificar se já temos esse número
    setNumbers(prevNumbers => {
      // Verificar se o número já existe com base no timestamp
      const exists = prevNumbers.some(
        n => n.numero === eventData.numero && 
             Math.abs(n.timestamp - eventData.timestamp) < 1000
      );
      
      if (exists) {
        return prevNumbers; // Nenhuma alteração se o número já existe
      }
      
      // Adicionar o novo número formatado
      const newNumber: RouletteNumber = {
        id: eventData.id || uuidv4(),
        roleta_id: eventData.roleta_id,
        numero: eventData.numero,
        timestamp: eventData.timestamp || Date.now(),
        cor: eventData.cor || getColorForNumber(eventData.numero)
      };
      
      // Retornar nova lista ordenada (mais recentes primeiro)
      return [newNumber, ...prevNumbers].sort((a, b) => b.timestamp - a.timestamp);
    });
    
    setHasData(true);
  }, [roletaId, roletaNome]);
  
  // Função para atualizar números manualmente (refresh)
  const refreshNumbers = useCallback(async () => {
    debugLog(`[useRouletteData] Atualizando números em segundo plano para ${roletaNome}`);
    
    try {
      // Buscar dados atualizados sem alterar estado de loading
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
      const response = await fetch(`${apiUrl}/api/numbers/${roletaId}`);
      
      if (!response.ok) {
        throw new Error(`Erro ao atualizar números: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 0) {
        // Processo igual ao fetchInitialNumbers
        const formattedNumbers = data.map((num: any) => ({
          id: num.id || uuidv4(),
          roleta_id: roletaId,
          numero: num.numero,
          timestamp: num.timestamp || Date.now(),
          cor: num.cor || getColorForNumber(num.numero)
        }));
        
        formattedNumbers.sort((a, b) => b.timestamp - a.timestamp);
        
        setNumbers(formattedNumbers);
        setHasData(true);
      }
    } catch (error: any) {
      debugLog(`[useRouletteData] Erro ao atualizar números: ${error.message}`);
      // Não alterar o estado em caso de erro durante refresh
    }
  }, [roletaId, roletaNome]);
  
  // Função para buscar o estado atual da estratégia
  const fetchStrategyData = useCallback(async () => {
    try {
      const eventService = EventService.getInstance();
      const strategyData = await eventService.fetchCurrentStrategy(roletaId);
      
      if (strategyData) {
        debugLog(`[useRouletteData] Estado da estratégia carregado para ${roletaNome}`);
        setStrategy(strategyData);
      } else {
        debugLog(`[useRouletteData] Nenhum dado de estratégia encontrado para ${roletaNome}`);
        setStrategy(null);
      }
    } catch (err: any) {
      console.error(`[useRouletteData] Erro ao carregar estratégia: ${err.message}`);
      setStrategy(null);
    } finally {
      setStrategyLoading(false);
    }
  }, [roletaId, roletaNome]);
  
  // Função para lidar com atualizações de estratégia
  const handleStrategyUpdate = useCallback((strategyEvent: StrategyUpdateEvent) => {
    // Verificar se é para a roleta correta
    if (strategyEvent.roleta_id !== roletaId) {
      return;
    }
    
    // Atualizar o estado da estratégia
    setStrategy({
      estado: strategyEvent.estado,
      estado_display: strategyEvent.estado_display,
      terminais_gatilho: strategyEvent.terminais_gatilho,
      vitorias: strategyEvent.vitorias,
      derrotas: strategyEvent.derrotas
    });
    
    debugLog(`[useRouletteData] Estratégia atualizada para ${roletaNome} via evento`);
    
    // Log para debug
    console.log(`[useRouletteData] Evento de estratégia recebido:`, {
      estado: strategyEvent.estado,
      estrategia_display: strategyEvent.estado_display,
      terminais: strategyEvent.terminais_gatilho,
      vitorias: strategyEvent.vitorias,
      derrotas: strategyEvent.derrotas
    });
  }, [roletaId, roletaNome]);
  
  // Função para lidar com novos números via socket
  const handleSocketNumber = useCallback((socketData: any) => {
    // Verificar se é para a roleta correta
    if (socketData.roleta_id !== roletaId) {
      return;
    }
    
    const numero = parseInt(socketData.numero);
    if (isNaN(numero)) return;
    
    debugLog(`[useRouletteData] Novo número via socket para ${roletaNome}: ${numero}`);
    
    // Criar evento no formato esperado e passá-lo para o handler
    handleNewNumber({
      roleta_id: roletaId,
      numero,
      timestamp: socketData.timestamp || Date.now()
    });
  }, [roletaId, roletaNome, handleNewNumber]);
  
  // Configurar event listeners
  useEffect(() => {
    debugLog(`[useRouletteData] Inscrevendo para eventos da roleta: ${roletaNome}`);
    
    // Obter instâncias dos serviços
    const eventService = EventService.getInstance();
    const socketService = SocketService.getInstance();
    const isSocketConnected = socketService.isSocketConnected();
    
    // Inscrever-se no evento de novo número específico para essa roleta
    const numeroEventId = eventService.subscribe(
      'roleta.numero.novo',
      handleNewNumber,
      roletaId
    );
    
    // Inscrever-se no evento de atualização de estratégia específico para essa roleta
    const strategyEventId = eventService.subscribe(
      'roleta.estrategia',
      handleStrategyUpdate,
      roletaId
    );
    
    // Salvar IDs dos listeners para limpeza
    eventListenersRef.current = [numeroEventId, strategyEventId];
    
    // Iniciar busca de dados iniciais
    fetchInitialNumbers();
    fetchStrategyData();
    
    // Verificar se o Socket.IO está conectado
    debugLog(`[useRouletteData] Status da conexão Socket.IO: ${isSocketConnected ? 'Conectado' : 'Desconectado'}`);
    setIsConnected(isSocketConnected);
    
    // Inscrever-se em eventos de conexão do Socket.IO
    const connectionEventId = socketService.on('connect', () => {
      debugLog('[useRouletteData] Socket.IO conectado');
      setIsConnected(true);
    });
    
    const disconnectionEventId = socketService.on('disconnect', () => {
      debugLog('[useRouletteData] Socket.IO desconectado');
      setIsConnected(false);
    });
    
    const statusChangeEventId = socketService.on('status_change', (status: string) => {
      const currentStatus = status === 'connected';
      debugLog(`[useRouletteData] Mudança no status da conexão: ${currentStatus}`);
      setIsConnected(currentStatus);
      
      // Se reconectado, atualizar dados
      if (currentStatus) {
        debugLog(`[useRouletteData] Reconectado, solicitando dados para ${roletaNome}`);
        refreshNumbers();
        fetchStrategyData();
      }
    });
    
    // Salvar IDs dos listeners de socket para limpeza
    socketListenersRef.current = [
      connectionEventId,
      disconnectionEventId,
      statusChangeEventId
    ];
    
    // Limpar event listeners ao desmontar
    return () => {
      debugLog(`[useRouletteData] Removendo inscrição para eventos da roleta: ${roletaNome}`);
      
      // Limpar listeners do EventService
      eventListenersRef.current.forEach(id => {
        eventService.unsubscribe(id);
      });
      
      // Limpar listeners do SocketService
      socketListenersRef.current.forEach(id => {
        socketService.off(id);
      });
    };
  }, [
    roletaId,
    roletaNome,
    handleNewNumber,
    handleStrategyUpdate,
    handleSocketNumber,
    fetchInitialNumbers,
    fetchStrategyData,
    refreshNumbers
  ]);
  
  // Retornar os dados e funções
  return {
    numbers,
    loading,
    error,
    isConnected,
    hasData,
    refreshNumbers,
    strategy,
    strategyLoading
  };
}

// Função auxiliar para determinar a cor com base no número
function getColorForNumber(numero: number): string {
  if (numero === 0) return 'green';
  return numero % 2 === 0 ? 'black' : 'red';
}