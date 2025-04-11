import React from 'react';
import { ChartBar } from 'lucide-react';

// Componente de Racetrack para roleta - exportado como named export
interface RouletteRacetrackProps {
  // Permite passar dados de frequência opcionalmente (quando disponíveis)
  frequencyData?: { number: number, frequency: number }[];
}

export const RouletteRacetrack: React.FC<RouletteRacetrackProps> = ({ frequencyData = [] }) => {
  // Função para determinar a cor do número na roleta
  const getNumberColor = (num: number): string => {
    if (num === 0) return "bg-green-500";
    
    // Números vermelhos na roleta europeia
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return redNumbers.includes(num) ? "bg-red-600" : "bg-black";
  };

  // Encontrar o número mais frequente para destacar
  const maxFrequency = frequencyData.length > 0 
    ? Math.max(...frequencyData.map(item => item.frequency))
    : 0;
  
  // Função para determinar se o número é "quente" (alta frequência)
  const isHotNumber = (num: number): boolean => {
    if (frequencyData.length === 0) return false;
    const numData = frequencyData.find(item => item.number === num);
    return numData ? numData.frequency >= maxFrequency * 0.7 : false; // 70% do máximo é considerado "quente"
  };
  
  // Função para obter a frequência de um número
  const getFrequency = (num: number): number => {
    if (frequencyData.length === 0) return 0;
    const numData = frequencyData.find(item => item.number === num);
    return numData ? numData.frequency : 0;
  };

  // Array com os números na ordem do racetrack da roleta europeia
  const firstRow = [1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const secondRow = [15, 4, 2, 17, 6, 8, 10, 24, 33, 16, 5, 23, 30, 36, 13, 27, 0, 32, 19, 21, 25, 34, 11];

  return (
    <div className="w-full overflow-hidden rounded-lg border border-[#00ff00]/20 bg-vegas-black-light p-4">
      <h3 className="text-[#00ff00] flex items-center text-base font-bold mb-3">
        <ChartBar className="mr-2" /> Racetrack da Roleta Europeia
      </h3>
      <div className="p-4">
        <div className="relative rounded-full border border-[#00ff00]/30 p-6">
          <div className="flex flex-col items-center">
            {/* Linha superior de números */}
            <div className="flex justify-center mb-4 flex-wrap gap-1">
              {firstRow.map((num) => (
                <div 
                  key={`top-${num}`}
                  style={{
                    width: '30px', 
                    height: '30px', 
                    borderRadius: '50%',
                    boxShadow: isHotNumber(num) ? '0 0 10px #ffcc00' : 'none'
                  }} 
                  className={`${getNumberColor(num)} text-white flex items-center justify-center text-xs font-bold hover:scale-110 transition-transform cursor-pointer relative`}
                  title={`Frequência: ${getFrequency(num)}`}
                >
                  {num}
                  {isHotNumber(num) && <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>}
                </div>
              ))}
            </div>
            
            {/* Linha inferior de números */}
            <div className="flex justify-center flex-wrap gap-1">
              {secondRow.map((num) => (
                <div 
                  key={`bottom-${num}`}
                  style={{
                    width: '30px', 
                    height: '30px', 
                    borderRadius: '50%',
                    boxShadow: isHotNumber(num) ? '0 0 10px #ffcc00' : 'none'
                  }}
                  className={`${getNumberColor(num)} text-white flex items-center justify-center text-xs font-bold hover:scale-110 transition-transform cursor-pointer relative`}
                  title={`Frequência: ${getFrequency(num)}`}
                >
                  {num}
                  {isHotNumber(num) && <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Legenda */}
      {frequencyData.length > 0 && (
        <div className="flex justify-center mt-2 text-xs text-gray-400">
          <div className="flex items-center mr-4">
            <div className="w-3 h-3 bg-yellow-400 rounded-full mr-1 animate-pulse"></div>
            <span>Número quente</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 border border-[#00ff00]/30 rounded-full mr-1"></div>
            <span>Passe o mouse para ver a frequência</span>
          </div>
        </div>
      )}
    </div>
  );
}; 