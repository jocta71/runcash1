/**
 * Lista de IDs de roletas permitidas para exibição no frontend
 * Estes IDs devem corresponder aos configurados no scraper
 */
import { getEnvVar } from './env';

// Obter lista de roletas permitidas das variáveis de ambiente
const getAllowedRoulettesFromEnv = (): string[] => {
  const envRoulettes = getEnvVar('VITE_ALLOWED_ROULETTES', '');
  if (envRoulettes) {
    console.log(`[CONFIG] Roletas permitidas da variável de ambiente: ${envRoulettes}`);
    return envRoulettes.split(',').map(id => id.trim()).filter(id => id !== '');
  }
  return [];
};

// Lista padrão de roletas permitidas (usada se não estiver definida nas variáveis de ambiente)
const DEFAULT_ROULETTES = [
  "2010016",  // Immersive Roulette
  "2380335",  // Brazilian Mega Roulette
  "2010065",  // Bucharest Auto-Roulette
  "2010096",  // Speed Auto Roulette
  "2010017",  // Auto-Roulette
  "2010098"   // Auto-Roulette VIP
];

// Usar as roletas da variável de ambiente ou as padrão
export const ROLETAS_PERMITIDAS = (() => {
  const envRoulettes = getAllowedRoulettesFromEnv();
  if (envRoulettes.length > 0) {
    console.log(`[CONFIG] Usando ${envRoulettes.length} roletas da variável de ambiente`);
    return envRoulettes;
  }
  console.log(`[CONFIG] Usando lista padrão de roletas permitidas (${DEFAULT_ROULETTES.length})`);
  return DEFAULT_ROULETTES;
})();

/**
 * Verifica se uma roleta está na lista de roletas permitidas
 * @param rouletteId ID da roleta a ser verificada
 * @returns boolean indicando se a roleta está permitida
 */
export const isRouletteAllowed = (rouletteId: string): boolean => {
  console.log(`[CONFIG] Verificando permissão para roleta ID: ${rouletteId}`);
  
  // Verificar se o ID é válido
  const isValid = rouletteId !== undefined && rouletteId !== null && rouletteId.trim() !== '';
  
  // Verificar se está na lista de permitidas
  const isInList = ROLETAS_PERMITIDAS.includes(rouletteId);
  
  console.log(`[CONFIG] Roleta ${rouletteId} ${isInList ? 'está' : 'não está'} na lista de permitidas`);
  
  // Usar a lista de roletas permitidas para filtrar
  return isValid && isInList;
};

/**
 * Filtra um array de roletas para incluir apenas as permitidas
 * @param roulettes Array de roletas
 * @returns Array filtrado contendo apenas roletas permitidas
 */
export const filterAllowedRoulettes = <T extends { id: string }>(roulettes: T[]): T[] => {
  console.log(`[CONFIG] Filtrando ${roulettes.length} roletas`);
  
  const filteredRoulettes = roulettes.filter(roulette => {
    const allowed = isRouletteAllowed(roulette.id);
    if (!allowed) {
      console.log(`[CONFIG] Roleta ${roulette.id} foi rejeitada`);
    }
    return allowed;
  });
  
  console.log(`[CONFIG] Resultado da filtragem: ${filteredRoulettes.length} roletas permitidas`);
  return filteredRoulettes;
}; 