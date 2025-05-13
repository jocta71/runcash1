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
 * Dados de usuários observando a roleta
 */
export interface RouletteWatchers {
  count: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  lastUpdate: number;
}

/**
 * Avaliação de estratégias para a roleta
 */
export interface StrategyPerformance {
  name: string;
  score: number; // 1-10
  trend: 'up' | 'down' | 'stable';
}

/**
 * Análise de setores da roleta
 */
export interface SectorAnalysis {
  hotSectors: number[]; // Setores considerados "quentes"
  coldSectors: number[]; // Setores considerados "frios"
  heatMapData: Record<number, number>; // Mapa de calor: número -> intensidade
}

/**
 * Comentário de usuário sobre a roleta
 */
export interface RouletteComment {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}

/**
 * Dados processados de uma roleta
 */
export interface ProcessedRouletteData {
  id: string;
  nome: string;
  provider: string;
  status: string;
  ultimoNumero: number | null;
  numeros: RouletteNumber[];
  winRate: number;
  streak: number;
  lastUpdateTime: number;
  isHistorical?: boolean;
  imageUrl?: string;
  
  // Novos campos para funcionalidades inovadoras
  predictabilityScore?: number; // 0-100
  watchers?: RouletteWatchers;
  sectorAnalysis?: SectorAnalysis;
  strategyPerformance?: StrategyPerformance[];
  roulettePersonality?: string; // ex: "Repetitiva", "Alternante", "Aleatória"
  comments?: RouletteComment[];
  isLikedByUser?: boolean;
  alertPatterns?: string[];
  averageTimeBetweenNumbers?: number; // em segundos
}

/**
 * Propriedades do componente RouletteCard
 */
export interface RouletteCardProps {
  data: any;
  isDetailView?: boolean;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
  onAddComment?: (id: string, comment: string) => void;
  onToggleLike?: (id: string) => void;
  onSetAlert?: (id: string, pattern: string) => void;
} 