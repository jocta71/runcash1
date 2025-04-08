import React from 'react';

interface SidePanelStatsProps {
  children: React.ReactNode;
}

const SidePanelStats: React.FC<SidePanelStatsProps> = ({ children }) => {
  return (
    <div className="w-1/2 h-full fixed right-0 top-0 bg-[#141318] border-l border-[#2a2a2e] overflow-y-auto">
      {children}
    </div>
  );
};

export default SidePanelStats; 
