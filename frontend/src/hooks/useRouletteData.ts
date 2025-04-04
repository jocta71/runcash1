import { useCallback, useEffect, useRef, useState } from 'react';
import { RouletteNumberEvent } from '@/services/EventService';
import EventService from '@/services/EventService';
import { 
  fetchRouletteLatestNumbersByName, 
  fetchRouletteStrategy,
  fetchRouletteById,
  RouletteStrategy as ApiRouletteStrategy,
  mapToCanonicalRouletteId  // Importar a função de mapeamento
} from '@/integrations/api/rouletteService';
import { toast } from '@/components/ui/use-toast';
import SocketService from '@/services/SocketService';
import axios from 'axios';
import config from '@/config/env';
import FetchService from '@/services/FetchService';

// Debug flag - set to false to disable logs in production
const DEBUG = false;

// Usar a variável de ambiente centralizada do config
const API_URL = config.apiBaseUrl;

// Configuração do axios com headers padrão
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    'bypass-tunnel-reminder': 'true'
  },
  timeout: 10000,
});

// Função auxiliar para debug
const debugLog = (...args: any[]) => {
  if (DEBUG) {
    console.log(...args);
  }
};

// Tipos locais para simplificar o uso
interface RouletteNumber {
  numero: number;
  roleta_id?: string;
  roleta_nome?: string;
  timestamp?: string;
  cor?: string; // Nova propriedade para a cor do número
}

type RouletteStrategy = ApiRouletteStrategy;

// Criar um registro global de polling para evitar duplicações
const pollingInitialized = new Set<string>();

/**
 * Função para buscar números da roleta pelo novo endpoint separado
 * @param roletaId ID da roleta
 * @param nome Nome da roleta (para mapeamento)
 * @param limit Limite de números a serem retornados
 * @returns Array de objetos RouletteNumber
 */
const fetchRouletteNumbers = async (roletaId: string, nome?: string, limit: number = 100): Promise<RouletteNumber[]> => {
  try {
    // Mapear para o ID canônico
    const canonicalId = mapToCanonicalRouletteId(roletaId, nome);
    console.log(`[useRouletteData] Buscando números para roleta ${roletaId} (canônico: ${canonicalId}) via novo endpoint...`);
    
    const response = await api.get(`/roulette-numbers/${canonicalId}?limit=${limit}`);
    
    if (response.data && Array.isArray(response.data)) {
      console.log(`[useRouletteData] Recebidos ${response.data.length} números da API para ID: ${canonicalId}`);
      return response.data;
    }
    
    console.log(`[useRouletteData] Resposta da API não é um array válido:`, response.data);
    return [];
  } catch (error: any) {
    console.error(`[useRouletteData] Erro ao buscar números da roleta:`, error.message);
    return [];
  }
};

/**
 * Processa números brutos em formato RouletteNumber
 */
const processRouletteNumbers = (numbers: number[] | any[]): RouletteNumber[] => {
  if (!Array.isArray(numbers)) return [];
  
  // Mapear para formato padrão
  return numbers.map((item) => {
    // Verificar se o item já é um objeto com número
    if (typeof item === 'object' && item !== null) {
      // Garantir que número seja um valor numérico válido
      let numeroValue: number;
      
      if (typeof item.numero === 'number' && !isNaN(item.numero)) {
        numeroValue = item.numero;
      } else if (typeof item.numero === 'string' && item.numero.trim() !== '') {
        const parsedValue = parseInt(item.numero, 10);
        numeroValue = !isNaN(parsedValue) ? parsedValue : 0;
      } else {
        numeroValue = 0;
        console.warn(`[useRouletteData] Valor inválido encontrado: ${item.numero}, usando 0 como fallback`);
      }
      
      return {
        numero: numeroValue,
        roleta_id: item.roleta_id,
        roleta_nome: item.roleta_nome,
        cor: item.cor || determinarCorNumero(numeroValue),
        timestamp: item.timestamp || new Date().toISOString()
      };
    }
    
    // Se for direto um número
    let numeroValue: number;
    if (typeof item === 'number' && !isNaN(item)) {
      numeroValue = item;
    } else if (typeof item === 'string' && item.trim() !== '') {
      const parsedValue = parseInt(item, 10);
      numeroValue = !isNaN(parsedValue) ? parsedValue : 0;
    } else {
      numeroValue = 0;
      console.warn(`[useRouletteData] Valor inválido encontrado: ${item}, usando 0 como fallback`);
    }
    
    return {
      numero: numeroValue,
      roleta_id: undefined,
      roleta_nome: undefined,
      cor: determinarCorNumero(numeroValue),
      timestamp: new Date().toISOString()
    };
  });
};

