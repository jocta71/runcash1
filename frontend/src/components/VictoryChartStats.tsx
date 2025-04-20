import React, { useState, useEffect } from 'react';
import {
  VictoryPie,
  VictoryChart,
  VictoryBar,
  VictoryTheme,
  VictoryAxis,
  VictoryTooltip,
  VictoryLabel,
  VictoryLegend,
  VictoryContainer
} from 'victory';
import { ChartBar, BarChart, PercentIcon } from "lucide-react";

// Tipos de dados para os gráficos
interface ColorData {
  name: string;
  value: number;
  color: string;
  label?: string;
}

interface ChartData {
  x: string | number;
  y: number;
  label?: string;
  color?: string;
}

interface VictoryChartStatsProps {
  roletaNome?: string;
  data?: {
    colorDistribution?: ColorData[];
    frequencyData?: any[];
  };
  wins?: number;
  losses?: number;
}

// Tema personalizado para os gráficos
const darkTheme = {
  ...VictoryTheme.material,
  axis: {
    ...VictoryTheme.material.axis,
    style: {
      ...VictoryTheme.material.axis.style,
      axis: { stroke: "#ccc" },
      grid: { stroke: "#333" },
      ticks: { stroke: "#ccc", size: 5 },
      tickLabels: { fill: "#ccc", fontSize: 10 }
    }
  },
  bar: {
    ...VictoryTheme.material.bar,
    style: {
      ...VictoryTheme.material.bar.style,
      data: { fill: "#059669" }
    }
  },
  pie: {
    ...VictoryTheme.material.pie,
    style: {
      ...VictoryTheme.material.pie.style,
      labels: { fill: "white", fontSize: 12 }
    }
  }
};

