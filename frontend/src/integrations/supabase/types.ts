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
        Args: { roleta_nome_param: string; limit_param: number }
        Returns: {
          cor: string
          total: number
          porcentagem: number
        }[]
      }
      get_current_streak: {
        Args: { roleta_nome_param: string }
        Returns: {
          type: string
          value: string
          count: number
        }[]
      }
      get_missing_dozens: {
        Args: { roleta_nome_param: string; limit_param: number }
        Returns: {
          dezena: string
          ultima_aparicao: number
          ausencia: number
        }[]
      }
      get_number_frequency: {
        Args: { roleta_nome_param: string; limit_param: number }
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
