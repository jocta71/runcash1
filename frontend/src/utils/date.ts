/**
 * Função para formatar datas no padrão brasileiro (dia/mês/ano)
 * @param date Data a ser formatada
 * @returns String formatada no padrão DD/MM/YYYY
 */
export const formatDate = (date: Date): string => {
  try {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Erro ao formatar data:', error);
    return 'Data inválida';
  }
};

/**
 * Função para formatar datas com hora no padrão brasileiro
 * @param date Data a ser formatada
 * @returns String formatada no padrão DD/MM/YYYY HH:MM
 */
export const formatDateWithTime = (date: Date): string => {
  try {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (error) {
    console.error('Erro ao formatar data com hora:', error);
    return 'Data inválida';
  }
};

/**
 * Função para calcular a diferença em dias entre duas datas
 * @param dateA Primeira data
 * @param dateB Segunda data
 * @returns Número de dias entre as datas
 */
export const daysBetween = (dateA: Date, dateB: Date): number => {
  try {
    const msPerDay = 1000 * 60 * 60 * 24;
    const utcA = Date.UTC(dateA.getFullYear(), dateA.getMonth(), dateA.getDate());
    const utcB = Date.UTC(dateB.getFullYear(), dateB.getMonth(), dateB.getDate());
    
    return Math.floor((utcB - utcA) / msPerDay);
  } catch (error) {
    console.error('Erro ao calcular diferença entre datas:', error);
    return 0;
  }
}; 