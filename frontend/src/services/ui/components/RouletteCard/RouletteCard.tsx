import React, { useState, useEffect } from 'react';
import { RouletteRepository } from '../../../data/rouletteRepository';
import NumberHistory from '../NumberHistory';
import './RouletteCard.css';

// Interface para as props do componente
interface RouletteCardProps {
  rouletteId: string;
  onError?: (error: string) => void;
}

/**
 * Componente que exibe um cartão com informações de uma roleta
 */
const RouletteCard: React.FC<RouletteCardProps> = ({ rouletteId, onError }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rouletteData, setRouletteData] = useState<any>(null);
  
  // Função para carregar os dados da roleta
  const loadData = async () => {
    try {
      setLoading(true);
      const data = await RouletteRepository.fetchRouletteById(rouletteId);
      
      if (data) {
        setRouletteData(data);
        setError(null);
      } else {
        const errorMsg = `Roleta não encontrada (ID: ${rouletteId})`;
        setError(errorMsg);
        if (onError) onError(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('RouletteCard error:', err);
      setError(errorMsg);
      if (onError) onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };
  
  // Carregar dados e configurar assinatura em tempo real
  useEffect(() => {
    loadData();
    
    // Assinar atualizações em tempo real
    const unsubscribe = RouletteRepository.subscribeToRouletteUpdates(
      rouletteId,
      (updatedData) => {
        setRouletteData(updatedData);
      }
    );
    
    // Limpar ao desmontar
    return () => {
      unsubscribe();
    };
  }, [rouletteId]);
  
  // Renderizar estado de carregamento
  if (loading) {
    return (
      <div className="roulette-card loading">
        <div className="loading-indicator">Carregando...</div>
      </div>
    );
  }
  
  // Renderizar estado de erro
  if (error) {
    return (
      <div className="roulette-card error">
        <div className="error-message">{error}</div>
      </div>
    );
  }
  
  // Extrair dados da roleta
  const { name, numbers, active, strategyState, wins, losses } = rouletteData;
  const latestNumber = numbers && numbers.length > 0 ? numbers[0] : null;
  
  // Renderizar a roleta
  return (
    <div className={`roulette-card ${active ? 'active' : 'inactive'}`}>
      <div className="roulette-header">
        <h3 className="roulette-name">{name}</h3>
        <span className={`status-badge ${active ? 'active' : 'inactive'}`}>
          {active ? 'Ativa' : 'Inativa'}
        </span>
      </div>
      
      {latestNumber && (
        <div className="latest-number">
          <div className="number-label">Último número:</div>
          <div className={`number-display ${latestNumber.color}`}>
            {latestNumber.value}
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
      
      <NumberHistory numbers={numbers} maxItems={10} />
    </div>
  );
};

export default RouletteCard; 