import { useEffect, useState, useRef } from 'react';
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
  const previousNumbersRef = useRef<string[]>([]);
  const navigate = useNavigate();
  
  // Flag para forçar atualizações
  const updateCounter = useRef<number>(0);
  
  // Usado para depuração
  const logUpdates = useRef<boolean>(true);

  useEffect(() => {
    // Iniciar o serviço de dados se não estiver rodando
    const feedService = RouletteFeedService.getInstance();
    feedService.startPolling();

    // Carregar números iniciais se disponíveis
    const initialNumbers = feedService.getLastNumbersForTable(tableId);
    if (initialNumbers && initialNumbers.length > 0) {
      if (logUpdates.current) {
        console.log(`[LastNumbersBar] Carregados ${initialNumbers.length} números iniciais para ${tableName}`);
      }
      setNumbers(initialNumbers);
      previousNumbersRef.current = [...initialNumbers];
    }

    // Função para receber atualizações
    const handleNumbersUpdate = (data: any) => {
      if (data.tableId === tableId) {
        const newNumbers = data.numbers || [];
        
        // Verificar se há novos números (comparando com os anteriores)
        const hasNewNumber = newNumbers.length > 0 && 
                             (previousNumbersRef.current.length === 0 || 
                              newNumbers[0] !== previousNumbersRef.current[0]);
        
        console.log(`[LastNumbersBar] Atualização para ${tableName}:`, {
          novos: newNumbers.slice(0, 5),
          anteriores: previousNumbersRef.current.slice(0, 5),
          novoDetectado: hasNewNumber,
          isNewNumber: data.isNewNumber,
          contadorAtualizacoes: updateCounter.current
        });
        
        // Atualizar os números apenas se houver mudança real
        if (JSON.stringify(newNumbers) !== JSON.stringify(previousNumbersRef.current)) {
          setNumbers(newNumbers);
          previousNumbersRef.current = [...newNumbers];
          updateCounter.current++; // Incrementar contador para forçar renderização
          
          // Destacar se há novo número ou se a flag isNewNumber estiver definida
          if (hasNewNumber || data.isNewNumber) {
            console.log(`[LastNumbersBar] NOVO NÚMERO DESTACADO para ${tableName}: ${newNumbers[0]}`);
            setHighlightIndex(0);
            
            // Remover o destaque após 3 segundos
            setTimeout(() => {
              setHighlightIndex(null);
            }, 3000);
          }
        }
      }
    };

    // Função para receber notificação de novo número
    const handleNewNumber = (data: any) => {
      if (data.tableId === tableId) {
        console.log(`[LastNumbersBar] Evento de novo número recebido para ${tableName}: ${data.number}`);
        // Atualizar para garantir que temos os dados mais recentes
        const updatedNumbers = feedService.getLastNumbersForTable(tableId);
        
        if (updatedNumbers.length > 0) {
          setNumbers(updatedNumbers);
          previousNumbersRef.current = [...updatedNumbers];
          updateCounter.current++; // Incrementar contador
          
          // Destacar o número mais recente
          setHighlightIndex(0);
          
          // Remover o destaque após 3 segundos
          setTimeout(() => {
            setHighlightIndex(null);
          }, 3000);
        }
      }
    };

    // Configurar um intervalo para verificar atualizações regularmente
    const intervalId = setInterval(() => {
      // Obter os últimos números conhecidos para esta mesa
      const latestNumbers = feedService.getLastNumbersForTable(tableId);
      
      // Verificar se os números mudaram
      if (JSON.stringify(latestNumbers) !== JSON.stringify(previousNumbersRef.current)) {
        console.log(`[LastNumbersBar] Números atualizados durante verificação para ${tableName}:`, {
          novos: latestNumbers.slice(0, 5),
          anteriores: previousNumbersRef.current.slice(0, 5)
        });
        
        setNumbers(latestNumbers);
        previousNumbersRef.current = [...latestNumbers];
        
        // Se o primeiro número mudou, destacar
        if (latestNumbers.length > 0 && 
            (previousNumbersRef.current.length === 0 || 
             latestNumbers[0] !== previousNumbersRef.current[0])) {
          setHighlightIndex(0);
          
          // Remover o destaque após 3 segundos
          setTimeout(() => {
            setHighlightIndex(null);
          }, 3000);
        }
      }
    }, 5000); // Verificar a cada 5 segundos

    // Inscrever-se nos eventos de atualização
    EventService.on('roulette:numbers-updated', handleNumbersUpdate);
    EventService.on('roulette:new-number', handleNewNumber);

    // Limpar ao desmontar
    return () => {
      EventService.off('roulette:numbers-updated', handleNumbersUpdate);
      EventService.off('roulette:new-number', handleNewNumber);
      clearInterval(intervalId);
    };
  }, [tableId, tableName]);

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
            const highlightClass = highlightIndex === index ? 'highlight-new' : '';
            
            return (
              <div 
                key={`${tableId}-${index}-${number}-${updateCounter.current}`}
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