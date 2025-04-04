/**
 * Definições de IDs canônicos para cada roleta.
 * Usamos esses IDs para garantir consistência em diferentes partes do sistema.
 */
export const CANONICAL_IDS = {
  BRAZILIAN_MEGA: "2380335",
  SPEED_AUTO: "2010096",
  AUTO_VIP: "2010098",
  RULETA_AUTOMATICA: "2010017",
  BUCHAREST: "2010065",
  IMMERSIVE: "2010016"
};

/**
 * Mapeamento de UUIDs para IDs canônicos.
 * Isso permite identificar roletas mesmo quando seus IDs são fornecidos
 * em formatos diferentes.
 */
export const UUID_TO_CANONICAL = {
  "7d3c2c9f-2850-f642-861f-5bb4daf1806a": CANONICAL_IDS.BRAZILIAN_MEGA,
  "18bdc4ea-d884-c47a-d33f-27a268a4eead": CANONICAL_IDS.SPEED_AUTO,
  "e3345af9-e387-9412-209c-e793fe73e520": CANONICAL_IDS.BUCHAREST,
  "419aa56c-bcff-67d2-f424-a6501bac4a36": CANONICAL_IDS.AUTO_VIP,
  "4cf27e48-2b9d-b58e-7dcc-48264c51d639": CANONICAL_IDS.IMMERSIVE,
  "f27dd03e-5282-fc78-961c-6375cef91565": CANONICAL_IDS.RULETA_AUTOMATICA
};

/**
 * Nomes amigáveis para roletas com base no ID canônico
 */
export const CANONICAL_NAMES = {
  [CANONICAL_IDS.BRAZILIAN_MEGA]: "Brazilian Mega Roulette",
  [CANONICAL_IDS.SPEED_AUTO]: "Speed Auto Roulette",
  [CANONICAL_IDS.AUTO_VIP]: "Auto-Roulette VIP",
  [CANONICAL_IDS.RULETA_AUTOMATICA]: "Ruleta Automática",
  [CANONICAL_IDS.BUCHAREST]: "Bucharest Auto-Roulette",
  [CANONICAL_IDS.IMMERSIVE]: "Immersive Roulette"
};

/**
 * Converte qualquer ID de roleta para seu ID canônico.
 * Isso garante que possamos identificar consistentemente
 * a mesma roleta, mesmo que ela seja referenciada com 
 * diferentes identificadores.
 * 
 * @param id ID da roleta (qualquer formato)
 * @returns ID canônico da roleta
 */
export function mapToCanonicalId(id: string): string {
  // Se já é um ID canônico, retornar como está
  if (Object.values(CANONICAL_IDS).includes(id)) {
    return id;
  }
  
  // Tentar mapeamento direto
  if (UUID_TO_CANONICAL[id]) {
    return UUID_TO_CANONICAL[id];
  }
  
  // Normalizar e tentar novamente
  const normalizedId = id.replace(/-/g, '').toLowerCase();
  
  for (const [uuid, canonicalId] of Object.entries(UUID_TO_CANONICAL)) {
    if (uuid.replace(/-/g, '').toLowerCase() === normalizedId) {
      return canonicalId;
    }
  }
  
  // Fallback seguro - retornar o ID Speed Auto como padrão
  console.warn(`[Transformer] ID não reconhecido: ${id}, usando fallback`);
  return CANONICAL_IDS.SPEED_AUTO;
}

/**
 * Números vermelhos na roleta (para determinar cor)
 */
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

/**
 * Determina a cor do número na roleta
 * @param number Número da roleta
 * @returns Cor correspondente ('red', 'black', 'green')
 */
export function getNumberColor(number: number): 'red' | 'black' | 'green' {
  if (number === 0) return 'green';
  return RED_NUMBERS.includes(number) ? 'red' : 'black';
}

/**
 * Transforma dados de um número da roleta para o formato padronizado
 * @param rawNumber Número bruto da API
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
        console.warn('[Transformer] Objeto de número inválido:', rawNumber);
        return null;
      }
      
      // Determinar cor
      const color = rawNumber.cor || rawNumber.color || getNumberColor(num);
      
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
 * Transforma dados brutos de roleta para o formato padronizado
 * @param rawData Dados brutos da API
 * @returns Objeto de roleta padronizado
 */
export function transformRouletteData(rawData: any) {
  try {
    // Garantir que temos um ID canônico
    const canonicalId = rawData.canonical_id || mapToCanonicalId(rawData.id);
    
    // Garantir que temos o array de números no formato correto
    let numbers = [];
    
    if (rawData.numero && Array.isArray(rawData.numero)) {
      numbers = rawData.numero;
    } else if (rawData.numeros && Array.isArray(rawData.numeros)) {
      numbers = rawData.numeros;
    }
    
    // Processar cada número para garantir formato consistente
    const processedNumbers = numbers
      .map(transformRouletteNumber)
      .filter(Boolean);
    
    // Determinar nome amigável
    const name = rawData.nome || rawData.name || CANONICAL_NAMES[canonicalId] || `Roleta ${canonicalId}`;
    
    return {
      id: canonicalId,
      uuid: rawData.id,
      name,
      numbers: processedNumbers,
      active: rawData.ativa !== false,
      strategyState: rawData.estado_estrategia || 'NEUTRAL',
      wins: rawData.vitorias || 0,
      losses: rawData.derrotas || 0
    };
  } catch (error) {
    console.error('[Transformer] Erro ao transformar dados da roleta:', error);
    return {
      id: '0',
      uuid: '0',
      name: 'Erro',
      numbers: [],
      active: false,
      strategyState: 'ERROR',
      wins: 0,
      losses: 0
    };
  }
} 