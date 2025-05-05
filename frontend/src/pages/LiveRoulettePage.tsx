import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import LiveRoulettesDisplay from '@/components/roulette/LiveRoulettesDisplay';
// <<< Tipagem RouletteData pode precisar ser ajustada ou vir de outro lugar >>>
// import { RouletteData } from '@/integrations/api/rouletteService'; 
import { Loader2 } from 'lucide-react';
// import EventService from '@/services/EventService'; // Remover se não usado diretamente aqui
// import RouletteFeedService from '@/services/RouletteFeedService'; // <<< REMOVIDO
import UnifiedRouletteClient from '@/services/UnifiedRouletteClient'; // <<< ADICIONADO

// <<< Definir tipo RouletteData localmente ou importar de local correto >>>
interface RouletteData { 
  id: string;
  _id?: string; // Para compatibilidade
  name?: string;
  nome?: string;
  numero?: any[]; // Ajustar tipo se soubermos a estrutura exata
  [key: string]: any; // Permitir outras propriedades
}

const LiveRoulettePage: React.FC = () => {
  const [roulettes, setRoulettes] = useState<RouletteData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // const [initialized, setInitialized] = useState<boolean>(false); // Estado de inicialização agora é do UnifiedClient
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  
  // <<< Obter instância do UnifiedRouletteClient >>>
  const unifiedClient = UnifiedRouletteClient.getInstance();

  // <<< Remover useCallback de addNewNumberToRoulette se não for mais necessário >>>
  // A lógica de atualização agora vem principalmente do UnifiedClient

  // <<< Remover determinarCorNumero se não for usado diretamente aqui >>>

  // <<< REFAZER useEffect >>>
  useEffect(() => {
    console.log('[LiveRoulettePage] Montando e buscando dados do UnifiedClient');
    
    // Função para processar dados recebidos
    const processUpdate = (updatedData: any[] | any) => {
        let updatedRoulettes: RouletteData[] = [];
        if (Array.isArray(updatedData)) {
            updatedRoulettes = updatedData;
        } else if (updatedData && typeof updatedData === 'object' && updatedData.id) {
            // Se for um objeto único, tentar atualizar ou adicionar na lista
            setRoulettes(prev => {
                 const existingIndex = prev.findIndex(r => r.id === updatedData.id);
                 if (existingIndex > -1) {
                     const newState = [...prev];
                     newState[existingIndex] = updatedData; // Substitui roleta existente
                     return newState;
                 } else {
                     return [...prev, updatedData]; // Adiciona nova roleta
                 }
            });
            setLastUpdateTime(Date.now());
            return; // Sai pois já atualizou o estado
        } else {
             console.warn('[LiveRoulettePage] Dados de atualização inválidos recebidos', updatedData);
             return; // Ignora atualização inválida
        }
        
        if (updatedRoulettes && updatedRoulettes.length > 0) {
            console.log(`[LiveRoulettePage] Atualizando com ${updatedRoulettes.length} roletas`);
            setRoulettes(updatedRoulettes);
            setLoading(false); 
            setLastUpdateTime(Date.now()); 
        } else {
             // Se receber array vazio, talvez manter os dados antigos ou limpar?
             // setLoading(false); // Pode parar loading mesmo sem dados novos
        }
    };

    // Obter dados iniciais do UnifiedClient
    const initialData = unifiedClient.getAllRoulettes();
    if (initialData && initialData.length > 0) {
      console.log(`[LiveRoulettePage] Carregados ${initialData.length} roletas iniciais do UnifiedClient`);
      setRoulettes(initialData);
      setLoading(false);
    } else {
      console.log('[LiveRoulettePage] Aguardando primeira atualização do UnifiedClient...');
      setLoading(true); // Manter loading até receber dados
    }

    // Inscrever-se no evento 'update' do UnifiedClient
    const unsubscribe = unifiedClient.on('update', processUpdate);
    
    // <<< Remover lógica de timer de verificação e EventService.on >>>
    /*
    EventService.on('roulette:data-updated', handleDataUpdated);
    EventService.on('roulette:new-number', handleSocketUpdate);
    const updateCheckTimer = setInterval(() => { ... }, 10000);
    */
    
    return () => {
      console.log('[LiveRoulettePage] Desmontando e cancelando inscrição');
      unsubscribe();
      // Limpar outros listeners ou timers se necessário
      // clearInterval(updateCheckTimer);
    };
  }, [unifiedClient]); // Depender apenas do unifiedClient

  return (
    <>
      <Helmet>
        <title>Roletas ao vivo | RunCash</title>
      </Helmet>
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Roletas ao vivo</h1>
        
        {/* Indicador de última atualização */}
        {!loading && (
          <div className="text-sm text-gray-500 mb-4 flex justify-between items-center">
            <span>Última atualização: {new Date(lastUpdateTime).toLocaleTimeString()}</span>
            <button 
              onClick={() => {
                console.log('[LiveRoulettePage] Forçando atualização via UnifiedClient...');
                setLoading(true); // Mostrar loading ao forçar
                // <<< Usar unifiedClient.forceUpdate() >>>
                unifiedClient.forceUpdate()
                  .catch(err => {
                      console.error('[LiveRoulettePage] Erro ao forçar atualização:', err);
                      setError('Falha ao forçar atualização.');
                  })
                  .finally(() => {
                       // O loading será removido quando o evento 'update' chegar
                       // setTimeout(() => setLoading(false), 1000); // Ou remover após um tempo
                  });
              }}
              className="text-xs text-blue-400 hover:text-blue-300 ml-4"
              title="Forçar Atualização"
            >
              (Atualizar)
            </button>
          </div>
        )}
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-vegas-green" />
          </div>
        ) : (
          <LiveRoulettesDisplay roulettesData={roulettes} />
        )}
      </div>
    </>
  );
};

export default LiveRoulettePage; 