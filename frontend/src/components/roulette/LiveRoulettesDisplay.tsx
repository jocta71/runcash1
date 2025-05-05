import React, { useEffect, useState, useRef } from 'react';
import { RouletteData } from '@/integrations/api/rouletteService';
import { UnifiedRouletteClient } from '@/services/UnifiedRouletteClient';
import LastNumbersBar from './LastNumbersBar';
import EventService from '@/services/EventService';
// Comentar a importação e uso do logger temporariamente
// import { getLogger } from '@/utils/logging';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';

// const logger = getLogger('LiveRoulettesDisplay');
const unifiedClient = UnifiedRouletteClient.getInstance();

// Helper para obter uma chave única da roleta
const getRouletteKey = (roulette: RouletteData): string => {
  return roulette._id || roulette.id || roulette.nome || 'unknown-roulette';
};

// Reintroduzir a definição do componente RouletteStatsInline aqui
// (Baseado na leitura anterior do arquivo original)
const RouletteStatsInline = ({ roletaNome, lastNumbers }: { roletaNome: string, lastNumbers: number[] }) => {
  // Calcular estatísticas
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const redCount = lastNumbers.filter(n => redNumbers.includes(n)).length;
  const blackCount = lastNumbers.filter(n => n !== 0 && !redNumbers.includes(n)).length;
  const zeroCount = lastNumbers.filter(n => n === 0).length;
  const total = lastNumbers.length;
  
  // Calcular porcentagens - Evitar divisão por zero
  const redPercent = total > 0 ? Math.round((redCount / total) * 100) : 0;
  const blackPercent = total > 0 ? Math.round((blackCount / total) * 100) : 0;
  const zeroPercent = total > 0 ? Math.round((zeroCount / total) * 100) : 0;
  
  // Calcular frequência de números
  const numberFrequency: Record<number, number> = {};
  lastNumbers.forEach(num => {
    numberFrequency[num] = (numberFrequency[num] || 0) + 1;
  });
  
  // Encontrar números quentes (mais frequentes)
  const hotNumbers = Object.entries(numberFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => ({ number: parseInt(entry[0]), count: entry[1] }));
    
  // Encontrar números frios (menos frequentes)
  const coldNumbers = Object.entries(numberFrequency)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 5)
    .map(entry => ({ number: parseInt(entry[0]), count: entry[1] }));
  
  // Retornar JSX para exibir as estatísticas (adaptar o estilo se necessário)
  return (
    <div className="p-4 bg-gray-850 rounded-lg">
      <h2 className="text-lg font-semibold text-green-400 mb-3">{roletaNome} - Estatísticas</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        {/* Coluna 1: Distribuição */} 
        <div>
          <h3 className="text-gray-400 font-medium mb-2">Distribuição</h3>
          <div className="space-y-1">
             <p>Vermelho: <span className="font-semibold text-red-500">{redCount} ({redPercent}%)</span></p>
             <p>Preto: <span className="font-semibold text-gray-300">{blackCount} ({blackPercent}%)</span></p>
             <p>Zero: <span className="font-semibold text-green-500">{zeroCount} ({zeroPercent}%)</span></p>
             <p>Total: <span className="font-semibold text-white">{total}</span></p>
          </div>
        </div>
        {/* Coluna 2: Quentes */} 
        <div>
          <h3 className="text-gray-400 font-medium mb-2">Números Quentes</h3>
          <div className="flex flex-wrap gap-1">
            {hotNumbers.map(({number, count}) => {
                const bgColor = number === 0 ? "bg-green-600" : redNumbers.includes(number) ? "bg-red-600" : "bg-gray-900";
                return (
                  <div key={number} title={`${count}x`} className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${bgColor}`}>{number}</div>
                );
            })}
          </div>
        </div>
        {/* Coluna 3: Frios */} 
        <div>
           <h3 className="text-gray-400 font-medium mb-2">Números Frios</h3>
           <div className="flex flex-wrap gap-1">
            {coldNumbers.map(({number, count}) => {
                 const bgColor = number === 0 ? "bg-green-600" : redNumbers.includes(number) ? "bg-red-600" : "bg-gray-900";
                 return (
                   <div key={number} title={`${count}x`} className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${bgColor}`}>{number}</div>
                 );
             })}
           </div>
        </div>
      </div>
    </div>
  );
};

interface LiveRoulettesDisplayProps {
  roulettesData?: RouletteData[];
}

