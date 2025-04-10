import React, { useState, useEffect, useRef } from 'react';
import { RouletteRepository } from '../services/data/rouletteRepository';
import { socketClient } from '../services/socket/socketClient';
import './RouletteCard.css';

// Interface para as props do componente
interface RouletteCardProps {
  rouletteId: string;
  refreshInterval?: number;
  onUpdate?: (data: any) => void;
}

/**
 * Componente de cartão de roleta que exibe informações em tempo real
 */
const RouletteCard: React.FC<RouletteCardProps> = ({
  rouletteId,
  refreshInterval = 30000,
  onUpdate
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rouletteData, setRouletteData] = useState<any>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [isUpdated, setIsUpdated] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected'|'disconnected'|'connecting'>('connecting');
  
  // Referência para o número atual
  const latestNumberRef = useRef<number | null>(null);
  
  // Função para carregar dados da roleta via API REST
  const loadData = async () => {
    try {
      setLoading(true);
      console.log(`[RouletteCard] Carregando dados para roleta ${rouletteId}...`);
      
      const data = await RouletteRepository.fetchRouletteById(rouletteId);
      
      if (data) {
        console.log(`[RouletteCard] Dados carregados com sucesso: ${data.name}`);
        
        // Verificar se há um novo número
        if (data.numbers && data.numbers.length > 0) {
          const newNumber = data.numbers[0].number;
          
          // Se tivermos um número anterior para comparar e ele mudou
          if (latestNumberRef.current !== null && latestNumberRef.current !== newNumber) {
            console.log(`[RouletteCard] Novo número detectado: ${newNumber} (anterior: ${latestNumberRef.current})`);
            setIsUpdated(true);
            
            // Desativar a animação após 2 segundos
            setTimeout(() => {
              setIsUpdated(false);
            }, 2000);
          }
          
          // Atualizar a referência do número
          latestNumberRef.current = newNumber;
        }
        
        // Atualizar o estado com os novos dados
        setRouletteData(data);
        setLastUpdateTime(new Date());
        setError(null);
        
        // Notificar o componente pai se necessário
        if (onUpdate) {
          onUpdate(data);
        }
      } else {
        console.error(`[RouletteCard] Roleta não encontrada: ${rouletteId}`);
        setError(`Roleta não encontrada: ${rouletteId}`);
      }
    } catch (err) {
      console.error(`[RouletteCard] Erro ao carregar dados:`, err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Função para buscar dados atualizados da API REST
  const fetchLatestRouletteData = async () => {
    try {
      // Chamada à API de produção
      const response = await fetch(`/api/ROULETTES?limit=100`);
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const allRoulettes = await response.json();
      const currentRoulette = allRoulettes.find((r: any) => r.id === rouletteId || r.uuid === rouletteId);
      
      if (currentRoulette) {
        // Processar e atualizar dados no estado
        processNewRouletteData(currentRoulette);
      }
    } catch (err) {
      console.error(`[RouletteCard] Erro ao buscar dados da API:`, err);
    }
  };
  
  // Função para processar dados novos da roleta (da API ou WebSocket)
  const processNewRouletteData = (data: any) => {
    // Se já temos dados da roleta
    if (data) {
      // Se houver novos números
      if (data.numbers && data.numbers.length > 0) {
        const newNumber = data.numbers[0].number;
        
        // Se tivermos um número anterior para comparar e ele mudou
        if (latestNumberRef.current !== null && latestNumberRef.current !== newNumber) {
          console.log(`[RouletteCard] Novo número atualizado: ${newNumber} (anterior: ${latestNumberRef.current})`);
          setIsUpdated(true);
          
          // Desativar a animação após 2 segundos
          setTimeout(() => {
            setIsUpdated(false);
          }, 2000);
        }
        
        // Atualizar a referência do número
        latestNumberRef.current = newNumber;
      }
      
      // Atualizar o estado com os novos dados
      setRouletteData(data);
      setLastUpdateTime(new Date());
      
      // Notificar o componente pai
      if (onUpdate) {
        onUpdate(data);
      }
    }
  };
  
  // Efeito para monitorar o status da conexão
  useEffect(() => {
    const handleConnect = () => {
      console.log('[RouletteCard] WebSocket conectado');
      setConnectionStatus('connected');
      
      // Recarregar dados ao conectar
      loadData();
    };
    
    const handleDisconnect = () => {
      console.log('[RouletteCard] WebSocket desconectado');
      setConnectionStatus('disconnected');
    };
    
    const handleConnecting = () => {
      console.log('[RouletteCard] WebSocket conectando...');
      setConnectionStatus('connecting');
    };
    
    // Registrar handlers de eventos
    socketClient.getInstance().on('connect', handleConnect);
    socketClient.getInstance().on('disconnect', handleDisconnect);
    socketClient.getInstance().on('connecting', handleConnecting);
    
    // Verificar estado atual
    if (socketClient.getInstance().isConnected()) {
      setConnectionStatus('connected');
    }
    
    // Limpar handlers ao desmontar
    return () => {
      socketClient.getInstance().removeListener('connect', handleConnect);
      socketClient.getInstance().removeListener('disconnect', handleDisconnect);
      socketClient.getInstance().removeListener('connecting', handleConnecting);
    };
  }, []);
  
  // Efeito para carregar dados iniciais e configurar atualizações
  useEffect(() => {
    // Carregar dados imediatamente
    loadData();
    // Buscar dados atualizados da API REST
    fetchLatestRouletteData();
    
    // Configurar atualização periódica
    const intervalId = setInterval(() => {
      console.log(`[RouletteCard] Executando atualização periódica para ${rouletteId}`);
      fetchLatestRouletteData();
    }, refreshInterval);
    
    // Configurar event handler para novos números
    const handleNewNumber = (data: any) => {
      // Verificar se o evento é para esta roleta
      if (data.roleta_id === rouletteId || data.uuid === rouletteId) {
        console.log(`[RouletteCard] Novo número recebido via WebSocket: ${data.numero || data.number}`);
        
        // Se já temos dados da roleta
        if (rouletteData) {
          const newNumber = data.numero || data.number;
          
          // Se tivermos um número anterior para comparar e ele mudou
          if (latestNumberRef.current !== null && latestNumberRef.current !== newNumber) {
            console.log(`[RouletteCard] Novo número diferente do anterior: ${newNumber} (anterior: ${latestNumberRef.current})`);
            setIsUpdated(true);
            
            // Desativar a animação após 2 segundos
            setTimeout(() => {
              setIsUpdated(false);
            }, 2000);
          }
          
          // Atualizar a referência do número
          latestNumberRef.current = newNumber;
          
          // Criar o novo objeto de número
          const numberObject = {
            number: newNumber,
            color: data.cor || data.color || 
                  (newNumber === 0 ? 'green' : 
                  [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(newNumber) 
                    ? 'red' : 'black'),
            timestamp: data.timestamp || new Date().toISOString()
          };
          
          // Atualizar os dados com o novo número
          const updatedData = {
            ...rouletteData,
            numbers: [numberObject, ...(rouletteData.numbers || [])]
          };
          
          setRouletteData(updatedData);
          setLastUpdateTime(new Date());
          
          // Notificar o componente pai
          if (onUpdate) {
            onUpdate(updatedData);
          }
        } else {
          // Se não temos dados ainda, carregá-los completamente
          loadData();
        }
      }
    };
    
    // Configurar event handler para atualizações de estratégia
    const handleStrategyUpdate = (data: any) => {
      // Verificar se o evento é para esta roleta
      if (data.roleta_id === rouletteId || data.uuid === rouletteId) {
        console.log(`[RouletteCard] Atualização de estratégia recebida via WebSocket`);
        
        // Se já temos dados da roleta
        if (rouletteData) {
          // Atualizar os dados com a nova estratégia
          const updatedData = {
            ...rouletteData,
            strategyState: data.estado || data.state || rouletteData.strategyState,
            wins: data.vitorias || data.wins || rouletteData.wins,
            losses: data.derrotas || data.losses || rouletteData.losses
          };
          
          setRouletteData(updatedData);
          setLastUpdateTime(new Date());
          setIsUpdated(true);
          
          // Desativar a animação após 2 segundos
          setTimeout(() => {
            setIsUpdated(false);
          }, 2000);
          
          // Notificar o componente pai
          if (onUpdate) {
            onUpdate(updatedData);
          }
        } else {
          // Se não temos dados ainda, carregá-los completamente
          loadData();
        }
      }
    };
    
    // Registrar os handlers de eventos
    socketClient.getInstance().on('new_number', handleNewNumber);
    socketClient.getInstance().on('strategy_update', handleStrategyUpdate);
    
    // Garantir conexão com o WebSocket
    socketClient.getInstance().connect();
    
    // Limpar ao desmontar
    return () => {
      clearInterval(intervalId);
      socketClient.getInstance().removeListener('new_number', handleNewNumber);
      socketClient.getInstance().removeListener('strategy_update', handleStrategyUpdate);
    };
  }, [rouletteId, refreshInterval, rouletteData, onUpdate]);
  
  // Se estiver carregando e não tivermos dados ainda
  if (loading && !rouletteData) {
    return (
      <div className="roulette-card loading">
        <div className="loading-indicator">Carregando roleta...</div>
      </div>
    );
  }
  
  // Se tivermos um erro e não tivermos dados
  if (error && !rouletteData) {
    return (
      <div className="roulette-card error">
        <div className="error-message">{error}</div>
        <button className="refresh-button" onClick={loadData}>Tentar novamente</button>
      </div>
    );
  }
  
  // Se não tivermos dados por algum motivo
  if (!rouletteData) {
    return null;
  }
  
  // Extrair dados relevantes
  const { name, numbers = [], active, strategyState, wins = 0, losses = 0 } = rouletteData;
  const latestNumber = numbers.length > 0 ? numbers[0] : null;
  
  // Renderizar o cartão
  return (
    <div className={`roulette-card ${active ? 'active' : 'inactive'} ${isUpdated ? 'updated' : ''}`}>
      <div className="roulette-header">
        <h3 className="roulette-name">{name}</h3>
        <div className="roulette-status">
          <span className={`status-badge ${active ? 'active' : 'inactive'}`}>
            {active ? 'Ativa' : 'Inativa'}
          </span>
          <span className={`connection-badge ${connectionStatus}`}>
            {connectionStatus === 'connected' ? '•' : 
             connectionStatus === 'connecting' ? '•••' : '×'}
          </span>
        </div>
      </div>
      
      {latestNumber && (
        <div className="latest-number">
          <div className="number-label">Último número:</div>
          <div className={`number-display ${latestNumber.color}`}>
            {latestNumber.number}
          </div>
          <div className="timestamp">
            {new Date(latestNumber.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
      
      <div className="strategy-info">
        <div className="strategy-state">
          Estado: <span className={strategyState}>{strategyState}</span>
        </div>
        
        <div className="stats-container">
          <div className="stat wins">
            <span className="label">Vitórias:</span>
            <span className="value">{wins}</span>
          </div>
          <div className="stat losses">
            <span className="label">Derrotas:</span>
            <span className="value">{losses}</span>
          </div>
        </div>
      </div>
      
      <div className="number-history">
        <div className="history-label">Últimos números:</div>
        <div className="history-balls">
          {numbers.slice(0, 10).map((num: any, idx: number) => (
            <div key={idx} className={`history-ball ${num.color}`}>
              {num.number}
            </div>
          ))}
        </div>
      </div>
      
      <div className="card-footer">
        <button className="refresh-button" onClick={fetchLatestRouletteData} title="Atualizar dados">
          ↻
        </button>
        {lastUpdateTime && (
          <span className="update-time">
            Atualizado: {lastUpdateTime.toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
};

export default RouletteCard;