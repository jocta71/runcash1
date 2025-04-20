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
    
    // Garantir que os valores são números e somar para calcular porcentagens
    const total = colorDistribution.reduce((sum, item) => sum + (item.value || 0), 0);
    
    // Retorna os dados no formato do Nivo com percentuais calculados
    return colorDistribution.map(item => {
      const itemValue = item.value || 0;
      const percentage = total > 0 ? Math.round((itemValue / total) * 100) : 0;
      
      return {
        id: item.name || "Desconhecido",
        label: item.name || "Desconhecido",
        value: Math.max(1, itemValue), // Valor original (não percentual) para cálculos do Nivo
        percentage, // Valor percentual para exibição no rótulo
        color: item.color || "#666666"
      };
    });
  };

  // Formatar dados para gráfico de taxa de vitória com validação
  const formatWinRateDataForNivo = () => {
    const safeWins = Math.max(1, typeof wins === 'number' ? wins : 1);
    const safeLosses = Math.max(1, typeof losses === 'number' ? losses : 1);
    
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
            <div className="w-full h-full flex flex-col">
              <div className="flex justify-center space-x-4 mt-2">
                {colorDistribution.map((item, index) => (
                  <div key={index} className="flex items-center">
                    <div 
                      className="w-4 h-4 mr-2 rounded-sm" 
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="text-sm text-white">{item.name}</span>
                  </div>
                ))}
              </div>
              <div className="flex-1">
                <ResponsivePie
                  data={formatColorDataForNivo()}
                  margin={{ top: 10, right: 40, bottom: 40, left: 40 }}
                  innerRadius={0.5}
                  padAngle={0.7}
                  cornerRadius={3}
                  activeOuterRadiusOffset={8}
                  borderWidth={1}
                  borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
                  enableArcLabels={true}
                  arcLabelsSkipAngle={5}
                  arcLabelsTextColor="#ffffff"
                  arcLabelsRadiusOffset={0.6}
                  arcLinkLabelsOffset={2}
                  arcLinkLabelsSkipAngle={10}
                  arcLinkLabelsTextColor="#ffffff"
                  arcLinkLabelsDiagonalLength={5}
                  arcLinkLabelsStraightLength={5}
                  arcLinkLabelsThickness={2}
                  arcLinkLabelsColor={{ from: 'color' }}
                  arcLabelsComponent={({ datum }) => {
                    // Acessar os dados diretamente da fonte original
                    const item = colorDistribution.find(item => item.name === datum.id);
                    const total = colorDistribution.reduce((sum, i) => sum + (i.value || 0), 0);
                    const percentage = item && total > 0 
                      ? Math.round(((item.value || 0) / total) * 100) 
                      : 0;
                    
                    return (
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          fill: '#ffffff'
                        }}
                      >
                        {percentage}%
                      </text>
                    );
                  }}
                  colors={{ datum: 'data.color' }}
                  theme={nivoTheme}
                  legends={[]}
                />
              </div>
            </div>
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
                margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                innerRadius={0.6}
                padAngle={0.7}
                cornerRadius={3}
                activeOuterRadiusOffset={8}
                borderWidth={1}
                borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
                enableArcLabels={false}
                enableArcLinkLabels={false}
                colors={{ datum: 'data.color' }}
                theme={nivoTheme}
                legends={[]}
              />
              
              {/* Texto centralizado com taxa de vitória e legendas */}
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <div className="text-3xl font-bold text-white">{winRate}%</div>
                <div className="text-sm text-gray-300">Taxa de Vitória</div>
              </div>
              
              {/* Legendas de vitórias e derrotas */}
              <div className="absolute left-2 bottom-2 flex flex-col space-y-2">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-[#059669] mr-2 rounded-sm"></div>
                  <span className="text-sm text-white">Vitórias: {wins}</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-[#ef4444] mr-2 rounded-sm"></div>
                  <span className="text-sm text-white">Derrotas: {losses}</span>
                </div>
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