const LiveRoulettesDisplay: React.FC<LiveRoulettesDisplayProps> = ({ roulettesData: initialPropData }) => {
  const [liveRoulettes, setLiveRoulettes] = useState<RouletteData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoulette, setSelectedRoulette] = useState<RouletteData | null>(null);
  const prevRoulettesRef = useRef<Map<string, RouletteData>>(new Map());

  useEffect(() => {
    // logger.info('LiveRoulettesDisplay montado. Buscando dados iniciais...');
    setLoading(true);

    const fetchInitialData = async () => {
      try {
        const initialData = await unifiedClient.fetchRouletteData();
        if (initialData && initialData.length > 0) {
          // logger.info(`Dados iniciais recebidos: ${initialData.length} roletas.`);
          setLiveRoulettes(initialData);
          updatePrevRoulettes(initialData);
        } else if (initialPropData && initialPropData.length > 0) {
            // logger.info('Usando dados das props como fallback inicial.');
            setLiveRoulettes(initialPropData);
            updatePrevRoulettes(initialPropData);
        } else {
          // logger.warn('Nenhum dado inicial de roleta disponível via unifiedClient ou props.');
        }
      } catch (err: any) {
        console.error('Erro ao buscar dados iniciais de roleta:', err); // Usar console.error como fallback
        setError('Falha ao carregar dados das roletas.');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    const handleDataUpdated = (updateData: RouletteData[] | RouletteData) => {
        // logger.debug('Evento rouletteDataUpdated recebido:', updateData);
        console.debug('Evento rouletteDataUpdated recebido:', updateData); // Usar console.debug
        setLiveRoulettes(currentRoulettes => {
            const newRoulettesMap = new Map(currentRoulettes.map(r => [getRouletteKey(r), r]));
            const dataArray = Array.isArray(updateData) ? updateData : [updateData];

            dataArray.forEach(roulette => {
                const key = getRouletteKey(roulette);
                const existing = newRoulettesMap.get(key);
                if (existing) {
                    const updatedRoulette = { ...existing, ...roulette };
                    updatedRoulette.numero = Array.isArray(roulette.numero) ? roulette.numero : existing.numero;
                    newRoulettesMap.set(key, updatedRoulette);
                } else {
                    newRoulettesMap.set(key, { ...roulette, numero: Array.isArray(roulette.numero) ? roulette.numero : [] });
                }
            });

            const updatedList = Array.from(newRoulettesMap.values());
            updatePrevRoulettes(updatedList);
            return updatedList;
        });
    };

    EventService.on('rouletteDataUpdated', handleDataUpdated);
    // logger.info('Inscrito no evento rouletteDataUpdated.');

    return () => {
      // logger.info('LiveRoulettesDisplay desmontando. Removendo listener.');
      EventService.off('rouletteDataUpdated', handleDataUpdated);
    };
  }, [initialPropData]);

   const updatePrevRoulettes = (roulettes: RouletteData[]) => {
    const newMap = new Map<string, RouletteData>();
    roulettes.forEach(r => newMap.set(getRouletteKey(r), r));
    prevRoulettesRef.current = newMap;
  };

  const isNewNumber = (roulette: RouletteData, numberIndex: number): boolean => {
    const key = getRouletteKey(roulette);
    const prevRoulette = prevRoulettesRef.current.get(key);
    if (!prevRoulette || !Array.isArray(prevRoulette.numero) || !Array.isArray(roulette.numero)) {
      return false;
    }
    return numberIndex === 0 && roulette.numero.length > 0 && prevRoulette.numero.length > 0 && roulette.numero[0] !== prevRoulette.numero[0];
  };

  const handleRouletteSelect = (roleta: RouletteData) => {
    // logger.info(`Roleta selecionada para estatísticas: ${roleta.nome || getRouletteKey(roleta)}`);
    console.log(`Roleta selecionada para estatísticas: ${roleta.nome || getRouletteKey(roleta)}`); // Usar console.log
    setSelectedRoulette(roleta);
  };

  const handleCloseStats = () => {
    // logger.info('Fechando painel de estatísticas.');
    console.log('Fechando painel de estatísticas.'); // Usar console.log
    setSelectedRoulette(null);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Card key={index} className="bg-gray-800 border-gray-700">
            <CardHeader>
              <Skeleton className="h-6 w-3/4 bg-gray-700" />
              <Skeleton className="h-4 w-1/2 bg-gray-700 mt-1" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full bg-gray-700" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-center p-4">Erro: {error}</div>;
  }

  if (!liveRoulettes || liveRoulettes.length === 0) {
        return <div className="text-gray-400 text-center p-4">Nenhuma roleta ao vivo disponível no momento.</div>;
    }

  return (
    <div className="p-4 relative">
       <AnimatePresence>
        {selectedRoulette && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-gray-900 border-t border-gray-700 shadow-lg p-4 max-h-[80vh] overflow-y-auto"
          >
            <button
                onClick={handleCloseStats}
                className="absolute top-2 right-2 text-gray-400 hover:text-white transition-colors"
                aria-label="Fechar estatísticas"
            >
                <X size={24} />
            </button>
            {selectedRoulette && (
               <RouletteStatsInline
                  roletaNome={selectedRoulette.nome || getRouletteKey(selectedRoulette)}
                  lastNumbers={selectedRoulette.numero?.map(n => typeof n === 'number' ? n : parseInt(String(n), 10)).filter(n => !isNaN(n)) ?? []}
               />
             )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {liveRoulettes.map((roleta) => {
           const numericLastNumbers = roleta.numero
            ?.map(n => typeof n === 'number' ? n : parseInt(String(n), 10))
            .filter(n => !isNaN(n)) ?? [];

          const uniqueKey = getRouletteKey(roleta);
          const displayName = roleta.nome || uniqueKey;

          return (
            <motion.div
              key={uniqueKey}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              layout
            >
              <Card
                className={`bg-gray-800 border border-gray-700 hover:border-green-500 transition-colors duration-200 cursor-pointer shadow-md rounded-lg overflow-hidden ${getRouletteKey(selectedRoulette || {}) === uniqueKey ? 'border-2 border-green-500' : ''}`}
                onClick={() => handleRouletteSelect(roleta)}
              >
                <CardHeader className="p-4 border-b border-gray-700">
                  <CardTitle className="text-lg font-semibold text-green-400 truncate">{displayName}</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <LastNumbersBar
                      numbers={numericLastNumbers}
                      isNewNumber={(index) => isNewNumber(roleta, index)}
                  />
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default LiveRoulettesDisplay; 