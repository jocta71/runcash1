import React, { useEffect, useState, useRef } from 'react';
import RouletteNumber from './RouletteNumber';
import { Loader2 } from 'lucide-react';

interface LastNumbersProps {
  numbers: number[];
  className?: string;
  isBlurred?: boolean;
  roletaId?: string; // Adicionado para permitir vinculação direta ao endpoint
}

const LastNumbers = ({ numbers, className = '', isBlurred = false, roletaId }: LastNumbersProps) => {
  const [displayNumbers, setDisplayNumbers] = useState<number[]>([]);
  const previousNumbersRef = useRef<number[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  // Efeito para processar números recebidos
  useEffect(() => {
    // Verificar se os números mudaram de forma significativa
    const hasNewNumbers = Array.isArray(numbers) && numbers.length > 0 && 
      (previousNumbersRef.current.length === 0 || numbers[0] !== previousNumbersRef.current[0]);
    
    if (hasNewNumbers) {
      console.log(`[LastNumbers] Recebidos ${numbers.length} números para exibição, primeiro número: ${numbers[0]}`);
      
      // Filtrar zeros solitários que são provavelmente placeholders
      const validNumbers = numbers.filter(num => {
        // Se não é um número válido, filtrar
        if (typeof num !== 'number' || isNaN(num)) return false;
        
        // Se há vários números, permitir zeros (pois provavelmente são números reais)
        if (numbers.length > 4) return true;
        
        // Para sequências curtas, filtrar zeros (prováveis placeholders)
        return num !== 0;
      });
      
      // Verificar se ainda temos números após a filtragem
      if (validNumbers.length > 0) {
        // Animar a transição de números (breve flash)
        setIsUpdating(true);
        setTimeout(() => setIsUpdating(false), 300);
        
        // Atualizar os números exibidos
        setDisplayNumbers(validNumbers);
        previousNumbersRef.current = validNumbers;
      } else if (numbers.length > 0 && validNumbers.length === 0) {
        console.log('[LastNumbers] Todos os números foram filtrados como inválidos');
      }
    }
  }, [numbers]);

  // Mover a validação para o efeito acima e simplificar o render
  // Verificar se temos números válidos para exibir
  if (displayNumbers.length === 0) {
    return (
      <div className={`flex items-center justify-center py-4 text-zinc-500 ${className}`}>
        {isUpdating ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <span>Sem dados disponíveis</span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 justify-center ${className} ${isUpdating ? 'opacity-70 transition-opacity duration-300' : ''}`}>
      {displayNumbers.map((number, index) => (
        <RouletteNumber
          key={`${number}-${index}`}
          number={number}
          size="md"
          isBlurred={isBlurred}
        />
      ))}
    </div>
  );
};

export default LastNumbers;