// Interface para o resultado do hook
export interface UseRouletteDataResult {
  numbers: RouletteNumber[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  hasData: boolean;
  strategy: RouletteStrategy | null;
  strategyLoading: boolean;
  refreshNumbers: () => Promise<boolean>;
  refreshStrategy: () => Promise<boolean>;
}

/**
 * Determina a cor de um número da roleta
 */
export const determinarCorNumero = (numero: number): string => {
  if (numero === 0) return 'verde';
  
  // Números vermelhos na roleta europeia
  const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return numerosVermelhos.includes(numero) ? 'vermelho' : 'preto';
};

/**
 * Converte um número bruto para o formato RouletteNumber
 */
export const processRouletteNumber = (numero: number, timestamp?: string): RouletteNumber => {
  return {
    numero,
    roleta_id: undefined,
    roleta_nome: undefined,
    cor: determinarCorNumero(numero),
    timestamp: timestamp || new Date().toISOString()
  };
};

/**
 * Processa números de uma roleta por ID
 */
export const fetchRouletteLatestNumbers = async (roletaId: string, limit = 10): Promise<number[]> => {
  const data = await extractRouletteNumbersById(roletaId, limit);
  
  if (data && Array.isArray(data)) {
    // Extrair apenas os números do array de objetos
    const numbers = data.map((item: any) => {
      // Verificar se o item.numero é válido
      if (typeof item.numero === 'number' && !isNaN(item.numero)) {
        return item.numero;
      } else if (typeof item.numero === 'string' && item.numero.trim() !== '') {
        const parsedValue = parseInt(item.numero, 10);
        if (!isNaN(parsedValue)) return parsedValue;
      }
      // Se chegou aqui, é um valor inválido, retornar 0
      console.warn(`[API] Valor inválido de número encontrado: ${item.numero}, substituindo por 0`);
      return 0;
    });
    console.log(`[API] Processados ${numbers.length} números para roleta ID ${roletaId}:`, numbers);
    return numbers;
  }
  
  console.warn(`[API] Nenhum número encontrado para roleta ID ${roletaId}`);
  return [];
};

// Adicionar flag para controlar carregamento inicial vs. atualização em tempo real
export function useRouletteData(
  id: string,
  refreshInterval = 0
): UseRouletteDataResult {
  const [data, setData] = useState<RouletteData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  const initialLoadCompleted = useRef(false);
  const realtimeUpdatesCount = useRef(0);
  
  // Função para buscar dados da API
  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!id) {
      setError(new Error('ID da roleta não fornecido'));
      setIsLoading(false);
      return;
    }
    
