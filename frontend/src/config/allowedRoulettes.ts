/**
 * Configuração de roletas para o frontend
 * Todas as roletas são permitidas por padrão
 */

// Para compatibilidade com código existente
export const ROLETAS_PERMITIDAS: string[] = [];

/**
 * Verifica se uma roleta é permitida (sempre retorna true)
 */
export function isRouletteAllowed(roletaId: string): boolean {
  // Permitir sempre todas as roletas
  return true;
}

/**
 * Função que não filtra as roletas, retornando todas
 */
export function filterAllowedRoulettes(roletas: any[]): any[] {
  // Retornar todas as roletas sem filtrar
  return roletas;
} 