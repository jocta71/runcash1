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
  // Função para determinar a cor com base no número
  const getNumberColor = (num: number): string => {
    if (num === 0) {
      return '#00a651'; // Verde para o zero
    } else if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num)) {
      return '#e71d36'; // Vermelho
    }
    return '#1e1e24'; // Preto
  };

  return (
    <NumberCircle 
      color={getNumberColor(number)}
      highcontrast={isHighContrast ? 'true' : 'false'}
      size={size}
    >
      {number}
    </NumberCircle>
  );
};

export default RouletteNumber; 