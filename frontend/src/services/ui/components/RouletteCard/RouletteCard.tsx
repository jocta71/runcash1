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
  const handlerRegisteredRef = useRef(false);
  
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
      if (!rouletteData) {
        setError(errorMsg);
        if (onError) onError(errorMsg);
      }
    }
  };
  
  // Efeito para registrar evento update e iniciar busca
  useEffect(() => {
    // Evitar múltiplos registros do mesmo handler
    if (handlerRegisteredRef.current) return;
    
    handlerRegisteredRef.current = true;
    
    // Registrar para atualizações
    unifiedClient.current.on('update', processData);
    
    // Forçar atualização inicial
    processData();
    
    return () => {
      handlerRegisteredRef.current = false;
      unifiedClient.current.off('update', processData);
    };
  }, [rouletteId]);
  
  // Formatar timestamp
  const formatTimestamp = (timestamp: string | number) => {
    try {
      return new Date(timestamp).toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (e) {
      return "--:--";
    }
  };
  
  // Renderização condicional
  if (loading) {
    return (
      <div className="roulette-card loading">
        <div className="loading-spinner"></div>
        <p>Carregando roleta {rouletteId}...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="roulette-card error">
        <div className="error-icon">❌</div>
        <p>{error}</p>
        <button onClick={() => processData()}>Tentar novamente</button>
      </div>
    );
  }
  
  // Se não há dados, mostrar estado vazio
  if (!rouletteData) {
    return (
      <div className="roulette-card empty">
        <p>Sem dados para roleta {rouletteId}</p>
        <button onClick={() => processData()}>Atualizar</button>
      </div>
    );
  }
  
  // Renderizar cartão com dados
  return (
    <div className={`roulette-card ${isNewNumber ? 'new-number-animation' : ''}`}>
      <div className="card-header">
        <h3>{rouletteData.nome || rouletteId}</h3>
        <span className={`status ${rouletteData.status || 'offline'}`}>
          {rouletteData.status || 'Offline'}
        </span>
      </div>
      
      <div className="card-body">
        {rouletteData.numeros && (
          <div className="numbers-container">
            <NumberHistory 
              numbers={rouletteData.numeros.map((n: any) => ({ 
                value: n.numero,
                timestamp: n.timestamp,
                color: getNumberColor(n.numero)
              }))} 
            />
          </div>
        )}
      </div>
      
      <div className="card-footer">
        <span className="provider">{rouletteData.provider || 'Desconhecido'}</span>
        <span className="timestamp">Atualizado: {formatTimestamp(lastUpdateTime)}</span>
      </div>
    </div>
  );
};

export default RouletteCard; 