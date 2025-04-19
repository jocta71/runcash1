// Re-exportar tipos dos módulos específicos
export * from './plans';
export * from './database.types';

// Definição das interfaces de eventos da roleta
export interface RouletteNumberEvent {
  type: 'new_number';
  roleta_id: string;
  roleta_nome: string;
  numero: number;
  timestamp: string;
  // Campos opcionais de estratégia
  estado_estrategia?: string;
  sugestao_display?: string;
  terminais_gatilho?: number[];
  // Flag para indicar se dados existentes devem ser preservados
  preserve_existing?: boolean;
  // Flag para indicar se é uma atualização em tempo real (após carregamento inicial)
  realtime_update?: boolean;
}

export interface StrategyUpdateEvent {
  type: 'strategy_update';
  roleta_id: string;
  roleta_nome: string;
  estado: string;
  numero_gatilho: number;
  terminais_gatilho: number[];
  vitorias: number;
  derrotas: number;
  sugestao_display?: string;
  timestamp?: string;
}

// Interface para os dados das roletas
export interface RouletteData {
  _id?: string;
  id?: string;
  nome?: string;
  name?: string;
  numeros?: number[];
  numero?: number[];
  lastNumbers?: number[];
  estado_estrategia?: string;
  ativa?: boolean;
  vitorias?: number;
  derrotas?: number;
  tipo?: string;
  provedor?: string;
  // Dados de histórico
  historico?: {
    numeros?: number[];
    timestamps?: string[];
  };
  // Dados em tempo real
  online?: boolean;
  jogadores_online?: number;
  dealer?: string;
  // Configurações
  estrategia_ativa?: boolean;
  tipo_estrategia?: string;
  uuid?: string;
}

// Interface para entrada de busca de roletas
export interface RouletteSearchInput {
  term: string;
  filter?: 'all' | 'active' | 'favorite' | 'recommended';
  sort?: 'name' | 'activity' | 'winrate';
}

// Interface para histórico de apostas
export interface BetHistory {
  id: string;
  roleta_id: string;
  roleta_nome: string;
  numero_apostado: number | number[];
  numero_sorteado: number;
  resultado: 'vitoria' | 'derrota' | 'empate';
  valor_apostado: number;
  valor_ganho: number;
  timestamp: string;
  tipo_aposta: string;
}

// Interface para estatísticas de roleta
export interface RouletteStats {
  roleta_id: string;
  total_numeros: number;
  distribuicao: {
    vermelhos: number;
    pretos: number;
    verdes: number;
  };
  paridade: {
    pares: number;
    impares: number;
  };
  faixas: {
    baixos: number; // 1-18
    altos: number;  // 19-36
  };
  duzias: [number, number, number]; // [1-12, 13-24, 25-36]
  colunas: [number, number, number];
  numeros_quentes: Array<{numero: number, contagem: number}>;
  numeros_frios: Array<{numero: number, contagem: number}>;
  sequencias: {
    atual: number[];
    maior: number[];
  };
} 