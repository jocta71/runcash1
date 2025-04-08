import React, { useEffect, useState } from 'react';
import CasinoAPIAdapter from '../../services/CasinoAPIAdapter';
import EventService from '../../services/EventService';
import RouletteNumber from './RouletteNumber';

// Interface para uma roleta
interface Roulette {
  tableId: string;
  name: string;
  numbers: string[];
  dealer: string;
  isOpen: boolean;
}

const Casino888RouletteDisplay: React.FC = () => {
  const [roulettes, setRoulettes] = useState<Roulette[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Inicializar o adaptador
    const casinoAdapter = CasinoAPIAdapter.getInstance();
    
    // Habilitar o 888casino
    casinoAdapter.initialize({ enable888Casino: true });
    
    // Handler para atualizações de roletas
    const handleRouletteUpdates = (data: { tables: Roulette[] }) => {
      setRoulettes(data.tables);
      setIsLoading(false);
    };
    
    // Registrar event listeners
    EventService.on('casino888:tables-updated', handleRouletteUpdates);
    
    // Obter dados iniciais
    const initialRoulettes = casinoAdapter.getCasino888Roulettes();
    if (initialRoulettes.length > 0) {
      setRoulettes(initialRoulettes);
      setIsLoading(false);
    }
    
    // Mostrar mensagem de carregamento
    const loadingTimeout = setTimeout(() => {
      if (isLoading && roulettes.length === 0) {
        setError('Aguardando dados das roletas... Isso pode levar alguns instantes.');
      }
    }, 5000);
    
    // Limpeza ao desmontar
    return () => {
      EventService.off('casino888:tables-updated', handleRouletteUpdates);
      casinoAdapter.stopCasino888Polling();
      clearTimeout(loadingTimeout);
    };
  }, []);
  
  // Exibir mensagem de carregamento
  if (isLoading && roulettes.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Roletas 888casino</h2>
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
        {error && <p className="text-orange-500 mt-2">{error}</p>}
      </div>
    );
  }
  
  // Exibir mensagem se não houver roletas
  if (roulettes.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Roletas 888casino</h2>
        <p className="text-gray-500">Nenhuma roleta disponível no momento.</p>
      </div>
    );
  }
  
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Roletas 888casino</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roulettes.map((roulette) => (
          <div key={roulette.tableId} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium">{roulette.name}</h3>
              <span 
                className={`px-2 py-1 text-xs rounded-full ${
                  roulette.isOpen ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {roulette.isOpen ? 'Aberta' : 'Fechada'}
              </span>
            </div>
            
            <p className="text-sm text-gray-600 mb-2">Dealer: {roulette.dealer || 'N/A'}</p>
            
            {/* Mostrar os últimos números */}
            <div className="flex flex-wrap gap-2 mt-3">
              {roulette.numbers.slice(0, 15).map((number, index) => (
                <RouletteNumber 
                  key={`${roulette.tableId}-${index}`}
                  number={number}
                  size="medium"
                  highlight={index === 0}
                />
              ))}
              
              {roulette.numbers.length === 0 && (
                <p className="text-gray-500 text-sm italic">Nenhum número disponível</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Casino888RouletteDisplay; 