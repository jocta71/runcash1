import React, { useState, useEffect } from 'react';
import { ResponsivePie } from '@nivo/pie';
import { ResponsiveBar } from '@nivo/bar';
import { ChartBar, BarChart, PercentIcon } from "lucide-react";

// Tipos de dados para os gráficos
interface ColorData {
  name: string;
  value: number;
  color: string;
}

interface NivoChartStatsProps {
  roletaNome?: string;
  data?: {
    colorDistribution?: ColorData[];
    frequencyData?: any[];
  };
  wins?: number;
  losses?: number;
}

const NivoChartStats: React.FC<NivoChartStatsProps> = ({ 
  roletaNome = "Roleta",
  data,
  wins = 0,
  losses = 0 
}) => {
  // Estado para armazenar dados de cores
  const [colorDistribution, setColorDistribution] = useState<ColorData[]>([
    { name: "Vermelhos", value: 50, color: "#ef4444" },
    { name: "Pretos", value: 45, color: "#111827" },
    { name: "Zero", value: 5, color: "#059669" },
  ]);

  // Estado para armazenar dados de frequência
  const [frequencyData, setFrequencyData] = useState([
    { number: "0", frequency: 5 },
    { number: "1-9", frequency: 15 },
    { number: "10-18", frequency: 20 },
    { number: "19-27", frequency: 18 },
    { number: "28-36", frequency: 12 },
  ]);

  // Atualizar dados com base nas props
  useEffect(() => {
    console.log("NivoChartStats recebeu props:", { data, wins, losses });
    
    if (data?.colorDistribution && Array.isArray(data.colorDistribution) && data.colorDistribution.length > 0) {
      console.log("Atualizando colorDistribution com:", data.colorDistribution);
      setColorDistribution(data.colorDistribution);
    } else {
      console.log("Usando colorDistribution padrão");
    }
    
    if (data?.frequencyData && Array.isArray(data.frequencyData) && data.frequencyData.length > 0) {
      console.log("Atualizando frequencyData com:", data.frequencyData);
      setFrequencyData(data.frequencyData);
    } else {
      console.log("Usando frequencyData padrão");
    }
  }, [data, wins, losses]);

  // Formatar dados para Nivo Pie Chart com validação
  const formatColorDataForNivo = () => {
    // Garantir que colorDistribution tenha pelo menos um item
    if (!colorDistribution || colorDistribution.length === 0) {
      return [{ id: "Sem Dados", label: "Sem Dados", value: 100, color: "#666666" }];
    }
    
    return colorDistribution.map(item => ({
      id: item.name || "Desconhecido",
      label: item.name || "Desconhecido",
      value: item.value || 0,
      color: item.color || "#666666"
    }));
  };

  // Formatar dados para gráfico de taxa de vitória com validação
  const formatWinRateDataForNivo = () => {
    const safeWins = typeof wins === 'number' ? wins : 0;
    const safeLosses = typeof losses === 'number' ? losses : 0;
    
    // Se ambos forem zero, mostrar um valor padrão
    if (safeWins === 0 && safeLosses === 0) {
      return [
        { id: "Vitórias", label: "Vitórias", value: 1, color: "#059669" },
        { id: "Derrotas", label: "Derrotas", value: 1, color: "#ef4444" }
      ];
    }
    
    return [
      { id: "Vitórias", label: "Vitórias", value: safeWins, color: "#059669" },
      { id: "Derrotas", label: "Derrotas", value: safeLosses, color: "#ef4444" }
    ];
  };

  // Formatar dados para gráfico de barras
  const formatFrequencyDataForNivo = () => {
    return frequencyData.map(item => ({
      number: item.number,
      frequency: item.frequency
    }));
  };

  // Tema comum para os gráficos Nivo
  const nivoTheme = {
    background: '#1a1a1a',
    textColor: '#ffffff',
    fontSize: 13,
    axis: {
      domain: {
        line: {
          stroke: '#777777',
          strokeWidth: 1
        }
      },
      ticks: {
        line: {
          stroke: '#777777',
          strokeWidth: 1
        },
        text: {
          fill: '#ffffff',
          fontSize: 13
        }
      },
      legend: {
        text: {
          fill: '#ffffff',
          fontSize: 13
        }
      }
    },
    grid: {
      line: {
        stroke: '#444444',
        strokeWidth: 1
      }
    },
    legends: {
      text: {
        fill: '#ffffff',
        fontSize: 13
      }
    },
    tooltip: {
      container: {
        background: '#333333',
        color: '#ffffff',
        fontSize: 13,
        borderRadius: 4,
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
      }
    }
  };

  // Calcular taxa de vitória em porcentagem
  const winRate = (wins + losses) > 0 
    ? Math.round((wins / (wins + losses)) * 100) 
    : 0;

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
        <div className="p-5 space-y-4 bg-gray-900 border border-gray-700 rounded-xl">
          <h3 className="text-sm font-medium text-white flex items-center">
            <ChartBar size={20} className="text-green-500 mr-2" /> Distribuição por Cor
          </h3>
          <div className="h-[260px] w-full bg-[#1a1a1a] rounded-lg overflow-hidden">
            <ResponsivePie
              data={formatColorDataForNivo()}
              margin={{ top: 40, right: 40, bottom: 80, left: 40 }}
              innerRadius={0.5}
              padAngle={0.7}
              cornerRadius={3}
              activeOuterRadiusOffset={8}
              borderWidth={1}
              borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
              arcLabelsSkipAngle={10}
              arcLabelsTextColor="#ffffff"
              enableArcLabels={true}
              arcLabelsComponent={({ datum }) => (
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    fill: '#ffffff'
                  }}
                >
                  {datum.label}: {datum.value}%
                </text>
              )}
              colors={{ datum: 'data.color' }}
              theme={nivoTheme}
              legends={[
                {
                  anchor: 'bottom',
                  direction: 'row',
                  justify: false,
                  translateX: 0,
                  translateY: 56,
                  itemsSpacing: 0,
                  itemWidth: 80,
                  itemHeight: 20,
                  itemTextColor: '#ffffff',
                  itemDirection: 'left-to-right',
                  itemOpacity: 1,
                  symbolSize: 12,
                  symbolShape: 'circle'
                }
              ]}
            />
          </div>
        </div>
        
        {/* Taxa de Vitória */}
        <div className="p-5 space-y-4 bg-gray-900 border border-gray-700 rounded-xl">
          <h3 className="text-sm font-medium text-white flex items-center">
            <PercentIcon size={20} className="text-green-500 mr-2" /> Taxa de Vitória
          </h3>
          <div className="h-[260px] w-full">
            <div className="relative h-full w-full bg-[#1a1a1a] rounded-lg overflow-hidden">
              <ResponsivePie
                data={formatWinRateDataForNivo()}
                margin={{ top: 40, right: 40, bottom: 80, left: 40 }}
                innerRadius={0.6}
                padAngle={0.7}
                cornerRadius={3}
                activeOuterRadiusOffset={8}
                borderWidth={1}
                borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
                enableArcLabels={true}
                arcLabelsSkipAngle={10}
                arcLabelsTextColor="#ffffff"
                arcLabelsComponent={({ datum }) => (
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      fill: '#ffffff'
                    }}
                  >
                    {datum.label}: {datum.value}
                  </text>
                )}
                colors={{ datum: 'data.color' }}
                theme={nivoTheme}
                legends={[
                  {
                    anchor: 'bottom',
                    direction: 'row',
                    justify: false,
                    translateX: 0,
                    translateY: 56,
                    itemsSpacing: 0,
                    itemWidth: 80,
                    itemHeight: 20,
                    itemTextColor: '#ffffff',
                    itemDirection: 'left-to-right',
                    itemOpacity: 1,
                    symbolSize: 12,
                    symbolShape: 'circle'
                  }
                ]}
              />
              
              {/* Texto centralizado com taxa de vitória */}
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <div className="text-3xl font-bold text-white">{winRate}%</div>
                <div className="text-xs text-gray-400">Taxa de Vitória</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Frequência por Número */}
        <div className="col-span-1 md:col-span-2 p-5 space-y-4 bg-gray-900 border border-gray-700 rounded-xl">
          <h3 className="text-sm font-medium text-white flex items-center">
            <BarChart size={20} className="text-green-500 mr-2" /> Frequência por Número
          </h3>
          <div className="h-[260px] w-full bg-[#1a1a1a] rounded-lg overflow-hidden">
            <ResponsiveBar
              data={formatFrequencyDataForNivo()}
              keys={['frequency']}
              indexBy="number"
              margin={{ top: 20, right: 20, bottom: 40, left: 50 }}
              padding={0.3}
              valueScale={{ type: 'linear' }}
              indexScale={{ type: 'band', round: true }}
              colors="#059669"
              borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
              axisTop={null}
              axisRight={null}
              axisBottom={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: 'Números',
                legendPosition: 'middle',
                legendOffset: 32
              }}
              axisLeft={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: 'Frequência',
                legendPosition: 'middle',
                legendOffset: -40
              }}
              labelSkipWidth={12}
              labelSkipHeight={12}
              labelTextColor="#ffffff"
              animate={true}
              theme={nivoTheme}
              tooltip={({ id, value, color }) => (
                <div
                  style={{
                    padding: 12,
                    background: '#222222',
                    color: '#ffffff',
                    borderRadius: 4,
                  }}
                >
                  <span style={{ fontWeight: 'bold' }}>Frequência:</span> {value}
                </div>
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default NivoChartStats; 