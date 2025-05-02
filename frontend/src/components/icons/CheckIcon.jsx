import React from 'react';

/**
 * Fallback para o ícone Check do Material UI
 * Este componente é utilizado caso o pacote @mui/icons-material não esteja disponível
 */
const CheckIcon = (props) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
};

export default CheckIcon; 