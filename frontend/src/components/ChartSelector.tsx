import React, { useState } from 'react';
import SidePanelStats from './SidePanelStats';
import ChartJsStats from './ChartJsStats';
import D3ChartStats from './D3ChartStats';
import NivoChartStats from './NivoChartStats';
import { X } from 'lucide-react';

type ChartLibrary = 'recharts' | 'chartjs' | 'd3' | 'nivo';

interface ChartSelectorProps {
  roletaNome?: string;
  data?: any;
  wins?: number;
  losses?: number;
  onClose?: () => void;
}

const ChartSelector: React.FC<ChartSelectorProps> = ({
  roletaNome = "Roleta",
  data,
  wins = 0,
  losses = 0,
  onClose
}) => {
  const [selectedLibrary, setSelectedLibrary] = useState<ChartLibrary>('recharts');

  const renderSelectedChart = () => {
    switch (selectedLibrary) {
      case 'recharts':
        return (
          <SidePanelStats 
            roletaNome={roletaNome} 
            data={data} 
            wins={wins} 
            losses={losses} 
          />
        );
      case 'chartjs':
        return (
          <ChartJsStats 
            roletaNome={roletaNome} 
            data={data} 
            wins={wins} 
            losses={losses} 
          />
        );
      case 'd3':
        return (
          <D3ChartStats 
            roletaNome={roletaNome} 
            data={data} 
            wins={wins} 
            losses={losses} 
          />
        );
      case 'nivo':
        return (
          <NivoChartStats 
            roletaNome={roletaNome} 
            data={data} 
            wins={wins} 
            losses={losses} 
          />
        );
      default:
        return (
          <SidePanelStats 
            roletaNome={roletaNome} 
            data={data} 
            wins={wins} 
            losses={losses} 
          />
        );
    }
  };

  return (
    <div className="relative">
      {/* Barra de seleção de biblioteca */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#0c0c0e] border-b border-gray-800 p-2 flex justify-between items-center">
        <div className="flex space-x-2">
          <button
            onClick={() => setSelectedLibrary('recharts')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedLibrary === 'recharts'
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Recharts
          </button>
          <button
            onClick={() => setSelectedLibrary('chartjs')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedLibrary === 'chartjs'
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Chart.js
          </button>
          <button
            onClick={() => setSelectedLibrary('d3')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedLibrary === 'd3'
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            D3.js
          </button>
          <button
            onClick={() => setSelectedLibrary('nivo')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedLibrary === 'nivo'
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Nivo
          </button>
        </div>
        
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Ajustar o espaço superior para acomodar a barra de seleção */}
      <div className="pt-14">
        {renderSelectedChart()}
      </div>
    </div>
  );
};

export default ChartSelector; 