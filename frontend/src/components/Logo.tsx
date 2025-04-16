import React from 'react';

interface LogoProps {
  className?: string;
  width?: number | string;
}

const Logo: React.FC<LogoProps> = ({ className = '', width = 240 }) => {
  return (
    <div className={`flex items-center justify-center ${className}`} style={{ width: typeof width === 'number' ? `${width}px` : width }}>
      <img 
        src="/img/logo.svg" 
        alt="RunCash Logo" 
        style={{ 
          width: '100%',
          height: 'auto',
          objectFit: 'contain',
          display: 'block'
        }} 
      />
    </div>
  );
};

export default Logo; 