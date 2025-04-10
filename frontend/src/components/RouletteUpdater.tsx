import React, { useState, useEffect, useRef } from 'react';
import * as rouletteRepository from '../services/data/rouletteRepository';
import { socketClient } from '../services/socket/socketClient';

interface RouletteUpdaterProps {
  onUpdate?: (roulettes: any[]) => void;
  refreshInterval?: number; // Intervalo de atualização em milissegundos
  limit?: number; // Limite de roletas a serem carregadas
}

/**
 * Componente que escuta dados da API e atualiza a UI conforme chegam novos dados
 */
const RouletteUpdater: React.FC<RouletteUpdaterProps> = ({
  onUpdate,
  refreshInterval = 30000, // 30 segundos por padrão
  limit = 100
}) => {
  const [roulettes, setRoulettes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  
  // Refs para armazenar handlers e controlar atualização
  const handlersRef = useRef<{
    newNumber: ((data: any) => void) | null;
    strategyUpdate: ((data: any) => void) | null;
    connect: (() => void) | null;
    disconnect: (() => void) | null;
  }>({
    newNumber: null,
    strategyUpdate: null,
    connect: null,
    disconnect: null
  });
  
  // Referência para o número de atualizações consecutivas falhas
  const failedUpdatesRef = useRef<number>(0);
  const MAX_FAILED_UPDATES = 3;
  
  // Função para carregar dados das roletas
  const loadRoulettesData = async () => {
    try {
      console.log('[RouletteUpdater] Carregando dados das roletas...');
      setLoading(true);
      
      // Buscar dados atualizados de todas as roletas
      const data = await rouletteRepository.fetchAllRoulettesWithNumbers();
      
      if (!data || data.length === 0) {
        console.warn('[RouletteUpdater] Nenhum dado recebido da API');
        failedUpdatesRef.current++;
        
        if (failedUpdatesRef.current >= MAX_FAILED_UPDATES) {
          console.error('[RouletteUpdater] Múltiplas falhas consecutivas na atualização');
          setError('Falha na atualização após múltiplas tentativas');
          
          // Forçar reconexão do socket
          socketClient.getInstance().forceReconnect();
        }
        return;
      }
      
      // Resetar contador de falhas se a requisição foi bem-sucedida
      failedUpdatesRef.current = 0;
      
      // Aplicar limite se definido
      const limitedData = limit ? data.slice(0, limit) : data;
      
      // Atualizar estado local
      setRoulettes(limitedData);
      setLastUpdateTime(new Date());
      setError(null);
      
      // Notificar componente pai se o callback estiver definido
      if (onUpdate) {
        onUpdate(limitedData);
      }
      
      console.log(`[RouletteUpdater] ✅ Dados atualizados: ${limitedData.length} roletas`);
    } catch (err) {
      failedUpdatesRef.current++;
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('[RouletteUpdater] Erro ao carregar dados:', err);
      setError(errorMsg);
      
      if (failedUpdatesRef.current >= MAX_FAILED_UPDATES) {
        // Forçar reconexão do socket após múltiplas falhas
        socketClient.getInstance().forceReconnect();
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Efeito para verificar status da conexão periodicamente
  useEffect(() => {
    const checkConnection = () => {
      const isConnected = socketClient.getInstance().isConnected();
      setSocketConnected(isConnected);
      
      if (!isConnected) {
        console.warn('[RouletteUpdater] Socket desconectado, tentando reconectar...');
        socketClient.getInstance().connect();
      }
    };
    
    // Verificar conexão imediatamente
    checkConnection();
    
    // Configurar verificação periódica
    const connectionCheckInterval = setInterval(checkConnection, 10000);
    
    return () => {
      clearInterval(connectionCheckInterval);
    };
  }, []);
  
  // Configurar escuta em tempo real para atualizações de roletas
  useEffect(() => {
    // Carregar dados iniciais
    loadRoulettesData();
    
    // Configurar atualização periódica como fallback
    const intervalId = setInterval(() => {
      console.log('[RouletteUpdater] Executando atualização periódica...');
      loadRoulettesData();
    }, refreshInterval);
    
    // Garantir que o socket esteja conectado
    socketClient.getInstance().connect();
    
    // Handler para conexão estabelecida
    const handleConnect = () => {
      console.log('[RouletteUpdater] Conexão WebSocket estabelecida');
      setSocketConnected(true);
      
      // Recarregar dados ao reconectar
      loadRoulettesData();
    };
    
    // Handler para desconexão
    const handleDisconnect = () => {
      console.log('[RouletteUpdater] Conexão WebSocket perdida');
      setSocketConnected(false);
    };
    
    // Configurar listener para novos números
    const handleNewNumber = (data: any) => {
      console.log('[RouletteUpdater] Novo número recebido:', data);
      
      // Atualizar imediatamente sem fazer nova requisição
      setRoulettes(prevRoulettes => {
        if (!prevRoulettes || prevRoulettes.length === 0) {
          console.warn('[RouletteUpdater] Lista de roletas vazia ao receber novo número');
          // Carregar todos os dados se a lista estiver vazia
          setTimeout(loadRoulettesData, 100);
          return prevRoulettes;
        }
        
        // Encontrar a roleta que precisa ser atualizada
        const updatedRoulettes = prevRoulettes.map(roulette => {
          // Verificar se é a roleta que recebeu o novo número
          if (roulette.id === data.roleta_id || roulette.uuid === data.roleta_id) {
            console.log(`[RouletteUpdater] Atualizando roleta: ${roulette.name}`);
            
            // Criar novo número no formato padronizado
            const newNumber = {
              number: data.numero || data.number,
              color: data.cor || data.color || 
                     (data.numero === 0 ? 'green' : 
                     [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(data.numero) ? 'red' : 'black'),
              timestamp: data.timestamp || new Date().toISOString()
            };
            
            // Adicionar novo número ao início da lista
            const updatedNumbers = [newNumber, ...(roulette.numbers || [])];
            
            // Retornar roleta atualizada
            return {
              ...roulette,
              numbers: updatedNumbers,
              numero: updatedNumbers.map(n => n.number) // Para compatibilidade
            };
          }
          
          // Retornar roleta sem alterações
          return roulette;
        });
        
        // Notificar componente pai se o callback estiver definido
        if (onUpdate) {
          onUpdate(updatedRoulettes);
        }
        
        // Atualizar timestamp da última atualização
        setLastUpdateTime(new Date());
        
        return updatedRoulettes;
      });
    };
    
    // Configurar listener para atualizações de estratégia
    const handleStrategyUpdate = (data: any) => {
      console.log('[RouletteUpdater] Atualização de estratégia recebida:', data);
      
      // Atualizar imediatamente sem fazer nova requisição
      setRoulettes(prevRoulettes => {
        if (!prevRoulettes || prevRoulettes.length === 0) {
          console.warn('[RouletteUpdater] Lista de roletas vazia ao receber atualização de estratégia');
          // Carregar todos os dados se a lista estiver vazia
          setTimeout(loadRoulettesData, 100);
          return prevRoulettes;
        }
        
        // Encontrar a roleta que precisa ser atualizada
        const updatedRoulettes = prevRoulettes.map(roulette => {
          // Verificar se é a roleta que recebeu a atualização de estratégia
          if (roulette.id === data.roleta_id || roulette.uuid === data.roleta_id) {
            console.log(`[RouletteUpdater] Atualizando estratégia para roleta: ${roulette.name}`);
            
            // Retornar roleta atualizada com novos dados de estratégia
            return {
              ...roulette,
              strategyState: data.estado || data.state || roulette.strategyState,
              wins: data.vitorias || data.wins || roulette.wins,
              losses: data.derrotas || data.losses || roulette.losses
            };
          }
          
          // Retornar roleta sem alterações
          return roulette;
        });
        
        // Notificar componente pai se o callback estiver definido
        if (onUpdate) {
          onUpdate(updatedRoulettes);
        }
        
        // Atualizar timestamp da última atualização
        setLastUpdateTime(new Date());
        
        return updatedRoulettes;
      });
    };
    
    // Salvar handlers na ref para poder removê-los depois
    handlersRef.current = {
      newNumber: handleNewNumber,
      strategyUpdate: handleStrategyUpdate,
      connect: handleConnect,
      disconnect: handleDisconnect
    };
    
    // Registrar listeners para eventos
    socketClient.getInstance().on('connect', handleConnect);
    socketClient.getInstance().on('disconnect', handleDisconnect);
    socketClient.getInstance().on('new_number', handleNewNumber);
    socketClient.getInstance().on('strategy_update', handleStrategyUpdate);
    
    // Limpar ao desmontar
    return () => {
      clearInterval(intervalId);
      
      // Remover todos os listeners
      if (handlersRef.current.connect) {
        socketClient.getInstance().removeListener('connect', handlersRef.current.connect);
      }
      
      if (handlersRef.current.disconnect) {
        socketClient.getInstance().removeListener('disconnect', handlersRef.current.disconnect);
      }
      
      if (handlersRef.current.newNumber) {
        socketClient.getInstance().removeListener('new_number', handlersRef.current.newNumber);
      }
      
      if (handlersRef.current.strategyUpdate) {
        socketClient.getInstance().removeListener('strategy_update', handlersRef.current.strategyUpdate);
      }
    };
  }, [onUpdate, refreshInterval, limit]);
  
  // Componente invisível - apenas lógica, sem renderização
  return (
    <div style={{ display: 'none' }} data-testid="roulette-updater">
      {/* Dados ocultos para debug */}
      <div data-socket-connected={socketConnected}></div>
      <div data-last-update={lastUpdateTime?.toISOString()}></div>
      <div data-error={error || 'none'}></div>
      <div data-roulettes-count={roulettes.length}></div>
    </div>
  );
};

export default RouletteUpdater; 