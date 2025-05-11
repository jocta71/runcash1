import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { ChartBar, BarChart, PercentIcon } from "lucide-react";

// Tipos de dados para os gráficos
interface ColorDistribution {
  name: string;
  value: number;
  color: string;
}

interface RateData {
  name: string;
  value: number;
  color: string;
}

interface SidePanelStatsProps {
  roletaNome?: string;
  data?: {
    colorDistribution?: ColorDistribution[];
    winRate?: RateData[];
    frequencyData?: any[];
  };
  wins?: number;
  losses?: number;
}

const SidePanelStats: React.FC<SidePanelStatsProps> = ({ 
  roletaNome = "Roleta",
  data,
  wins = 0,
  losses = 0 
}) => {
  // Estado para armazenar dados de cores (exemplo)
  const [colorDistribution, setColorDistribution] = useState<ColorDistribution[]>([
    { name: "Vermelhos", value: 50, color: "#ef4444" },
    { name: "Pretos", value: 45, color: "#111827" },
    { name: "Zero", value: 5, color: "#059669" },
  ]);

  // Estado para taxa de vitória/derrota
  const [winRateData, setWinRateData] = useState<RateData[]>([
    { name: "Vitórias", value: wins || 1, color: "#059669" },
    { name: "Derrotas", value: losses || 1, color: "#ef4444" }
  ]);

  // Dados de frequência simplificados
  const [frequencyData, setFrequencyData] = useState([
    { number: "0", frequency: 5 },
    { number: "1-9", frequency: 15 },
    { number: "10-18", frequency: 20 },
    { number: "19-27", frequency: 18 },
    { number: "28-36", frequency: 12 },
  ]);

  // Atualizar dados com base nas props
  useEffect(() => {
    if (data?.colorDistribution) {
      setColorDistribution(data.colorDistribution);
    }
    
    if (wins || losses) {
      setWinRateData([
        { name: "Vitórias", value: wins, color: "#059669" },
        { name: "Derrotas", value: losses, color: "#ef4444" }
      ]);
    }
    
    if (data?.frequencyData) {
      setFrequencyData(data.frequencyData);
    }
  }, [data, wins, losses]);

  return (
    <div className="h-full bg-[#141318] border border-[#2a2a2e] rounded-lg overflow-y-auto">
      <div className="p-5 border-b border-gray-800 bg-opacity-40">
        <h2 className="text-white flex items-center text-xl font-bold mb-3">
          <BarChart className="mr-3 text-green-500 h-6 w-6" /> 
          Estatísticas da {roletaNome}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5">
        {/* Distribuição por Cor */}
        <div className="p-5 space-y-4 bg-opacity-50 border border-gray-700 rounded-xl">
          <h3 className="text-sm font-medium text-white flex items-center">
            <ChartBar size={20} className="text-green-500 mr-2" /> Distribuição por Cor
          </h3>
          <div className="h-[220px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={colorDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="white"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {colorDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(0,0,0,0.8)', 
                    borderColor: '#059669',
                    borderRadius: '8px'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Taxa de Vitória */}
        <div className="p-5 space-y-4 bg-opacity-50 border border-gray-700 rounded-xl">
          <h3 className="text-sm font-medium text-white flex items-center">
            <PercentIcon size={20} className="text-green-500 mr-2" /> Taxa de Vitória
          </h3>
          <div className="h-[220px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={winRateData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  fill="white"
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {winRateData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(0,0,0,0.8)', 
                    borderColor: '#059669',
                    borderRadius: '8px'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Frequência de Números */}
        <div className="p-5 space-y-4 bg-opacity-50 border border-gray-700 rounded-xl md:col-span-2">
          <h3 className="text-sm font-medium text-white flex items-center">
            <ChartBar size={20} className="text-green-500 mr-2" /> Frequência de Números
          </h3>
          <div className="h-[250px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart 
                data={frequencyData} 
                margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis 
                  dataKey="number" 
                  tick={{ fill: '#ccc' }} 
                  axisLine={{ stroke: '#444' }}
                />
                <YAxis 
                  tick={{ fill: '#ccc' }} 
                  axisLine={{ stroke: '#444' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(0,0,0,0.8)', 
                    borderColor: '#059669',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="frequency" 
                  fill="#059669" 
                  radius={[4, 4, 0, 0]}
                />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SidePanelStats; 