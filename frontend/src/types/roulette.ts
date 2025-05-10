/**
 * Tipos para roletas e números
 */

// Tipo básico para um número de roleta
export interface RouletteNumber {
  numero: number;
  timestamp?: number;
}

// Tipo básico para dados de roleta
export interface RouletteData {
  id: string;
  _id?: string;
  roleta_id?: string;
  nome: string;
  name?: string;
  provider?: string;
  status?: "online" | "offline";
  numero: RouletteNumber[];
  lastUpdated?: number;
  timestamp?: number;
}

// Estender o tipo RouletteData para incluir propriedades adicionais
export interface ExtendedRouletteData extends RouletteData {
  lastNumbers?: number[];
  numeros?: any[];
  ultimoNumero?: number;
}

// Tipo para uma mesa de roleta
export interface RouletteTable {
  tableId: string;
  tableName: string;
  numbers: string[];
  dealer?: string;
  players?: number;
}

// Tipo para estatísticas de roleta
export interface RouletteStats {
  red: number;
  black: number;
  zero: number;
  even: number;
  odd: number;
  high: number;
  low: number;
  dozens: [number, number, number];
  columns: [number, number, number];
  lastNumbers: number[];
}

// Tipo para um evento de novo número
export interface RouletteNumberEvent {
  roulette_id: string;
  roulette_name: string;
  number: number;
  timestamp: number;
} 