import React, { useEffect, useState } from 'react';
import SocketService from '../services/SocketService';
import { RouletteEvent, RouletteNumberEvent } from '../services/EventService';

interface RouletteNumbersProps {
  roletaId: string;
  roletaNome: string;
  maxNumbers?: number;
}

const RouletteNumbers: React.FC<RouletteNumbersProps> = ({
  roletaId,
  roletaNome,
  maxNumbers = 20
}) => {
  const [numbers, setNumbers] = useState<number[]>([]);
  
  useEffect(() => {
    const socketService = SocketService.getInstance();
    
    // Carregar histórico inicial
    const initialHistory = socketService.getRouletteHistory(roletaId);
    setNumbers(initialHistory.slice(0, maxNumbers));
    
    // Função para processar novos números
    const handleRouletteEvent = (event: RouletteEvent) => {
      if (event.type === 'new_number') {
        const numberEvent = event as RouletteNumberEvent;
        setNumbers(prev => {
          const newNumbers = [numberEvent.numero, ...prev];
          return newNumbers.slice(0, maxNumbers);
        });
      } else if (event.type === 'history_update') {
        setNumbers(event.numeros.slice(0, maxNumbers));
      }
    };
    
    // Inscrever para receber atualizações
    socketService.subscribe(roletaId, handleRouletteEvent);
    
    // Limpar inscrição ao desmontar
    return () => {
      socketService.unsubscribe(roletaId, handleRouletteEvent);
    };
  }, [roletaId, maxNumbers]);
  
  return (
    <div className="roulette-numbers">
      <div className="flex flex-wrap gap-2">
        {numbers.map((number, index) => (
          <div
            key={`${roletaId}-${index}`}
            className={`
              w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold
              ${number === 0 ? 'bg-green-600' : 
                number % 2 === 0 ? 'bg-red-600' : 'bg-black'}
            `}
          >
            {number}
          </div>
        ))}
      </div>
      
      {numbers.length === 0 && (
        <div className="text-gray-500 text-sm">
          Aguardando números...
        </div>
      )}
    </div>
  );
};

export default RouletteNumbers; 