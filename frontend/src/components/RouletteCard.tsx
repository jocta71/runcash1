import React, { useEffect, useState, useCallback } from 'react';
import './RouletteCard.css';
import { RouletteData } from '../services/api/rouletteApi';
import * as rouletteRepository from '../services/data/rouletteRepository';
import { Logger } from '../utils/logger';

interface RouletteCardProps {
  data: RouletteData; // Dados iniciais da roleta
  refreshInterval?: number; // Intervalo de atualização em ms (padrão: 5000ms = 5s)
  onUpdate?: (data: RouletteData) => void; // Callback opcional ao atualizar dados
}

const RouletteCard: React.FC<RouletteCardProps> = ({
  data,
  refreshInterval = 5000,
  onUpdate
}) => {
  const [rouletteData, setRouletteData] = useState<RouletteData | null>(data || null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastNumbers, setLastNumbers] = useState<Array<{numero: string | number}>>([]);
  const [newNumber, setNewNumber] = useState<string | number | null>(null);

  // Identifica o ID da roleta a partir dos dados disponíveis
  const getRoulettePrimaryId = useCallback(() => {
    if (!rouletteData) return null;
    
    // Prioriza roleta_id se disponível
    if (rouletteData.roleta_id) return rouletteData.roleta_id;
    
    // Tenta outros IDs como fallback
    return rouletteData.id || rouletteData._id || null;
  }, [rouletteData]);

  // Carrega dados da roleta
  const loadData = useCallback(async () => {
    const rouletteId = getRoulettePrimaryId();
    
    if (!rouletteId) {
      setError('ID da roleta não encontrado');
      return;
    }
    
    try {
      setLoading(true);
      
      // Busca os dados atualizados da roleta
      Logger.info(`Buscando dados da roleta ${rouletteId} via API`);
      const updatedData = await rouletteRepository.fetchRouletteById(rouletteId);
      
      if (!updatedData) {
        setError(`Roleta ${rouletteId} não encontrada`);
        return;
      }
      
      // Atualiza os dados da roleta
      setRouletteData(updatedData);
      
      // Extrai os últimos números
      const numbers = updatedData.numeros || updatedData.lastNumbers || [];
      
      // Verifica se há um novo número
      if (numbers.length > 0 && 
          lastNumbers.length > 0 && 
          numbers[0].numero !== lastNumbers[0].numero) {
        setNewNumber(numbers[0].numero);
        
        // Limpa o indicador de novo número após 2 segundos
        setTimeout(() => {
          setNewNumber(null);
        }, 2000);
      }
      
      // Atualiza a lista de últimos números
      setLastNumbers(numbers);
      
      // Chama o callback se fornecido
      if (onUpdate) {
        onUpdate(updatedData);
      }
      
      setError(null);
    } catch (err) {
      Logger.error(`Erro ao buscar roleta ${rouletteId}:`, err);
      setError('Erro ao buscar dados da roleta');
    } finally {
      setLoading(false);
    }
  }, [getRoulettePrimaryId, lastNumbers, onUpdate]);

  // Configura o intervalo de polling
  useEffect(() => {
    // Carrega dados iniciais
    loadData();
    
    // Configura o intervalo para atualização periódica
    const intervalId = setInterval(loadData, refreshInterval);
    
    // Limpa o intervalo ao desmontar o componente
    return () => clearInterval(intervalId);
  }, [loadData, refreshInterval]);

  // Renderiza mensagem de carregamento
  if (!rouletteData && loading) {
    return (
      <div className="roulette-card loading">
        <div className="loading-spinner"></div>
        <p>Carregando roleta...</p>
      </div>
    );
  }

  // Renderiza mensagem de erro
  if (error && !rouletteData) {
    return (
      <div className="roulette-card error">
        <p>Erro: {error}</p>
        <button onClick={loadData}>Tentar novamente</button>
      </div>
    );
  }

  // Se não houver dados, não renderiza nada
  if (!rouletteData) {
    return null;
  }

  // Calcula estatísticas
  const totalGames = (rouletteData.vitorias || 0) + (rouletteData.derrotas || 0);
  const winRate = totalGames > 0 
    ? Math.round((rouletteData.vitorias || 0) * 100 / totalGames) 
    : 0;

  // Renderiza o cartão da roleta
  return (
    <div className={`roulette-card ${loading ? 'updating' : ''}`}>
      <h3 className="roulette-title">
        {rouletteData.nome || rouletteData.name || 'Roleta sem nome'}
      </h3>
      
      {/* Último número */}
      <div className={`last-number ${newNumber ? 'new-number' : ''}`}>
        {lastNumbers.length > 0 ? lastNumbers[0].numero : '-'}
      </div>
      
      {/* Números recentes */}
      <div className="recent-numbers">
        {lastNumbers.slice(0, 10).map((num, index) => (
          <span key={index} className="number">
            {num.numero}
          </span>
        ))}
      </div>
      
      {/* Estatísticas */}
      <div className="statistics">
        <div className="stat">
          <span className="label">Vitórias:</span>
          <span className="value">{rouletteData.vitorias || 0}</span>
        </div>
        <div className="stat">
          <span className="label">Derrotas:</span>
          <span className="value">{rouletteData.derrotas || 0}</span>
        </div>
        <div className="stat">
          <span className="label">Taxa de vitória:</span>
          <span className="value">{winRate}%</span>
        </div>
      </div>
      
      {/* Estado da estratégia */}
      {rouletteData.estado_estrategia && (
        <div className="strategy-state">
          <span className="label">Estratégia:</span>
          <span className="value">{rouletteData.estado_estrategia}</span>
        </div>
      )}
      
      {/* Indicador de atualização */}
      {loading && (
        <div className="updating-indicator">
          <div className="updating-spinner"></div>
        </div>
      )}
    </div>
  );
};

export default RouletteCard;