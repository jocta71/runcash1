import React, { useState, useEffect, useRef } from 'react';
import NumberHistory from '../NumberHistory';
import UnifiedRouletteClient from '../../../../services/UnifiedRouletteClient';
import { processRouletteData as globalProcessRouletteData, getNumberColor } from '../../../../utils/rouletteUtils';
import './RouletteCard.css';

// Adiciona regra global para corrigir posicionamento de dropdowns
const addDropdownStyles = () => {
  // Adicionar estilo global para garantir que dropdowns não sejam cortados
  const styleTag = document.createElement('style');
  styleTag.innerHTML = `
    .roulette-card {
      overflow: visible !important;
    }
    .roulette-card .dropdown-content {
      z-index: 1000;
      position: absolute;
    }
  `;
  document.head.appendChild(styleTag);
};

// Interface para as props do componente
interface RouletteCardProps {
  rouletteId: string;
  onError?: (error: string) => void;
}

/**
 * Componente que exibe um cartão com informações de uma roleta
 * Implementa sincronização automática via SSE
 */
const RouletteCard: React.FC<RouletteCardProps> = ({ rouletteId, onError }) => {
  // Estados
  const [rouletteData, setRouletteData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const [isNewNumber, setIsNewNumber] = useState(false);
  
  // Referências
  const lastNumberRef = useRef<number | null>(null);
  const subscriberId = useRef(`roulette-card-${rouletteId}-${Date.now()}`);
  const unifiedClient = useRef(UnifiedRouletteClient.getInstance());
  
  // Função para processar dados da roleta
  const processData = () => {
    try {
      // Obter dados das roletas do UnifiedRouletteClient
      const allRoulettes = unifiedClient.current.getAllRoulettes();
      
      // Encontrar a roleta específica pelo ID
      const apiData = allRoulettes.find((roulette: any) => {
        const rouletteIdentifier = roulette.id || roulette.name || '';
        return rouletteIdentifier.toLowerCase() === rouletteId.toLowerCase();
      });
      
      if (!apiData) {
        console.warn(`[RouletteCard] Roleta ${rouletteId} não encontrada`);
        return;
      }
      
      // Usar a função centralizada para processar os dados
      const processedData = globalProcessRouletteData(apiData);
      
      if (processedData) {
        // Verificar novo número
        if (processedData.numeros?.length > 0) {
          const latestNumber = processedData.numeros[0].numero;
          if (lastNumberRef.current !== latestNumber) {
            lastNumberRef.current = latestNumber;
            setIsNewNumber(true);
            setTimeout(() => setIsNewNumber(false), 2000);
          }
        }
        
        // Atualizar estados
        setRouletteData(processedData);
        setLastUpdateTime(Date.now());
        setError(null);
        setLoading(false);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('[RouletteCard] Erro:', err);
      if (!rouletteData) {
        setError(errorMsg);
        if (onError) onError(errorMsg);
      }
    }
  };
  
  // Função auxiliar para determinar a cor do número
  const getNumberColor = (numero: number): string => {
    if (numero === 0) return 'green';
    return [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(numero) ? 'red' : 'black';
  };
  
  // Efeito para gerenciar conexão SSE
  useEffect(() => {
    console.log(`[RouletteCard] Inicializando para roleta ${rouletteId}`);
    setLoading(true);
    
    // Registrar para atualizações
    unifiedClient.current.on('update', processData);
    
    // Forçar atualização inicial
    unifiedClient.current.forceUpdate();
    
    // Limpar ao desmontar
    return () => {
      console.log(`[RouletteCard] Limpando para roleta ${rouletteId}`);
      unifiedClient.current.off('update', processData);
    };
  }, [rouletteId, processData]);
  
  // Formatar timestamp
  const formatTimestamp = (timestamp: string | number) => {
    return new Date(timestamp).toLocaleTimeString();
  };
  
  // Renderizar estados de carregamento e erro
  if (loading && !rouletteData) {
    return (
      <div className="roulette-card loading">
        <div className="loading-indicator">Carregando...</div>
      </div>
    );
  }
  
  if (error && !rouletteData) {
    return (
      <div className="roulette-card error">
        <div className="error-message">{error}</div>
      </div>
    );
  }
  
  if (!rouletteData) {
    return (
      <div className="roulette-card">
        <div className="loading-indicator">Aguardando dados...</div>
      </div>
    );
  }
  
  // Extrair dados
  const { name, numbers, active, strategyState, wins, losses } = rouletteData;
  const latestNumber = numbers?.[0];
  
  // Renderizar roleta
  return (
    <div className={`roulette-card ${active ? 'active' : 'inactive'} ${isNewNumber ? 'new-number' : ''}`}>
      <div className="roulette-header">
        <h3 className="roulette-name">{name}</h3>
        <div className="status-container">
          <span className={`status-badge ${active ? 'active' : 'inactive'}`}>
            {active ? 'Ativa' : 'Inativa'}
          </span>
          {loading && <span className="loading-indicator-small" />}
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
    </div>
  );
};

export default RouletteCard; 