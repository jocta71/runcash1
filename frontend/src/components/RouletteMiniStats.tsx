import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { BarChart3, RefreshCw } from 'lucide-react';
import RouletteStatsModal from './RouletteStatsModal';

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
      
      <RouletteStatsModal
        open={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
        roletaNome={roletaNome}
        lastNumbers={lastNumbers}
        wins={0}
        losses={0}
      />
    </>
  );
};

export default RouletteMiniStats; 