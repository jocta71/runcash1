import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface RouletteNumbersProps {
  tableId: string;
  tableName: string;
  numbers: number[];
  className?: string;
  onNumberClick?: (index: number, number: number) => void;
  interactive?: boolean;
  limit?: number;
  isBlurred?: boolean;
}

// Função para determinar a classe CSS correta com base no número
const getNumberColorClass = (number: number): string => {
  const num = number;
  
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

const LastNumbersBar = ({ 
  tableId, 
  tableName, 
  numbers,
  className,
  interactive = true,
  limit = 10
}: RouletteNumbersProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (interactive) {
      navigate(`/roulette/${tableId}`);
    }
  };

  const displayNumbers = Array.isArray(numbers) ? numbers.slice(0, limit) : [];

  return (
    <div 
      className={`cy-live-casino-grid-item ${className || ''}`.trim()}
      onClick={handleClick}
      style={{ cursor: interactive ? 'pointer' : 'default' }}
    >
      <div className="sc-jhRbCK dwoBEu cy-live-casino-grid-item-infobar">
        <div className="sc-hGwcmR dYPzjx cy-live-casino-grid-item-infobar-dealer-name">
          {tableName}
        </div>
        <div className="sc-brePHE gjvwkd cy-live-casino-grid-item-infobar-draws">
          {displayNumbers.map((number, index) => {
            const colorClass = getNumberColorClass(number);
            
            return (
              <div 
                key={`${tableId}-${index}-${number}`}
                className={`${colorClass}`}
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