import { useState, useEffect } from 'react';
import useAIRouletteData from './useAIRouletteData';

// Interface para tendências da roleta
export interface RouletteTrends {
  recentTrend: string;
  significantPatterns: string[];
  recommendedNumbers: number[];
  colorStreaks: { color: string; length: number }[];
  hotNumbers: number[];
  coldNumbers: number[];
  predictedNumbers: number[];
  confidenceScore: number;
}

/**
 * Hook para identificar tendências nos dados da roleta
 */
export default function useRouletteTrends() {
  const { rawData, isLoading } = useAIRouletteData();
  const [trends, setTrends] = useState<RouletteTrends | null>(null);

  useEffect(() => {
    if (!rawData || isLoading) return;

    // Identificar cores (vermelho/preto)
    const red = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const getColor = (num: number) => {
      if (num === 0) return 'zero';
      return red.includes(num) ? 'vermelho' : 'preto';
    };

    // Analisar últimos 50 números (ou todos se menos que 50)
    const recentNumbers = rawData.slice(-Math.min(50, rawData.length));
    
    // Identificar cor mais frequente recentemente
    const colorCounts = { vermelho: 0, preto: 0, zero: 0 };
    recentNumbers.forEach(num => {
      const color = getColor(num);
      colorCounts[color as keyof typeof colorCounts]++;
    });
    
    // Cor dominante
    let dominantColor = 'equilibrado';
    if (colorCounts.vermelho > colorCounts.preto * 1.2) {
      dominantColor = 'números vermelhos';
    } else if (colorCounts.preto > colorCounts.vermelho * 1.2) {
      dominantColor = 'números pretos';
    }
    
    // Identificar streaks (sequências da mesma cor)
    const colorStreaks: { color: string; length: number }[] = [];
    let currentStreak = { color: getColor(recentNumbers[0]), length: 1 };
    
    for (let i = 1; i < recentNumbers.length; i++) {
      const color = getColor(recentNumbers[i]);
      
      if (color === currentStreak.color) {
        currentStreak.length++;
      } else {
        if (currentStreak.length >= 3) {
          colorStreaks.push({ ...currentStreak });
        }
        currentStreak = { color, length: 1 };
      }
    }
    
    // Adicionar o último streak se for relevante
    if (currentStreak.length >= 3) {
      colorStreaks.push(currentStreak);
    }
    
    // Ordenar por tamanho de sequência (do maior para o menor)
    colorStreaks.sort((a, b) => b.length - a.length);
    
    // Identificar padrões de alternância
    let alternatingPattern = false;
    let parityPattern = false;
    let dozenPattern = false;
    
    // Verificar se há alternância de cores nas últimas jogadas
    let alternatingCount = 0;
    for (let i = 1; i < Math.min(10, recentNumbers.length); i++) {
      if (getColor(recentNumbers[i]) !== getColor(recentNumbers[i-1]) && 
          recentNumbers[i] !== 0 && recentNumbers[i-1] !== 0) {
        alternatingCount++;
      }
    }
    
    if (alternatingCount >= 7) {
      alternatingPattern = true;
    }
    
    // Verificar padrões de paridade
    const parities = recentNumbers.map(n => n === 0 ? 'zero' : n % 2 === 0 ? 'par' : 'ímpar');
    let parityAlternatingCount = 0;
    
    for (let i = 1; i < Math.min(10, parities.length); i++) {
      if (parities[i] !== 'zero' && parities[i-1] !== 'zero' && parities[i] !== parities[i-1]) {
        parityAlternatingCount++;
      }
    }
    
    if (parityAlternatingCount >= 7) {
      parityPattern = true;
    }
    
    // Verificar padrões de dúzias
    const dozens = recentNumbers.map(n => {
      if (n === 0) return 'zero';
      if (n <= 12) return 'primeira';
      if (n <= 24) return 'segunda';
      return 'terceira';
    });
    
    // Contar ocorrências de cada dúzia
    const dozenCounts = { primeira: 0, segunda: 0, terceira: 0, zero: 0 };
    dozens.forEach(d => {
      dozenCounts[d as keyof typeof dozenCounts]++;
    });
    
    // Verificar se uma dúzia está aparecendo com muito mais frequência
    const dozenValues = Object.values(dozenCounts).filter(v => v > 0);
    const maxDozen = Math.max(...dozenValues);
    const avgOtherDozens = (dozenValues.reduce((sum, v) => sum + v, 0) - maxDozen) / (dozenValues.length - 1);
    
    if (maxDozen > avgOtherDozens * 1.5) {
      dozenPattern = true;
    }
    
    // Construir descrição da tendência recente
    let recentTrend = '';
    
    if (alternatingPattern) {
      recentTrend = 'alternância frequente entre cores';
    } else if (colorStreaks.length > 0 && colorStreaks[0].length >= 4) {
      recentTrend = `sequências de ${colorStreaks[0].length}+ números ${colorStreaks[0].color}s consecutivos`;
    } else if (parityPattern) {
      recentTrend = 'alternância entre números pares e ímpares';
    } else if (dozenPattern) {
      // Encontrar a dúzia dominante
      let dominantDozen = '';
      if (dozenCounts.primeira === maxDozen) dominantDozen = 'primeira';
      else if (dozenCounts.segunda === maxDozen) dominantDozen = 'segunda';
      else if (dozenCounts.terceira === maxDozen) dominantDozen = 'terceira';
      
      recentTrend = `predominância de números da ${dominantDozen} dúzia`;
    } else {
      recentTrend = dominantColor;
    }
    
    // Encontrar números "quentes" e "frios"
    // Criar contagem para todos os números
    const numberCounts: { [key: number]: number } = {};
    for (let i = 0; i <= 36; i++) numberCounts[i] = 0;
    
    // Contar ocorrências
    recentNumbers.forEach(num => {
      numberCounts[num]++;
    });
    
    // Converter para array e ordenar
    const numbersArray = Object.entries(numberCounts).map(([num, count]) => ({
      number: parseInt(num),
      count
    }));
    
    // Obter os 5 números mais frequentes (hot)
    const hotNumbers = numbersArray
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(item => item.number);
    
    // Obter os 5 números menos frequentes (cold) excluindo aqueles com contagem zero
    const coldNumbers = numbersArray
      .filter(item => item.count > 0)  // Excluir números que nunca apareceram
      .sort((a, b) => a.count - b.count)
      .slice(0, 5)
      .map(item => item.number);
    
    // Gerar "previsão" de números (apenas para fins de demonstração)
    // Na prática, algoritmos mais sofisticados seriam usados
    const predictedNumbers = [
      hotNumbers[Math.floor(Math.random() * hotNumbers.length)],
      Math.floor(Math.random() * 37),
      coldNumbers[Math.floor(Math.random() * coldNumbers.length)]
    ];
    
    // Padrões significativos identificados
    const significantPatterns = [];
    
    if (colorStreaks.length > 0) {
      significantPatterns.push(`${colorStreaks[0].length} ${colorStreaks[0].color}s consecutivos`);
    }
    
    if (alternatingPattern) {
      significantPatterns.push('Alternância de cores');
    }
    
    if (parityPattern) {
      significantPatterns.push('Alternância par/ímpar');
    }
    
    if (dozenPattern) {
      // Encontrar a dúzia dominante
      let dominantDozen = '';
      if (dozenCounts.primeira === maxDozen) dominantDozen = 'primeira';
      else if (dozenCounts.segunda === maxDozen) dominantDozen = 'segunda';
      else if (dozenCounts.terceira === maxDozen) dominantDozen = 'terceira';
      
      significantPatterns.push(`Predominância da ${dominantDozen} dúzia`);
    }
    
    // Se não identificamos padrões claros
    if (significantPatterns.length === 0) {
      significantPatterns.push('Distribuição equilibrada sem padrões claros');
    }
    
    // Definir o resultado da análise
    setTrends({
      recentTrend,
      significantPatterns,
      recommendedNumbers: hotNumbers,
      colorStreaks: colorStreaks.slice(0, 3),  // Retornar apenas as 3 sequências mais significativas
      hotNumbers,
      coldNumbers,
      predictedNumbers,
      confidenceScore: Math.floor(Math.random() * 30) + 50  // Simular um score de confiança entre 50-80%
    });
    
  }, [rawData, isLoading]);

  return {
    trends,
    isLoading
  };
} 