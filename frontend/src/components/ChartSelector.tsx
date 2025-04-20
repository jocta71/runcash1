import React, { useState, useEffect } from 'react';
import SidePanelStats from './SidePanelStats';
import ChartJsStats from './ChartJsStats';
import D3ChartStats from './D3ChartStats';
import NivoChartStats from './NivoChartStats';
import { X } from 'lucide-react';

type ChartLibrary = 'recharts' | 'chartjs' | 'd3' | 'nivo';

interface ColorData {
  name: string;
  value: number;
  color: string;
}

interface FrequencyData {
  number: string;
  frequency: number;
}

interface ChartSelectorProps {
  roletaNome?: string;
  data?: {
    colorDistribution?: ColorData[];
    frequencyData?: FrequencyData[];
    [key: string]: any;
  };
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
  const [selectedLibrary, setSelectedLibrary] = useState<ChartLibrary>('nivo');
  
  // Dados padronizados para todos os componentes
  const [standardizedData, setStandardizedData] = useState({
    colorDistribution: [
      { name: "Vermelhos", value: 50, color: "#ef4444" },
      { name: "Pretos", value: 45, color: "#111827" },
      { name: "Zero", value: 5, color: "#059669" },
    ],
    frequencyData: [
      { number: "0", frequency: 5 },
      { number: "1-9", frequency: 15 },
      { number: "10-18", frequency: 20 },
      { number: "19-27", frequency: 18 },
      { number: "28-36", frequency: 12 },
    ]
  });

  // Processa os dados recebidos para garantir formato padronizado
  useEffect(() => {
    console.log("Dados originais recebidos:", data);
    
    // Se temos dados válidos, vamos padronizá-los
    if (data) {
      const newData = {...standardizedData};
      
      // Verifica e normaliza colorDistribution
      if (data.colorDistribution && Array.isArray(data.colorDistribution) && data.colorDistribution.length > 0) {
        newData.colorDistribution = data.colorDistribution.map(item => ({
          name: item.name || "Desconhecido",
          value: typeof item.value === 'number' ? item.value : 0,
          color: item.color || "#666666"
        }));
      }
      
      // Verifica e normaliza frequencyData
      if (data.frequencyData && Array.isArray(data.frequencyData) && data.frequencyData.length > 0) {
        newData.frequencyData = data.frequencyData.map(item => ({
          number: item.number || "Desconhecido",
          frequency: typeof item.frequency === 'number' ? item.frequency : 0
        }));
      }
      
      console.log("Dados padronizados:", newData);
      setStandardizedData(newData);
    }
  }, [data]);

  const renderSelectedChart = () => {
    switch (selectedLibrary) {
      case 'recharts':
        return (
          <SidePanelStats 
            roletaNome={roletaNome} 
            data={standardizedData} 
            wins={wins} 
            losses={losses} 
          />
        );
      case 'chartjs':
        return (
          <ChartJsStats 
            roletaNome={roletaNome} 
            data={standardizedData} 
            wins={wins} 
            losses={losses} 
          />
        );
      case 'd3':
        return (
          <D3ChartStats 
            roletaNome={roletaNome} 
            data={standardizedData} 
            wins={wins} 
            losses={losses} 
          />
        );
      case 'nivo':
        return (
          <NivoChartStats 
            roletaNome={roletaNome} 
            data={standardizedData} 
            wins={wins} 
            losses={losses} 
          />
        );
      default:
        return (
          <NivoChartStats 
            roletaNome={roletaNome} 
            data={standardizedData} 
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