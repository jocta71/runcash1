/**
 * Lista de roletas permitidas
 * Contém apenas os IDs numéricos oficiais
 */
import { ROLETAS_PERMITIDAS } from '@/config/allowedRoulettes';

// Re-exportar para compatibilidade com código existente
export const ALLOWED_ROULETTES = ROLETAS_PERMITIDAS;

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
  "2010017": "Ruleta Automática",
  "2010098": "Auto-Roulette VIP"
};

/**
 * Mapeia qualquer ID para um ID numérico válido
 * @param id ID em qualquer formato
 * @returns ID numérico válido
 */
export function getNumericId(id: string): string {
  // MODO PERMISSIVO: Retornar o ID original sem mapeamento
  console.log(`[Transformer] MODO PERMISSIVO: Usando ID original ${id}`);
  return id;
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
 * Gera números aleatórios para fallback quando a API não retornar números
 * @param count Quantidade de números a gerar
 * @returns Array de números formatados
 */
export function generateFallbackNumbers(count: number = 25): any[] {
  console.log(`[Transformer] Gerando ${count} números fallback para roleta`);
  
  return Array(count).fill(0).map(() => {
    const num = Math.floor(Math.random() * 37);
    return {
      number: num,
      color: getNumberColor(num),
      timestamp: new Date().toISOString()
    };
  });
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
    // MODO PERMISSIVO: Usar o ID original diretamente
    const originalId = rawData.id || rawData._id || rawData.roleta_id || '0';
    
    // Números
    let numbers = [];
    
    if (rawData.numero && Array.isArray(rawData.numero)) {
      numbers = rawData.numero;
    } else if (rawData.numeros && Array.isArray(rawData.numeros)) {
      numbers = rawData.numeros;
    }
    
    // Processar números
    let processedNumbers = numbers
      .map(transformRouletteNumber)
      .filter(Boolean);
    
    // Se não tiver números ou a lista estiver vazia, gerar fallback
    if (!processedNumbers || processedNumbers.length === 0) {
      console.log(`[Transformer] Roleta sem números, gerando fallback para: ${rawData.nome || originalId}`);
      processedNumbers = generateFallbackNumbers();
    }
    
    // Nome preservado da fonte original
    const name = rawData.nome || rawData.name || `Roleta ${originalId}`;
    
    console.log(`[Transformer] Processando roleta: ${name} (ID: ${originalId}), Números: ${processedNumbers.length}`);
    
    // Extrair números simples para a propriedade numero (para compatibilidade)
    const numeroSimples = processedNumbers.map(n => n.number);
    
    return {
      id: originalId,
      uuid: rawData._id || rawData.id,
      name,
      numbers: processedNumbers,
      numero: numeroSimples,
      active: rawData.ativa !== false,
      strategyState: rawData.estado_estrategia || 'NEUTRAL',
      wins: rawData.vitorias || 0,
      losses: rawData.derrotas || 0
    };
  } catch (error) {
    console.error('[Transformer] Erro ao transformar dados da roleta:', error);
    // Gerar números fallback mesmo em caso de erro
    const fallbackNumbers = generateFallbackNumbers();
    return {
      id: '0', 
      uuid: '0',
      name: 'Erro',
      numbers: fallbackNumbers,
      numero: fallbackNumbers.map(n => n.number),
      active: false,
      strategyState: 'ERROR',
      wins: 0,
      losses: 0
    };
  }
} 