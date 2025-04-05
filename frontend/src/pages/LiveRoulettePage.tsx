import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import MainLayout from '@/components/layouts/MainLayout';
import LiveRoulettesDisplay from '@/components/roulette/LiveRoulettesDisplay';
import { RouletteData } from '@/integrations/api/rouletteService';
import axios from 'axios';
import { Loader } from 'lucide-react';
import SocketService from '@/services/SocketService';
import EventService from '@/services/EventService';

const LiveRoulettePage: React.FC = () => {
  const [roulettes, setRoulettes] = useState<RouletteData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Função para buscar os dados das roletas
  const fetchRoulettes = useCallback(async () => {
    try {
      const response = await axios.get('/api/ROULETTES');
      if (response.data && Array.isArray(response.data)) {
        setRoulettes(response.data);
      } else {
        setError('Dados de roletas em formato inválido');
      }
    } catch (err) {
      console.error('Erro ao buscar roletas:', err);
      setError('Erro ao carregar dados das roletas');
    } finally {
      setLoading(false);
    }
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
  }, []);

  // Função para determinar a cor de um número da roleta
  const determinarCorNumero = (numero: number): string => {
    if (numero === 0) return 'verde';
    
    const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return numerosVermelhos.includes(numero) ? 'vermelho' : 'preto';
  };

  // Efeito para buscar os dados iniciais
  useEffect(() => {
    fetchRoulettes();
  }, [fetchRoulettes]);

  // Efeito para configurar os listeners de eventos em tempo real
  useEffect(() => {
    // Inicializar o serviço de socket
    const socketService = SocketService.getInstance();
    
    // Função para lidar com novos números
    const handleNewNumber = (event: any) => {
      if (event.type === 'new_number' && event.roleta_id && event.numero !== undefined) {
        console.log(`[LiveRoulettePage] Novo número recebido para roleta ${event.roleta_id}: ${event.numero}`);
        addNewNumberToRoulette(event.roleta_id, {
          numero: event.numero,
          cor: determinarCorNumero(event.numero),
          timestamp: event.timestamp
        });
      }
    };

    // Registrar listener para novos números
    EventService.on('roulette:new-number', handleNewNumber);

    // Registrar todas as roletas para atualizações
    socketService.registerToAllRoulettes();
    
    // Solicitar dados recentes
    socketService.requestRecentNumbers();

    // Polling para atualização de backup (caso websocket falhe)
    const pollingInterval = setInterval(() => {
      fetchRoulettes();
    }, 30000); // A cada 30 segundos

    return () => {
      // Limpar listeners e intervalos ao desmontar
      EventService.off('roulette:new-number', handleNewNumber);
      clearInterval(pollingInterval);
    };
  }, [addNewNumberToRoulette, fetchRoulettes]);

  return (
    <MainLayout>
      <Helmet>
        <title>Roletas ao vivo | RunCash</title>
      </Helmet>
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-6">Roletas ao Vivo</h1>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader className="animate-spin h-8 w-8 text-primary" />
            <span className="ml-2 text-white">Carregando roletas...</span>
          </div>
        ) : error ? (
          <div className="bg-red-500 text-white p-4 rounded-md">
            {error}
          </div>
        ) : (
          <LiveRoulettesDisplay roulettesData={roulettes} />
        )}
      </div>
    </MainLayout>
  );
};

export default LiveRoulettePage; 