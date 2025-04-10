import React, { useState, useEffect, useRef } from 'react';
import { RouletteRepository } from '../services/data/rouletteRepository';
import './RouletteCard.css';

// Interface para as props do componente
interface RouletteCardProps {
  rouletteId: string;
  refreshInterval?: number;
  onUpdate?: (data: any) => void;
}

/**
 * Componente de cartão de roleta que exibe informações em tempo real via API REST
 */
const RouletteCard: React.FC<RouletteCardProps> = ({
  rouletteId,
  refreshInterval = 5000, // Intervalo menor para atualizações mais frequentes
  onUpdate
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rouletteData, setRouletteData] = useState<any>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [isUpdated, setIsUpdated] = useState(false);
  
  // Referência para o número atual
  const latestNumberRef = useRef<number | null>(null);
  
  // Função para buscar dados atualizados da API REST
  const fetchLatestRouletteData = async () => {
    try {
      setLoading(true);
      console.log(`[RouletteCard] Buscando dados atualizados para roleta ${rouletteId}...`);
      
      // Chamada à API de produção
      const response = await fetch(`/api/ROULETTES?limit=100`);
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const allRoulettes = await response.json();
      const currentRoulette = allRoulettes.find((r: any) => r.id === rouletteId || r.uuid === rouletteId);
      
      if (currentRoulette) {
        console.log(`[RouletteCard] Dados atualizados recebidos: ${currentRoulette.name}`);
        
        // Processar e atualizar dados no estado
        processNewRouletteData(currentRoulette);
        setError(null);
      } else {
        console.error(`[RouletteCard] Roleta não encontrada: ${rouletteId}`);
        setError(`Roleta não encontrada: ${rouletteId}`);
      }
    } catch (err) {
      console.error(`[RouletteCard] Erro ao buscar dados da API:`, err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };
  
  // Função para buscar uma roleta específica por ID
  const fetchRouletteById = async () => {
    try {
      setLoading(true);
      console.log(`[RouletteCard] Buscando roleta pelo ID ${rouletteId}...`);
      
      // Chamada à API de produção para uma roleta específica
      const response = await fetch(`/api/ROULETTES/${rouletteId}`);
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      if (data) {
        console.log(`[RouletteCard] Dados da roleta recebidos: ${data.name}`);
        processNewRouletteData(data);
        setError(null);
      } else {
        console.error(`[RouletteCard] Roleta não encontrada: ${rouletteId}`);
        setError(`Roleta não encontrada: ${rouletteId}`);
      }
    } catch (err) {
      console.error(`[RouletteCard] Erro ao buscar roleta:`, err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };
   
  // Função para processar dados novos da roleta da API REST
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
  
  // Efeito para carregar dados iniciais e configurar atualizações periódicas
  useEffect(() => {
    // Carregar dados imediatamente
    fetchRouletteById();
    
    // Configurar atualização periódica via API REST
    const intervalId = setInterval(() => {
      console.log(`[RouletteCard] Executando atualização periódica para ${rouletteId}`);
      fetchLatestRouletteData();
    }, refreshInterval);
    
    // Limpar ao desmontar
    return () => {
      clearInterval(intervalId);
    };
  }, [rouletteId, refreshInterval]);
  
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
        <button className="refresh-button" onClick={fetchLatestRouletteData}>Tentar novamente</button>
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