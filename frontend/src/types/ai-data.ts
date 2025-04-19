// Tipos para dados das roletas utilizados pela IA

export interface RouletteNumber {
  number: number;
  timestamp?: Date;
}

export interface Roulette {
  id: string;
  name: string;
  online: boolean;
  numbers?: RouletteNumber[];
}

export interface Trend {
  type: 'color' | 'parity' | 'dozen';
  value: string;
  count: number;
}

export interface NumbersStatistics {
  recent: number[];
  raw: number[];
  redCount: number;
  blackCount: number;
  greenCount: number;
  redPercentage: number;
  blackPercentage: number;
  greenPercentage: number;
  evenCount: number;
  oddCount: number;
  evenPercentage: number;
  oddPercentage: number;
  dozenCounts: number[];
  dozenPercentages: number[];
  hotNumbers: number[];
  coldNumbers: number[];
}

export interface NumbersByRoulette {
  [rouletteName: string]: number[];
}

export interface RouletteData {
  numbers: NumbersStatistics;
  trends: Trend[];
  roletas: Roulette[];
  numerosPorRoleta: NumbersByRoulette;
}

// Interface para resposta da API Gemini
export interface GeminiResponse {
  candidates: {
    content: {
      parts: {
        text: string;
      }[];
    };
  }[];
}

// Estrutura de frequência de números para cálculos internos
export interface NumberFrequency {
  [key: string]: number;
} 