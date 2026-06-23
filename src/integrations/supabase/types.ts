export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agreement_change_requests: {
        Row: {
          agreement_id: string
          created_at: string
          field_name: string
          id: string
          new_value: Json | null
          old_value: Json | null
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_record_id: string
          target_table: string
        }
        Insert: {
          agreement_id: string
          created_at?: string
          field_name: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_record_id: string
          target_table: string
        }
        Update: {
          agreement_id?: string
          created_at?: string
          field_name?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_record_id?: string
          target_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_change_requests_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_costs: {
        Row: {
          agreement_id: string
          created_at: string
          id: string
        }
        Insert: {
          agreement_id: string
          created_at?: string
          id?: string
        }
        Update: {
          agreement_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_costs_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_members: {
        Row: {
          agreement_id: string
          assigned_by: string | null
          can_view_costs: boolean
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          agreement_id: string
          assigned_by?: string | null
          can_view_costs?: boolean
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          agreement_id?: string
          assigned_by?: string | null
          can_view_costs?: boolean
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_members_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_products: {
        Row: {
          agreement_id: string
          created_at: string
          id: string
        }
        Insert: {
          agreement_id: string
          created_at?: string
          id?: string
        }
        Update: {
          agreement_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_products_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      agreements: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_companies: {
        Row: {
          client_id: string | null
          commercial_name: string | null
          created_at: string
          erp_name: string | null
          id: string
          legal_name: string
          notes: string | null
          status: string
          tax_id: string
          tax_id_type: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          commercial_name?: string | null
          created_at?: string
          erp_name?: string | null
          id?: string
          legal_name: string
          notes?: string | null
          status?: string
          tax_id: string
          tax_id_type?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          commercial_name?: string | null
          created_at?: string
          erp_name?: string | null
          id?: string
          legal_name?: string
          notes?: string | null
          status?: string
          tax_id?: string
          tax_id_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_companies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          commercial_name: string | null
          created_at: string
          erp_name: string | null
          id: string
          legal_name: string
          notes: string | null
          status: string
          tax_id: string
          tax_id_type: string
          type: string
          updated_at: string
        }
        Insert: {
          commercial_name?: string | null
          created_at?: string
          erp_name?: string | null
          id?: string
          legal_name: string
          notes?: string | null
          status?: string
          tax_id: string
          tax_id_type?: string
          type: string
          updated_at?: string
        }
        Update: {
          commercial_name?: string | null
          created_at?: string
          erp_name?: string | null
          id?: string
          legal_name?: string
          notes?: string | null
          status?: string
          tax_id?: string
          tax_id_type?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          brand_reference: string | null
          commercial_brand: string | null
          commercial_description: string | null
          commercial_unit: string | null
          created_at: string
          erp_brand: string | null
          erp_description: string
          erp_product_category_n1: string | null
          erp_product_category_n2: string | null
          erp_product_category_n3: string | null
          id: string
          product_classification: string | null
          sku: string
          status: string
          updated_at: string
        }
        Insert: {
          brand_reference?: string | null
          commercial_brand?: string | null
          commercial_description?: string | null
          commercial_unit?: string | null
          created_at?: string
          erp_brand?: string | null
          erp_description: string
          erp_product_category_n1?: string | null
          erp_product_category_n2?: string | null
          erp_product_category_n3?: string | null
          id?: string
          product_classification?: string | null
          sku: string
          status?: string
          updated_at?: string
        }
        Update: {
          brand_reference?: string | null
          commercial_brand?: string | null
          commercial_description?: string | null
          commercial_unit?: string | null
          created_at?: string
          erp_brand?: string | null
          erp_description?: string
          erp_product_category_n1?: string | null
          erp_product_category_n2?: string | null
          erp_product_category_n3?: string | null
          id?: string
          product_classification?: string | null
          sku?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          can_create_agreements: boolean
          created_at: string
          created_by: string | null
          email: string
          erp_user_code: string | null
          full_name: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_create_agreements?: boolean
          created_at?: string
          created_by?: string | null
          email: string
          erp_user_code?: string | null
          full_name: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_create_agreements?: boolean
          created_at?: string
          created_by?: string | null
          email?: string
          erp_user_code?: string | null
          full_name?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_client_access: {
        Row: {
          assigned_by: string | null
          client_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          client_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          client_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_client_access_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_agreement: {
        Args: { p_agreement_id: string }
        Returns: boolean
      }
      can_admin_agreement: {
        Args: { p_agreement_id: string }
        Returns: boolean
      }
      can_create_agreements_for_client: {
        Args: { p_client_id: string }
        Returns: boolean
      }
      can_view_costs: { Args: { p_agreement_id: string }; Returns: boolean }
      get_agreement_client_id: {
        Args: { p_agreement_id: string }
        Returns: string
      }
      get_agreement_role: { Args: { p_agreement_id: string }; Returns: string }
      has_client_access: { Args: { p_client_id: string }; Returns: boolean }
      is_active_user: { Args: { p_user_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      user_can_access_agreement: {
        Args: { p_agreement_id: string; p_user_id: string }
        Returns: boolean
      }
      user_has_client_access: {
        Args: { p_client_id: string; p_user_id: string }
        Returns: boolean
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
