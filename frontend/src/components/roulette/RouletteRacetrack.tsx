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

  // Números configurados exatamente como na imagem
  const topRow = [24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35];
  const leftSide = [5, 10, 23, 8, 30, 11, 36];
  const rightSide = [3, 26, 0, 32];
  const bottomRow = [13, 27, 6, 34, 17, 25, 2, 21, 4, 19, 15];

  return (
    <div className="w-full overflow-hidden rounded-lg border border-[#00ff00]/20 bg-vegas-black-light p-4">
      <h3 className="text-[#00ff00] flex items-center text-base font-bold mb-3">
        <ChartBar className="mr-2" /> Racetrack da Roleta Europeia
      </h3>
      <div className="p-2">
        {/* Container principal com fundo preto */}
        <div className="relative bg-black rounded-lg overflow-hidden" style={{ height: '200px' }}>
          {/* Container interno oval/arredondado */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full h-[90%] mx-2 rounded-[60px] bg-black border border-gray-800 overflow-hidden">
              
              {/* Seções internas */}
              <div className="absolute inset-0 flex">
                <div className="grid grid-cols-4 w-full h-full">
                  <div className="bg-[#111] border-r border-gray-800 flex items-center justify-center">
                    <span className="text-white text-sm">Tier</span>
                  </div>
                  <div className="bg-[#111] border-r border-gray-800 flex items-center justify-center">
                    <span className="text-white text-sm">Orphelins</span>
                  </div>
                  <div className="bg-[#111] border-r border-gray-800 flex items-center justify-center">
                    <span className="text-white text-sm">Voisins</span>
                  </div>
                  <div className="bg-[#111] flex items-center justify-center">
                    <span className="text-white text-sm">Zero</span>
                  </div>
                </div>
              </div>

              {/* Linha superior */}
              <div className="absolute top-0 w-full flex justify-center space-x-0.5">
                {topRow.map((num) => (
                  <div 
                    key={`top-${num}`}
                    style={{
                      width: '26px', 
                      height: '26px', 
                      borderRadius: '50%',
                      boxShadow: isHotNumber(num) ? '0 0 5px #ffcc00' : 'none'
                    }} 
                    className={`${getNumberColor(num)} text-white flex items-center justify-center text-xs font-bold cursor-pointer relative`}
                    title={`Frequência: ${getFrequency(num)}`}
                  >
                    {num}
                    {isHotNumber(num) && <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>}
                  </div>
                ))}
              </div>

              {/* Lado esquerdo */}
              <div className="absolute left-0 top-6 h-[calc(100%-12px)] flex flex-col justify-between py-1">
                {leftSide.map((num) => (
                  <div 
                    key={`left-${num}`}
                    style={{
                      width: '26px', 
                      height: '26px', 
                      borderRadius: '50%',
                      boxShadow: isHotNumber(num) ? '0 0 5px #ffcc00' : 'none'
                    }} 
                    className={`${getNumberColor(num)} text-white flex items-center justify-center text-xs font-bold cursor-pointer relative`}
                    title={`Frequência: ${getFrequency(num)}`}
                  >
                    {num}
                    {isHotNumber(num) && <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>}
                  </div>
                ))}
              </div>

              {/* Lado direito */}
              <div className="absolute right-0 top-6 h-[calc(100%-12px)] flex flex-col justify-between py-1">
                {rightSide.map((num) => (
                  <div 
                    key={`right-${num}`}
                    style={{
                      width: '26px', 
                      height: '26px', 
                      borderRadius: '50%',
                      boxShadow: isHotNumber(num) ? '0 0 5px #ffcc00' : 'none'
                    }} 
                    className={`${getNumberColor(num)} text-white flex items-center justify-center text-xs font-bold cursor-pointer relative`}
                    title={`Frequência: ${getFrequency(num)}`}
                  >
                    {num}
                    {isHotNumber(num) && <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>}
                  </div>
                ))}
              </div>

              {/* Linha inferior */}
              <div className="absolute bottom-0 w-full flex justify-center space-x-0.5">
                {bottomRow.map((num) => (
                  <div 
                    key={`bottom-${num}`}
                    style={{
                      width: '26px', 
                      height: '26px', 
                      borderRadius: '50%',
                      boxShadow: isHotNumber(num) ? '0 0 5px #ffcc00' : 'none'
                    }}
                    className={`${getNumberColor(num)} text-white flex items-center justify-center text-xs font-bold cursor-pointer relative`}
                    title={`Frequência: ${getFrequency(num)}`}
                  >
                    {num}
                    {isHotNumber(num) && <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>}
                  </div>
                ))}
              </div>
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