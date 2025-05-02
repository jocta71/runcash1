import React, { useState, useEffect, useRef } from 'react';
import NumberHistory from '../NumberHistory';
import globalRouletteDataService from '../../../../services/GlobalRouletteDataService';
import EventService from '../../../../services/EventService';
import './RouletteCard.css';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

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
 * Implementa sincronização automática a cada 8 segundos
 */
const RouletteCard: React.FC<RouletteCardProps> = ({ rouletteId, onError }) => {
  // Estados
  const [rouletteData, setRouletteData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const [isNewNumber, setIsNewNumber] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSubscriptionMessage, setShowSubscriptionMessage] = useState(false);
  
  // Referências
  const lastNumberRef = useRef<number | null>(null);
  const fetchCountRef = useRef(0);
  const subscriberId = useRef(`roulette-card-${rouletteId}-${Date.now()}`);
  
  // Função para processar dados da roleta do serviço centralizado
  const processRouletteData = () => {
    try {
      fetchCountRef.current += 1;
      const fetchCount = fetchCountRef.current;
      
      console.log(`[RouletteCard] Processando dados da roleta (ID: ${rouletteId}) - Atualização #${fetchCount}`);
      
      // Obter todos os dados das roletas do serviço global
      const allRoulettes = globalRouletteDataService.getAllRoulettes();
      
      // Encontrar a roleta específica pelo ID
      const apiData = allRoulettes.find((roulette: any) => {
        const rouletteIdentifier = roulette.id || roulette.name || '';
        return rouletteIdentifier.toLowerCase() === rouletteId.toLowerCase();
      });
      
      // Verificar se encontramos a roleta
      if (!apiData) {
        console.warn(`[RouletteCard] Roleta com ID ${rouletteId} não encontrada nos dados globais`);
        return;
      }
      
      console.log(`[RouletteCard] Dados recebidos para roleta ${rouletteId} [${fetchCount}]`);
      
      // Adaptar formato de dados do serviço global para o formato esperado pelo componente
      const processedData = {
        name: apiData.nome || apiData.name || rouletteId,
        numbers: Array.isArray(apiData.numero) 
          ? apiData.numero.map((n: any) => ({
              value: n.numero,
              color: getNumberColor(n.numero),
              timestamp: n.timestamp || new Date().toISOString()
            }))
          : [],
        active: true,
        strategyState: apiData.strategyState || 'Neutro',
        wins: apiData.wins || 0,
        losses: apiData.losses || 0
      };
      
      // Verificar se há um novo número
      if (processedData.numbers && processedData.numbers.length > 0) {
        const latestNumber = processedData.numbers[0].value;
        
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
      setRouletteData(processedData);
      setLastUpdateTime(Date.now());
      setError(null);
      setLoading(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('[RouletteCard] Erro ao processar dados:', err);
      
      // Só definir erro se ainda não tivermos dados
      if (!rouletteData) {
        setError(errorMsg);
        if (onError) onError(errorMsg);
      }
    }
  };
  
  // Função auxiliar para determinar a cor de um número
  const getNumberColor = (numero: number): string => {
    if (numero === 0) return 'green';
    return [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(numero) ? 'red' : 'black';
  };
  
  // Efeito para se inscrever no serviço global de dados
  useEffect(() => {
    // Aplicar estilos para corrigir dropdowns
    addDropdownStyles();
    
    console.log(`[RouletteCard] Configurando escuta de eventos para roleta ${rouletteId}`);
    setLoading(true);
    
    // Registrar no EventService para receber atualizações
    const handleUpdate = () => {
      processRouletteData();
    };
    
    EventService.on('roulette:data-updated', handleUpdate);
    
    // Processar dados iniciais se disponíveis
    processRouletteData();
    
    // Forçar uma atualização inicial para buscar os dados mais recentes
    globalRouletteDataService.forceUpdate();
    
    // Limpar inscrição ao desmontar
    return () => {
      console.log(`[RouletteCard] Removendo escuta de eventos para roleta ${rouletteId}`);
      EventService.off('roulette:data-updated', handleUpdate);
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
  
  const navigate = useNavigate();
  
  const renderMissingSubscriptionMessage = () => {
    return (
      <div className="p-4 bg-gray-800/90 rounded-lg shadow-md flex flex-col items-center gap-4 text-center absolute inset-0 backdrop-blur-sm z-10">
        <AlertCircle className="w-12 h-12 text-amber-500" />
        <h3 className="text-lg font-semibold text-white">Acesso Restrito</h3>
        <p className="text-gray-300 max-w-xs">
          Para acessar os dados detalhados das roletas, você precisa ter uma assinatura ativa.
        </p>
        <button 
          onClick={() => navigate('/planos')}
          className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
        >
          Ver Planos
        </button>
      </div>
    );
  };
  
  // Adicionar na função render ou no componente principal
  useEffect(() => {
    if (error && error.includes('Assinatura necessária')) {
      setHasError(true);
      setErrorMessage('Você precisa ter uma assinatura ativa para acessar estes dados.');
      setShowSubscriptionMessage(true);
    }
  }, [error]);
  
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
    <div className={`relative bg-slate-800 rounded-lg shadow-md overflow-hidden ${cardClassName || ''}`}>
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
      
      {showSubscriptionMessage && renderMissingSubscriptionMessage()}
    </div>
  );
};

export default RouletteCard; 