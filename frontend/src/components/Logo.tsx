import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = '' }) => {
  return (
    <a href="/">
      <ips-icon name="logo" className={`max-xl:hidden w-36 flex ${className}`}>
        <img 
          className="w-full h-full" 
          alt="logo" 
          loading="lazy" 
          fetchPriority="low" 
          src="/img/logo.svg" 
        />
      </ips-icon>
    </a>
  );
};

export default Logo; 