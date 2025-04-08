import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import LiveRoulettesDisplay from '@/components/roulette/LiveRoulettesDisplay';
import { RouletteData } from '@/integrations/api/rouletteService';
// import axios from 'axios'; // Removido - não precisamos mais de requisições diretas
import { Loader2 } from 'lucide-react';
import SocketService from '@/services/SocketService';
import EventService from '@/services/EventService';
import RouletteFeedService from '@/services/RouletteFeedService';
// Remover a importação do initializeRouletteSystem pois vamos usar o service diretamente
// import { initializeRouletteSystem } from '@/hooks/useRouletteData';

// Flag para controlar se o componente já foi inicializado
let IS_COMPONENT_INITIALIZED = false;

const LiveRoulettePage: React.FC = () => {
  const [roulettes, setRoulettes] = useState<RouletteData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Obter referência ao serviço de feed centralizado
  const feedService = useMemo(() => RouletteFeedService.getInstance(), []);

  // Função para adicionar um novo número a uma roleta específica
  const addNewNumberToRoulette = useCallback((rouletteId: string, newNumberData: any) => {
    setRoulettes(prevRoulettes => {
      return prevRoulettes.map(roleta => {
        // Verificar se é a roleta certa
        if (roleta.id === rouletteId || roleta._id === rouletteId || roleta.canonicalId === rouletteId) {
          // Criar um novo número no formato correto
          const newNumber = {
            numero: newNumberData.numero,
            cor: newNumberData.cor || determinarCorNumero(newNumberData.numero),
            timestamp: newNumberData.timestamp || new Date().toISOString()
          };

          // Verificar se o array numero existe e é um array
          const numeros = Array.isArray(roleta.numero) ? [...roleta.numero] : [];
          
          // Adicionar o novo número no início do array (mais recente primeiro)
          return {
            ...roleta,
            numero: [newNumber, ...numeros]
          };
        }
        return roleta;
      });
    });
  }, []);

  // Função para determinar a cor de um número da roleta
  const determinarCorNumero = (numero: number): string => {
    if (numero === 0) return 'verde';
    
    const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return numerosVermelhos.includes(numero) ? 'vermelho' : 'preto';
  };

  // Efeito para buscar os dados iniciais
  useEffect(() => {
    // Verificar se o componente já foi inicializado antes
    if (IS_COMPONENT_INITIALIZED) {
      console.log('[LiveRoulettePage] Componente já inicializado, evitando dupla inicialização');
      return;
    }
    
    // Marcar como inicializado para evitar inicializações múltiplas
    IS_COMPONENT_INITIALIZED = true;
    
    // Usar o serviço diretamente em vez de inicializar pelo hook
    console.log('[LiveRoulettePage] Inicializando fonte única de dados - RouletteFeedService');
    
    // Iniciar o polling se ainda não estiver ativo
    if (!feedService.isPollingActive) {
      feedService.startPolling();
    }
    
    // Buscar dados iniciais
    async function fetchInitialData() {
      try {
        setLoading(true);
        
        // Verificar se já temos dados em cache
        const cachedRoulettes = feedService.getAllRoulettes();
        
        if (cachedRoulettes && cachedRoulettes.length > 0) {
          console.log(`[LiveRoulettePage] Usando ${cachedRoulettes.length} roletas do cache`);
          setRoulettes(cachedRoulettes);
          setLoading(false);
        } else {
          // Buscar dados iniciais
          console.log('[LiveRoulettePage] Buscando dados iniciais');
          
          feedService.fetchInitialData()
            .then(data => {
              if (Array.isArray(data) && data.length > 0) {
                console.log(`[LiveRoulettePage] Dados iniciais obtidos: ${data.length} roletas`);
                setRoulettes(data);
              } else {
                console.warn('[LiveRoulettePage] Dados iniciais inválidos:', data);
              }
              setLoading(false);
            })
            .catch(error => {
              console.error('[LiveRoulettePage] Erro ao buscar dados iniciais:', error);
              setError('Falha ao carregar dados das roletas');
              setLoading(false);
            });
        }
      } catch (err: any) {
        console.error('Erro ao carregar dados de roletas:', err);
        setError(err.message || 'Erro ao carregar roletas');
        setLoading(false);
      }
    }
    
    fetchInitialData();
    
    // Inscrever-se no evento de atualização de dados
    const handleDataUpdated = (updateData: any) => {
      console.log('[LiveRoulettePage] Recebida atualização de dados');
      
      // Obter dados atualizados do cache
      const updatedRoulettes = feedService.getAllRoulettes();
      
      if (updatedRoulettes && updatedRoulettes.length > 0) {
        console.log(`[LiveRoulettePage] Atualizando com ${updatedRoulettes.length} roletas`);
        setRoulettes(updatedRoulettes);
      }
    };
    
    // Inscrever-se no evento
    EventService.on('roulette:data-updated', handleDataUpdated);
    
    return () => {
      // Limpar listener ao desmontar
      EventService.off('roulette:data-updated', handleDataUpdated);
      // Não resetamos IS_COMPONENT_INITIALIZED pois queremos garantir que só haja
      // uma inicialização durante todo o ciclo de vida da aplicação
    };
  }, [feedService]);

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