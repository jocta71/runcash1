import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import LiveRoulettesDisplay from '@/components/roulette/LiveRoulettesDisplay';
import { RouletteData } from '@/integrations/api/rouletteService';
import { fetchRoulettesWithNumbers } from '@/integrations/api/rouletteApi';
import { Loader2 } from 'lucide-react';

const LiveRoulettePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roulettes, setRoulettes] = useState<RouletteData[]>([]);

  useEffect(() => {
    const fetchRoulettesData = async () => {
      try {
        setLoading(true);
        
        // Usar nossa nova API que busca roletas com números incluídos
        console.log('[LiveRoulettePage] Buscando roletas com números incluídos');
        const roulettesWithNumbers = await fetchRoulettesWithNumbers(20);
        
        console.log('[LiveRoulettePage] Roletas com números recebidas:', roulettesWithNumbers);
        setRoulettes(roulettesWithNumbers);
      } catch (err) {
        console.error('Erro ao buscar dados das roletas:', err);
        setError('Falha ao carregar dados das roletas. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };

    fetchRoulettesData();
  }, []);

  return (
    <>
      <Helmet>
        <title>Roletas ao vivo | RunCash</title>
      </Helmet>
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Roletas ao vivo</h1>
        
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Carregando roletas...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        ) : roulettes.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-500">Nenhuma roleta disponível no momento.</p>
          </div>
        ) : (
          <LiveRoulettesDisplay roulettesData={roulettes} />
        )}
      </div>
    </>
  );
};

export default LiveRoulettePage; 