const VictoryChartStats: React.FC<VictoryChartStatsProps> = ({ 
  roletaNome = "Roleta",
  data,
  wins = 0,
  losses = 0 
}) => {
  // Estado para armazenar dados de cores
  const [colorData, setColorData] = useState<ChartData[]>([
    { x: "Vermelhos", y: 50, label: "Vermelhos: 50%", color: "#ef4444" },
    { x: "Pretos", y: 45, label: "Pretos: 45%", color: "#111827" },
    { x: "Zero", y: 5, label: "Zero: 5%", color: "#059669" },
  ]);

  // Estado para taxa de vitória/derrota
  const [winRateData, setWinRateData] = useState<ChartData[]>([
    { x: "Vitórias", y: wins || 1, label: `Vitórias: ${wins || 1}`, color: "#059669" },
    { x: "Derrotas", y: losses || 1, label: `Derrotas: ${losses || 1}`, color: "#ef4444" }
  ]);

  // Dados de frequência
  const [frequencyData, setFrequencyData] = useState<ChartData[]>([
    { x: "0", y: 5, label: "0: 5" },
    { x: "1-9", y: 15, label: "1-9: 15" },
    { x: "10-18", y: 20, label: "10-18: 20" },
    { x: "19-27", y: 18, label: "19-27: 18" },
    { x: "28-36", y: 12, label: "28-36: 12" },
  ]);

  // Atualizar dados com base nas props
  useEffect(() => {
    if (data?.colorDistribution) {
      const formattedData = data.colorDistribution.map(item => ({
        x: item.name,
        y: item.value,
        label: `${item.name}: ${item.value}%`,
        color: item.color
      }));
      setColorData(formattedData);
    }
    
    if (wins || losses) {
      setWinRateData([
        { x: "Vitórias", y: wins, label: `Vitórias: ${wins}`, color: "#059669" },
        { x: "Derrotas", y: losses, label: `Derrotas: ${losses}`, color: "#ef4444" }
      ]);
    }
    
    if (data?.frequencyData) {
      const formattedData = data.frequencyData.map((item: any) => ({
        x: item.number || item.x,
        y: item.frequency || item.y,
        label: `${item.number || item.x}: ${item.frequency || item.y}`
      }));
      setFrequencyData(formattedData);
    }
  }, [data, wins, losses]);

  // Calcular porcentagens para legenda
  const calculatePercentage = (value: number, total: number) => {
    return `${Math.round((value / total) * 100)}%`;
  };

  const colorTotal = colorData.reduce((sum, item) => sum + item.y, 0);
  const winRateTotal = winRateData.reduce((sum, item) => sum + item.y, 0);

  return (
    <div className="w-full h-full fixed right-0 top-0 bg-[#141318] border-l border-[#2a2a2e] overflow-y-auto text-white">
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
          <div className="h-[260px] w-full">
            <VictoryPie
              data={colorData}
              theme={darkTheme}
              colorScale={colorData.map(d => d.color)}
              innerRadius={30}
              labelRadius={85}
              style={{
                labels: { fill: "white", fontSize: 12 },
                parent: { height: "100%", width: "100%" }
              }}
              labels={({ datum }) => `${datum.x}: ${calculatePercentage(datum.y, colorTotal)}`}
              animate={{ duration: 500 }}
              containerComponent={
                <VictoryContainer 
                  style={{ 
                    touchAction: "auto",
                    height: "100%", 
                    width: "100%" 
                  }} 
                />
              }
            />
          </div>
        </div>
        
        {/* Taxa de Vitória */}
        <div className="p-5 space-y-4 bg-opacity-50 border border-gray-700 rounded-xl">
          <h3 className="text-sm font-medium text-white flex items-center">
            <PercentIcon size={20} className="text-green-500 mr-2" /> Taxa de Vitória
          </h3>
          <div className="h-[260px] w-full">
            <VictoryPie
              data={winRateData}
              theme={darkTheme}
              colorScale={winRateData.map(d => d.color)}
              innerRadius={40}
              labelRadius={80}
              style={{
                labels: { fill: "white", fontSize: 12 },
                parent: { height: "100%", width: "100%" }
              }}
              labels={({ datum }) => `${datum.x}: ${calculatePercentage(datum.y, winRateTotal)}`}
              animate={{ duration: 500 }}
              containerComponent={
                <VictoryContainer 
                  style={{ 
                    touchAction: "auto",
                    height: "100%", 
                    width: "100%" 
                  }} 
                />
              }
            />
          </div>
        </div>

        {/* Frequência de Números */}
        <div className="p-5 space-y-4 bg-opacity-50 border border-gray-700 rounded-xl md:col-span-2">
          <h3 className="text-sm font-medium text-white flex items-center">
            <ChartBar size={20} className="text-green-500 mr-2" /> Frequência de Números
          </h3>
          <div className="h-[300px] w-full">
            <VictoryChart
              theme={darkTheme}
              domainPadding={20}
              padding={{ top: 20, bottom: 50, left: 50, right: 30 }}
              animate={{ duration: 500 }}
              containerComponent={
                <VictoryContainer 
                  style={{ 
                    touchAction: "auto",
                    height: "100%", 
                    width: "100%" 
                  }} 
                />
              }
            >
              <VictoryAxis
                tickFormat={(t) => t}
                style={{
                  axis: { stroke: "#ccc" },
                  grid: { stroke: "transparent" },
                  ticks: { stroke: "#ccc", size: 5 },
                  tickLabels: { fill: "#ccc", fontSize: 10 }
                }}
              />
              <VictoryAxis
                dependentAxis
                style={{
                  axis: { stroke: "#ccc" },
                  grid: { stroke: "#333", strokeDasharray: "3,3" },
                  ticks: { stroke: "#ccc", size: 5 },
                  tickLabels: { fill: "#ccc", fontSize: 10 }
                }}
              />
              <VictoryBar
                data={frequencyData}
                barWidth={30}
                cornerRadius={{ top: 4 }}
                style={{
                  data: { 
                    fill: "#059669", 
                    stroke: "transparent",
                    strokeWidth: 0
                  }
                }}
                labels={({ datum }) => `${datum.y}`}
                labelComponent={
                  <VictoryTooltip
                    flyoutStyle={{
                      fill: "rgba(0, 0, 0, 0.8)",
                      stroke: "#059669",
                      strokeWidth: 1,
                      borderRadius: 5
                    }}
                    style={{ fill: "white" }}
                  />
                }
              />
            </VictoryChart>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VictoryChartStats; 