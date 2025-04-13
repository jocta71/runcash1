
export interface Database {
  public: {
    Tables: {
      recent_numbers: {
        Row: {
          id: string;
          roulette_name: string;
          number: number;
          color: string;
          timestamp: string;
        };
        Insert: {
          id?: string;
          roulette_name: string;
          number: number;
          color: string;
          timestamp?: string;
        };
        Update: {
          id?: string;
          roulette_name?: string;
          number?: number;
          color?: string;
          timestamp?: string;
        };
      };
      roleta_numeros: {
        Row: {
          id: number;
          roleta_nome: string;
          roleta_id?: string;
          numero: number;
          cor?: string;
          timestamp?: string;
          dezena?: string;
          metade?: string;
          paridade?: string;
        };
        Insert: {
          id?: number;
          roleta_nome: string;
          roleta_id?: string;
          numero: number;
          cor?: string;
          timestamp?: string;
          dezena?: string;
          metade?: string;
          paridade?: string;
        };
        Update: {
          id?: number;
          roleta_nome?: string;
          roleta_id?: string;
          numero?: number;
          cor?: string;
          timestamp?: string;
          dezena?: string;
          metade?: string;
          paridade?: string;
        };
      };
      roletas: {
        Row: {
          id: string;
          nome: string;
          provedor: string;
          tipo: string;
          ativa?: boolean;
          criado_em?: string;
          atualizado_em?: string;
        };
        Insert: {
          id?: string;
          nome: string;
          provedor: string;
          tipo: string;
          ativa?: boolean;
          criado_em?: string;
          atualizado_em?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          provedor?: string;
          tipo?: string;
          ativa?: boolean;
          criado_em?: string;
          atualizado_em?: string;
        };
      };
    };
  };
}
