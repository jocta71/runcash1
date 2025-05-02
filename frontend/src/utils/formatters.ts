/**
 * Formata uma data para o formato local de data e hora
 * @param date Data a ser formatada
 * @returns String formatada no padrão local
 */
export const formatDateTime = (date: Date): string => {
  if (!date) return '';
  
  try {
    // Formatar como HH:MM:SS
    return date.toLocaleTimeString();
  } catch (error) {
    console.error('Erro ao formatar data:', error);
    return date.toString();
  }
};

/**
 * Formata um número como moeda (R$)
 * @param value Valor a ser formatado
 * @returns String formatada como moeda
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

/**
 * Formata um número com casas decimais
 * @param value Valor a ser formatado
 * @param decimalPlaces Número de casas decimais
 * @returns String formatada
 */
export const formatNumber = (value: number, decimalPlaces: number = 2): string => {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces
  }).format(value);
}; 