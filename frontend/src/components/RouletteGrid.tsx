import React from 'react';

interface RouletteGridProps {
  children: React.ReactNode;
}

const RouletteGrid: React.FC<RouletteGridProps> = ({ children }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-4">
      {children}
    </div>
  );
};

export default RouletteGrid; 
