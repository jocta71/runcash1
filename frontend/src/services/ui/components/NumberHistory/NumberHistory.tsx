import React from 'react';
import './NumberHistory.css';

// Interface para as props do componente
interface NumberHistoryProps {
  numbers: Array<{
    value: number;
    color: string;
    timestamp: number;
  }>;
  maxItems?: number;
}

/**
 * Componente para exibir o histórico de números de uma roleta
 */
const NumberHistory: React.FC<NumberHistoryProps> = ({ 
  numbers, 
  maxItems = 20 
}) => {
  // Se não houver números, exibir mensagem
  if (!numbers || numbers.length === 0) {
    return (
      <div className="number-history empty">
        <div className="history-title">Histórico de Números</div>
        <p>Sem histórico disponível</p>
      </div>
    );
  }
  
  // Limitar a quantidade de números exibidos
  const limitedNumbers = numbers.slice(0, maxItems);
  
  // Contar a quantidade de cada cor para exibir estatísticas
  const redCount = limitedNumbers.filter(n => n.color === 'red').length;
  const blackCount = limitedNumbers.filter(n => n.color === 'black').length;
  const greenCount = limitedNumbers.filter(n => n.color === 'green').length;
  
  return (
    <div className="number-history">
      <div className="history-title">Histórico de Números</div>
      
      <div className="number-grid">
        {limitedNumbers.map((number, index) => (
          <div 
            key={`${number.value}-${index}`}
            className={`number-circle ${number.color}`}
            title={new Date(number.timestamp).toLocaleString()}
          >
            {number.value}
          </div>
        ))}
      </div>
      
      <div className="history-stats">
        <div className="stat red">
          <span className="label">Vermelhos:</span>
          <span className="value">{redCount}</span>
        </div>
        <div className="stat black">
          <span className="label">Pretos:</span>
          <span className="value">{blackCount}</span>
        </div>
        <div className="stat green">
          <span className="label">Verdes:</span>
          <span className="value">{greenCount}</span>
        </div>
      </div>
    </div>
  );
};

export default NumberHistory; 