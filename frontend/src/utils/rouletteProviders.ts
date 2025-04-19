import { RouletteData } from '@/types';

// Definição do tipo RouletteProvider
export interface RouletteProvider {
  id: string;
  name: string;
}

// Mapeamento de identificadores nos nomes para provedores
const providerMapping: Record<string, string> = {
  // Evolution Gaming
  'lightning': 'Evolution',
  'xxxtreme': 'Evolution',
  'immersive': 'Evolution',
  'speed': 'Evolution',
  'auto-roulette': 'Evolution',
  'auto roulette': 'Evolution',
  
  // Pragmatic Play
  'auto-': 'Pragmatic Play',
  'auto ': 'Pragmatic Play',
  'pragmatic': 'Pragmatic Play',
  'mega': 'Pragmatic Play',
  
  // Playtech
  'playtech': 'Playtech',
  'prestige': 'Playtech',
  'premium': 'Playtech',
  
  // Authentic Gaming
  'authentic': 'Authentic Gaming',
  'casino': 'Authentic Gaming',
  
  // Ezugi
  'ezugi': 'Ezugi',
  'casino floor': 'Ezugi',
  
  // Outros comuns
  'netent': 'NetEnt',
  'microgaming': 'Microgaming',
  'betgames': 'BetGames',
  'vivo': 'Vivo Gaming',
};

// Mapeamento explícito de roletas para cada provedor
export const providerRoulettesMap: Record<string, string[]> = {
  'Evolution': [
    'American Roulette',
    'Lightning Roulette',
    'Immersive Roulette',
    'Speed Auto Roulette',
    'Auto-Roulette',
    'Auto Roulette VIP',
    'Speed Roulette',
    'Bucharest Auto-Roulette',
    'Brazilian Mega Roulette',
    'Dansk Roulette',
    'Deutsches Roulette',
    'Dragonara Roulette',
    'Football Studio Roulette',
    'Gold Vault Roulette',
    'Hippodrome Grand Casino',
    'Jawhara Roulette',
    'Romanian Roulette',
    'XXXtreme Lightning Roulette',
    'VIP Roulette',
    'Live Roulette'
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
  
  // Casos específicos baseados no nome completo
  if (lowerName.includes('american')) return 'Evolution';
  if (lowerName.includes('brazilian')) return 'Evolution';
  if (lowerName.includes('bucharest')) return 'Evolution';
  if (lowerName.includes('dansk')) return 'Evolution';
  if (lowerName.includes('deutsches')) return 'Evolution';
  if (lowerName.includes('dragonara')) return 'Evolution';
  if (lowerName.includes('football studio')) return 'Evolution';
  if (lowerName.includes('gold vault')) return 'Evolution';
  if (lowerName.includes('hippodrome')) return 'Evolution';
  if (lowerName.includes('jawhara')) return 'Evolution';
  if (lowerName.includes('romanian')) return 'Evolution';
  
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