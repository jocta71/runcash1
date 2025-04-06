import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { BarChart3, RefreshCw } from 'lucide-react';
import RouletteSidePanelStats from './RouletteSidePanelStats';

interface RouletteMiniStatsProps {
  roletaId: string;
  roletaNome: string;
  lastNumbers?: number[];
}

const RouletteMiniStats: React.FC<RouletteMiniStatsProps> = ({ 
  roletaId, 
  roletaNome, 
  lastNumbers = [] 
}) => {
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  
  const handleOpenStatsModal = () => {
    setIsStatsModalOpen(true);
  };

  return (
    <>
      <Button 
        onClick={handleOpenStatsModal}
        variant="ghost" 
        size="sm" 
        className="flex items-center gap-1 text-xs font-medium hover:bg-green-600/10 hover:text-green-500 transition-colors"
      >
        <BarChart3 className="h-3.5 w-3.5" />
        <span>Estatísticas</span>
      </Button>
      
      {isStatsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-gray-900 w-11/12 max-w-6xl h-[90vh] rounded-lg overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-gray-800">
              <h2 className="text-[#00ff00] text-xl font-bold">Estatísticas da {roletaNome}</h2>
              <button 
                onClick={() => setIsStatsModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <RouletteSidePanelStats
                roletaNome={roletaNome}
                lastNumbers={lastNumbers}
                wins={0}
                losses={0}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RouletteMiniStats; 