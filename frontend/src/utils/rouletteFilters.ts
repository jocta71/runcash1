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
 * Combina múltiplos filtros para roletas
 * @param roulettes Lista de roletas
 * @param searchTerm Termo de pesquisa
 * @param providerFilter Lista de provedores para filtrar
 * @returns Lista de roletas filtradas
 */
export function applyAllFilters(
  roulettes: RouletteData[],
  searchTerm: string,
  providerFilter: (roleta: RouletteData) => boolean
): RouletteData[] {
  // Se não há filtros ativos, retorna todas as roletas
  if ((!searchTerm || !searchTerm.trim()) && !providerFilter) {
    return roulettes;
  }
  
  // Filtra pela pesquisa primeiro
  let filtered = roulettes;
  
  if (searchTerm && searchTerm.trim()) {
    filtered = filterRoulettesBySearchTerm(filtered, searchTerm);
  }
  
  // Se há um filtro de provedor, aplica-o
  if (providerFilter) {
    filtered = filtered.filter(providerFilter);
  }
  
  return filtered;
} 