/**
 * Utilitários para trabalhar com dados de roletas
 */

/**
 * Tipos conhecidos de roletas
 */
export enum RouletteType {
  STANDARD = 'standard',
  SPEED = 'speed',
  LIGHTNING = 'lightning',
  BRASILEIRA = 'brasileira',
  AMERICANA = 'americana',
  AUTO = 'auto',
  VIP = 'vip',
  IMMERSIVE = 'immersive',
  XXL = 'xxl',
  UNKNOWN = 'unknown'
}

/**
 * Mapeia o nome da roleta para o tipo correspondente
 * @param name Nome da roleta
 * @returns Tipo da roleta de acordo com seu nome
 */
export function getRouletteTypeByName(name: string): RouletteType {
  // Normalizar o nome para comparação
  const normalizedName = name.toLowerCase().trim();
  
  // Verificar cada tipo conhecido
  if (normalizedName.includes('speed') || normalizedName.includes('rápida')) {
    return RouletteType.SPEED;
  }
  if (normalizedName.includes('lightning') || normalizedName.includes('relâmpago')) {
    return RouletteType.LIGHTNING;
  }
  if (normalizedName.includes('brasileira') || normalizedName.includes('brazil')) {
    return RouletteType.BRASILEIRA;
  }
  if (normalizedName.includes('americana') || normalizedName.includes('american')) {
    return RouletteType.AMERICANA;
  }
  if (normalizedName.includes('auto')) {
    return RouletteType.AUTO;
  }
  if (normalizedName.includes('vip')) {
    return RouletteType.VIP;
  }
  if (normalizedName.includes('immersive') || normalizedName.includes('imersiva')) {
    return RouletteType.IMMERSIVE;
  }
  if (normalizedName.includes('xxl')) {
    return RouletteType.XXL;
  }
  
  // Se não corresponder a nenhum tipo específico, retornar o tipo padrão
  return RouletteType.STANDARD;
}

/**
 * Obtém a cor correspondente a um número de roleta
 * @param number Número da roleta (0-36)
 * @returns String representando a cor ('red', 'black', 'green')
 */
export function getRouletteNumberColor(number: number): string {
  // Números verdes (zero e duplo zero)
  if (number === 0 || number === 37) {
    return 'green';
  }
  
  // Lista de números vermelhos
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  
  // Verificar se é vermelho
  if (redNumbers.includes(number)) {
    return 'red';
  }
  
  // Se não for verde nem vermelho, é preto
  return 'black';
}

/**
 * Verifica se um número é par
 * @param number Número a verificar
 * @returns true se o número for par, false caso contrário
 */
export function isEven(number: number): boolean {
  // Zero não é considerado par nem ímpar em jogos de roleta
  if (number === 0 || number === 37) {
    return false;
  }
  
  return number % 2 === 0;
}

/**
 * Verifica se um número pertence à primeira ou segunda dúzia
 * @param number Número a verificar
 * @returns Número da dúzia (1, 2 ou 3) ou 0 para zero
 */
export function getDozen(number: number): number {
  // Zero não pertence a nenhuma dúzia
  if (number === 0 || number === 37) {
    return 0;
  }
  
  if (number >= 1 && number <= 12) {
    return 1;
  } else if (number >= 13 && number <= 24) {
    return 2;
  } else {
    return 3;
  }
}

/**
 * Verifica se um número pertence à primeira ou segunda metade
 * @param number Número a verificar
 * @returns 1 para primeira metade, 2 para segunda metade, 0 para zero
 */
export function getHalf(number: number): number {
  // Zero não pertence a nenhuma metade
  if (number === 0 || number === 37) {
    return 0;
  }
  
  return number <= 18 ? 1 : 2;
}

/**
 * Obtém a coluna do número na mesa de roleta
 * @param number Número a verificar
 * @returns Número da coluna (1, 2 ou 3) ou 0 para zero
 */
export function getColumn(number: number): number {
  // Zero não pertence a nenhuma coluna
  if (number === 0 || number === 37) {
    return 0;
  }
  
  const remainder = number % 3;
  
  if (remainder === 1) {
    return 1;
  } else if (remainder === 2) {
    return 2;
  } else {
    return 3;
  }
} 