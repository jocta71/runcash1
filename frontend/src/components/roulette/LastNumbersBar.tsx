import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import EventService from '@/services/EventService';
import RouletteFeedService from '@/services/RouletteFeedService';
import { cn } from '@/lib/utils';
import { RouletteNumberEvent } from '@/types';

interface RouletteNumbersProps {
  tableId: string;
  tableName: string;
  className?: string;
  onNumberClick?: (index: number, number: number) => void;
  interactive?: boolean;
  limit?: number;
  isBlurred?: boolean;
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

  const feedService = RouletteFeedService.getInstance();

  // Carregar números iniciais e configurar o estado
  useEffect(() => {
    try {
      // Garantir que feedService é válido
      if (!feedService) {
        console.error('[LastNumbersBar] FeedService não está disponível');
        setNumbers([]);
        return;
      }

      // Obter números iniciais com verificação defensiva
      let initialNumbers = [];
      try {
        initialNumbers = feedService.getLastNumbersForTable(tableId) || [];
        // Converter para números se for array de strings
        initialNumbers = initialNumbers.map(n => typeof n === 'string' ? parseInt(n, 10) : n);
        // Filtrar valores NaN
        initialNumbers = initialNumbers.filter(n => !isNaN(n));
      } catch (err) {
        console.error(`[LastNumbersBar] Erro ao obter números iniciais para ${tableName}:`, err);
        initialNumbers = [];
      }

      console.log(`[LastNumbersBar] Carregados ${initialNumbers.length} números iniciais para ${tableName}`);
      setNumbers(initialNumbers);
      
      // Iniciar a animação se houver números
      if (initialNumbers.length > 0) {
        setHighlightIndex(initialNumbers[0]);
        startHighlightAnimation();
      }
    } catch (error) {
      console.error(`[LastNumbersBar] Erro durante inicialização para ${tableName}:`, error);
      setNumbers([]);
    }
  }, [tableId, tableName]);

  // Manipulador para quando um novo número é adicionado
  const handleRouletteUpdate = useCallback((data: any) => {
    try {
      // Verificar se os dados do evento são válidos
      if (!data || !data.tableId) {
        console.warn('[LastNumbersBar] Dados de atualização inválidos:', data);
        return;
      }

      // Verificar se esta atualização é para nossa mesa
      if (data.tableId !== tableId) {
        return;
      }

      // Log para debug
      console.log(`[LastNumbersBar] Atualização para ${tableName}:`, {
        isNewNumber: data.isNewNumber,
        numbersLength: data.numbers?.length || 0
      });

      // Verificar se temos novos números
      if (data.isNewNumber && Array.isArray(data.numbers) && data.numbers.length > 0) {
        // Obter números atualizados de forma segura
        let updatedNumbers = [];
        try {
          updatedNumbers = data.numbers.map((n: any) => typeof n === 'string' ? parseInt(n, 10) : n);
          updatedNumbers = updatedNumbers.filter((n: any) => !isNaN(n));
        } catch (err) {
          console.error(`[LastNumbersBar] Erro ao processar números:`, err);
          return;
        }

        if (updatedNumbers.length === 0) {
          console.warn('[LastNumbersBar] Nenhum número válido após processamento');
          return;
        }

        // Atualizar estado de números
        setNumbers(updatedNumbers);
        
        // Destacar o novo número
        console.log(`[LastNumbersBar] NOVO NÚMERO DESTACADO para ${tableName}: ${updatedNumbers[0]}`);
        setHighlightIndex(updatedNumbers[0]);
        startHighlightAnimation();
      }
    } catch (error) {
      console.error(`[LastNumbersBar] Erro ao processar atualização para ${tableName}:`, error);
    }
  }, [tableId, tableName]);

  const handleClick = () => {
    // Navegar para página detalhada da roleta ao clicar
    navigate(`/roulette/${tableId}`);
  };

  const startHighlightAnimation = () => {
    // Implemente a lógica para iniciar a animação de destaque
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
          {numbers.map((number, index) => {
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