    try {
      // Se já completou o carregamento inicial e não é forçada uma atualização,
      // não fazemos nova requisição para não substituir dados em tempo real
      if (initialLoadCompleted.current && !forceRefresh) {
        console.log(`[useRouletteData] Pulando requisição para preservar dados em tempo real - ID: ${id}`);
        return;
      }
      
      setIsLoading(true);
      console.log(`[useRouletteData] Buscando dados da roleta - ID: ${id}`);
      
      // Buscar dados da API usando o endpoint correto
      const response = await fetch(`/api/roulette-numbers/${id}`);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar dados: ${response.status}`);
      }
      
      const responseData = await response.json();
      
      // Validar os dados recebidos
      if (!responseData) {
        throw new Error('Dados inválidos recebidos da API');
      }
      
      // Garantir que estamos usando o formato correto dos dados
      const formattedData: RouletteData = {
        id: responseData.id || id,
        name: responseData.name || 'Roleta sem nome',
        numbers: Array.isArray(responseData.numbers) 
          ? responseData.numbers.filter((n: any) => typeof n === 'number' && n > 0)
          : [],
        mappedNumbers: Array.isArray(responseData.mappedNumbers)
          ? responseData.mappedNumbers.filter((n: any) => n && n.numero > 0)
          : []
      };
      
      // Se já temos dados e estamos apenas atualizando, preservar os dados em tempo real
      if (data && initialLoadCompleted.current) {
        console.log(`[useRouletteData] Mesclando dados novos com dados em tempo real existentes`);
        
        // Preservar números em tempo real que já foram recebidos
        const existingRealtimeNumbers = data.mappedNumbers?.filter(
          n => n.isRealtime === true
        ) || [];
        
        // Verificar quais IDs já existem nos dados em tempo real para evitar duplicação
        const existingIds = new Set(existingRealtimeNumbers.map(n => n.id));
        
        // Filtrar novos dados para não incluir IDs que já existem em tempo real
        const filteredNewNumbers = formattedData.mappedNumbers?.filter(
          n => !n.isRealtime || !existingIds.has(n.id)
        ) || [];
        
        // Combinar mantendo os dados em tempo real no início (mais recentes)
        formattedData.mappedNumbers = [
          ...existingRealtimeNumbers,
          ...filteredNewNumbers
        ];
        
        // Combinar números simples também
        const existingNumbers = new Set(data.numbers);
        const newNumbers = formattedData.numbers.filter(n => !existingNumbers.has(n));
        formattedData.numbers = [...data.numbers, ...newNumbers];
      }
      
      // Atualizar os dados
      setData(formattedData);
      setLastUpdateTime(new Date().toISOString());
      setError(null);
      initialLoadCompleted.current = true;
      
    } catch (err) {
      console.error('[useRouletteData] Erro ao buscar dados:', err);
      setError(err instanceof Error ? err : new Error('Erro desconhecido'));
    } finally {
      setIsLoading(false);
    }
  }, [id, data]);
  
  // Efeito para carregar dados iniciais e configurar atualizações periódicas
  useEffect(() => {
    // Resetar estado quando o ID mudar
    initialLoadCompleted.current = false;
    realtimeUpdatesCount.current = 0;
    
    // Fazer a carga inicial
    fetchData();
    
    // Configurar atualização periódica se solicitado
    let intervalId: NodeJS.Timeout | undefined;
    if (refreshInterval > 0) {
      intervalId = setInterval(() => {
        fetchData(true); // Forçar atualização
      }, refreshInterval);
    }
    
    // Cleanup
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [id, fetchData, refreshInterval]);

  // Função para atualizar dados manualmente
  const refreshData = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);
  
  // Função para adicionar um novo número em tempo real
  const addRealtimeNumber = useCallback((number: number, timestamp?: string) => {
    if (!number || number <= 0) {
      console.warn('[useRouletteData] Tentativa de adicionar número inválido em tempo real:', number);
      return;
    }
    
    realtimeUpdatesCount.current += 1;
    console.log(`[useRouletteData] Adicionando número em tempo real: ${number} (updates: ${realtimeUpdatesCount.current})`);
    
    setData(prevData => {
      if (!prevData) return null;
      
      // Criar novo item mapeado
      const newMappedNumber = {
        id: `realtime-${Date.now()}-${number}`,
        numero: number,
        timestamp: timestamp || new Date().toISOString(),
        isRealtime: true
      };
      
      // Verificar se o número já existe para evitar duplicação
      const alreadyExists = prevData.mappedNumbers?.some(
        n => n.numero === number && 
            (new Date().getTime() - new Date(n.timestamp).getTime() < 10000)
      );
      
      if (alreadyExists) {
        console.log(`[useRouletteData] Número ${number} já existe, ignorando`);
        return prevData;
      }
      
      // Adicionar ao início dos números mapeados
      const updatedMappedNumbers = [
        newMappedNumber,
        ...(prevData.mappedNumbers || [])
      ];
      
      // Adicionar ao início dos números simples se ainda não existir
      const updatedNumbers = prevData.numbers?.includes(number)
        ? prevData.numbers
        : [number, ...(prevData.numbers || [])];
      
      return {
        ...prevData,
        numbers: updatedNumbers,
        mappedNumbers: updatedMappedNumbers
      };
    });
    
    setLastUpdateTime(new Date().toISOString());
  }, []);

  return {
    data,
    isLoading,
    error,
    refreshData,
    lastUpdateTime,
    addRealtimeNumber
  };
}