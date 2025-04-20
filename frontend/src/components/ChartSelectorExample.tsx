import React, { useState } from 'react';
import ChartSelector from './ChartSelector';
import { Button } from '../components/ui/button';
import { BarChart } from 'lucide-react';

const ChartSelectorExample: React.FC = () => {
  const [showStats, setShowStats] = useState(false);
  
  // Dados de exemplo
  const exampleData = {
    colorDistribution: [
      { name: "Vermelhos", value: 42, color: "#ef4444" },
      { name: "Pretos", value: 51, color: "#111827" },
      { name: "Zero", value: 7, color: "#059669" }
    ],
    frequencyData: [
      { number: "0", frequency: 7 },
      { number: "1-9", frequency: 14 },
      { number: "10-18", frequency: 23 },
      { number: "19-27", frequency: 17 },
      { number: "28-36", frequency: 19 }
    ]
  };

  // Estatísticas de exemplo
  const wins = 27;
  const losses = 23;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Demonstração do Seletor de Gráficos</h1>
      
      <div className="flex items-center space-x-4 mb-10">
        <Button 
          onClick={() => setShowStats(!showStats)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
        >
          <BarChart className="h-5 w-5" />
          {showStats ? "Fechar Estatísticas" : "Mostrar Estatísticas"}
        </Button>
        
        <p className="text-gray-400 text-sm">
          Clique no botão para abrir o painel de estatísticas com diferentes bibliotecas de gráficos
        </p>
      </div>
      
      {/* Informações para demonstração */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h2 className="text-white text-lg font-medium mb-3">Dados da Demonstração</h2>
          <div className="text-gray-300 text-sm space-y-2">
            <p>Roleta: <span className="text-green-500 font-medium">Roleta Live Lightning</span></p>
            <p>Total de Rodadas: <span className="text-green-500 font-medium">50</span></p>
            <p>Vitórias: <span className="text-green-500 font-medium">{wins}</span></p>
            <p>Derrotas: <span className="text-red-500 font-medium">{losses}</span></p>
            <p>Taxa de Acerto: <span className="text-green-500 font-medium">{((wins / (wins + losses)) * 100).toFixed(1)}%</span></p>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h2 className="text-white text-lg font-medium mb-3">Como Usar</h2>
          <div className="text-gray-300 text-sm space-y-2">
            <p>1. Clique no botão "Mostrar Estatísticas" para abrir o painel</p>
            <p>2. Escolha entre as bibliotecas disponíveis usando os botões na parte superior</p>
            <p>3. Compare as diferentes visualizações para encontrar a mais adequada</p>
            <p>4. Consulte o arquivo README-CHART-ALTERNATIVES.md para mais detalhes</p>
          </div>
        </div>
      </div>
      
      {/* Código de exemplo */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-700">
        <h2 className="text-white text-lg font-medium mb-3">Código de Implementação</h2>
        <pre className="text-gray-300 text-sm overflow-x-auto bg-black bg-opacity-50 p-4 rounded-md">
{`import React, { useState } from 'react';
import ChartSelector from './components/ChartSelector';

const YourComponent = () => {
  const [showStats, setShowStats] = useState(false);
  
  // Seus dados reais
  const data = {
    colorDistribution: [
      { name: "Vermelhos", value: 42, color: "#ef4444" },
      { name: "Pretos", value: 51, color: "#111827" },
      { name: "Zero", value: 7, color: "#059669" }
    ],
    frequencyData: [
      { number: "0", frequency: 7 },
      { number: "1-9", frequency: 14 },
      { number: "10-18", frequency: 23 },
      { number: "19-27", frequency: 17 },
      { number: "28-36", frequency: 19 }
    ]
  };

  return (
    <div>
      <button onClick={() => setShowStats(!showStats)}>
        {showStats ? "Fechar Estatísticas" : "Mostrar Estatísticas"}
      </button>
      
      {showStats && (
        <ChartSelector 
          roletaNome="Sua Roleta"
          data={data}
          wins={27}
          losses={23}
          onClose={() => setShowStats(false)}
        />
      )}
    </div>
  );
};`}
        </pre>
      </div>
      
      {/* Renderiza o seletor de gráficos */}
      {showStats && (
        <ChartSelector 
          roletaNome="Roleta Live Lightning"
          data={exampleData}
          wins={wins}
          losses={losses}
          onClose={() => setShowStats(false)}
        />
      )}
    </div>
  );
};

export default ChartSelectorExample; 