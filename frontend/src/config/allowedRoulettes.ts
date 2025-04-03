import axios from 'axios';
import config from '@/config/env';

/**
 * Lista de IDs de roletas permitidas para exibição no frontend
 * Estes IDs serão carregados da API e são configurados no Railway
 */
export let ROLETAS_PERMITIDAS: string[] = [
  "2010016",  // Immersive Roulette
  "2380335",  // Brazilian Mega Roulette
  "2010065",  // Bucharest Auto-Roulette
  "2010096",  // Speed Auto Roulette
  "2010017",  // Auto-Roulette
  "2010098"   // Auto-Roulette VIP
];

// Flag para indicar se os dados já foram carregados
let roletasCarregadas = false;

/**
 * Carrega a lista de roletas permitidas do backend
 * @returns Promise que resolve quando a lista for carregada
 */
export const carregarRoletasPermitidas = async (): Promise<string[]> => {
  try {
    const baseUrl = config.apiBaseUrl;
    const response = await axios.get(`${baseUrl}/allowed-roulettes`);
    
    if (response.data && response.data.success && Array.isArray(response.data.allowed_ids)) {
      console.log('[Config] Lista de roletas permitidas carregada da API:', response.data.allowed_ids);
      ROLETAS_PERMITIDAS = response.data.allowed_ids;
      roletasCarregadas = true;
      return ROLETAS_PERMITIDAS;
    } else {
      console.warn('[Config] Falha ao carregar roletas permitidas. Usando lista padrão.');
    }
  } catch (error) {
    console.error('[Config] Erro ao carregar roletas permitidas da API:', error);
    console.warn('[Config] Usando lista padrão de roletas permitidas.');
  }
  
  return ROLETAS_PERMITIDAS;
};

/**
 * Verifica se uma roleta está na lista de roletas permitidas
 * @param rouletteId ID da roleta a ser verificada
 * @returns boolean indicando se a roleta está permitida
 */
export const isRouletteAllowed = (rouletteId: string): boolean => {
  // Se os dados ainda não foram carregados, tentar carregar
  if (!roletasCarregadas) {
    carregarRoletasPermitidas().catch(console.error);
  }
  
  // Verificar se o ID está na lista de roletas permitidas
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