import React, { memo, useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getRouletteNumberColor } from '@/utils/rouletteUtils';

interface LastNumbersProps {
  numbers: number[];
  isLoading?: boolean;
  className?: string;
  isBlurred?: boolean;
}

const LastNumbers = memo(({ numbers, isLoading = false, className = '', isBlurred = false }: LastNumbersProps) => {
  // Garantir que numbers é um array válido
  const safeNumbers = Array.isArray(numbers) ? numbers : [];
  
  // Log para depuração
  useEffect(() => {
    console.log(`[LastNumbers] Recebeu ${safeNumbers.length} números`, 
      safeNumbers.length > 0 ? safeNumbers.slice(0, 5) : 'array vazio');
  }, [safeNumbers]);

  // Manter uma referência aos números exibidos para evitar oscilações
  const displayNumbersRef = useRef<number[]>([]);
  
  // Atualizar os números de exibição apenas quando houver novos números
  useEffect(() => {
    // Só atualizamos os números se:
    // 1. Temos números novos E
    // 2. Os números são diferentes dos que já estamos exibindo
    if (safeNumbers.length > 0 && 
        JSON.stringify(safeNumbers) !== JSON.stringify(displayNumbersRef.current)) {
      console.log(`[LastNumbers] Atualizando displayNumbersRef com ${safeNumbers.length} números`);
      displayNumbersRef.current = [...safeNumbers];
    }
  }, [safeNumbers]);
  
  // Se temos números na ref de exibição, usamos eles (mesmo durante loading)
  // Isso garante que os números permaneçam visíveis mesmo durante refreshes
  const hasStoredNumbers = displayNumbersRef.current.length > 0;
  
  // Não usar mais dados falsos de template
  const shouldUseTemplateData = false;
  
  // Array final de números para exibição
  const displayNumbers = hasStoredNumbers
    ? displayNumbersRef.current
    : [];
  
  // Verificar qual número é novo (para animação)
  const previousRenderRef = useRef<number[]>([]);
  const newNumberIndex = displayNumbers.length > 0 && previousRenderRef.current.length > 0 
    ? (displayNumbers[0] !== previousRenderRef.current[0] ? 0 : -1) 
    : -1;
  
  // Após renderizar, atualizar a referência do render anterior para detectar novos números
  useEffect(() => {
    if (displayNumbers.length > 0) {
      previousRenderRef.current = [...displayNumbers];
    }
  }, [displayNumbers]);
  
  // Mostrar loading apenas no carregamento inicial e quando não temos números armazenados
  if (isLoading && !hasStoredNumbers) {
    return (
      <div className={`flex flex-wrap gap-1.5 my-2 ${className}`}>
        {Array(10).fill(0).map((_, i) => (
          <Skeleton key={i} className="w-7 h-7 rounded-full" />
        ))}
      </div>
    );
  }
  
  // Se não temos dados para exibir
  if (displayNumbers.length === 0) {
    return (
      <div className={`flex flex-wrap gap-1.5 my-2 ${className}`}>
        <div className="w-full text-center text-zinc-500">Sem dados disponíveis</div>
      </div>
    );
  }
  
  // Renderizar números
  return (
    <div 
      className={`h-[74px] flex flex-wrap content-start gap-1 my-2 w-full overflow-hidden ${className}`} 
      data-testid="last-numbers"
      data-numbers-count={displayNumbers.length}
    >
      {displayNumbers.slice(0, 12).map((num, idx) => (
        <div
          key={`${num}-${idx}`}
          className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-xs font-bold 
            ${getRouletteNumberColor(num)}
            ${newNumberIndex === 0 && idx === 0 ? 'animate-pulse shadow-lg transition-all duration-500 scale-110' : ''}
            ${isBlurred ? 'opacity-30 blur-sm' : ''}
          `}
          data-number={num}
          data-new={newNumberIndex === 0 && idx === 0 ? 'true' : 'false'}
        >
          {num}
        </div>
      ))}
    </div>
  );
});

LastNumbers.displayName = 'LastNumbers';

export default LastNumbers;
