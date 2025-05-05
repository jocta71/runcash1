import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import LiveRoulettesDisplay from '@/components/roulette/LiveRoulettesDisplay';
import { RouletteData } from '@/integrations/api/rouletteService';
import { Loader2 } from 'lucide-react';
import EventService from '@/services/EventService';
import { UnifiedRouletteClient } from '@/services/UnifiedRouletteClient';

const LiveRoulettePage: React.FC = () => {
  const [roulettes, setRoulettes] = useState<RouletteData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState<boolean>(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  
  const unifiedClient = useMemo(() => {
    console.log('[LiveRoulettePage] Obtendo instância do UnifiedRouletteClient');
    return UnifiedRouletteClient.getInstance();
  }, []);

  const addNewNumberToRoulette = useCallback((rouletteId: string, newNumberData: any) => {
    setRoulettes(prevRoulettes => {
      return prevRoulettes.map(roleta => {
        if (roleta.id === rouletteId || roleta._id === rouletteId) {
          const newNumber = {
            numero: newNumberData.numero,
            cor: newNumberData.cor || determinarCorNumero(newNumberData.numero),
            timestamp: newNumberData.timestamp || new Date().toISOString()
          };
          const numeros = Array.isArray(roleta.numero) ? [...roleta.numero] : [];
          return {
            ...roleta,
            numero: [newNumber, ...numeros]
          };
        }
        return roleta;
      });
    });
    setLastUpdateTime(Date.now());
  }, []);

  const determinarCorNumero = (numero: number): string => {
    if (numero === 0) return 'verde';
    const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return numerosVermelhos.includes(numero) ? 'vermelho' : 'preto';
  };

  useEffect(() => {
    console.log('[LiveRoulettePage] Montando componente e buscando dados iniciais...');
    setLoading(true);

    const initialData = unifiedClient.getAllRoulettes();
    if (initialData && initialData.length > 0) {
      console.log(`[LiveRoulettePage] Carregados ${initialData.length} roletas do cache inicial do UnifiedClient`);
      setRoulettes(initialData);
      setLoading(false);
      setInitialized(true);
    } else {
      console.log('[LiveRoulettePage] Cache inicial vazio, aguardando dados do SSE...');
      const timer = setTimeout(() => {
        if (loading) {
           console.warn('[LiveRoulettePage] Tempo limite de espera por dados iniciais.');
           setLoading(false);
           setInitialized(true);
        }
      }, 5000);
      return () => clearTimeout(timer);
    }

    const handleDataUpdated = (eventData: any) => {
      console.log('[LiveRoulettePage] Evento roulette:data-updated recebido');
      const updatedRoulettes = unifiedClient.getAllRoulettes();
      if (updatedRoulettes && updatedRoulettes.length >= 0) {
        console.log(`[LiveRoulettePage] Atualizando com ${updatedRoulettes.length} roletas do UnifiedClient`);
        setRoulettes(updatedRoulettes);
        setLoading(false);
        setInitialized(true);
        setLastUpdateTime(Date.now());
      }
    };
    
    const handleNewNumber = (event: any) => {
      if (event && event.roleta_id && event.numero !== undefined) {
        console.log(`[LiveRoulettePage] Evento roulette:new-number recebido: ${event.numero} para roleta ${event.roleta_id}`);
        addNewNumberToRoulette(event.roleta_id, {
          numero: event.numero,
          timestamp: event.timestamp,
          cor: event.cor
        });
      }
    };
    
    EventService.on('roulette:data-updated', handleDataUpdated);
    EventService.on('roulette:new-number', handleNewNumber);
    
    return () => {
      console.log('[LiveRoulettePage] Desmontando componente e limpando listeners...');
      EventService.off('roulette:data-updated', handleDataUpdated);
      EventService.off('roulette:new-number', handleNewNumber);
    };
  }, [unifiedClient, addNewNumberToRoulette]);

  return (
    <>
      <Helmet>
        <title>Roletas ao vivo | RunCash</title>
      </Helmet>
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Roletas ao vivo</h1>
        
        {initialized && !loading && (
          <div className="text-sm text-gray-500 mb-4">
            Última atualização: {new Date(lastUpdateTime).toLocaleTimeString()}
            <button 
              onClick={async () => {
                console.log('[LiveRoulettePage] Botão Atualizar clicado');
                setLoading(true);
                try {
                  await unifiedClient.forceUpdate();
                  const refreshedData = unifiedClient.getAllRoulettes();
                  setRoulettes(refreshedData);
                  setLastUpdateTime(Date.now());
                  console.log('[LiveRoulettePage] Dados atualizados manualmente após forceUpdate');
                } catch (err) {
                  console.error('[LiveRoulettePage] Erro ao forçar atualização:', err);
                  setError('Falha ao atualizar dados.');
                } finally {
                  setLoading(false);
                }
              }}
              className="ml-2 text-blue-500 hover:text-blue-700"
            >
              Atualizar agora
            </button>
          </div>
        )}
        
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Carregando roletas...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        ) : !initialized ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Inicializando conexão...</span>
          </div>
        ) : roulettes.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-500">Nenhuma roleta disponível ou conectando...</p>
            <button 
              onClick={async () => { 
                setLoading(true);
                await unifiedClient.forceUpdate(); 
                setLoading(false); 
              }} 
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Tentar Reconectar
            </button>
          </div>
        ) : (
          <LiveRoulettesDisplay roulettesData={roulettes} />
        )}
      </div>
    </>
  );
};

export default LiveRoulettePage; 