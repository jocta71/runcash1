import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { cn } from '../lib/utils';

const LastNumbers: React.FC<LastNumbersProps> = ({
  numbers = [],
  override = [],
  isLoading = false,
  maxItems = 8,
  highlightedNumber,
}) => {
  // Usar estado local para rastrear números que foram vistos após a renderização inicial
  const [seenNumbersInRealtime, setSeenNumbersInRealtime] = useState<Record<number, boolean>>({});
  const [lastRender, setLastRender] = useState<string>(new Date().toISOString());
  
  // Identificar números que vieram em tempo real após a primeira renderização
  useEffect(() => {
    if (override && override.length > 0) {
      const currentNumbers = override.filter(item => item.numero > 0)
                               .map(item => item.numero);
      
      // Registrar novos números vistos
      const newSeenNumbers = { ...seenNumbersInRealtime };
      currentNumbers.forEach(num => {
        if (num > 0 && !newSeenNumbers[num]) {
          newSeenNumbers[num] = true;
        }
      });
      
      setSeenNumbersInRealtime(newSeenNumbers);
      setLastRender(new Date().toISOString());
    }
  }, [override]);

  // Lógica para filtrar e combinar dados
  const processedNumbers = useMemo(() => {
    // Usar override quando disponível, senão usar numbers
    let displayNumbers: number[] = [];
    
    if (override && override.length > 0) {
      // Filtrar zeros e extrair números do override
      displayNumbers = override
        .filter(item => item.numero > 0) // Filtra zeros
        .map(item => item.numero);
    } else if (numbers && numbers.length > 0) {
      // Filtrar zeros dos números normais
      displayNumbers = numbers.filter(n => n > 0);
    }
    
    // Se não houver números válidos após a filtragem, retornar array vazio
    if (!displayNumbers.length) {
      return [];
    }
    
    // Limitar ao número máximo de itens
    return displayNumbers.slice(0, maxItems);
  }, [numbers, override, maxItems]);

  // Função para verificar se um número chegou em tempo real
  const isRealtimeNumber = useCallback((num: number): boolean => {
    // Verificar se existe no registro de números vistos em tempo real
    return !!seenNumbersInRealtime[num];
  }, [seenNumbersInRealtime]);

  // Função para verificar se um número é o mais recente
  const isLatestNumber = useCallback((num: number, index: number): boolean => {
    return index === 0 && processedNumbers.length > 0;
  }, [processedNumbers]);

  // Se estiver carregando, mostrar estado de carregamento
  if (isLoading) {
    return (
      <div className="flex items-center justify-between gap-2 p-2">
        {Array.from({ length: maxItems }).map((_, index) => (
          <div
            key={`skeleton-${index}`}
            className="h-9 w-9 rounded-full bg-background/30 animate-pulse flex items-center justify-center"
          />
        ))}
      </div>
    );
  }

  // Se não houver números para mostrar, mostrar mensagem
  if (!processedNumbers.length) {
    return (
      <div className="flex items-center justify-center p-2 text-muted-foreground text-sm">
        Aguardando números...
      </div>
    );
  }

  // Renderizar números com destaque para tempo real
  return (
    <div className="flex items-center justify-between gap-2 p-2 overflow-x-auto">
      {processedNumbers.map((num, index) => {
        const isHighlighted = num === highlightedNumber;
        const isLatest = isLatestNumber(num, index);
        const isRealtime = isRealtimeNumber(num);
        
        return (
          <div
            key={`number-${index}-${num}`}
            className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center transition-all duration-300",
              {
                "bg-primary text-primary-foreground animate-pulse": isHighlighted,
                "bg-amber-500 text-primary-foreground": isLatest && !isHighlighted,
                "border-2 border-green-500": isRealtime && !isHighlighted && !isLatest,
                "bg-card text-card-foreground": !isHighlighted && !isLatest && !isRealtime,
              }
            )}
          >
            {num}
          </div>
        );
      })}
      <div 
        className="text-xs text-muted-foreground absolute right-1 top-1 opacity-50"
        style={{ fontSize: '0.6rem' }}
      >
        {processedNumbers.length > 0 ? `${processedNumbers.length} números` : ''}
      </div>
    </div>
  );
};

export default LastNumbers; 