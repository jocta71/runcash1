/**
 * Definições de tipos para o sistema de roletas
 */

/**
 * Representa um número da roleta com sua timestamp
 */
export interface RouletteNumber {
  numero: number;
  timestamp: string;
  cor?: string;
}

/**
 * Dados processados de uma roleta
 */
export interface ProcessedRouletteData {
  id: string;
  nome: string;
  provider: string;
  imageUrl: string;
  status: string;
  ultimoNumero: number | null;
  numeros: RouletteNumber[];
  winRate: number;
  streak: number;
  lastUpdateTime: number;
  isHistorical?: boolean;
}

/**
 * Propriedades do componente RouletteCard
 */
export interface RouletteCardProps {
  data: any;
  isDetailView?: boolean;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
} 