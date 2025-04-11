import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import NumberHistory from '../NumberHistory';
import './RouletteCard.css';

// Interface para as props do componente
interface RouletteCardProps {
  rouletteId: string;
  onError?: (error: string) => void;
}

/**
 * Componente que exibe um cartão com informações de uma roleta
 * Implementa sincronização automática a cada 8 segundos
 */
const RouletteCard: React.FC<RouletteCardProps> = ({ rouletteId, onError }) => {
  // Estados do componente
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rouletteData, setRouletteData] = useState<any>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const [isNewNumber, setIsNewNumber] = useState(false);
  
  // Referências
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastNumberRef = useRef<number | null>(null);
  const fetchCountRef = useRef(0);
  
  // Função para buscar dados da API
  const fetchRouletteData = async () => {
    try {
      fetchCountRef.current += 1;
      const fetchCount = fetchCountRef.current;
      
      console.log(`[RouletteCard] Buscando dados da roleta (ID: ${rouletteId}) - Tentativa #${fetchCount}`);
      setLoading(true);
      
      // URL da API
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://backendapi-production-36b5.up.railway.app/api';
      const url = `${apiBaseUrl}/roulette/${rouletteId}`;
      
      // Fazer a requisição
      const response = await axios.get(url);
      
      // Validar resposta
      if (!response.data) {
        throw new Error('Resposta vazia da API');
      }
      
      // Processar dados
      const apiData = response.data;
      console.log(`[RouletteCard] Dados recebidos para roleta ${rouletteId} [${fetchCount}]`, apiData);
      
      // Verificar se há um novo número
      if (apiData.numbers && apiData.numbers.length > 0) {
        const latestNumber = apiData.numbers[0].value;
        
        // Se é um novo número, mostrar efeito visual
        if (lastNumberRef.current !== latestNumber) {
          console.log(`[RouletteCard] Novo número detectado: ${latestNumber} (anterior: ${lastNumberRef.current})`);
          lastNumberRef.current = latestNumber;
          setIsNewNumber(true);
          
          // Remover efeito visual após 2 segundos
          setTimeout(() => setIsNewNumber(false), 2000);
        }
      }
      
      // Atualizar estados
      setRouletteData(apiData);
      setLastUpdateTime(Date.now());
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('[RouletteCard] Erro ao buscar dados:', err);
      
      // Só definir erro se ainda não tivermos dados
      if (!rouletteData) {
        setError(errorMsg);
        if (onError) onError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Efeito para carregar dados e configurar atualização periódica
  useEffect(() => {
    // Buscar dados iniciais
    fetchRouletteData();
    
    // Configurar atualização a cada 8 segundos
    timerRef.current = setInterval(() => {
      fetchRouletteData();
    }, 8000); // 8 segundos
    
    // Limpar intervalo ao desmontar
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [rouletteId]); // Recriar efeito se o ID da roleta mudar
  
  // Formatar timestamp
  const formatTimestamp = (timestamp: string | number) => {
    return new Date(timestamp).toLocaleTimeString();
  };
  
  // Calcular tempo desde a última atualização
  const getTimeElapsed = () => {
    const seconds = Math.floor((Date.now() - lastUpdateTime) / 1000);
    if (seconds < 60) return `${seconds}s atrás`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s atrás`;
  };
  
  // Renderizar estado de carregamento inicial
  if (loading && !rouletteData) {
    return (
      <div className="roulette-card loading">
        <div className="loading-indicator">Carregando...</div>
      </div>
    );
  }
  
  // Renderizar estado de erro inicial
  if (error && !rouletteData) {
    return (
      <div className="roulette-card error">
        <div className="error-message">{error}</div>
      </div>
    );
  }
  
  // Se não temos dados ainda, mostrar placeholder
  if (!rouletteData) {
    return (
      <div className="roulette-card">
        <div className="loading-indicator">Aguardando dados...</div>
      </div>
    );
  }
  
  // Extrair dados da roleta
  const { name, numbers, active, strategyState, wins, losses } = rouletteData;
  const latestNumber = numbers && numbers.length > 0 ? numbers[0] : null;
  
  // Determinar a classe do card com base em se há um novo número
  const cardClassName = `roulette-card ${active ? 'active' : 'inactive'} ${isNewNumber ? 'new-number' : ''}`;
  
  // Renderizar a roleta
  return (
    <div className={cardClassName}>
      <div className="roulette-header">
        <h3 className="roulette-name">{name}</h3>
        <div className="status-container">
          <span className={`status-badge ${active ? 'active' : 'inactive'}`}>
            {active ? 'Ativa' : 'Inativa'}
          </span>
          {loading && (
            <span className="loading-indicator-small"></span>
          )}
        </div>
      </div>
      
      {latestNumber && (
        <div className="latest-number">
          <div className="number-label">Último número:</div>
          <div className={`number-display ${latestNumber.color}`}>
            {latestNumber.value}
          </div>
          <div className="timestamp">
            {formatTimestamp(latestNumber.timestamp)}
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
      
      <div className="card-footer">
        {/* Rodapé sem informação de sincronização */}
      </div>
    </div>
  );
};

export default RouletteCard; 