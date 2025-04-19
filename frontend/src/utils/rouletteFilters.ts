import { RouletteData } from '@/types';

/**
 * Filtra roletas por termo de pesquisa
 * @param roulettes Lista de roletas
 * @param searchTerm Termo de pesquisa
 * @returns Lista de roletas filtradas
 */
export function filterRoulettesBySearchTerm(
  roulettes: RouletteData[],
  searchTerm: string
): RouletteData[] {
  if (!searchTerm || !searchTerm.trim()) {
    return roulettes;
  }
  
  const normalizedSearchTerm = searchTerm.toLowerCase().trim();
  
  return roulettes.filter(roulette => {
    const name = (roulette.name || roulette.nome || '').toLowerCase();
    return name.includes(normalizedSearchTerm);
  });
}

/**
 * Filtra roletas por número específico nos últimos números
 * @param roulettes Lista de roletas
 * @param number Número para filtrar
 * @returns Lista de roletas filtradas
 */
export function filterRoulettesByNumber(
  roulettes: RouletteData[],
  number: number | null
): RouletteData[] {
  if (number === null) {
    return roulettes;
  }
  
  return roulettes.filter(roulette => {
    const lastNumbers = roulette.lastNumbers || roulette.numeros || [];
    return lastNumbers.includes(number);
  });
}

/**
 * Filtra roletas por cor nos últimos números
 * @param roulettes Lista de roletas
 * @param color Cor para filtrar ('red', 'black', 'green')
 * @returns Lista de roletas filtradas
 */
export function filterRoulettesByColor(
  roulettes: RouletteData[],
  color: 'red' | 'black' | 'green' | null
): RouletteData[] {
  if (!color) {
    return roulettes;
  }
  
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
  const greenNumbers = [0];
  
  let targetNumbers: number[] = [];
  
  if (color === 'red') targetNumbers = redNumbers;
  if (color === 'black') targetNumbers = blackNumbers;
  if (color === 'green') targetNumbers = greenNumbers;
  
  return roulettes.filter(roulette => {
    const lastNumber = roulette.lastNumbers?.[0] ?? roulette.numeros?.[0];
    return lastNumber !== undefined && targetNumbers.includes(lastNumber);
  });
}

/**
 * Filtra roletas por paridade do último número
 * @param roulettes Lista de roletas
 * @param parity Paridade para filtrar ('even', 'odd')
 * @returns Lista de roletas filtradas
 */
export function filterRoulettesByParity(
  roulettes: RouletteData[],
  parity: 'even' | 'odd' | null
): RouletteData[] {
  if (!parity) {
    return roulettes;
  }
  
  return roulettes.filter(roulette => {
    const lastNumber = roulette.lastNumbers?.[0] ?? roulette.numeros?.[0];
    if (lastNumber === undefined || lastNumber === 0) return false;
    
    if (parity === 'even') return lastNumber % 2 === 0;
    if (parity === 'odd') return lastNumber % 2 !== 0;
    
    return false;
  });
}

/**
 * Filtra roletas por intervalo de tempo do último número
 * @param roulettes Lista de roletas
 * @param minutes Minutos para filtrar (máximo de tempo desde o último número)
 * @returns Lista de roletas filtradas
 */
export function filterRoulettesByTime(
  roulettes: RouletteData[],
  minutes: number | null
): RouletteData[] {
  if (minutes === null) {
    return roulettes;
  }
  
  const now = new Date();
  const maxTimeDiff = minutes * 60 * 1000; // Converte minutos para milissegundos
  
  return roulettes.filter(roulette => {
    if (!roulette.historico?.timestamps?.[0]) return false;
    
    const lastTimestamp = new Date(roulette.historico.timestamps[0]);
    const diffMs = now.getTime() - lastTimestamp.getTime();
    
    return diffMs <= maxTimeDiff;
  });
}

/**
 * Combina múltiplos filtros para roletas
 * @param roulettes Lista de roletas
 * @param searchTerm Termo de pesquisa
 * @param providerFilter Lista de provedores para filtrar
 * @param numberFilter Número específico para filtrar
 * @param colorFilter Cor para filtrar
 * @param parityFilter Paridade para filtrar
 * @param timeFilter Tempo máximo em minutos desde o último número
 * @returns Lista de roletas filtradas
 */
export function applyAllFilters(
  roulettes: RouletteData[],
  searchTerm: string,
  providerFilter: ((roleta: RouletteData) => boolean) | null = null,
  numberFilter: number | null = null,
  colorFilter: 'red' | 'black' | 'green' | null = null,
  parityFilter: 'even' | 'odd' | null = null,
  timeFilter: number | null = null
): RouletteData[] {
  // Se não há filtros ativos, retorna todas as roletas
  if (
    (!searchTerm || !searchTerm.trim()) &&
    !providerFilter &&
    numberFilter === null &&
    colorFilter === null &&
    parityFilter === null &&
    timeFilter === null
  ) {
    return roulettes;
  }
  
  // Aplica todos os filtros em sequência
  let filtered = roulettes;
  
  if (searchTerm && searchTerm.trim()) {
    filtered = filterRoulettesBySearchTerm(filtered, searchTerm);
  }
  
  if (providerFilter) {
    filtered = filtered.filter(providerFilter);
  }
  
  if (numberFilter !== null) {
    filtered = filterRoulettesByNumber(filtered, numberFilter);
  }
  
  if (colorFilter) {
    filtered = filterRoulettesByColor(filtered, colorFilter);
  }
  
  if (parityFilter) {
    filtered = filterRoulettesByParity(filtered, parityFilter);
  }
  
  if (timeFilter !== null) {
    filtered = filterRoulettesByTime(filtered, timeFilter);
  }
  
  return filtered;
} 