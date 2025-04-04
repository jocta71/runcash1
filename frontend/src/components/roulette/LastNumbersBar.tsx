import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EventService from '@/services/EventService';
import RouletteFeedService from '@/services/RouletteFeedService';

interface RouletteNumbersProps {
  tableId: string;
  tableName: string;
}

// Função para determinar a classe CSS correta com base no número
const getNumberColorClass = (number: string): string => {
  const num = parseInt(number, 10);
  
  // Zero é verde
  if (num === 0) {
    return 'sc-kJLGgd iDZRwn'; // Classe verde observada no site
  }
  
  // Verificar se é número vermelho
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  if (redNumbers.includes(num)) {
    return 'sc-kJLGgd dPOPqL'; // Classe vermelha observada no site
  }
  
  // Caso contrário é preto
  return 'sc-kJLGgd bYTuoA'; // Classe preta observada no site
};

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

  const handleClick = () => {
    // Navegar para página detalhada da roleta ao clicar
    navigate(`/roulette/${tableId}`);
  };

  return (
    <div 
      className="cy-live-casino-grid-item"
      onClick={handleClick}
    >
      <div className="sc-jhRbCK dwoBEu cy-live-casino-grid-item-infobar">
        <div className="sc-hGwcmR dYPzjx cy-live-casino-grid-item-infobar-dealer-name">
          {tableName}
        </div>
        <div className="sc-brePHE gjvwkd cy-live-casino-grid-item-infobar-draws">
          {numbers.slice(0, 5).map((number, index) => {
            const colorClass = getNumberColorClass(number);
            const highlightClass = highlightIndex === index ? 'animate-pulse' : '';
            
            return (
              <div 
                key={`${tableId}-${index}`} 
                className={`${colorClass} ${highlightClass}`}
                style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
              >
                <span>{number}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LastNumbersBar; 