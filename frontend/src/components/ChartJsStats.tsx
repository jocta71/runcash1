import React, { useState, useEffect } from 'react';
import { 
  Chart as ChartJS, 
  ArcElement, 
  Tooltip, 
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
} from 'chart.js';
import { Pie, Doughnut, Bar } from 'react-chartjs-2';
import { ChartBar, BarChart, PercentIcon } from "lucide-react";

// Registro dos componentes Chart.js
ChartJS.register(
  ArcElement, 
  Tooltip, 
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

// Tipos de dados para os gráficos
interface ColorData {
  name: string;
  value: number;
  color: string;
}

interface ChartJsStatsProps {
  roletaNome?: string;
  data?: {
    colorDistribution?: ColorData[];
    frequencyData?: any[];
  };
  wins?: number;
  losses?: number;
}

const ChartJsStats: React.FC<ChartJsStatsProps> = ({ 
  roletaNome = "Roleta",
  data,
  wins = 0,
  losses = 0 
}) => {
  // Estado para armazenar dados de cores (exemplo)
  const [colorDistribution, setColorDistribution] = useState<ColorData[]>([
    { name: "Vermelhos", value: 50, color: "#ef4444" },
    { name: "Pretos", value: 45, color: "#111827" },
    { name: "Zero", value: 5, color: "#059669" },
  ]);

  // Dados de frequência simplificados
  const [frequencyData, setFrequencyData] = useState([
    { number: "0", frequency: 5 },
    { number: "1-9", frequency: 15 },
    { number: "10-18", frequency: 20 },
    { number: "19-27", frequency: 18 },
    { number: "28-36", frequency: 12 },
  ]);

  // Configuração global do Chart.js para temas escuros
  ChartJS.defaults.color = '#cccccc';
  ChartJS.defaults.borderColor = '#333333';

  // Atualizar dados com base nas props
  useEffect(() => {
    if (data?.colorDistribution) {
      setColorDistribution(data.colorDistribution);
    }
    
    if (data?.frequencyData) {
      setFrequencyData(data.frequencyData);
    }
  }, [data, wins, losses]);

  // Configuração do gráfico de distribuição de cores
  const colorChartData = {
    labels: colorDistribution.map(d => d.name),
    datasets: [
      {
        label: 'Distribuição por Cor',
        data: colorDistribution.map(d => d.value),
        backgroundColor: colorDistribution.map(d => d.color),
        borderColor: colorDistribution.map(d => d.color),
        borderWidth: 1,
      },
    ],
  };

  // Configuração do gráfico de taxa de vitória
  const winRateData = {
    labels: ['Vitórias', 'Derrotas'],
    datasets: [
      {
        label: 'Taxa de Vitória',
        data: [wins || 1, losses || 1],
        backgroundColor: ['#059669', '#ef4444'],
        borderColor: ['#059669', '#ef4444'],
        borderWidth: 1,
      },
    ],
  };

  // Configuração do gráfico de frequência
  const barChartData = {
    labels: frequencyData.map(d => d.number),
    datasets: [
      {
        label: 'Frequência',
        data: frequencyData.map(d => d.frequency),
        backgroundColor: '#059669',
        borderColor: '#047857',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  // Opções comuns para os gráficos
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          font: {
            size: 12
          },
          color: '#cccccc'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#059669',
        borderWidth: 1,
        padding: 10,
        displayColors: true,
        usePointStyle: true,
        bodyFont: {
          size: 12
        },
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed || context.raw;
            const valueDisplay = typeof value === 'number' ? value : value.y;
            return `${label}: ${valueDisplay}`;
          }
        }
      }
    },
    animation: {
      duration: 1000
    }
  };

  // Opções específicas para o gráfico de barras
  const barOptions = {
    ...chartOptions,
    scales: {
      x: {
        grid: {
          color: '#333333',
          borderColor: '#555555',
          display: false
        },
        ticks: {
          color: '#cccccc'
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: '#333333',
          borderColor: '#555555',
          lineWidth: 0.5
        },
        ticks: {
          color: '#cccccc'
        }
      }
    }
  };

  return (
    <div className="w-full h-full fixed right-0 top-0 bg-[#141318] border-l border-[#2a2a2e] overflow-y-auto">
      <div className="p-5 border-b border-gray-800 bg-opacity-40">
        <h2 className="text-white flex items-center text-xl font-bold mb-3">
          <BarChart className="mr-3 text-green-500 h-6 w-6" /> 
          Estatísticas da {roletaNome}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5">
        {/* Distribuição por Cor */}
        <div className="p-5 space-y-4 bg-opacity-50 bg-gray-900 border border-gray-700 rounded-xl">
          <h3 className="text-sm font-medium text-white flex items-center">
            <ChartBar size={20} className="text-green-500 mr-2" /> Distribuição por Cor
          </h3>
          <div className="h-[260px] w-full">
            <Pie 
              data={colorChartData} 
              options={chartOptions} 
            />
          </div>
        </div>
        
        {/* Taxa de Vitória */}
        <div className="p-5 space-y-4 bg-opacity-50 bg-gray-900 border border-gray-700 rounded-xl">
          <h3 className="text-sm font-medium text-white flex items-center">
            <PercentIcon size={20} className="text-green-500 mr-2" /> Taxa de Vitória
          </h3>
          <div className="h-[260px] w-full">
            <Doughnut 
              data={winRateData} 
              options={chartOptions} 
            />
          </div>
        </div>

        {/* Frequência de Números */}
        <div className="p-5 space-y-4 bg-opacity-50 bg-gray-900 border border-gray-700 rounded-xl md:col-span-2">
          <h3 className="text-sm font-medium text-white flex items-center">
            <ChartBar size={20} className="text-green-500 mr-2" /> Frequência de Números
          </h3>
          <div className="h-[300px] w-full">
            <Bar 
              data={barChartData} 
              options={barOptions} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChartJsStats; 