import { getEnvVar } from '@/config/env';

/**
 * Lista de IDs de roletas permitidas para exibição no frontend
 * Estes IDs devem corresponder aos configurados no scraper
 */
export const ROLETAS_PERMITIDAS = getRouletasFromEnv() || [
  "2010016",  // Immersive Roulette
  "2380335",  // Brazilian Mega Roulette
  "2010065",  // Bucharest Auto-Roulette
  "2010096",  // Speed Auto Roulette
  "2010017",  // Auto-Roulette
  "2010098"   // Auto-Roulette VIP
];

/**
 * Lê as roletas permitidas das variáveis de ambiente
 * Formato da variável: VITE_ALLOWED_ROULETTES="2010016,2380335,2010065,2010096,2010017,2010098"
 */
function getRouletasFromEnv(): string[] | null {
  try {
    // Tentar ler da variável de ambiente
    const envRoulettes = getEnvVar('VITE_ALLOWED_ROULETTES', '');
    
    if (envRoulettes) {
      console.log('[Config] Lendo roletas permitidas das variáveis de ambiente');
      const roulettes = envRoulettes.split(',').map(id => id.trim());
      console.log(`[Config] Roletas permitidas por env (${roulettes.length}):`, roulettes);
      return roulettes.length > 0 ? roulettes : null;
    }
    
    return null;
  } catch (error) {
    console.warn('[Config] Erro ao ler roletas de variáveis de ambiente:', error);
    return null;
  }
}

/**
 * Verifica se uma roleta está na lista de roletas permitidas
 * @param rouletteId ID da roleta a ser verificada
 * @returns boolean indicando se a roleta está permitida
 */
export const isRouletteAllowed = (rouletteId: string): boolean => {
  return ROLETAS_PERMITIDAS.includes(rouletteId);
};

/**
 * Filtra um array de roletas para incluir apenas as permitidas
 * @param roulettes Array de roletas
 * @returns Array filtrado contendo apenas roletas permitidas
 */
export const filterAllowedRoulettes = <T extends { id: string }>(roulettes: T[]): T[] => {
  return roulettes.filter(roulette => isRouletteAllowed(roulette.id));
}; 