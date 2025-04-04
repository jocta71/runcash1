import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import axios from 'axios';
import LiveRoulettesDisplay from '@/components/roulette/LiveRoulettesDisplay';
import { RouletteData } from '@/integrations/api/rouletteService';
import { Loader2 } from 'lucide-react';

const LiveRoulettePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roulettes, setRoulettes] = useState<RouletteData[]>([]);

  useEffect(() => {
    const fetchRoulettes = async () => {
      try {
        setLoading(true);
        
        // Buscar dados das roletas do endpoint principal
        const response = await axios.get<RouletteData[]>('/api/ROULETTES');
        console.log('[LiveRoulettePage] Dados recebidos da API:', response.data);
        
        if (Array.isArray(response.data)) {
          // Buscar os números reais para cada roleta usando o ID canônico
          const enrichedRoulettes = await Promise.all(
            response.data.map(async (roleta) => {
              try {
                // Usar o ID canônico para buscar números
                const numbersResponse = await axios.get(
                  `/api/roulette-numbers/${roleta.id}?limit=20`
                );
                
                console.log(`[LiveRoulettePage] Números para ${roleta.nome || roleta.name}:`, 
                  numbersResponse.data);
                
                // Adicionar os números à roleta
                return {
                  ...roleta,
                  numero: Array.isArray(numbersResponse.data) ? numbersResponse.data : []
                };
              } catch (err) {
                console.error(`Erro ao buscar números para roleta ${roleta.id}:`, err);
                // Retornar a roleta sem números em caso de erro
                return {
                  ...roleta,
                  numero: []
                };
              }
            })
          );
          
          setRoulettes(enrichedRoulettes);
        } else {
          setError('Formato de resposta inválido da API');
        }
      } catch (err) {
        console.error('Erro ao buscar dados das roletas:', err);
        setError('Falha ao carregar dados das roletas. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };

    fetchRoulettes();
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