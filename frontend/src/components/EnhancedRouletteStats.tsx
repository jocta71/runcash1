import React, { useMemo } from 'react';
import { BarChart, ChartBar, PercentIcon } from "lucide-react";
import { ROULETTE_COLORS, RED_NUMBERS } from './RouletteSidePanelStats';
import { RouletteNumber } from '../types/global';
import { ResponsivePie } from '@nivo/pie';

interface EnhancedRouletteStatsProps {
  roletaNome: string;
  numbers: RouletteNumber[];
  wins: number;
  losses: number;
  className?: string;
}

// Interface para os dados do gráfico Nivo
interface NivoChartData {
  id: string;
  label: string;
  value: number;
  color: string;
  percentage: number;
}

/**
 * Componente de estatísticas avançadas para roleta
 * Combina visualizações de distribuição de cores e taxa de vitória
 * com design aprimorado e alta legibilidade
 */
const EnhancedRouletteStats: React.FC<EnhancedRouletteStatsProps> = ({
  roletaNome,
  numbers,
  wins,
  losses,
  className = ""
}) => {
  // Processar números para obter frequência por grupo
  const frequencyByGroup = useMemo(() => {
    if (!numbers || numbers.length === 0) {
      return [
        { group: "0", count: 0 },
        { group: "1-12", count: 0 },
        { group: "13-24", count: 0 },
        { group: "25-36", count: 0 }
      ];
    }
    
    // Inicializar contadores
    const groups = {
      "0": 0,
      "1-12": 0,
      "13-24": 0,
      "25-36": 0
    };
    
    // Contar números por grupo
    numbers.forEach(({ numero }) => {
      if (numero === 0) {
        groups["0"]++;
      } else if (numero >= 1 && numero <= 12) {
        groups["1-12"]++;
      } else if (numero >= 13 && numero <= 24) {
        groups["13-24"]++;
      } else if (numero >= 25 && numero <= 36) {
        groups["25-36"]++;
      }
    });
    
    // Converter para array
    return Object.entries(groups).map(([group, count]) => ({
      group,
      count
    }));
  }, [numbers]);
  
  // Calcular percentagens para grupos
  const groupPercentages = useMemo(() => {
    const total = frequencyByGroup.reduce((sum, item) => sum + item.count, 0);
    if (total === 0) return frequencyByGroup.map(item => ({ ...item, percentage: 0 }));
    
    return frequencyByGroup.map(item => ({
      ...item,
      percentage: Math.round((item.count / total) * 100)
    }));
  }, [frequencyByGroup]);
  
  // Obter os 5 números mais frequentes
  const topNumbers = useMemo(() => {
    if (!numbers || numbers.length === 0) return [];
    
    // Inicializar contadores
    const frequency: Record<number, number> = {};
    for (let i = 0; i <= 36; i++) {
      frequency[i] = 0;
    }
    
    // Contar frequência
    numbers.forEach(({ numero }) => {
      if (frequency[numero] !== undefined) {
        frequency[numero]++;
      }
    });
    
    // Converter para array e ordenar
    const sortedFrequency = Object.entries(frequency)
      .map(([num, count]) => ({ 
        numero: parseInt(num), 
        count,
        isRed: RED_NUMBERS.includes(parseInt(num)),
        isGreen: parseInt(num) === 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return sortedFrequency;
  }, [numbers]);
  
  // Obter último número sorteado
  const lastNumber = useMemo(() => {
    if (!numbers || numbers.length === 0) return null;
    return numbers[0];
  }, [numbers]);
  
  // Obter cor para número
  const getNumberColor = (num: number) => {
    if (num === 0) return ROULETTE_COLORS.GREEN_BG;
    return RED_NUMBERS.includes(num) ? ROULETTE_COLORS.RED_BG : ROULETTE_COLORS.BLACK_BG;
  };

  // Formatar dados da distribuição por cor para o gráfico Nivo
  const colorDistributionData = useMemo<NivoChartData[]>(() => {
    if (!numbers || numbers.length === 0) {
      return [{ id: "Sem Dados", label: "Sem Dados", value: 100, color: "#666666", percentage: 100 }];
    }
    
    // Contadores para as cores
    let redCount = 0;
    let blackCount = 0;
    let greenCount = 0;
    
    // Contar ocorrências por cor
    numbers.forEach(({ numero }) => {
      if (numero === 0) {
        greenCount++;
      } else if (RED_NUMBERS.includes(numero)) {
        redCount++;
      } else {
        blackCount++;
      }
    });
    
    // Calcular total e evitar divisão por zero
    const total = redCount + blackCount + greenCount;
    if (total === 0) {
      return [{ id: "Sem Dados", label: "Sem Dados", value: 100, color: "#666666", percentage: 100 }];
    }
    
    // Garantir valor mínimo de 1 para melhor visualização
    redCount = Math.max(1, redCount);
    blackCount = Math.max(1, blackCount);
    greenCount = Math.max(1, greenCount);
    
    // Calcular percentagens
    const redPercentage = Math.round((redCount / total) * 100);
    const blackPercentage = Math.round((blackCount / total) * 100);
    const greenPercentage = Math.round((greenCount / total) * 100);
    
    // Formatar dados para o gráfico
    return [
      {
        id: "Vermelhos",
        label: "Vermelhos",
        value: redCount,
        percentage: redPercentage,
        color: ROULETTE_COLORS.RED
      },
      {
        id: "Pretos",
        label: "Pretos",
        value: blackCount,
        percentage: blackPercentage,
        color: ROULETTE_COLORS.BLACK
      },
      {
        id: "Zero",
        label: "Zero",
        value: greenCount,
        percentage: greenPercentage,
        color: ROULETTE_COLORS.GREEN
      }
    ];
  }, [numbers]);

  // Formatar dados da taxa de vitória para o gráfico Nivo
  const winRateData = useMemo<NivoChartData[]>(() => {
    // Verificar se temos dados
    if (wins === 0 && losses === 0) {
      return [
        { id: "Sem Dados", label: "Sem Dados", value: 100, color: "#666666", percentage: 100 }
      ];
    }
    
    // Calcular total e taxa de vitórias
    const total = wins + losses;
    const winPercentage = Math.round((wins / total) * 100);
    const lossPercentage = 100 - winPercentage;
    
    return [
      { id: "Vitórias", label: "Vitórias", value: wins, color: "#059669", percentage: winPercentage },
      { id: "Derrotas", label: "Derrotas", value: losses, color: "#dc2626", percentage: lossPercentage }
    ];
  }, [wins, losses]);

  // Cálculo da taxa de vitória
  const winRate = useMemo(() => {
    if (wins === 0 && losses === 0) return 0;
    const total = wins + losses;
    return Math.round((wins / total) * 100);
  }, [wins, losses]);

  // Tema para os gráficos Nivo
  const nivoTheme = {
    background: '#1a1a1a',
    textColor: '#ffffff',
    fontSize: 14,
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
  
  return (
    <div className={`w-full bg-[#141318] text-white ${className}`}>
      <div className="p-5 border-b border-gray-800 bg-opacity-40">
        <h2 className="text-white flex items-center text-xl font-bold mb-3">
          <BarChart className="mr-3 text-[#059669] h-6 w-6" /> 
          Estatísticas da {roletaNome}
        </h2>
        <p className="text-sm text-gray-400">
          {numbers.length > 0 ? 
            `Análise baseada em ${numbers.length} rodadas recentes` : 
            "Sem dados históricos para análise"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 p-5">
        {/* Painel lateral com números mais frequentes */}
        <div className="p-5 space-y-4 bg-gray-900 border border-gray-700 rounded-xl">
          <h3 className="text-sm font-medium text-white flex items-center">
            <ChartBar size={20} className="text-[#059669] mr-2" /> Resumo Rápido
          </h3>
          
          {/* Último número */}
          {lastNumber && (
            <div className="space-y-2">
              <div className="text-xs text-gray-400">Último número:</div>
              <div className="flex items-center">
                <div className={`w-10 h-10 flex items-center justify-center rounded-full ${getNumberColor(lastNumber.numero)}`}>
                  <span className="text-lg font-bold text-white">{lastNumber.numero}</span>
                </div>
                <div className="ml-3">
                  <span className="text-xs text-gray-400">Sorteado em:</span>
                  <div className="text-white">{lastNumber.timestamp || "N/A"}</div>
                </div>
              </div>
            </div>
          )}
          
          {/* Top 5 números */}
          <div className="mt-6 space-y-2">
            <div className="text-xs text-gray-400">Top 5 números mais frequentes:</div>
            <div className="space-y-2">
              {topNumbers.map((item, index) => (
                <div key={index} className="flex items-center justify-between bg-[#1a1a1a] p-2 rounded">
                  <div className="flex items-center">
                    <div 
                      className={`w-8 h-8 flex items-center justify-center rounded-full ${
                        item.isGreen ? ROULETTE_COLORS.GREEN_BG : 
                        item.isRed ? ROULETTE_COLORS.RED_BG : 
                        ROULETTE_COLORS.BLACK_BG
                      }`}
                    >
                      <span className="text-sm font-bold text-white">{item.numero}</span>
                    </div>
                    <span className="ml-2 text-white">{item.isGreen ? "Zero" : (item.isRed ? "Vermelho" : "Preto")}</span>
                  </div>
                  <div className="bg-[#2a2a2a] px-2 py-1 rounded text-xs">
                    {item.count}x
                  </div>
                </div>
              ))}
              
              {topNumbers.length === 0 && (
                <div className="text-gray-400 text-sm p-4 text-center">
                  Sem dados disponíveis
                </div>
              )}
            </div>
          </div>
          
          {/* Distribuição por grupos */}
          <div className="mt-6 space-y-2">
            <div className="text-xs text-gray-400">Distribuição por grupos:</div>
            <div className="space-y-2">
              {groupPercentages.map((item, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-300">{item.group}</span>
                    <span className="text-gray-300">{item.percentage}%</span>
                  </div>
                  <div className="w-full bg-[#2a2a2a] rounded-full h-2">
                    <div 
                      className="bg-[#059669] h-2 rounded-full" 
                      style={{ width: `${item.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Gráficos principais */}
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Gráfico de distribuição por cor */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-medium text-white mb-4">Distribuição por Cor</h3>
            
            <div className="h-[260px] w-full bg-[#1a1a1a] rounded-lg overflow-hidden">
              <div className="w-full h-full flex flex-col">
                {/* Legenda superior */}
                <div className="flex justify-center space-x-4 mt-2 mb-1">
                  {colorDistributionData.map((item, index) => (
                    <div key={index} className="flex items-center">
                      <div 
                        className="w-4 h-4 mr-2 rounded-sm" 
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="text-sm text-white font-medium">{item.label}</span>
                    </div>
                  ))}
                </div>
                
                {/* Gráfico Nivo */}
                <div className="flex-1">
                  <ResponsivePie
                    data={colorDistributionData}
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
          
          {/* Gráfico de taxa de vitória */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-medium text-white mb-4">Taxa de Vitória</h3>
            
            <div className="relative h-[260px] w-full bg-[#1a1a1a] rounded-lg overflow-hidden">
              {/* Gráfico Nivo */}
              <ResponsivePie
                data={winRateData}
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
                  <div className="w-4 h-4 bg-[#dc2626] mr-2 rounded-sm"></div>
                  <span className="text-sm text-white font-medium">Derrotas: {losses}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedRouletteStats; 