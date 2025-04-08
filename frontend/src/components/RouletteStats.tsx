import { useMemo } from 'react';

interface RouletteStatsProps {
  numbers: number[];
}

const RouletteStats = ({ numbers }: RouletteStatsProps) => {
  const stats = useMemo(() => {
    if (!numbers || numbers.length === 0) {
      return {
        red: 0, 
        black: 0,
        green: 0,
        odd: 0,
        even: 0,
        high: 0,
        low: 0,
        dozens: [0, 0, 0],
        columns: [0, 0, 0]
      };
    }

    // Números vermelhos na roleta europeia
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    
    let red = 0, black = 0, green = 0;
    let odd = 0, even = 0;
    let high = 0, low = 0;
    const dozens = [0, 0, 0];
    const columns = [0, 0, 0];
    
    for (const num of numbers) {
      // Cor
      if (num === 0) {
        green++;
      } else if (redNumbers.includes(num)) {
        red++;
      } else {
        black++;
      }
      
      // Par/ímpar
      if (num !== 0) {
        if (num % 2 === 0) {
          even++;
        } else {
          odd++;
        }
      }
      
      // Alto/baixo
      if (num >= 1 && num <= 18) {
        low++;
      } else if (num >= 19 && num <= 36) {
        high++;
      }
      
      // Dúzias
      if (num >= 1 && num <= 12) {
        dozens[0]++;
      } else if (num >= 13 && num <= 24) {
        dozens[1]++;
      } else if (num >= 25 && num <= 36) {
        dozens[2]++;
      }
      
      // Colunas
      if (num > 0) {
        const column = (num - 1) % 3;
        columns[column]++;
      }
    }
    
    return {
      red, black, green,
      odd, even,
      high, low,
      dozens,
      columns
    };
  }, [numbers]);

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
      <div className="flex justify-between">
        <span>Vermelho:</span>
        <span className="font-medium">{stats.red}</span>
      </div>
      <div className="flex justify-between">
        <span>Preto:</span>
        <span className="font-medium">{stats.black}</span>
      </div>
      <div className="flex justify-between">
        <span>Par:</span>
        <span className="font-medium">{stats.even}</span>
      </div>
      <div className="flex justify-between">
        <span>Ímpar:</span>
        <span className="font-medium">{stats.odd}</span>
      </div>
      <div className="flex justify-between">
        <span>Alto (19-36):</span>
        <span className="font-medium">{stats.high}</span>
      </div>
      <div className="flex justify-between">
        <span>Baixo (1-18):</span>
        <span className="font-medium">{stats.low}</span>
      </div>
      <div className="flex justify-between">
        <span>Verde (0):</span>
        <span className="font-medium">{stats.green}</span>
      </div>
      <div className="flex justify-between">
        <span>Total:</span>
        <span className="font-medium">{numbers.length}</span>
      </div>
    </div>
  );
};

export default RouletteStats; 