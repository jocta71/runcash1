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
    if (data?.colorDistribution && Array.isArray(data.colorDistribution) && data.colorDistribution.length > 0) {
      setColorDistribution(data.colorDistribution);
    }
    
    if (data?.frequencyData && Array.isArray(data.frequencyData) && data.frequencyData.length > 0) {
      setFrequencyData(data.frequencyData);
    }
  }, [data, wins, losses]);

  // Formatar dados para Nivo Pie Chart com validação
  const formatColorDataForNivo = () => {
    // Garantir que colorDistribution tenha pelo menos um item
    if (!colorDistribution || colorDistribution.length === 0) {
      return [{ id: "Sem Dados", label: "Sem Dados", value: 100, color: "#666666", percentage: 100 }];
    }
    
    // Calcular total para percentagens
    const total = colorDistribution.reduce((sum, item) => sum + (item.value || 0), 0);
    
    // Garantir que temos pelo menos um valor total para evitar divisão por zero
    if (total <= 0) {
      return [{ id: "Sem Dados", label: "Sem Dados", value: 100, color: "#666666", percentage: 100 }];
    }
    
    // Retorna os dados formatados para Nivo
    return colorDistribution.map(item => {
      const itemValue = Math.max(1, item.value || 0); // Garantir valor mínimo de 1 para visualização
      const percentage = Math.round((itemValue / total) * 100);
      
      return {
        id: item.name || "Desconhecido",
        label: item.name || "Desconhecido",
        value: itemValue,
        percentage,
        color: item.color || "#666666"
      };
    });
  };

  // Formatar dados de taxa de vitória para Nivo
  const formatWinRateDataForNivo = () => {
    // Interface para tipar corretamente o objeto winRate
    interface WinRateData {
      wins?: number;
      losses?: number;
    }
    
    // Validar dados
    if (!winRate) {
      return [
        { id: "Sem Dados", label: "Sem Dados", value: 100, color: "#666666", percentage: 100 }
      ];
    }
    
    // Cast seguro para o tipo específico
    const winRateData = winRate as WinRateData;
    
    // Verificar se tem propriedades wins e losses e se ambas são zero
    if ((winRateData.wins === 0 || winRateData.wins === undefined) && 
        (winRateData.losses === 0 || winRateData.losses === undefined)) {
      return [
        { id: "Sem Dados", label: "Sem Dados", value: 100, color: "#666666", percentage: 100 }
      ];
    }
    
    // Extrair os valores com segurança de tipo
    const wins = winRateData.wins !== undefined ? Math.max(0, winRateData.wins) : 0;
    const losses = winRateData.losses !== undefined ? Math.max(0, winRateData.losses) : 0;
    const total = wins + losses;
    
    // Evitar divisão por zero
    if (total === 0) {
      return [
        { id: "Sem Dados", label: "Sem Dados", value: 100, color: "#666666", percentage: 100 }
      ];
    }
    
    const winPercentage = Math.round((wins / total) * 100);
    const lossPercentage = 100 - winPercentage;
    
    return [
      { id: "Vitórias", label: "Vitórias", value: wins, color: "#4caf50", percentage: winPercentage },
      { id: "Derrotas", label: "Derrotas", value: losses, color: "#f44336", percentage: lossPercentage }
    ];
  };

  // Formatar dados para gráfico de barras
  const formatFrequencyDataForNivo = () => {
    if (!frequencyData || frequencyData.length === 0) {
      return [{ number: "Sem Dados", frequency: 0 }];
    }
    
    return frequencyData.map(item => ({
      number: item.number,
      frequency: Math.max(0, item.frequency || 0) // Garantir valores não negativos
    }));
  };

  // Tema comum para os gráficos Nivo
  const nivoTheme = {
    background: '#1a1a1a',
    textColor: '#ffffff',
    fontSize: 14,
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
          fontSize: 14
        }
      },
      legend: {
        text: {
          fill: '#ffffff',
          fontSize: 14,
          fontWeight: 'bold'
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
        fontSize: 14
      }
    },
    tooltip: {
      container: {
        background: '#333333',
        color: '#ffffff',
        fontSize: 14,
        borderRadius: 4,
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
      }
    }
  };

  // Calcular taxa de vitória em porcentagem com validação
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
              {/* Legenda superior melhorada */}
              <div className="flex justify-center space-x-4 mt-2 mb-1">
                {colorDistribution.map((item, index) => (
                  <div key={index} className="flex items-center">
                    <div 
                      className="w-4 h-4 mr-2 rounded-sm" 
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="text-sm text-white font-medium">{item.name}</span>
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
                  enableArcLinkLabels={false}
                  colors={{ datum: 'data.color' }}
                  theme={nivoTheme}
                  legends={[]}
                  arcLabelsComponent={({ datum }) => {
                    return (
                      <g>
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          style={{
                            fontSize: 16,
                            fontWeight: 'bold',
                            fill: '#ffffff'
                          }}
                        >
                          {datum.data.percentage}%
                        </text>
                      </g>
                    );
                  }}
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
                margin={{ top: 30, right: 30, bottom: 50, left: 30 }}
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
              />
              
              {/* Exibição centralizada da taxa de vitória */}
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <div className="text-4xl font-bold text-white">{winRate}%</div>
              </div>
              
              {/* Legenda clara na parte inferior */}
              <div className="absolute bottom-2 left-0 right-0 flex justify-center space-x-8">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-[#059669] mr-2 rounded-sm"></div>
                  <span className="text-sm text-white font-medium">Vitórias: {wins}</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-[#ef4444] mr-2 rounded-sm"></div>
                  <span className="text-sm text-white font-medium">Derrotas: {losses}</span>
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