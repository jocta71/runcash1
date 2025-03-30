export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      roleta_estatisticas_diarias: {
        Row: {
          data: string
          frequencia_maxima: number | null
          id: number
          numero_mais_frequente: number | null
          numeros_impares: number | null
          numeros_pares: number | null
          numeros_pretos: number | null
          numeros_vermelhos: number | null
          roleta_id: string | null
          total_numeros: number | null
          zeros: number | null
        }
        Insert: {
          data: string
          frequencia_maxima?: number | null
          id?: number
          numero_mais_frequente?: number | null
          numeros_impares?: number | null
          numeros_pares?: number | null
          numeros_pretos?: number | null
          numeros_vermelhos?: number | null
          roleta_id?: string | null
          total_numeros?: number | null
          zeros?: number | null
        }
        Update: {
          data?: string
          frequencia_maxima?: number | null
          id?: number
          numero_mais_frequente?: number | null
          numeros_impares?: number | null
          numeros_pares?: number | null
          numeros_pretos?: number | null
          numeros_vermelhos?: number | null
          roleta_id?: string | null
          total_numeros?: number | null
          zeros?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "roleta_estatisticas_diarias_roleta_id_fkey"
            columns: ["roleta_id"]
            isOneToOne: false
            referencedRelation: "roletas"
            referencedColumns: ["id"]
          },
        ]
      }
      roleta_numeros: {
        Row: {
          cor: string | null
          dezena: string | null
          id: number
          metade: string | null
          numero: number
          paridade: string | null
          roleta_id: string | null
          roleta_nome: string
          timestamp: string | null
        }
        Insert: {
          cor?: string | null
          dezena?: string | null
          id?: number
          metade?: string | null
          numero: number
          paridade?: string | null
          roleta_id?: string | null
          roleta_nome: string
          timestamp?: string | null
        }
        Update: {
          cor?: string | null
          dezena?: string | null
          id?: number
          metade?: string | null
          numero?: number
          paridade?: string | null
          roleta_id?: string | null
          roleta_nome?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roleta_numeros_roleta_id_fkey"
            columns: ["roleta_id"]
            isOneToOne: false
            referencedRelation: "roletas"
            referencedColumns: ["id"]
          },
        ]
      }
      roleta_sequencias: {
        Row: {
          comprimento: number
          fim_timestamp: string
          id: number
          inicio_timestamp: string
          roleta_id: string | null
          tipo: string
          valor: string
        }
        Insert: {
          comprimento: number
          fim_timestamp: string
          id?: number
          inicio_timestamp: string
          roleta_id?: string | null
          tipo: string
          valor: string
        }
        Update: {
          comprimento?: number
          fim_timestamp?: string
          id?: number
          inicio_timestamp?: string
          roleta_id?: string | null
          tipo?: string
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "roleta_sequencias_roleta_id_fkey"
            columns: ["roleta_id"]
            isOneToOne: false
            referencedRelation: "roletas"
            referencedColumns: ["id"]
          },
        ]
      }
      roletas: {
        Row: {
          ativa: boolean | null
          atualizado_em: string | null
          criado_em: string | null
          id: string
          nome: string
          provedor: string
          tipo: string
        }
        Insert: {
          ativa?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          nome: string
          provedor: string
          tipo: string
        }
        Update: {
          ativa?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          nome?: string
          provedor?: string
          tipo?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_color_distribution: {
        Args: {
          roleta_nome_param: string
          limit_param: number
        }
        Returns: {
          cor: string
          total: number
          porcentagem: number
        }[]
      }
      get_current_streak: {
        Args: {
          roleta_nome_param: string
        }
        Returns: {
          type: string
          value: string
          count: number
        }[]
      }
      get_missing_dozens: {
        Args: {
          roleta_nome_param: string
          limit_param: number
        }
        Returns: {
          dezena: string
          ultima_aparicao: number
          ausencia: number
        }[]
      }
      get_number_frequency: {
        Args: {
          roleta_nome_param: string
          limit_param: number
        }
        Returns: {
          numero: number
          total: number
          porcentagem: number
          cor: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
