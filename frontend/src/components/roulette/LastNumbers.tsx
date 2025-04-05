import React, { useEffect, useState, useRef } from 'react';
import RouletteNumber from './RouletteNumber';
import { Loader2 } from 'lucide-react';

interface LastNumbersProps {
  numbers: number[] | any[];
  className?: string;
  isBlurred?: boolean;
  roletaId?: string;
}

const LastNumbers = ({ numbers, className = '', isBlurred = false, roletaId }: LastNumbersProps) => {
  const [displayNumbers, setDisplayNumbers] = useState<number[]>([]);
  const previousNumbersRef = useRef<number[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Efeito para processar números recebidos
  useEffect(() => {
    // Verificar se há números para processar
    if (!Array.isArray(numbers)) {
      console.log('[LastNumbers] Nenhum array de números recebido');
      setIsLoading(false);
      return;
    }
    
    if (numbers.length === 0) {
      console.log('[LastNumbers] Array de números vazio');
      setIsLoading(false);
      return;
    }
    
    console.log(`[LastNumbers] Recebidos ${numbers.length} números para exibição, primeiro número:`, numbers[0]);
    
    // Converter e validar números (incluindo quando são objetos)
    const validNumbers = numbers.map(num => {
      // Se já é um número válido
      if (typeof num === 'number' && !isNaN(num) && num > 0) {
        return num;
      }
      
      // Se é um objeto, tentar extrair o número
      if (typeof num === 'object' && num !== null) {
        // Verificar propriedade 'numero'
        if ('numero' in num && num.numero !== undefined) {
          const numValue = typeof num.numero === 'number' 
            ? num.numero 
            : parseInt(String(num.numero), 10);
          if (!isNaN(numValue) && numValue > 0) return numValue;
        }
        
        // Verificar propriedade 'value'
        if ('value' in num && num.value !== undefined) {
          const numValue = typeof num.value === 'number'
            ? num.value
            : parseInt(String(num.value), 10);
          if (!isNaN(numValue) && numValue > 0) return numValue;
        }
        
        // Verificar propriedade 'number'
        if ('number' in num && num.number !== undefined) {
          const numValue = typeof num.number === 'number'
            ? num.number
            : parseInt(String(num.number), 10);
          if (!isNaN(numValue) && numValue > 0) return numValue;
        }
      }
      
      // Se é uma string, tentar converter
      if (typeof num === 'string' && num.trim() !== '') {
        const parsed = parseInt(num, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
      
      // Se chegou aqui, o número é inválido
      return NaN;
    }).filter(num => !isNaN(num) && num > 0);
    
    // Verificar se ainda temos números após a filtragem
    if (validNumbers.length > 0) {
      console.log(`[LastNumbers] Números válidos após filtragem: ${validNumbers.length}, primeiro: ${validNumbers[0]}`);
      
      // Verificar mudança real nos números
      const hasNewNumbers = previousNumbersRef.current.length === 0 || 
                            validNumbers[0] !== previousNumbersRef.current[0];
                            
      if (hasNewNumbers) {
        // Animar a transição de números (breve flash)
        setIsUpdating(true);
        setTimeout(() => setIsUpdating(false), 300);
        
        // Atualizar os números exibidos
        setDisplayNumbers(validNumbers);
        previousNumbersRef.current = validNumbers;
      }
    } else {
      console.log('[LastNumbers] Todos os números foram filtrados como inválidos. Dados originais:', 
        numbers.slice(0, 3)); // Mostrar até 3 primeiros itens para debug
    }
    
    setIsLoading(false);
  }, [numbers]);

  // Verificar se temos números válidos para exibir
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-4 text-zinc-500 ${className}`}>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        <span>Carregando...</span>
      </div>
    );
  }

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
