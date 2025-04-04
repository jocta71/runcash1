import React, { memo, useMemo } from 'react';

interface RouletteNumberProps {
  number: number | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  isBlurred?: boolean;
}

// Os números vermelhos na roleta
const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

// Função para determinar a cor do número movida para fora do componente
export const determinarCorNumero = (num: number): string => {
  // Verificar se o número é válido
  if (num === null || num === undefined || isNaN(num)) {
    console.warn(`[RouletteNumber] Número inválido: ${num}, usando fallback`);
    return "bg-zinc-600 text-white"; // Cor padrão para números inválidos
  }
  
  // Verificar o número 0 (verde)
  if (num === 0) {
    return "bg-vegas-green text-white";
  }
  
  // Verificar se é vermelho ou preto
  if (redNumbers.includes(num)) {
    return "bg-red-600 text-white";
  } else {
    return "bg-black text-white";
  }
};

// Componente otimizado com memo para evitar re-renderizações desnecessárias
const RouletteNumber = memo(({ 
  number, 
  className = '', 
  size = 'md',
  isBlurred = false
}: RouletteNumberProps) => {
  // Verificar se o número é válido - usar 0 como fallback para valores inválidos
  const safeNumber = useMemo(() => {
    if (number === null || number === undefined) return 0;
    
    // Tentar converter para número
    const num = typeof number === 'string' ? parseInt(number, 10) : Number(number);
    
    // Verificar se é um número válido
    return isNaN(num) ? 0 : num;
  }, [number]);
  
  // Determinar tamanho baseado na prop
  const sizeClass = useMemo(() => {
    switch (size) {
      case 'sm': return 'w-4 h-4 text-[8px]';
      case 'lg': return 'w-12 h-12 text-base';
      case 'md':
      default: return 'w-6 h-6 text-[10px]';
    }
  }, [size]);
  
  // Usar useMemo para calcular a classe de cor apenas quando o número muda
  const colorClass = useMemo(() => determinarCorNumero(safeNumber), [safeNumber]);
  
  // Classe para blur condicional
  const blurClass = isBlurred ? 'filter blur-sm' : '';

  return (
    <div
      className={`rounded-full ${colorClass} ${sizeClass} ${blurClass} flex items-center justify-center font-medium ${className}`}
    >
      {safeNumber}
    </div>
  );
});

// Adiciona um nome de exibição para melhorar a depuração
RouletteNumber.displayName = 'RouletteNumber';

export default RouletteNumber;
