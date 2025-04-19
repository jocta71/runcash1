import React from 'react';
import RouletteStatsInline from './roulette/RouletteStatsInline';
import { RouletteData } from '@/types';

interface RouletteStatsModalProps {
  roulette: RouletteData;
  onClose: () => void;
}

const RouletteStatsModal: React.FC<RouletteStatsModalProps> = ({ roulette, onClose }) => {
  // Extrair números para estatísticas
  const lastNumbers = (roulette.numero || []).map(n => 
    typeof n === 'number' ? n : n.numero
  );

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
      <div className="bg-gray-900 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center p-4 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">{roulette.nome || roulette.name} - Estatísticas</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <RouletteStatsInline 
          roletaNome={roulette.nome || roulette.name || ''} 
          lastNumbers={lastNumbers} 
        />
      </div>
    </div>
  );
};

export default RouletteStatsModal; 