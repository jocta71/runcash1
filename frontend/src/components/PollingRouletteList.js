import React, { useEffect, useState } from 'react';
import RouletteFeedService from '../services/RouletteFeedService';

/**
 * Componente que exibe uma lista de roletas usando o serviço de polling
 */
const PollingRouletteList = () => {
  const [roulettes, setRoulettes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pollingStatus, setPollingStatus] = useState('stopped');

  // Manipulador para quando novos dados são recebidos
  const handleRouletteUpdate = (data) => {
    setRoulettes(data);
    setLoading(false);
  };

  // Manipulador para erros
  const handleError = (err) => {
    console.error('Erro no serviço de polling:', err);
    setError('Falha ao conectar com o servidor. Tentando novamente...');
    setLoading(false);
  };

  // Iniciar o serviço de polling quando o componente montar
  useEffect(() => {
    setPollingStatus('connecting');
    
    // Iniciar o serviço com delay de 3 segundos
    RouletteFeedService.start(handleRouletteUpdate, handleError, 3000);
    setPollingStatus('active');
    
    // Limpar quando o componente desmontar
    return () => {
      RouletteFeedService.stop();
      setPollingStatus('stopped');
    };
  }, []);

  // Renderizar números da roleta
  const renderNumbers = (numbers) => {
    if (!numbers || numbers.length === 0) {
      return <span className="text-gray-400">Sem números recentes</span>;
    }

    return (
      <div className="flex space-x-2 overflow-x-auto pb-2">
        {numbers.map((number, index) => {
          // Definir cores
          let bgColor = 'bg-green-500';
          if (number > 0) {
            const vermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
            bgColor = vermelhos.includes(number) ? 'bg-red-600' : 'bg-black';
          }

          return (
            <div 
              key={index} 
              className={`${bgColor} text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold`}
            >
              {number}
            </div>
          );
        })}
      </div>
    );
  };

  // Renderizar indicador de status do polling
  const renderPollingStatus = () => {
    let statusColor = 'bg-gray-500';
    let statusText = 'Parado';
    
    if (pollingStatus === 'connecting') {
      statusColor = 'bg-yellow-500';
      statusText = 'Conectando...';
    } else if (pollingStatus === 'active') {
      statusColor = 'bg-green-500';
      statusText = 'Ativo';
    }
    
    return (
      <div className="flex items-center mb-4">
        <div className={`${statusColor} w-3 h-3 rounded-full mr-2`}></div>
        <span className="text-sm text-gray-600">Status do Polling: {statusText}</span>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Roletas (Polling)</h2>
      
      {renderPollingStatus()}
      
      {loading && <p className="text-gray-500">Carregando roletas...</p>}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      )}
      
      {!loading && Object.keys(roulettes).length === 0 && !error && (
        <p className="text-gray-500">Nenhuma roleta disponível no momento.</p>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.values(roulettes).map((roulette) => (
          <div key={roulette.id} className="border rounded-lg p-4 shadow-sm">
            <h3 className="text-xl font-semibold mb-2">{roulette.name || 'Roleta sem nome'}</h3>
            
            <div className="mb-3">
              <h4 className="text-sm font-medium text-gray-500 mb-1">Últimos números:</h4>
              {renderNumbers(roulette.numbers)}
            </div>
            
            <div className="text-xs text-gray-500">
              Última atualização: {roulette.lastUpdated ? new Date(roulette.lastUpdated).toLocaleString() : 'Nunca'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PollingRouletteList; 