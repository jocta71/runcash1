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
  const [initialized, setInitialized] = useState<boolean>(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  
  // Obter referência ao serviço de feed centralizado sem inicializar novo polling
  const feedService = useMemo(() => {
    // Verificar se o sistema já foi inicializado globalmente
    if (window.isRouletteSystemInitialized && window.isRouletteSystemInitialized()) {
      console.log('[LiveRoulettePage] Usando sistema de roletas já inicializado');
      // Recuperar o serviço do sistema global
      return window.getRouletteSystem 
        ? window.getRouletteSystem().rouletteFeedService 
        : RouletteFeedService.getInstance();
    }
    
    // Fallback para o comportamento padrão
    console.log('[LiveRoulettePage] Sistema global não detectado, usando instância padrão');
    return RouletteFeedService.getInstance();
  }, []);

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
    
    // Atualizar timestamp da última atualização
    setLastUpdateTime(Date.now());
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
    
    console.log('[LiveRoulettePage] Inicializando componente');
    
    // Inicializar o serviço de feed, que agora só busca dados iniciais uma vez
    feedService.initialize()
      .then(() => {
        console.log('[LiveRoulettePage] Serviço de feed inicializado com sucesso');
        setInitialized(true);
        
        // Obter dados do serviço após inicialização
        const rouletteData = Object.values(feedService.getAllRoulettes());
        if (rouletteData.length > 0) {
          console.log(`[LiveRoulettePage] Carregados ${rouletteData.length} roletas do serviço`);
          setRoulettes(rouletteData);
          setLoading(false);
        } else {
          // Se não temos dados ainda, aguardar até 5 segundos
          setTimeout(() => {
            const delayedData = Object.values(feedService.getAllRoulettes());
            console.log(`[LiveRoulettePage] Carregados ${delayedData.length} roletas após aguardar`);
            setRoulettes(delayedData);
            setLoading(false);
          }, 5000);
        }
      })
      .catch(err => {
        console.error('[LiveRoulettePage] Erro ao inicializar serviço de feed:', err);
        setError('Erro ao carregar dados. Por favor, tente novamente.');
        setLoading(false);
      });
    
    // Inscrever-se no evento de atualização de dados
    const handleDataUpdated = (updateData: any) => {
      console.log('[LiveRoulettePage] Recebida atualização de dados');
      
      // Obter dados atualizados do cache
      const updatedRoulettes = Object.values(feedService.getAllRoulettes());
      
      if (updatedRoulettes && updatedRoulettes.length > 0) {
        console.log(`[LiveRoulettePage] Atualizando com ${updatedRoulettes.length} roletas`);
        setRoulettes(updatedRoulettes);
        setLoading(false); // Garantir que o loading seja desativado ao receber dados
        setLastUpdateTime(Date.now()); // Registrar momento da atualização
      }
    };
    
    // Registrar manipulador para evento de socket (caso a versão use sockets)
    const handleSocketUpdate = (event: any) => {
      if (event && event.type === 'new_number' && event.roleta_id && event.numero) {
        console.log(`[LiveRoulettePage] Recebido novo número via socket: ${event.numero} para roleta ${event.roleta_id}`);
        addNewNumberToRoulette(event.roleta_id, {
          numero: event.numero,
          timestamp: event.timestamp
        });
      }
    };
    
    // Inscrever-se nos eventos
    EventService.on('roulette:data-updated', handleDataUpdated);
    EventService.on('roulette:new-number', handleSocketUpdate);
    
    // Iniciar timer para verificar atualizações periódicas
    const updateCheckTimer = setInterval(() => {
      // Verificar quanto tempo se passou desde a última atualização
      const timeSinceLastUpdate = Date.now() - lastUpdateTime;
      
      if (timeSinceLastUpdate > 30000) { // 30 segundos sem atualizações
        console.log('[LiveRoulettePage] Mais de 30s sem atualizações, verificando novos dados...');
        
        // Forçar uma atualização manual dos dados
        feedService.refreshCache()
          .then(() => {
            console.log('[LiveRoulettePage] Dados atualizados manualmente');
            const refreshedData = Object.values(feedService.getAllRoulettes());
            setRoulettes(refreshedData);
            setLastUpdateTime(Date.now());
          })
          .catch(err => {
            console.error('[LiveRoulettePage] Erro ao atualizar dados manualmente:', err);
          });
      }
    }, 10000); // Verificar a cada 10 segundos
    
    return () => {
      // Limpar listeners ao desmontar
      EventService.off('roulette:data-updated', handleDataUpdated);
      EventService.off('roulette:new-number', handleSocketUpdate);
      clearInterval(updateCheckTimer);
      // Não resetamos IS_COMPONENT_INITIALIZED pois queremos garantir que só haja
      // uma inicialização durante todo o ciclo de vida da aplicação
    };
  }, [feedService, addNewNumberToRoulette, lastUpdateTime]);

  return (
    <>
      <Helmet>
        <title>Roletas ao vivo | RunCash</title>
      </Helmet>
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Roletas ao vivo</h1>
        
        {/* Indicador de última atualização */}
        {initialized && !loading && (
          <div className="text-sm text-gray-500 mb-4">
            Última atualização: {new Date(lastUpdateTime).toLocaleTimeString()}
            <button 
              onClick={() => {
                setLoading(true);
                feedService.refreshCache()
                  .then(() => {
                    const refreshedData = Object.values(feedService.getAllRoulettes());
                    setRoulettes(refreshedData);
                    setLastUpdateTime(Date.now());
                    setLoading(false);
                  })
                  .catch(() => setLoading(false));
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