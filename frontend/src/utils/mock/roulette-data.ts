/**
 * Dados simulados de roletas para uso como fallback
 * quando a API não estiver disponível
 */

// Tipos
interface RouletteNumber {
  numero: number;
  cor: string;
  timestamp: string;
}

export interface MockRoulette {
  roleta_id: string;
  casa_de_aposta: string;
  tipo_de_roleta: string;
  status: string;
  numeros: RouletteNumber[];
  ultima_atualizacao: string;
  estrategias: any[];
  connected: boolean;
  is_simulated: boolean;
}

/**
 * Retorna a cor para um número da roleta
 */
function getColorForNumber(number: number): string {
  if (number === 0) return "verde";
  
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return redNumbers.includes(number) ? "vermelho" : "preto";
}

/**
 * Gera dados simulados de roletas
 */
export function generateMockRouletteData(): MockRoulette[] {
  console.log('[MOCK] Gerando dados simulados de roleta para fallback');
  
  // Lista de casas de apostas conhecidas
  const casas = [
    "Evolution Gaming",
    "Pragmatic Play",
    "Playtech",
    "Ezugi", 
    "Authentic Gaming"
  ];
  
  // Tipos de roleta conhecidos
  const tipos = [
    "Roleta Brasileira",
    "Roleta Europeia",
    "Roleta Americana",
    "Roleta Lightning",
    "Roleta Automática"
  ];
  
  // Gerar 8-12 roletas simuladas
  const quantidade = Math.floor(Math.random() * 5) + 8;
  const roletasSimuladas: MockRoulette[] = [];
  
  for (let i = 0; i < quantidade; i++) {
    const id = `sim-${Date.now()}-${i}`;
    const casa = casas[Math.floor(Math.random() * casas.length)];
    const tipo = tipos[Math.floor(Math.random() * tipos.length)];
    
    // Gerar 10-20 números aleatórios para o histórico
    const numeros: RouletteNumber[] = [];
    for (let j = 0; j < Math.floor(Math.random() * 10) + 10; j++) {
      const numero = Math.floor(Math.random() * 37); // 0-36
      numeros.push({
        numero: numero,
        cor: getColorForNumber(numero),
        timestamp: new Date(Date.now() - (j * 30000)).toISOString() // A cada 30 segundos
      });
    }
    
    const roleta: MockRoulette = {
      roleta_id: id,
      casa_de_aposta: casa,
      tipo_de_roleta: tipo,
      status: "online",
      numeros: numeros,
      ultima_atualizacao: new Date().toISOString(),
      estrategias: [],
      connected: true,
      is_simulated: true // Marcar como dados simulados
    };
    
    roletasSimuladas.push(roleta);
  }
  
  console.log(`[MOCK] ${roletasSimuladas.length} roletas simuladas foram geradas`);
  return roletasSimuladas;
}

// Exportar dados simulados estáticos para uso imediato
export const mockRouletteData = generateMockRouletteData(); 