import React, { useEffect, useState } from 'react';
import RouletteCard from '@/components/RouletteCard';
import { RouletteData } from '@/integrations/api/rouletteService';
import RouletteFeedService from '@/services/RouletteFeedService';
import LastNumbersBar from './LastNumbersBar';
import EventService from '@/services/EventService';
import CasinoAPIAdapter from '@/services/CasinoAPIAdapter';
import RouletteMiniStats from '@/components/RouletteMiniStats';
import RouletteStatsModal from '@/components/RouletteStatsModal';

interface RouletteTable {
  tableId: string;
  tableName: string;
  numbers: string[];
  dealer?: string;
  players?: number;
}

interface LiveRoulettesDisplayProps {
  roulettesData?: RouletteData[]; // Opcional para manter compatibilidade retroativa
}

const LiveRoulettesDisplay: React.FC<LiveRoulettesDisplayProps> = ({ roulettesData }) => {
  const [tables, setTables] = useState<RouletteTable[]>([]);
  const [roulettes, setRoulettes] = useState<RouletteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRoulette, setSelectedRoulette] = useState<RouletteData | null>(null);
  const [showStatsInline, setShowStatsInline] = useState(false);

  // Usar os dados passados como prop ou manter lógica antiga
  useEffect(() => {
    if (roulettesData && Array.isArray(roulettesData) && roulettesData.length > 0) {
      console.log(`[LiveRoulettesDisplay] Usando ${roulettesData.length} roletas fornecidas via props`);
      setRoulettes(roulettesData);
      
      // Converter os dados das roletas para o formato de tabela
      const rouletteTables = roulettesData.map(roleta => {
        // Extrair os números do campo numero (limitado a 30 mais recentes)
        const numeros = Array.isArray(roleta.numero) 
          ? roleta.numero.slice(0, 30).map(n => n.numero.toString()) 
          : [];
        
        return {
          tableId: roleta.id || '',
          tableName: roleta.nome || roleta.name || 'Roleta',
          numbers: numeros,
          canonicalId: roleta.canonicalId || roleta._id
        };
      });
      
      console.log('[LiveRoulettesDisplay] Tabelas de roletas criadas a partir dos dados:', rouletteTables);
      setTables(rouletteTables);
      setIsLoading(false);
    }
  }, [roulettesData]);

  // Função para selecionar uma roleta e mostrar estatísticas ao lado
  const handleRouletteSelect = (roleta: RouletteData) => {
    setSelectedRoulette(roleta);
    setShowStatsInline(true);
  };

  // Função para fechar a visualização de estatísticas
  const handleCloseStats = () => {
    setSelectedRoulette(null);
    setShowStatsInline(false);
  };

  // Se temos dados passados por props, mostrar eles diretamente
  if (roulettesData && roulettesData.length > 0) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Roletas Disponíveis</h2>
            <p className="text-gray-400">Escolha uma roleta para começar a jogar</p>
          </div>
          <div className="relative w-64">
            <input 
              type="text" 
              placeholder="Buscar roleta..." 
              className="w-full bg-gray-800 text-white py-2 px-4 pl-10 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <svg 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
        </div>
        
        {/* Grade de roletas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {roulettes.map(roleta => (
            <div 
              key={roleta.id} 
              className="bg-gray-900 rounded-lg overflow-hidden shadow-lg cursor-pointer hover:bg-gray-800 transition-colors border border-gray-800"
              onClick={() => handleRouletteSelect(roleta)}
            >
              <div className="p-4">
                {/* Cabeçalho do card */}
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    {/* Nome da roleta com contagem de atualizações */}
                    <h3 className="text-lg font-semibold text-white">{roleta.nome}</h3>
                    
                    {/* Ícone do número de atualizações */}
                    <div className="flex items-center">
                      <span className="bg-gray-800 text-xs text-gray-300 px-2 py-0.5 rounded">
                        {Array.isArray(roleta.numero) && roleta.numero.length > 0 ? roleta.numero.length : 0} atualizações
                      </span>
                    </div>
                  </div>
                  
                  {/* Ícone de informações */}
                  <div className="flex">
                    <RouletteMiniStats
                      roletaId={roleta.id || ''}
                      roletaNome={roleta.nome || ''}
                      lastNumbers={Array.isArray(roleta.numero) ? roleta.numero.map(n => n.numero) : []}
                    />
                  </div>
                </div>
                
                {/* Número atual em destaque */}
                <div className="flex justify-center my-3">
                  {Array.isArray(roleta.numero) && roleta.numero.length > 0 ? (
                    <div 
                      className={`${
                        roleta.numero[0].numero === 0 
                          ? "bg-green-600" 
                          : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(roleta.numero[0].numero)
                            ? "bg-red-600"
                            : "bg-black"
                      } w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold`}
                    >
                      {roleta.numero[0].numero}
                    </div>
                  ) : (
                    <div className="bg-gray-700 text-gray-400 w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold">
                      ?
                    </div>
                  )}
                </div>
                
                {/* Linha de números recentes */}
                <div className="flex flex-wrap gap-1 justify-center my-2">
                  {Array.isArray(roleta.numero) && roleta.numero.slice(1, 9).map((n, index) => {
                    const num = n.numero;
                    const bgColor = num === 0 
                      ? "bg-green-600" 
                      : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num)
                        ? "bg-red-600"
                        : "bg-black";
                    
                    return (
                      <div 
                        key={index} 
                        className={`${bgColor} text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium`}
                      >
                        {num}
                      </div>
                    );
                  })}
                </div>
                
                {/* Estatísticas em formato tabular, como na imagem */}
                <div className="mt-3 text-sm">
                  {/* Linha para vermelho/preto */}
                  <div className="grid grid-cols-4 mb-1">
                    <div className="text-right pr-2 text-gray-400">Vermelho:</div>
                    <div className="text-white font-medium">
                      {Array.isArray(roleta.numero) 
                        ? roleta.numero.filter(n => [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n.numero)).length 
                        : 0}
                    </div>
                    <div className="text-right pr-2 text-gray-400">Preto:</div>
                    <div className="text-white font-medium">
                      {Array.isArray(roleta.numero) 
                        ? roleta.numero.filter(n => n.numero !== 0 && ![1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n.numero)).length 
                        : 0}
                    </div>
                  </div>
                  
                  {/* Linha para par/ímpar */}
                  <div className="grid grid-cols-4 mb-1">
                    <div className="text-right pr-2 text-gray-400">Par:</div>
                    <div className="text-white font-medium">
                      {Array.isArray(roleta.numero) 
                        ? roleta.numero.filter(n => n.numero !== 0 && n.numero % 2 === 0).length 
                        : 0}
                    </div>
                    <div className="text-right pr-2 text-gray-400">Ímpar:</div>
                    <div className="text-white font-medium">
                      {Array.isArray(roleta.numero) 
                        ? roleta.numero.filter(n => n.numero % 2 === 1).length 
                        : 0}
                    </div>
                  </div>
                  
                  {/* Linha para alto/baixo */}
                  <div className="grid grid-cols-4 mb-1">
                    <div className="text-right pr-2 text-gray-400">Alto (19-36):</div>
                    <div className="text-white font-medium">
                      {Array.isArray(roleta.numero) 
                        ? roleta.numero.filter(n => n.numero >= 19 && n.numero <= 36).length 
                        : 0}
                    </div>
                    <div className="text-right pr-2 text-gray-400">Baixo (1-18):</div>
                    <div className="text-white font-medium">
                      {Array.isArray(roleta.numero) 
                        ? roleta.numero.filter(n => n.numero >= 1 && n.numero <= 18).length 
                        : 0}
                    </div>
                  </div>
                  
                  {/* Linha para verde/total */}
                  <div className="grid grid-cols-4 mb-1">
                    <div className="text-right pr-2 text-gray-400">Verde (0):</div>
                    <div className="text-white font-medium">
                      {Array.isArray(roleta.numero) 
                        ? roleta.numero.filter(n => n.numero === 0).length 
                        : 0}
                    </div>
                    <div className="text-right pr-2 text-gray-400">Total:</div>
                    <div className="text-white font-medium">
                      {Array.isArray(roleta.numero) ? roleta.numero.length : 0}
                    </div>
                  </div>
                </div>
                
                {/* Rodapé do card com ícone de tempo real */}
                <div className="flex items-center justify-between mt-3 text-xs text-gray-500 border-t border-gray-800 pt-2">
                  <div className="flex items-center gap-1">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="12" 
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span>Tempo real</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <span>{Array.isArray(roleta.numero) ? roleta.numero.length : 0} números</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  // Componente de estatísticas inline 
  const RouletteStatsInline = ({ roletaNome, lastNumbers }: { roletaNome: string, lastNumbers: number[] }) => {
    // Calcular estatísticas
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const redCount = lastNumbers.filter(n => redNumbers.includes(n)).length;
    const blackCount = lastNumbers.filter(n => n !== 0 && !redNumbers.includes(n)).length;
    const zeroCount = lastNumbers.filter(n => n === 0).length;
    const total = lastNumbers.length;
    
    // Calcular porcentagens
    const redPercent = Math.round((redCount / total) * 100);
    const blackPercent = Math.round((blackCount / total) * 100);
    const zeroPercent = Math.round((zeroCount / total) * 100);
    
    // Calcular frequência de números
    const numberFrequency: Record<number, number> = {};
    for (let i = 0; i <= 36; i++) {
      numberFrequency[i] = 0;
    }
    lastNumbers.forEach(num => {
      if (numberFrequency[num] !== undefined) {
        numberFrequency[num]++;
      }
    });
    
    // Obter números quentes e frios
    const hotNumbers = getHotNumbers(lastNumbers).slice(0, 5);
    const coldNumbers = getColdNumbers(lastNumbers).slice(0, 5);
    
    return (
      <div className="p-4 h-full overflow-y-auto bg-gray-900 text-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-[#00ff00] flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="M3 3v18h18"></path>
              <path d="M18 12V8"></path>
              <path d="M12 18v-2"></path>
              <path d="M6 18v-6"></path>
            </svg>
            Estatísticas da {roletaNome}
          </h3>
          <p className="text-gray-400 text-sm">Análise detalhada dos últimos {lastNumbers.length} números e tendências</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {/* Histórico de números */}
          <div className="bg-gray-800 rounded-lg p-4 overflow-hidden">
            <h4 className="text-base flex items-center text-[#00ff00] mb-3 font-bold">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M3 3v18h18"></path>
              </svg>
              Histórico de Números (Mostrando: {Math.min(lastNumbers.length, 50)})
            </h4>
            <div className="grid grid-cols-10 gap-1">
              {lastNumbers.slice(0, 50).map((num, idx) => {
                const bgColor = num === 0 
                  ? "bg-green-600" 
                  : redNumbers.includes(num)
                    ? "bg-red-600"
                    : "bg-black";
                
                return (
                  <div 
                    key={idx} 
                    className={`${bgColor} text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium`}
                  >
                    {num}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Taxa de Vitória */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-base flex items-center text-[#00ff00] mb-3 font-bold">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
              </svg>
              Taxa de Vitória
            </h4>
            <div className="flex items-center justify-center h-44">
              <div className="relative h-40 w-40 rounded-full border-8 border-gray-700 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-[#00ff00]">Simule suas apostas</span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 flex justify-center -mb-12">
                  <div className="flex space-x-4 text-xs">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-[#00ff00] rounded-full mr-1"></div>
                      <span>Vitórias</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-red-500 rounded-full mr-1"></div>
                      <span>Derrotas</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Frequência de Números */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-base flex items-center text-[#00ff00] mb-3 font-bold">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M3 3v18h18"></path>
                <path d="M18 12V8"></path>
                <path d="M12 18v-2"></path>
                <path d="M6 18v-6"></path>
              </svg>
              Frequência de Números
            </h4>
            <div className="h-44 bg-gray-900 rounded relative">
              {/* Simular um gráfico de barras */}
              <div className="absolute inset-0 flex items-end justify-between px-1">
                {[...Array(10)].map((_, idx) => {
                  const height = Math.max(10, Math.floor(Math.random() * 80)); // Altura aleatória para ilustração
                  return (
                    <div 
                      key={idx} 
                      className="w-2 bg-[#00ff00] rounded-t"
                      style={{ height: `${height}%` }}
                    ></div>
                  );
                })}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-5 flex justify-between px-1 text-[10px] text-gray-400">
                {[0, 6, 12, 18, 24, 30, 36].map(num => (
                  <span key={num}>{num}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Segunda linha de gráficos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Distribuição por Cor */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-base flex items-center text-[#00ff00] mb-3 font-bold">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
              </svg>
              Distribuição por Cor
            </h4>
            <div className="flex items-center justify-center mt-4">
              <div className="w-40 h-40 relative">
                {/* Circle chart */}
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  {/* Red section */}
                  <path 
                    d={`M 50,50 L 50,0 A 50,50 0 ${redPercent > 50 ? 1 : 0},1 ${50 + 50 * Math.sin(2 * Math.PI * redPercent / 100)},${50 - 50 * Math.cos(2 * Math.PI * redPercent / 100)} Z`} 
                    fill="#ef4444" 
                  />
                  {/* Black section */}
                  <path 
                    d={`M 50,50 L ${50 + 50 * Math.sin(2 * Math.PI * redPercent / 100)},${50 - 50 * Math.cos(2 * Math.PI * redPercent / 100)} A 50,50 0 ${100 - redPercent - zeroPercent > 50 ? 1 : 0},1 ${50 + 50 * Math.sin(2 * Math.PI * (redPercent + zeroPercent) / 100)},${50 - 50 * Math.cos(2 * Math.PI * (redPercent + zeroPercent) / 100)} Z`} 
                    fill="#111827" 
                  />
                  {/* Green section */}
                  <path 
                    d={`M 50,50 L ${50 + 50 * Math.sin(2 * Math.PI * (redPercent + zeroPercent) / 100)},${50 - 50 * Math.cos(2 * Math.PI * (redPercent + zeroPercent) / 100)} A 50,50 0 ${zeroPercent > 50 ? 1 : 0},1 ${50 + 50 * Math.sin(0)},${50 - 50 * Math.cos(0)} Z`} 
                    fill="#059669" 
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 bg-gray-900 rounded-full"></div>
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-4 text-sm">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-600 rounded-full mr-1"></div>
                <span>Vermelhos {redPercent}%</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-black rounded-full mr-1"></div>
                <span>Pretos {blackPercent}%</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-600 rounded-full mr-1"></div>
                <span>Zero {zeroPercent}%</span>
              </div>
            </div>
          </div>
          
          {/* Estatísticas resumidas */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-base flex items-center text-[#00ff00] mb-3 font-bold">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path>
                <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path>
                <path d="M7 21h10"></path>
                <path d="M12 3v18"></path>
                <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"></path>
              </svg>
              Resumo
            </h4>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="bg-gray-900 p-3 rounded">
                <div className="text-xs text-gray-400">Par</div>
                <div className="text-lg font-bold mt-1">{lastNumbers.filter(n => n !== 0 && n % 2 === 0).length}</div>
                <div className="text-xs text-gray-400 mt-2">Ímpar</div>
                <div className="text-lg font-bold mt-1">{lastNumbers.filter(n => n % 2 === 1).length}</div>
              </div>
              <div className="bg-gray-900 p-3 rounded">
                <div className="text-xs text-gray-400">Baixo (1-18)</div>
                <div className="text-lg font-bold mt-1">{lastNumbers.filter(n => n >= 1 && n <= 18).length}</div>
                <div className="text-xs text-gray-400 mt-2">Alto (19-36)</div>
                <div className="text-lg font-bold mt-1">{lastNumbers.filter(n => n >= 19 && n <= 36).length}</div>
              </div>
              <div className="bg-gray-900 p-3 rounded">
                <div className="text-xs text-gray-400">1ª dúzia (1-12)</div>
                <div className="text-lg font-bold mt-1">{lastNumbers.filter(n => n >= 1 && n <= 12).length}</div>
              </div>
              <div className="bg-gray-900 p-3 rounded">
                <div className="text-xs text-gray-400">2ª dúzia (13-24)</div>
                <div className="text-lg font-bold mt-1">{lastNumbers.filter(n => n >= 13 && n <= 24).length}</div>
              </div>
              <div className="bg-gray-900 p-3 rounded col-span-2">
                <div className="text-xs text-gray-400">3ª dúzia (25-36)</div>
                <div className="text-lg font-bold mt-1">{lastNumbers.filter(n => n >= 25 && n <= 36).length}</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Números quentes e frios */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h4 className="text-lg text-white mb-4 font-bold">Números Quentes & Frios</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h5 className="text-base font-semibold flex items-center text-red-500 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                  <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
                Números Quentes (Mais Frequentes)
              </h5>
              <div className="flex flex-wrap gap-2">
                {hotNumbers.map((num, idx) => {
                  const bgColor = num.number === 0 
                    ? "bg-green-600" 
                    : redNumbers.includes(num.number)
                      ? "bg-red-600"
                      : "bg-black";
                  
                  return (
                    <div key={idx} className="flex items-center">
                      <div className={`${bgColor} w-8 h-8 rounded-full flex items-center justify-center text-white mr-1`}>
                        {num.number}
                      </div>
                      <span className="text-gray-400 text-sm">({num.count}x)</span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div>
              <h5 className="text-base font-semibold flex items-center text-blue-500 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                Números Frios (Menos Frequentes)
              </h5>
              <div className="flex flex-wrap gap-2">
                {coldNumbers.map((num, idx) => {
                  const bgColor = num.number === 0 
                    ? "bg-green-600" 
                    : redNumbers.includes(num.number)
                      ? "bg-red-600"
                      : "bg-black";
                  
                  return (
                    <div key={idx} className="flex items-center">
                      <div className={`${bgColor} w-8 h-8 rounded-full flex items-center justify-center text-white mr-1`}>
                        {num.number}
                      </div>
                      <span className="text-gray-400 text-sm">({num.count}x)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Função para obter os números mais frequentes
  const getHotNumbers = (numbers: number[]) => {
    const frequency: Record<number, number> = {};
    
    // Inicializar todos os números possíveis
    for (let i = 0; i <= 36; i++) {
      frequency[i] = 0;
    }
    
    // Contar a frequência
    numbers.forEach(num => {
      if (frequency[num] !== undefined) {
        frequency[num]++;
      }
    });
    
    // Converter para array e ordenar do mais frequente para o menos frequente
    return Object.keys(frequency)
      .map(num => ({ number: parseInt(num), count: frequency[parseInt(num)] }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };
  
  // Função para obter os números menos frequentes
  const getColdNumbers = (numbers: number[]) => {
    const frequency: Record<number, number> = {};
    
    // Inicializar todos os números possíveis
    for (let i = 0; i <= 36; i++) {
      frequency[i] = 0;
    }
    
    // Contar a frequência
    numbers.forEach(num => {
      if (frequency[num] !== undefined) {
        frequency[num]++;
      }
    });
    
    // Converter para array e ordenar do menos frequente para o mais frequente
    return Object.keys(frequency)
      .map(num => ({ number: parseInt(num), count: frequency[parseInt(num)] }))
      .filter(item => numbers.includes(item.number) && item.count > 0)
      .sort((a, b) => a.count - b.count)
      .slice(0, 5);
  };

  // Lógica antiga do componente (mantida para compatibilidade)
  useEffect(() => {
    // Iniciar o adaptador de API do cassino
    const apiAdapter = CasinoAPIAdapter.getInstance();
    apiAdapter.configure({
      pollInterval: 5000 // 5 segundos entre verificações
    });
    
    // Buscar dados iniciais imediatamente
    apiAdapter.fetchDataOnce().then(initialData => {
      console.log('[LiveRoulettesDisplay] Dados iniciais carregados com sucesso:', 
        initialData?.LiveTables ? Object.keys(initialData.LiveTables).length : 0);
    });
    
    // Iniciar polling regular
    apiAdapter.startPolling();
    
    // Função para atualizar a lista de mesas
    const updateTables = () => {
      const feedService = RouletteFeedService.getInstance();
      const allTables = feedService.getAllRouletteTables();
      
      if (allTables.length > 0) {
        console.log(`[LiveRoulettesDisplay] Atualizando lista de mesas: ${allTables.length} mesas disponíveis`);
        
        const formattedTables = allTables.map(item => ({
          tableId: item.tableId,
          tableName: item.tableId, // Inicialmente usamos o ID como nome
          numbers: item.numbers
        }));
        
        setTables(formattedTables);
        setIsLoading(false);
      }
    };
    
    // Escutar por atualizações de números
    const handleNumbersUpdated = (data: any) => {
      console.log(`[LiveRoulettesDisplay] Dados atualizados para mesa ${data.tableName || data.tableId}:`, {
        primeiros_numeros: data.numbers?.slice(0, 3)
      });
      
      setTables(prevTables => {
        // Verificar se a mesa já existe na lista
        const tableIndex = prevTables.findIndex(t => t.tableId === data.tableId);
        
        if (tableIndex >= 0) {
          // Atualizar mesa existente
          const updatedTables = [...prevTables];
          updatedTables[tableIndex] = {
            ...updatedTables[tableIndex],
            numbers: data.numbers,
            tableName: data.tableName || updatedTables[tableIndex].tableName,
            dealer: data.dealer,
            players: data.players
          };
          return updatedTables;
        } else {
          // Adicionar nova mesa
          console.log(`[LiveRoulettesDisplay] Nova mesa adicionada: ${data.tableName || data.tableId}`);
          return [
            ...prevTables,
            {
              tableId: data.tableId,
              tableName: data.tableName || data.tableId,
              numbers: data.numbers,
              dealer: data.dealer,
              players: data.players
            }
          ];
        }
      });
      
      setIsLoading(false);
    };
    
    // Inscrever para eventos de atualização
    EventService.on('roulette:numbers-updated', handleNumbersUpdated);
    EventService.on('casino:data-updated', () => {
      console.log('[LiveRoulettesDisplay] Dados gerais do casino atualizados, atualizando a lista de mesas');
      setTimeout(updateTables, 100); // Pequeno delay para garantir que o serviço processou os dados
    });
    
    // Escutar por eventos específicos de novos números
    const handleNewNumber = (data: any) => {
      console.log(`[LiveRoulettesDisplay] NOVO NÚMERO recebido para ${data.tableName || data.tableId}: ${data.number}`);
      
      // Forçar atualização imediata para garantir que o novo número seja mostrado
      setTimeout(() => {
        apiAdapter.fetchDataOnce();
        updateTables();
      }, 100);
    };
    
    // Registrar evento para novos números
    EventService.on('roulette:new-number', handleNewNumber);
    
    // Verificar se já temos mesas disponíveis
    updateTables();
    
    // Configurar um intervalo para verificar atualizações em caso de falha no evento
    const checkInterval = setInterval(() => {
      console.log('[LiveRoulettesDisplay] Verificação periódica de dados');
      apiAdapter.fetchDataOnce(); // Forçar atualização periódica
      
      // Re-verificar estado das mesas para garantir que temos os dados mais recentes
      setTimeout(updateTables, 200);
    }, 15000); // A cada 15 segundos
    
    // Limpeza ao desmontar
    return () => {
      EventService.off('roulette:numbers-updated', handleNumbersUpdated);
      EventService.off('casino:data-updated', updateTables);
      EventService.off('roulette:new-number', handleNewNumber);
      clearInterval(checkInterval);
      apiAdapter.stopPolling();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8 h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        <span className="ml-2 text-white">Carregando mesas de roleta...</span>
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="text-center p-4 text-gray-400">
        Nenhuma mesa de roleta ativa no momento.
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-6 text-white">Roletas ao Vivo</h2>
      
      {/* Grid de roletas similar ao do site de referência */}
      <div className="sc-casino-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {tables.map(table => (
          <LastNumbersBar 
            key={table.tableId}
            tableId={table.tableId}
            tableName={table.tableName}
          />
        ))}
      </div>
      
      {/* Botão para atualizar manualmente */}
      <div className="flex justify-center mt-8">
        <button 
          onClick={() => CasinoAPIAdapter.getInstance().fetchDataOnce()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
        >
          Atualizar Dados
        </button>
      </div>
    </div>
  );
};

export default LiveRoulettesDisplay; 