/**
 * Lista de IDs de roletas permitidas para exibição no frontend
 * Estes IDs devem corresponder aos configurados no scraper
 */
export const ROLETAS_PERMITIDAS = [
  "2010016",  // Immersive Roulette
  "2380335",  // Brazilian Mega Roulette
  "2010065",  // Bucharest Auto-Roulette
  "2010096",  // Speed Auto Roulette
  "2010017",  // Auto-Roulette
  "2010098"   // Auto-Roulette VIP
];

/**
 * Verifica se uma roleta está na lista de roletas permitidas
 * Modificado para permitir todas as roletas que tenham um ID válido
 * @param rouletteId ID da roleta a ser verificada
 * @returns boolean indicando se a roleta está permitida
 */
export const isRouletteAllowed = (rouletteId: string): boolean => {
  console.log(`[CONFIG] Verificando permissão para roleta ID: ${rouletteId}`);
  
  // Verificar se o ID é válido
  const isValid = rouletteId !== undefined && rouletteId !== null && rouletteId.trim() !== '';
  
  // Verificar se está na lista de permitidas
  const isInList = ROLETAS_PERMITIDAS.includes(rouletteId);
  
  // Usar configuração que permite todas as roletas com ID válido
  // Se quiser restringir apenas para as IDs específicas, comente a linha abaixo
  // e descomente a linha return isInList;
  return isValid;
  
  // Código original que filtra apenas as roletas específicas:
  // return isInList;
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