import React, { useState, useEffect } from 'react';
import { ResponsivePie } from '@nivo/pie';

interface RouletteWinRateChartProps {
  wins: number;
  losses: number;
  title?: string;
  className?: string;
}

/**
 * Componente de gráfico para exibir taxa de vitória com estilo consistente
 * Mostra percentual no centro e legenda clara no rodapé
 */
const RouletteWinRateChart: React.FC<RouletteWinRateChartProps> = ({
  wins = 0,
  losses = 0,
  title = "Taxa de Vitória",
  className = ""
}) => {
  // Estado para armazenar dados formatados
  const [pieData, setPieData] = useState<any[]>([]);
  const [winRate, setWinRate] = useState<number>(0);
  
  // Processar dados quando as props mudarem
  useEffect(() => {
    // Verificar se temos dados
    if (wins === 0 && losses === 0) {
      setPieData([
        { id: "Sem Dados", label: "Sem Dados", value: 100, color: "#666666" }
      ]);
      setWinRate(0);
      return;
    }
    
    // Calcular total e taxa de vitórias
    const total = wins + losses;
    const calculatedWinRate = Math.round((wins / total) * 100);
    
    setWinRate(calculatedWinRate);
    
    // Formatar dados para o gráfico
    setPieData([
      { id: "Vitórias", label: "Vitórias", value: wins, color: "#059669" },
      { id: "Derrotas", label: "Derrotas", value: losses, color: "#dc2626" }
    ]);
  }, [wins, losses]);
  
  // Tema personalizado para os gráficos Nivo
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
    <div className={`bg-gray-900 border border-gray-700 rounded-xl p-5 ${className}`}>
      <h3 className="text-sm font-medium text-white mb-4">{title}</h3>
      
      <div className="relative h-[260px] w-full bg-[#1a1a1a] rounded-lg overflow-hidden">
        {/* Gráfico Nivo */}
        <ResponsivePie
          data={pieData}
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
      
      {/* Estatísticas adicionais */}
      <div className="mt-4 text-sm text-gray-400 flex justify-between">
        <div>Total: {wins + losses} rodadas</div>
        {wins + losses === 0 && (
          <div className="text-xs">
            * Sem dados para calcular taxa de vitória
          </div>
        )}
      </div>
    </div>
  );
};

export default RouletteWinRateChart; 