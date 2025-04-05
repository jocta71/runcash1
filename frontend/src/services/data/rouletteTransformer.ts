/**
 * Lista de roletas permitidas
 * Contém apenas os IDs numéricos oficiais
 */
export const ALLOWED_ROULETTES = [
  "2010016",  // Immersive Roulette
  "2380335",  // Brazilian Mega Roulette
  "2010065",  // Bucharest Auto-Roulette
  "2010096",  // Speed Auto Roulette
  "2010017",  // Ruleta Automática
  "2010098"   // Auto-Roulette VIP
];

/**
 * Mapeamento de UUIDs para IDs numéricos
 */
export const UUID_TO_NUMERIC = {
  "7d3c2c9f-2850-f642-861f-5bb4daf1806a": "2380335", // Brazilian Mega
  "18bdc4ea-d884-c47a-d33f-27a268a4eead": "2010096", // Speed Auto
  "e3345af9-e387-9412-209c-e793fe73e520": "2010065", // Bucharest
  "419aa56c-bcff-67d2-f424-a6501bac4a36": "2010098", // Auto VIP
  "4cf27e48-2b9d-b58e-7dcc-48264c51d639": "2010016", // Immersive
  "f27dd03e-5282-fc78-961c-6375cef91565": "2010017"  // Ruleta Automática
};

/**
 * Nomes amigáveis para roletas
 */
export const ROULETTE_NAMES = {
  "2010016": "Immersive Roulette",
  "2380335": "Brazilian Mega Roulette",
  "2010065": "Bucharest Auto-Roulette",
  "2010096": "Speed Auto Roulette",
  "2010017": "Auto-Roulette",
  "2010098": "Auto-Roulette VIP"
};

/**
 * Mapeia qualquer ID para um ID numérico válido
 * @param id ID em qualquer formato
 * @returns ID numérico válido
 */
export function getNumericId(id: string): string {
  // Se já é um ID numérico válido, retorna ele mesmo
  if (ALLOWED_ROULETTES.includes(id)) {
    return id;
  }
  
  // Se está no mapeamento, retorna o ID correspondente
  if (UUID_TO_NUMERIC[id]) {
    return UUID_TO_NUMERIC[id];
  }
  
  // Verificar se o ID contém um ID numérico como sufixo
  for (const numericId of ALLOWED_ROULETTES) {
    if (id.endsWith(numericId)) {
      return numericId;
    }
  }
  
  // Não foi possível mapear, usar o valor padrão
  console.warn(`[Transformer] ID não reconhecido: ${id}, usando Speed Auto como fallback`);
  return "2010096"; // Speed Auto como fallback
}

/**
 * Determina a cor de um número
 * @param num Número da roleta
 * @returns Cor ('red', 'black', 'green')
 */
export function getNumberColor(num: number): 'red' | 'black' | 'green' {
  if (num === 0) return 'green';
  
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return redNumbers.includes(num) ? 'red' : 'black';
}

/**
 * Transforma um número bruto em formato padronizado
 * @param rawNumber Número em qualquer formato
 * @returns Objeto de número padronizado
 */
export function transformRouletteNumber(rawNumber: any): {
  number: number;
  color: string;
  timestamp: string;
} | null {
  try {
    // Se é um número simples
    if (typeof rawNumber === 'number') {
      return {
        number: rawNumber,
        color: getNumberColor(rawNumber),
        timestamp: new Date().toISOString()
      };
    }
    
    // Se é um objeto
    if (typeof rawNumber === 'object' && rawNumber !== null) {
      // Extrair o número
      const num = typeof rawNumber.numero !== 'undefined' 
        ? rawNumber.numero 
        : typeof rawNumber.number !== 'undefined'
          ? rawNumber.number
          : null;
          
      if (num === null) {
        console.warn('[Transformer] Número inválido:', rawNumber);
        return null;
      }
      
      // Determinar cor
      const color = rawNumber.cor || rawNumber.color || getNumberColor(Number(num));
      
      // Determinar timestamp
      const timestamp = rawNumber.timestamp || new Date().toISOString();
      
      return {
        number: Number(num),
        color,
        timestamp
      };
    }
    
    console.warn('[Transformer] Formato de número não reconhecido:', rawNumber);
    return null;
  } catch (error) {
    console.error('[Transformer] Erro ao transformar número:', error);
    return null;
  }
}

/**
 * Transforma dados brutos de roleta em formato padronizado
 * @param rawData Dados brutos
 * @returns Objeto de roleta padronizado
 */
export function transformRouletteData(rawData: any) {
  try {
    // Obter o ID numérico
    let numericId;
    
    // Prioridade: campo roleta_id > id > _id
    if (rawData.roleta_id) {
      numericId = getNumericId(rawData.roleta_id);
    } else {
      numericId = getNumericId(rawData.id || rawData._id);
    }
    
    // Números
    let numbers = [];
    
    if (rawData.numero && Array.isArray(rawData.numero)) {
      numbers = rawData.numero;
    } else if (rawData.numeros && Array.isArray(rawData.numeros)) {
      numbers = rawData.numeros;
    }
    
    // Processar números
    const processedNumbers = numbers
      .map(transformRouletteNumber)
      .filter(Boolean);
    
    // Nome - usar o mapeamento de ID para nome como primeira prioridade
    const name = ROULETTE_NAMES[numericId] || rawData.nome || rawData.name || `Roleta ${numericId}`;
    
    return {
      id: numericId,
      uuid: rawData._id || rawData.id,
      name,
      nome: name, // Adicionar nome em português também
      roleta_nome: name, // Campo usado por alguns componentes
      numbers: processedNumbers,
      numeros: processedNumbers, // Campo em português para compatibilidade
      active: rawData.ativa !== false,
      strategyState: rawData.estado_estrategia || 'NEUTRAL',
      wins: rawData.vitorias || 0,
      losses: rawData.derrotas || 0
    };
  } catch (error) {
    console.error('[Transformer] Erro ao transformar dados da roleta:', error);
    return {
      id: '2010096', // Speed Auto como fallback
      uuid: '0',
      name: 'Erro',
      nome: 'Erro',
      roleta_nome: 'Erro',
      numbers: [],
      numeros: [],
      active: false,
      strategyState: 'ERROR',
      wins: 0,
      losses: 0
    };
  }
} 