import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

// Interface para definir a estrutura dos dados da roleta
export interface RouletteDataSummary {
  redCount: number;
  blackCount: number;
  zeroCount: number;
  redPercentage: number;
  blackPercentage: number;
  zeroPercentage: number;
  evenCount: number;
  oddCount: number;
  evenPercentage: number;
  oddPercentage: number;
  dozenCounts: [number, number, number];
  dozenPercentages: [number, number, number];
  mostFrequentNumbers: Array<{number: number, count: number}>;
  leastFrequentNumbers: Array<{number: number, count: number}>;
  lastResults: number[];
}

// Hook para obter e processar dados da roleta para análise de IA
export default function useAIRouletteData() {
  // Função para buscar dados da roleta da API
  const fetchRouletteData = async (): Promise<number[]> => {
    try {
      // Em produção, isso seria uma chamada real para a API
      // const { data } = await axios.get('/api/roulette/history');
      // return data;
      
      // Para fins de demonstração, usando dados simulados
      return [
        8, 23, 15, 0, 12, 32, 19, 4, 27, 8, 
        17, 34, 6, 29, 11, 23, 8, 14, 31, 5, 
        17, 22, 0, 9, 18, 26, 33, 10, 24, 8,
        19, 25, 13, 29, 7, 32, 16, 23, 4, 21,
        3, 36, 14, 27, 5, 19, 8, 0, 11, 24,
        15, 34, 6, 27, 17, 32, 9, 23, 12, 5,
        26, 21, 4, 15, 0, 31, 22, 8, 19, 12,
        25, 16, 28, 1, 13, 33, 24, 7, 11, 34,
        18, 29, 6, 20, 3, 35, 10, 23, 19, 36,
        8, 17, 31, 14, 27, 5, 18, 2, 9, 22
      ];
    } catch (error) {
      console.error('Erro ao buscar dados da roleta:', error);
      throw new Error('Falha ao carregar dados da roleta');
    }
  };
  
  // Usar React Query para buscar e gerenciar o estado dos dados
  const { data: rouletteNumbers, isLoading, error } = useQuery({
    queryKey: ['aiRouletteData'],
    queryFn: fetchRouletteData,
    staleTime: 60 * 1000, // 1 minuto
    refetchInterval: 30 * 1000, // Atualizar a cada 30 segundos
  });
  
  // Estado processado dos dados da roleta
  const [rouletteData, setRouletteData] = useState<RouletteDataSummary | null>(null);
  
  // Processar os dados brutos da roleta quando disponíveis
  useEffect(() => {
    if (!rouletteNumbers || !rouletteNumbers.length) return;
    
    // Cores
    const red = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const black = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
    
    // Contadores
    let redCount = 0;
    let blackCount = 0;
    let zeroCount = 0;
    let evenCount = 0;
    let oddCount = 0;
    const dozenCounts: [number, number, number] = [0, 0, 0];
    const numberCounts: { [key: number]: number } = {};
    
    // Inicializar contador para todos os números
    for (let i = 0; i <= 36; i++) {
      numberCounts[i] = 0;
    }
    
    // Analisar os números
    rouletteNumbers.forEach(number => {
      // Contagem de cada número
      numberCounts[number] = (numberCounts[number] || 0) + 1;
      
      // Cores
      if (number === 0) {
        zeroCount++;
      } else if (red.includes(number)) {
        redCount++;
      } else if (black.includes(number)) {
        blackCount++;
      }
      
      // Paridade
      if (number !== 0) {
        if (number % 2 === 0) {
          evenCount++;
        } else {
          oddCount++;
        }
      }
      
      // Dúzias
      if (number >= 1 && number <= 12) {
        dozenCounts[0]++;
      } else if (number >= 13 && number <= 24) {
        dozenCounts[1]++;
      } else if (number >= 25 && number <= 36) {
        dozenCounts[2]++;
      }
    });
    
    // Calcular percentagens
    const total = rouletteNumbers.length;
    const totalWithoutZero = total - zeroCount;
    
    const redPercentage = Math.round((redCount / total) * 100);
    const blackPercentage = Math.round((blackCount / total) * 100);
    const zeroPercentage = Math.round((zeroCount / total) * 100);
    
    const evenPercentage = Math.round((evenCount / totalWithoutZero) * 100);
    const oddPercentage = Math.round((oddCount / totalWithoutZero) * 100);
    
    const dozenPercentages: [number, number, number] = [
      Math.round((dozenCounts[0] / totalWithoutZero) * 100),
      Math.round((dozenCounts[1] / totalWithoutZero) * 100),
      Math.round((dozenCounts[2] / totalWithoutZero) * 100)
    ];
    
    // Encontrar números mais e menos frequentes
    const numbersArray = Object.entries(numberCounts).map(([number, count]) => ({
      number: parseInt(number),
      count
    }));
    
    // Ordenar por frequência
    numbersArray.sort((a, b) => b.count - a.count);
    
    const mostFrequentNumbers = numbersArray.slice(0, 5);
    const leastFrequentNumbers = [...numbersArray].sort((a, b) => a.count - b.count).slice(0, 5);
    
    // Últimos resultados (mais recentes primeiro)
    const lastResults = [...rouletteNumbers].slice(-10).reverse();
    
    // Definir os dados processados
    setRouletteData({
      redCount,
      blackCount,
      zeroCount,
      redPercentage,
      blackPercentage,
      zeroPercentage,
      evenCount,
      oddCount,
      evenPercentage,
      oddPercentage,
      dozenCounts,
      dozenPercentages,
      mostFrequentNumbers,
      leastFrequentNumbers,
      lastResults
    });
    
  }, [rouletteNumbers]);
  
  return {
    rouletteData,
    rawData: rouletteNumbers,
    isLoading,
    error
  };
} 