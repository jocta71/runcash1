import React, { useEffect, useState } from 'react';
import RouletteCard from './RouletteCard';
import SocketService from '../services/SocketService';

interface Roulette {
  id: string;
  nome: string;
}

const RouletteList: React.FC = () => {
  const [roulettes, setRoulettes] = useState<Roulette[]>([]);
  const socketService = SocketService.getInstance();

  useEffect(() => {
    // Carregar lista inicial de roletas
    const loadRoulettes = async () => {
      try {
        const response = await fetch('/api/roulettes');
        const data = await response.json();
        setRoulettes(data);
      } catch (error) {
        console.error('Erro ao carregar roletas:', error);
      }
    };

    loadRoulettes();

    // Inscrever para atualizações de roletas via WebSocket
    const handleRouletteUpdate = (data: any) => {
      if (data.type === 'roulette_list_update') {
        setRoulettes(data.roulettes);
      }
    };

    socketService.subscribe('roulette_update', handleRouletteUpdate);

    return () => {
      socketService.unsubscribe('roulette_update', handleRouletteUpdate);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {roulettes.map((roulette) => (
        <RouletteCard
          key={roulette.id}
          roletaId={roulette.id}
          roletaNome={roulette.nome}
        />
      ))}
    </div>
  );
};

export default RouletteList; 