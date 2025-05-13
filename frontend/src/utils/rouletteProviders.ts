import { RouletteData } from '@/types';

// Definição do tipo RouletteProvider
export interface RouletteProvider {
  id: string;
  name: string;
}

// Mapeamento de identificadores nos nomes para provedores
const providerMapping: Record<string, string> = {
  // Evolution Gaming
  'evolution': 'Evolution',
  'lightning': 'Evolution',
  'immersive': 'Evolution',
  'xxxtreme': 'Evolution',
  'red door': 'Evolution',
  'instant': 'Evolution',
  
  // Pragmatic Play
  'pragmatic': 'Pragmatic Play',
  'mega roulette': 'Pragmatic Play',
  'powerup': 'Pragmatic Play',
  'power up': 'Pragmatic Play',
  'azure': 'Pragmatic Play',
  'ruby': 'Pragmatic Play',
  'lucky 6': 'Pragmatic Play',
  'speed auto': 'Pragmatic Play',
  'macao': 'Pragmatic Play',
  
  // Playtech
  'playtech': 'Playtech',
  'age of the gods': 'Playtech',
  'quantum': 'Playtech',
  'prestige': 'Playtech',
  'premium': 'Playtech',
  
  // Authentic Gaming
  'authentic': 'Authentic Gaming',
  'blaze': 'Authentic Gaming',
  'viva las vegas': 'Authentic Gaming',
  'grand': 'Authentic Gaming',
  
  // Ezugi
  'ezugi': 'Ezugi',
  'salsa': 'Ezugi',
  'portomaso': 'Ezugi',
  'oracle': 'Ezugi',
  
  // NetEnt
  'netent': 'NetEnt',
  'advanced': 'NetEnt',
  'professional': 'NetEnt',
  
  // Microgaming
  'microgaming': 'Microgaming',
  'european gold': 'Microgaming',
  
  // BetGames
  'betgames': 'BetGames',
  
  // Vivo Gaming
  'vivo': 'Vivo Gaming',
  'chroma': 'Vivo Gaming',
  
  // Stakelogic
  'stakelogic': 'Stakelogic',
  'vegas drops': 'Stakelogic',
  
  // Para nomes de "card"
  'card': 'Casino Cards'
};

// Mapeamento explícito de roletas para cada provedor
export const providerRoulettesMap: Record<string, string[]> = {
  'Evolution': [
    
    'Lightning Roulette',
    'Immersive Roulette',
    'Speed Auto Roulette',
    'Auto-Roulette',
    'Auto Roulette VIP',
    'Speed Roulette'
    
  ],
  'Pragmatic Play': [
    'Mega Roulette',
    'Auto-Roulette',
    'Speed Roulette',
    'Pragmatic Roulette',
    'PowerUp Roulette',
    'Roulette Azure',
    'Roulette Ruby'
  ],
  'Playtech': [
    'Prestige Roulette',
    'Premium Roulette',
    'Playtech Roulette',
    'Age of the Gods Roulette',
    'Quantum Roulette'
  ],
  'Authentic Gaming': [
    'Authentic Roulette',
    'Casino Roulette',
    'Grand Roulette',
    'Blaze Roulette',
    'Viva Las Vegas'
  ],
  'Ezugi': [
    'Ezugi Roulette',
    'Casino Floor Roulette',
    'Salsa Roulette',
    'Portomaso Roulette',
    'Oracle Roulette'
  ],
  'NetEnt': [
    'NetEnt Roulette',
    'Advanced Roulette',
    'Professional Roulette'
  ],
  'Microgaming': [
    'Microgaming Roulette',
    'European Roulette Gold'
  ],
  'BetGames': [
    'BetGames Roulette',
    'Classic Roulette'
  ],
  'Vivo Gaming': [
    'Vivo Roulette',
    'European Roulette',
    'Chroma Roulette'
  ],
  'Stakelogic': [
    'Vegas Drops Roulette',
    'Stakelogic Roulette'
  ],
  'Casino Cards': [
    'Card Roulette',
    'Cards Roulette',
    'Card Game',
    'Card Table'
  ],
  'Outro': []
};

/**
 * Identifica o provedor com base no nome da roleta
 * @param rouletteName Nome da roleta
 * @returns Nome do provedor ou "Outro" se não identificado
 */
export function identifyProvider(rouletteName: string): string {
  if (!rouletteName) return 'Outro';
  
  const lowerName = rouletteName.toLowerCase();
  
  // Primeiro verifica no mapeamento explícito
  for (const [provider, roulettes] of Object.entries(providerRoulettesMap)) {
    if (provider === 'Outro') continue; // Ignora a categoria "Outro"
    
    // Verifica se o nome da roleta está na lista deste provedor
    // Usando pesquisa por substring para aumentar a chance de correspondência
    const isMatch = roulettes.some(roulette => 
      lowerName.includes(roulette.toLowerCase()) || 
      roulette.toLowerCase().includes(lowerName)
    );
    
    if (isMatch) return provider;
  }
  
  // Verificar se o nome contém algum dos identificadores conhecidos
  for (const [identifier, provider] of Object.entries(providerMapping)) {
    if (lowerName.includes(identifier.toLowerCase())) {
      return provider;
    }
  }
  
  // Se não encontrou, retorna "Outro"
  return 'Outro';
}

/**
 * Extrai todos os provedores distintos de uma lista de roletas
 * @param roulettes Lista de roletas
 * @returns Lista de provedores distintos
 */
export function extractProviders(roulettes: RouletteData[]): RouletteProvider[] {
  if (!roulettes || !Array.isArray(roulettes) || roulettes.length === 0) {
    return [];
  }
  
  // Conjunto para armazenar provedores únicos
  const uniqueProviders = new Set<string>();
  
  // Para cada roleta, identificar o provedor e adicionar ao conjunto
  roulettes.forEach(roulette => {
    const name = roulette.name || roulette.nome || '';
    const provider = identifyProvider(name);
    
    uniqueProviders.add(provider);
  });
  
  // Converter o conjunto em um array de objetos RouletteProvider
  const providers: RouletteProvider[] = Array.from(uniqueProviders)
    .sort() // Ordenar alfabeticamente
    .map(name => ({
      id: name,
      name
    }));
  
  return providers;
}

/**
 * Filtra roletas por provedor
 * @param roulettes Lista de roletas
 * @param providerIds IDs dos provedores para filtrar
 * @returns Lista de roletas filtradas
 */
export function filterRoulettesByProvider(roulettes: RouletteData[], providerIds: string[]): RouletteData[] {
  // Se não há filtros, retorna todas as roletas
  if (!providerIds || providerIds.length === 0) {
    return roulettes;
  }
  
  // Filtra as roletas pelos provedores selecionados
  return roulettes.filter(roulette => {
    const name = roulette.name || roulette.nome || '';
    const provider = identifyProvider(name);
    
    return providerIds.includes(provider);
  });
} 