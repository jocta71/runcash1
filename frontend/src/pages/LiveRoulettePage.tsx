import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import LiveRoulettesDisplay from '@/components/roulette/LiveRoulettesDisplay';
import { RouletteData } from '@/integrations/api/rouletteService';
// import axios from 'axios'; // Removido - não precisamos mais de requisições diretas
import { Loader2 } from 'lucide-react';
import SocketService from '@/services/SocketService';
import EventService from '@/services/EventService';
import RouletteFeedService from '@/services/RouletteFeedService';
import { initializeRouletteSystem } from '@/hooks/useRouletteData';

// Flag para controlar se o componente já foi inicializado
let IS_COMPONENT_INITIALIZED = false;

const LiveRoulettePage: React.FC = () => {
  const [roulettes, setRoulettes] = useState<RouletteData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
    
    // Inicializar o sistema de roletas otimizado (singleton garantido)
    const { rouletteFeedService } = initializeRouletteSystem();
    console.log('[LiveRoulettePage] Sistema de roletas inicializado - fonte única de dados (8s)');
    
    // Buscar dados iniciais
    async function fetchInitialData() {
      try {
        setLoading(true);
        
        // Adicionar um pequeno atraso para garantir que o serviço carregou os dados iniciais
        // Este atraso evita que requisições múltiplas sejam feitas durante o carregamento
        setTimeout(() => {
          // Obter dados do serviço singleton
          const rouletteData = rouletteFeedService.getAllRouletteTables().map(table => ({
            id: table.tableId,
            nome: table.tableId, // Usar ID temporariamente se não tiver nome
            numero: table.numbers.map(n => ({ numero: parseInt(n) })),
            ativa: true  // Usando ativa em vez de ativo para corresponder ao tipo
          }));
          
          setRoulettes(rouletteData);
          setLoading(false);
        }, 800); // Aumentar atraso para dar mais tempo ao serviço
      } catch (err: any) {
        console.error('Erro ao carregar dados de roletas:', err);
        setError(err.message || 'Erro ao carregar roletas');
        setLoading(false);
      }
    }
    
    fetchInitialData();
    
    // Listener para atualizações de números
    const handleNumbersUpdated = (data: any) => {
      // console.log('[LiveRoulettePage] Recebida atualização:', data.tableId);
      setRoulettes(prev => {
        // Encontrar a roleta que foi atualizada
        const roletaIndex = prev.findIndex(r => r.id === data.tableId);
        
        if (roletaIndex >= 0) {
          // Atualizar roleta existente
          const updatedRoulettes = [...prev];
          
          // Converter os números de string para o formato esperado
          const numeros = data.numbers.map((n: string) => ({ 
            numero: parseInt(n),
            timestamp: new Date().toISOString()
          }));
          
          updatedRoulettes[roletaIndex] = {
            ...updatedRoulettes[roletaIndex],
            numero: numeros
          };
          
          return updatedRoulettes;
        }
        
        // Se a roleta não existir, adicionar nova
        const newRoulette: RouletteData = {
          id: data.tableId,
          nome: data.tableName || data.tableId,
          numero: data.numbers.map((n: string) => ({ 
            numero: parseInt(n),
            timestamp: new Date().toISOString()
          })),
          ativa: true
        };
        
        return [...prev, newRoulette];
      });
    };
    
    EventService.on('roulette:numbers-updated', handleNumbersUpdated);
    
    return () => {
      EventService.off('roulette:numbers-updated', handleNumbersUpdated);
      // Não resetamos IS_COMPONENT_INITIALIZED pois queremos garantir que só haja
      // uma inicialização durante todo o ciclo de vida da aplicação
    };
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