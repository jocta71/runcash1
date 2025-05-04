import { useState, useEffect, useCallback, useRef } from 'react';
import { connectToRouletteStream, connectToAllRoulettesStream } from '../services/api/streamingApi';

// Tipos
interface RouletteData {
  roulette?: any;
  roulettes?: any[];
  numbers?: any[];
  type?: string;
  timestamp?: string;
  // Campos adicionais para informações de limite baseado no plano
  totalCount?: number;
  availableCount?: number;
  limited?: boolean;
  userPlan?: string;
  changeType?: string;
}

interface StreamOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
}

/**
 * Hook para uso da API de streaming de roletas
 * @param rouletteId ID da roleta (undefined para todas as roletas)
 * @param options Opções adicionais
 * @returns Dados e funções para interagir com o stream de roletas
 */
export function useRouletteStream(rouletteId?: string, options: StreamOptions = {}) {
  // Estado para armazenar dados recebidos
  const [data, setData] = useState<RouletteData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Referência para o serviço de streaming
  const streamingServiceRef = useRef<any>(null);
  
  // Função para processar dados iniciais recebidos
  const handleInitialData = useCallback((initialData: any) => {
    console.log('[RouletteStream] Received initial data:', initialData);
    setData(initialData);
    setIsLoading(false);
  }, []);
  
  // Função para processar atualizações
  const handleUpdate = useCallback((updateData: any) => {
    console.log('[RouletteStream] Received update:', updateData);
    setData(prevData => ({
      ...prevData,
      ...updateData,
      timestamp: updateData.timestamp
    }));
  }, []);
  
  // Função para processar erros
  const handleError = useCallback((err: any) => {
    console.error('[RouletteStream] Error:', err);
    setError(err instanceof Error ? err : new Error(err?.message || 'Unknown error'));
    if (options.onError) {
      options.onError(err);
    }
  }, [options]);
  
  // Função para reconectar manualmente
  const reconnect = useCallback(() => {
    // Limpar referência existente
    if (streamingServiceRef.current) {
      streamingServiceRef.current.disconnect();
      streamingServiceRef.current = null;
    }
    
    setIsLoading(true);
    setError(null);
    
    // Criar nova conexão
    if (rouletteId) {
      streamingServiceRef.current = connectToRouletteStream(rouletteId, {
        onInitial: handleInitialData,
        onUpdate: handleUpdate,
        onError: handleError,
        onConnect: () => {
          setIsConnected(true);
          if (options.onConnect) options.onConnect();
        },
        onDisconnect: () => {
          setIsConnected(false);
          if (options.onDisconnect) options.onDisconnect();
        }
      });
    } else {
      streamingServiceRef.current = connectToAllRoulettesStream({
        onInitial: handleInitialData,
        onUpdate: handleUpdate,
        onError: handleError,
        onConnect: () => {
          setIsConnected(true);
          if (options.onConnect) options.onConnect();
        },
        onDisconnect: () => {
          setIsConnected(false);
          if (options.onDisconnect) options.onDisconnect();
        }
      });
    }
  }, [rouletteId, handleInitialData, handleUpdate, handleError, options]);
  
  // Iniciar conexão quando o componente montar
  useEffect(() => {
    reconnect();
    
    // Limpar quando o componente desmontar
    return () => {
      if (streamingServiceRef.current) {
        streamingServiceRef.current.disconnect();
      }
    };
  }, [reconnect]);
  
  // Função para desconectar manualmente
  const disconnect = useCallback(() => {
    if (streamingServiceRef.current) {
      streamingServiceRef.current.disconnect();
      streamingServiceRef.current = null;
    }
    setIsConnected(false);
  }, []);
  
  return {
    data,
    isConnected,
    isLoading,
    error,
    reconnect,
    disconnect
  };
} 