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