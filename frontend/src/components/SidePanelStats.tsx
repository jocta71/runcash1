import React, { useState, useEffect } from 'react';
import { RouletteRacetrack } from './roulette/RouletteRacetrack';

interface SidePanelStatsProps {
  isOpen: boolean;
  onClose: () => void;
}

const SidePanelStats: React.FC<SidePanelStatsProps> = ({ isOpen, onClose }) => {
  // Dados de frequência simulados para demonstração
  const [demoFrequencyData, setDemoFrequencyData] = useState<{ number: number, frequency: number }[]>([]);
  
  // Gerar dados de frequência simulados para demonstração
  useEffect(() => {
    // Gerar dados de frequência para todos os números da roleta (0-36)
    const simulatedData = Array.from({ length: 37 }, (_, i) => ({
      number: i,
      frequency: Math.floor(Math.random() * 20) + 1, // Frequência entre 1 e 20
    }));
    
    setDemoFrequencyData(simulatedData);
  }, []);

  if (!isOpen) return null;
  
  return (
    <div className="w-1/2 h-full fixed right-0 top-0 bg-[#141318] border-l border-[#2a2a2e] overflow-y-auto">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Estatísticas da Roleta</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* Componente RouletteRacetrack com dados simulados */}
          <RouletteRacetrack frequencyData={demoFrequencyData} />
          
          {/* Espaço para mais estatísticas */}
          <div className="rounded-lg border border-[#00ff00]/20 bg-vegas-black-light p-4">
            <h3 className="text-[#00ff00] flex items-center text-base font-bold mb-3">
              Estatísticas Recentes
            </h3>
            <p className="text-gray-300">Mais estatísticas serão exibidas aqui.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SidePanelStats; 