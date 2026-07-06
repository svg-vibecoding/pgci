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
          {
            foreignKeyName: "agreement_change_requests_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements_with_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_companies: {
        Row: {
          agreement_id: string
          client_id: string
          created_at: string
          ended_by: string | null
          ended_reason: string | null
          id: string
          linked_by: string | null
          notes: string | null
          started_by: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          agreement_id: string
          client_id: string
          created_at?: string
          ended_by?: string | null
          ended_reason?: string | null
          id?: string
          linked_by?: string | null
          notes?: string | null
          started_by?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          agreement_id?: string
          client_id?: string
          created_at?: string
          ended_by?: string | null
          ended_reason?: string | null
          id?: string
          linked_by?: string | null
          notes?: string | null
          started_by?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreement_companies_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_companies_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements_with_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_companies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_costs: {
        Row: {
          agreement_product_id: string
          cost_source: string | null
          cost_value: number | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          agreement_product_id: string
          cost_source?: string | null
          cost_value?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          agreement_product_id?: string
          cost_source?: string | null
          cost_value?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreement_costs_agreement_product_id_fkey"
            columns: ["agreement_product_id"]
            isOneToOne: false
            referencedRelation: "agreement_products"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_group_members: {
        Row: {
          agreement_group_id: string
          assigned_by: string | null
          created_at: string
          ended_by: string | null
          ended_reason: string | null
          id: string
          role: string
          started_by: string | null
          user_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          agreement_group_id: string
          assigned_by?: string | null
          created_at?: string
          ended_by?: string | null
          ended_reason?: string | null
          id?: string
          role: string
          started_by?: string | null
          user_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          agreement_group_id?: string
          assigned_by?: string | null
          created_at?: string
          ended_by?: string | null
          ended_reason?: string | null
          id?: string
          role?: string
          started_by?: string | null
          user_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreement_group_members_agreement_group_id_fkey"
            columns: ["agreement_group_id"]
            isOneToOne: false
            referencedRelation: "agreement_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_groups: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          group_name: string
          id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          group_name: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          group_name?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_groups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
          ended_by: string | null
          ended_reason: string | null
          id: string
          role: string
          started_by: string | null
          user_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          agreement_id: string
          assigned_by?: string | null
          can_view_costs?: boolean
          created_at?: string
          ended_by?: string | null
          ended_reason?: string | null
          id?: string
          role: string
          started_by?: string | null
          user_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          agreement_id?: string
          assigned_by?: string | null
          can_view_costs?: boolean
          created_at?: string
          ended_by?: string | null
          ended_reason?: string | null
          id?: string
          role?: string
          started_by?: string | null
          user_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreement_members_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_members_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements_with_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_product_alternatives: {
        Row: {
          agreement_product_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          product_id: string
        }
        Insert: {
          agreement_product_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id: string
        }
        Update: {
          agreement_product_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_product_alternatives_agreement_product_id_fkey"
            columns: ["agreement_product_id"]
            isOneToOne: false
            referencedRelation: "agreement_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_product_alternatives_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_products: {
        Row: {
          agreement_id: string
          client_product_id: string | null
          client_product_match_id: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          excluded_at: string | null
          excluded_by: string | null
          excluded_reason: string | null
          id: string
          observations: string | null
          par_price: number | null
          pending_reason: string | null
          product_id: string | null
          sale_price: number | null
          start_date: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agreement_id: string
          client_product_id?: string | null
          client_product_match_id?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          excluded_at?: string | null
          excluded_by?: string | null
          excluded_reason?: string | null
          id?: string
          observations?: string | null
          par_price?: number | null
          pending_reason?: string | null
          product_id?: string | null
          sale_price?: number | null
          start_date?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agreement_id?: string
          client_product_id?: string | null
          client_product_match_id?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          excluded_at?: string | null
          excluded_by?: string | null
          excluded_reason?: string | null
          id?: string
          observations?: string | null
          par_price?: number | null
          pending_reason?: string | null
          product_id?: string | null
          sale_price?: number | null
          start_date?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreement_products_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_products_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements_with_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_products_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_sku_links: {
        Row: {
          agreement_id: string
          created_at: string
          created_by: string | null
          id: string
          product_id: string
        }
        Insert: {
          agreement_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
        }
        Update: {
          agreement_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_sku_links_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_sku_links_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements_with_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_sku_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      agreements: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string | null
          group_id: string | null
          id: string
          name: string
          observations: string | null
          scope: string
          start_date: string | null
          status: string
          unit_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          group_id?: string | null
          id?: string
          name: string
          observations?: string | null
          scope?: string
          start_date?: string | null
          status?: string
          unit_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          group_id?: string | null
          id?: string
          name?: string
          observations?: string | null
          scope?: string
          start_date?: string | null
          status?: string
          unit_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "agreement_groups"
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
      client_product_history: {
        Row: {
          brand: string | null
          client_product_id: string
          created_at: string
          description: string | null
          id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          brand?: string | null
          client_product_id: string
          created_at?: string
          description?: string | null
          id?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          brand?: string | null
          client_product_id?: string
          created_at?: string
          description?: string | null
          id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_product_history_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
        ]
      }
      client_product_match: {
        Row: {
          client_product_id: string
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          source: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          client_product_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          source?: string | null
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          client_product_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          source?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_product_match_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_product_match_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      client_products: {
        Row: {
          client_code: string
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          status: string
        }
        Insert: {
          client_code: string
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
        }
        Update: {
          client_code?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_products_client_id_fkey"
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
          parent_client_id: string | null
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
          parent_client_id?: string | null
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
          parent_client_id?: string | null
          status?: string
          tax_id?: string
          tax_id_type?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_parent_client_id_fkey"
            columns: ["parent_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
          can_create_agreement_groups: boolean
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
          can_create_agreement_groups?: boolean
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
          can_create_agreement_groups?: boolean
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
          can_create_agreements: boolean
          can_manage_client_catalog: boolean
          can_manage_matching: boolean
          client_id: string
          created_at: string
          ended_by: string | null
          ended_reason: string | null
          id: string
          started_by: string | null
          user_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          assigned_by?: string | null
          can_create_agreements?: boolean
          can_manage_client_catalog?: boolean
          can_manage_matching?: boolean
          client_id: string
          created_at?: string
          ended_by?: string | null
          ended_reason?: string | null
          id?: string
          started_by?: string | null
          user_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          assigned_by?: string | null
          can_create_agreements?: boolean
          can_manage_client_catalog?: boolean
          can_manage_matching?: boolean
          client_id?: string
          created_at?: string
          ended_by?: string | null
          ended_reason?: string | null
          id?: string
          started_by?: string | null
          user_id?: string
          valid_from?: string
          valid_until?: string | null
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
      agreements_with_counts: {
        Row: {
          companies_count: number | null
          created_at: string | null
          created_by: string | null
          end_date: string | null
          group_client_commercial_name: string | null
          group_client_id: string | null
          group_client_legal_name: string | null
          group_client_tax_id: string | null
          group_id: string | null
          group_name: string | null
          id: string | null
          lines_active: number | null
          lines_excluded: number | null
          lines_pending: number | null
          lines_review: number | null
          lines_total: number | null
          members_count: number | null
          my_role: string | null
          name: string | null
          observations: string | null
          scope: string | null
          start_date: string | null
          status: string | null
          unit_name: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreement_groups_client_id_fkey"
            columns: ["group_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "agreement_groups"
            referencedColumns: ["id"]
          },
        ]
      }
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
      can_create_agreement_groups: { Args: never; Returns: boolean }
      can_create_agreements: { Args: never; Returns: boolean }
      can_create_agreements_for_client: {
        Args: { p_client_id: string }
        Returns: boolean
      }
      can_manage_client_catalog: {
        Args: { p_client_id: string }
        Returns: boolean
      }
      can_manage_matching: { Args: { p_client_id: string }; Returns: boolean }
      can_view_costs: { Args: { p_agreement_id: string }; Returns: boolean }
      commit_agreement_import: {
        Args: { p_agreement_id: string; p_payload: Json }
        Returns: Json
      }
      get_agreement_role: { Args: { p_agreement_id: string }; Returns: string }
      has_client_access: { Args: { p_client_id: string }; Returns: boolean }
      is_active_user: { Args: { p_user_id: string }; Returns: boolean }
      is_agreement_group_admin: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: boolean
      }
      is_agreement_group_member: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: boolean
      }
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
