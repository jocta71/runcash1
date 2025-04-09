/**
 * Dados simulados para uso quando a API estiver indisponível
 */

// Utilitário para gerar números aleatórios para roleta
const generateRandomRouletteNumber = () => Math.floor(Math.random() * 37); // 0-36

// Utilitário para gerar uma série de números para roleta
const generateRandomNumberSeries = (count: number) => {
  const numbers = [];
  for (let i = 0; i < count; i++) {
    numbers.push(generateRandomRouletteNumber());
  }
  return numbers;
};

// Função para obter a cor de um número de roleta
const getRouletteNumberColor = (number: number): string => {
  if (number === 0) return 'green';
  
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return redNumbers.includes(number) ? 'red' : 'black';
};

// Gerador de ID único
const generateId = () => `roleta_${Math.random().toString(36).substring(2, 10)}`;

// Lista de nomes para roletas simuladas
const rouletteNames = [
  'Roleta Brasileira',
  'Roleta Europeia',
  'Roleta Americana',
  'Speed Roulette',
  'Lightning Roulette',
  'Roleta VIP',
  'Casino Royal',
  'Grand Roulette',
  'Roleta Express',
  'Mega Roleta'
];

// Lista de provedores simulados
const providers = [
  'Evolution Gaming',
  'Pragmatic Play',
  'Ezugi',
  'Authentic Gaming',
  'NetEnt',
  'Playtech',
  'Microgaming'
];

// Gerar dados simulados para uma roleta
const generateRouletteData = (index: number) => {
  const numbers = generateRandomNumberSeries(20);
  const name = rouletteNames[index % rouletteNames.length];
  const provider = providers[index % providers.length];
  
  return {
    id: generateId(),
    roleta_id: generateId(),
    nome: name,
    name: name,
    provider: provider,
    status: Math.random() > 0.2 ? 'active' : 'inactive',
    timestamp: new Date().toISOString(),
    numeros: numbers,
    lastNumbers: numbers.slice(0, 5),
    cores: numbers.map(getRouletteNumberColor),
    cor_background: '#1c1c1c',
    logo: `https://via.placeholder.com/100x50?text=${encodeURIComponent(name)}`,
    vitorias: Math.floor(Math.random() * 100),
    derrotas: Math.floor(Math.random() * 50),
    estado_estrategia: ['aguardando', 'vitoria', 'derrota'][Math.floor(Math.random() * 3)]
  };
};

// Dados simulados para todas as roletas
export const MOCK_ROULETTES = Array.from({ length: 20 }, (_, i) => generateRouletteData(i));

// Função para obter dados simulados
export const getMockRoulettes = (limit?: number) => {
  if (limit) {
    return MOCK_ROULETTES.slice(0, limit);
  }
  return MOCK_ROULETTES;
};

// Função para obter uma roleta específica
export const getMockRouletteById = (id: string) => {
  return MOCK_ROULETTES.find(r => r.id === id || r.roleta_id === id);
};

// Função para adicionar um novo número a uma roleta simulada
export const addNewNumberToRoulette = (roletaId: string) => {
  const roulette = getMockRouletteById(roletaId);
  if (roulette) {
    const newNumber = generateRandomRouletteNumber();
    roulette.numeros.unshift(newNumber);
    roulette.lastNumbers.unshift(newNumber);
    roulette.lastNumbers = roulette.lastNumbers.slice(0, 5);
    return { ...roulette, numero: newNumber };
  }
  return null;
};

// Exportar por padrão
export default {
  getMockRoulettes,
  getMockRouletteById,
  addNewNumberToRoulette
}; 