import React from 'react';
import { styled } from '@mui/material/styles';

interface RouletteNumberProps {
  number: number;
  isHighContrast?: boolean;
  size?: 'small' | 'medium' | 'mini';
}

// Componente estilizado para os números da roleta
const NumberCircle = styled('div')<{ 
  color: string; 
  highcontrast?: string;
  size?: string;
}>(({ theme, color, highcontrast, size }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  backgroundColor: color,
  color: '#fff',
  fontWeight: 'bold',
  width: size === 'small' ? '30px' : size === 'mini' ? '24px' : '40px',
  height: size === 'small' ? '30px' : size === 'mini' ? '24px' : '40px',
  fontSize: size === 'small' ? '12px' : size === 'mini' ? '10px' : '16px',
  boxShadow: highcontrast === 'true' ? '0 0 6px rgba(255, 255, 255, 0.5)' : 'none',
  border: highcontrast === 'true' ? '1px solid rgba(255, 255, 255, 0.8)' : 'none',
  transition: 'transform 0.2s ease',
  '&:hover': {
    transform: 'scale(1.1)',
  },
}));

const RouletteNumber: React.FC<RouletteNumberProps> = ({ 
  number, 
  isHighContrast = false,
  size = 'medium'
}) => {
  // Validar o número para garantir que é um valor válido para renderização
  const safeNumber = React.useMemo(() => {
    // Se for um número na faixa válida (0-36), usar como está
    if (typeof number === 'number' && !isNaN(number) && number >= 0 && number <= 36) {
      return number;
    }
    
    // Se for uma string numérica, converter para número
    if (typeof number === 'string') {
      const parsed = parseInt(number, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 36) {
        return parsed;
      }
    }
    
    // Valor padrão seguro para números inválidos
    console.warn(`RouletteNumber recebeu um valor inválido: ${number}, usando 0 como fallback`);
    return 0;
  }, [number]);

  // Função para determinar a cor com base no número
  const getNumberColor = (num: number): string => {
    try {
      if (num === 0) {
        return '#00a651'; // Verde para o zero
      } else if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num)) {
        return '#e71d36'; // Vermelho
      }
      return '#1e1e24'; // Preto
    } catch (error) {
      console.error('Erro ao determinar cor do número:', error);
      return '#1e1e24'; // Cor padrão em caso de erro
    }
  };

  return (
    <NumberCircle 
      color={getNumberColor(safeNumber)}
      highcontrast={isHighContrast ? 'true' : 'false'}
      size={size}
    >
      {safeNumber}
    </NumberCircle>
  );
};

export default RouletteNumber; 