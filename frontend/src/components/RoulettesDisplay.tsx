import React, { useState, useEffect, useCallback } from 'react';
import RouletteUpdater from './RouletteUpdater';
import * as rouletteRepository from '../services/data/rouletteRepository';
import { socketClient } from '../services/socket/socketClient';

interface RoulettesDisplayProps {
  limit?: number;
  refreshInterval?: number;
  showInactive?: boolean;
}

/**
 * Componente que exibe todas as roletas atualizadas em tempo real
 */
const RoulettesDisplay: React.FC<RoulettesDisplayProps> = ({
  limit = 100,
  refreshInterval = 30000,
  showInactive = false
}) => {
  const [roulettes, setRoulettes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [updatesCount, setUpdatesCount] = useState<number>(0);

  // Função para atualizar dados das roletas (chamada pelo RouletteUpdater)
  const handleRouletteUpdate = useCallback((updatedRoulettes: any[]) => {
    const filteredRoulettes = showInactive 
      ? updatedRoulettes 
      : updatedRoulettes.filter(r => r.active);
    
    setRoulettes(filteredRoulettes);
    setLoading(false);
    setLastUpdateTime(new Date());
    setUpdatesCount(prev => prev + 1);
  }, [showInactive]);

  // Efeito para monitorar o status da conexão
  useEffect(() => {
    const handleConnect = () => {
      console.log('[RoulettesDisplay] WebSocket conectado');
      setConnectionStatus('connected');
    };

    const handleDisconnect = () => {
      console.log('[RoulettesDisplay] WebSocket desconectado');
      setConnectionStatus('disconnected');
    };

    const handleConnecting = () => {
      console.log('[RoulettesDisplay] WebSocket conectando...');
      setConnectionStatus('connecting');
    };

    // Registrar listeners de conexão
    socketClient.getInstance().on('connect', handleConnect);
    socketClient.getInstance().on('disconnect', handleDisconnect);
    socketClient.getInstance().on('connecting', handleConnecting);

    // Verificar estado atual
    if (socketClient.getInstance().isConnected()) {
      setConnectionStatus('connected');
    } else {
      setConnectionStatus('connecting');
      socketClient.getInstance().connect();
    }

    return () => {
      socketClient.getInstance().removeListener('connect', handleConnect);
      socketClient.getInstance().removeListener('disconnect', handleDisconnect);
      socketClient.getInstance().removeListener('connecting', handleConnecting);
    };
  }, []);

  // Força reconexão manual
  const handleForceReconnect = () => {
    console.log('[RoulettesDisplay] Forçando reconexão...');
    setConnectionStatus('connecting');
    socketClient.getInstance().forceReconnect();
  };

  // Força recarregamento de dados manual
  const handleManualRefresh = async () => {
    console.log('[RoulettesDisplay] Recarregando dados manualmente...');
    setLoading(true);
    
    try {
      const data = await rouletteRepository.fetchAllRoulettesWithNumbers();
      const filteredData = showInactive ? data : data.filter(r => r.active);
      const limitedData = limit ? filteredData.slice(0, limit) : filteredData;
      
      setRoulettes(limitedData);
      setLastUpdateTime(new Date());
      setError(null);
      setUpdatesCount(prev => prev + 1);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Efeito para carregar dados iniciais (fallback se o RouletteUpdater falhar)
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const data = await rouletteRepository.fetchAllRoulettesWithNumbers();
        const filteredData = showInactive ? data : data.filter(r => r.active);
        const limitedData = limit ? filteredData.slice(0, limit) : filteredData;
        
        setRoulettes(limitedData);
        setLastUpdateTime(new Date());
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [showInactive, limit]);

  // Renderizar estado de carregamento
  if (loading) {
    return (
      <div className="roulettes-display loading">
        <div className="loading-indicator">Carregando roletas...</div>
      </div>
    );
  }

  // Renderizar estado de erro
  if (error) {
    return (
      <div className="roulettes-display error">
        <div className="error-message">{error}</div>
        <div className="error-actions">
          <button onClick={handleManualRefresh} className="refresh-button">
            Recarregar dados
          </button>
          <button onClick={handleForceReconnect} className="reconnect-button">
            Reconectar WebSocket
          </button>
        </div>
      </div>
    );
  }

  // Renderizar roletas
  return (
    <div className="roulettes-display">
      {/* Componente invisível que atualiza os dados */}
      <RouletteUpdater 
        onUpdate={handleRouletteUpdate} 
        refreshInterval={refreshInterval}
        limit={limit}
      />
      
      {/* Cabeçalho com informações */}
      <div className="display-header">
        <h2>Roletas em Tempo Real</h2>
        <div className="status-info">
          <span className={`connection-status ${connectionStatus}`}>
            {connectionStatus === 'connected' ? 'Conectado' : 
             connectionStatus === 'connecting' ? 'Conectando...' : 'Desconectado'}
          </span>
          <span className="count-badge">
            {roulettes.length} roletas exibidas
          </span>
          {lastUpdateTime && (
            <span className="update-time">
              Última atualização: {lastUpdateTime.toLocaleTimeString()}
            </span>
          )}
          <span className="updates-counter">
            Atualizações: {updatesCount}
          </span>
          <button 
            onClick={handleManualRefresh} 
            className="refresh-button"
            title="Forçar atualização de dados"
          >
            ↻
          </button>
        </div>
      </div>
      
      {/* Grid de roletas */}
      <div className="roulettes-grid">
        {roulettes.length > 0 ? (
          roulettes.map(roulette => (
            <div key={roulette.id} className={`roulette-card ${roulette.active ? 'active' : 'inactive'}`}>
              <div className="roulette-header">
                <h3 className="roulette-name">{roulette.name}</h3>
                <span className={`status-badge ${roulette.active ? 'active' : 'inactive'}`}>
                  {roulette.active ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              
              {roulette.numbers && roulette.numbers.length > 0 && (
                <div className="latest-number">
                  <div className="number-label">Último número:</div>
                  <div className={`number-display ${roulette.numbers[0].color}`}>
                    {roulette.numbers[0].number}
                  </div>
                  <div className="timestamp">
                    {new Date(roulette.numbers[0].timestamp).toLocaleTimeString()}
                  </div>
                </div>
              )}
              
              <div className="strategy-info">
                <div className="strategy-state">
                  Estado: <span className={roulette.strategyState}>{roulette.strategyState}</span>
                </div>
                
                <div className="stats-container">
                  <div className="stat wins">
                    <span className="label">Vitórias:</span>
                    <span className="value">{roulette.wins}</span>
                  </div>
                  <div className="stat losses">
                    <span className="label">Derrotas:</span>
                    <span className="value">{roulette.losses}</span>
                  </div>
                </div>
              </div>
              
              {/* Exibir últimos 5 números */}
              <div className="number-history">
                <div className="history-label">Últimos números:</div>
                <div className="history-balls">
                  {roulette.numbers.slice(0, 5).map((num: any, idx: number) => (
                    <div key={idx} className={`history-ball ${num.color}`}>
                      {num.number}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="no-roulettes">
            <p>Nenhuma roleta disponível no momento.</p>
            <button onClick={handleManualRefresh} className="refresh-button">
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoulettesDisplay; 