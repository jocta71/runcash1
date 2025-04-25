/**
 * Tipos relacionados às roletas do sistema
 */

/**
 * Representa uma roleta no sistema
 */
export interface RouletteType {
  _id: string;
  roleta_id?: number;
  id?: number;
  nome?: string;
  name?: string;
  provider?: string;
  status?: string;
  url?: string;
  ultimo_numero?: number;
  last_number?: number;
  ultimos_numeros?: number[];
  recent_numbers?: number[];
  updated_at?: string;
  created_at?: string;
  
  // Campos relacionados à estratégia
  estado_estrategia?: string;
  numero_gatilho?: number;
  terminais_gatilho?: number[];
  vitorias?: number;
  derrotas?: number;
  sugestao_display?: string;
}

/**
 * Representa um número de roleta com informações adicionais
 */
export interface RouletteNumber {
  numero: number;
  cor?: string;
  timestamp?: string;
  roleta_id?: string | number;
}

/**
 * Representa uma estratégia para uma roleta
 */
export interface RouletteStrategy {
  estado: string;
  numero_gatilho: number | null;
  terminais_gatilho: number[];
  vitorias: number;
  derrotas: number;
  sugestao_display: string;
} 