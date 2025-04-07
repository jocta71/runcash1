/**
 * Lista de IDs de roletas permitidas para exibição no frontend
 * Estes IDs devem corresponder aos configurados no scraper
 */
// Obter roletas permitidas da variável de ambiente, se disponível
const allowedRoulettesEnv = import.meta.env.VITE_ALLOWED_ROULETTES as string | undefined;
console.log('[CONFIG] Variável VITE_ALLOWED_ROULETTES:', allowedRoulettesEnv);

// Converter a string de IDs separados por vírgula em um array
export const ROLETAS_PERMITIDAS = allowedRoulettesEnv
  ? allowedRoulettesEnv.split(',').map(id => id.trim())
  : [
      "2010016",  // Immersive Roulette
      "2380335",  // Brazilian Mega Roulette
      "2010065",  // Bucharest Auto-Roulette
      "2010096",  // Speed Auto Roulette
      "2010017",  // Auto-Roulette
      "2010098"   // Auto-Roulette VIP
    ];

console.log('[CONFIG] Roletas permitidas:', ROLETAS_PERMITIDAS);

/**
 * Verifica se uma roleta está na lista de roletas permitidas
 * Modificado para permitir todas as roletas válidas, independentemente da configuração
 * @param rouletteId ID da roleta a ser verificada
 * @returns boolean indicando se a roleta está permitida
 */
export const isRouletteAllowed = (rouletteId: string): boolean => {
  console.log(`[CONFIG] Verificando permissão para roleta ID: ${rouletteId}`);
  
  // Verificar se o ID é válido
  const isValid = rouletteId !== undefined && rouletteId !== null && rouletteId.trim() !== '';
  
  // MODO PERMISSIVO: Permitir todas as roletas com ID válido
  console.log(`[CONFIG] Modo permissivo FORÇADO: ${isValid ? 'permitida' : 'não permitida'}`);
  return isValid;
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