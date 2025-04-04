import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EventService from '@/services/EventService';
import RouletteFeedService from '@/services/RouletteFeedService';

interface RouletteNumbersProps {
  tableId: string;
  tableName: string;
}

const LastNumbersBar = ({ tableId, tableName }: RouletteNumbersProps) => {
  const [numbers, setNumbers] = useState<string[]>([]);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Iniciar o serviço de dados se não estiver rodando
    const feedService = RouletteFeedService.getInstance();
    feedService.startPolling();

    // Carregar números iniciais se disponíveis
    const initialNumbers = feedService.getLastNumbersForTable(tableId);
    if (initialNumbers && initialNumbers.length > 0) {
      setNumbers(initialNumbers);
    }

    // Função para receber atualizações
    const handleNumbersUpdate = (data: any) => {
      if (data.tableId === tableId) {
        setNumbers(data.numbers);
        setHighlightIndex(0); // Destacar o número mais recente
        
        // Remover o destaque após 2 segundos
        setTimeout(() => {
          setHighlightIndex(null);
        }, 2000);
      }
    };

    // Inscrever-se no evento de atualização
    EventService.on('roulette:numbers-updated', handleNumbersUpdate);

    // Limpar ao desmontar
    return () => {
      EventService.off('roulette:numbers-updated', handleNumbersUpdate);
    };
  }, [tableId]);

  // Função para obter a classe CSS baseada no número
  const getNumberClass = (number: string, index: number) => {
    const baseClass = 'flex justify-center items-center rounded-full w-7 h-7 text-white font-bold text-sm';
    
    // Adicionar classe de destaque se for o número recém-adicionado
    const highlightClass = highlightIndex === index ? 'animate-pulse ring-2 ring-yellow-400' : '';
    
    // Determinar cor de fundo com base no valor do número
    let bgColorClass = 'bg-gray-700'; // Default
    
    if (number === '0') {
      bgColorClass = 'bg-green-600';
    } else if (parseInt(number) > 0 && parseInt(number) <= 36) {
      // Vermelho ou preto baseado na regra da roleta
      const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
      bgColorClass = redNumbers.includes(parseInt(number)) 
        ? 'bg-red-600' 
        : 'bg-black';
    }
    
    return `${baseClass} ${bgColorClass} ${highlightClass}`;
  };

  const handleClick = () => {
    // Navegar para página detalhada da roleta ao clicar
    navigate(`/roulette/${tableId}`);
  };

  return (
    <div 
      className="flex flex-col space-y-1 bg-gray-800 p-2 rounded-md cursor-pointer hover:bg-gray-700 transition-colors"
      onClick={handleClick}
    >
      <div className="text-xs text-white font-medium mb-1 truncate">{tableName}</div>
      <div className="flex flex-wrap gap-1">
        {numbers.slice(0, 10).map((number, index) => (
          <div 
            key={`${tableId}-${index}`} 
            className={getNumberClass(number, index)}
          >
            {number}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LastNumbersBar; 