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
          agreement_position_id: string
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
          agreement_position_id: string
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
          agreement_position_id?: string
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
            foreignKeyName: "agreement_costs_agreement_position_id_fkey"
            columns: ["agreement_position_id"]
            isOneToOne: false
            referencedRelation: "agreement_positions"
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
      agreement_position_alternatives: {
        Row: {
          agreement_position_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          product_id: string
        }
        Insert: {
          agreement_position_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id: string
        }
        Update: {
          agreement_position_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_position_alternatives_position_id_fkey"
            columns: ["agreement_position_id"]
            isOneToOne: false
            referencedRelation: "agreement_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_position_alternatives_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_position_client_codes: {
        Row: {
          agreement_id: string
          agreement_position_id: string
          client_id: string
          client_product_id: string
          client_product_match_id: string | null
          ended_by: string | null
          ended_reason: string | null
          id: string
          sku_change_kind: string | null
          started_by: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          agreement_id: string
          agreement_position_id: string
          client_id: string
          client_product_id: string
          client_product_match_id?: string | null
          ended_by?: string | null
          ended_reason?: string | null
          id?: string
          sku_change_kind?: string | null
          started_by?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          agreement_id?: string
          agreement_position_id?: string
          client_id?: string
          client_product_id?: string
          client_product_match_id?: string | null
          ended_by?: string | null
          ended_reason?: string | null
          id?: string
          sku_change_kind?: string | null
          started_by?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreement_position_client_codes_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_position_client_codes_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements_with_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_position_client_codes_agreement_position_id_fkey"
            columns: ["agreement_position_id"]
            isOneToOne: false
            referencedRelation: "agreement_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_position_client_codes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_position_client_codes_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_position_client_codes_client_product_match_id_fkey"
            columns: ["client_product_match_id"]
            isOneToOne: false
            referencedRelation: "client_product_match"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_position_exclusions: {
        Row: {
          ended_by: string | null
          ended_reason: string | null
          exclusion_reason: string
          id: string
          position_id: string
          started_by: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          ended_by?: string | null
          ended_reason?: string | null
          exclusion_reason: string
          id?: string
          position_id: string
          started_by?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          ended_by?: string | null
          ended_reason?: string | null
          exclusion_reason?: string
          id?: string
          position_id?: string
          started_by?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreement_position_exclusions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "agreement_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_position_price_history: {
        Row: {
          change_reason: string | null
          end_date: string | null
          id: string
          position_id: string
          product_id: string | null
          recorded_at: string
          recorded_by: string | null
          sale_price: number
          sku_change_kind: string | null
          sku_change_note: string | null
          start_date: string | null
        }
        Insert: {
          change_reason?: string | null
          end_date?: string | null
          id?: string
          position_id: string
          product_id?: string | null
          recorded_at?: string
          recorded_by?: string | null
          sale_price: number
          sku_change_kind?: string | null
          sku_change_note?: string | null
          start_date?: string | null
        }
        Update: {
          change_reason?: string | null
          end_date?: string | null
          id?: string
          position_id?: string
          product_id?: string | null
          recorded_at?: string
          recorded_by?: string | null
          sale_price?: number
          sku_change_kind?: string | null
          sku_change_note?: string | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreement_position_price_history_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "agreement_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_position_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_positions: {
        Row: {
          agreement_id: string
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          observations: string | null
          par_price: number | null
          pending_reason: string | null
          product_id: string | null
          published_at: string | null
          published_by: string | null
          sale_price: number | null
          sku_raw: string | null
          start_date: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agreement_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          observations?: string | null
          par_price?: number | null
          pending_reason?: string | null
          product_id?: string | null
          published_at?: string | null
          published_by?: string | null
          sale_price?: number | null
          sku_raw?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agreement_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          observations?: string | null
          par_price?: number | null
          pending_reason?: string | null
          product_id?: string | null
          published_at?: string | null
          published_by?: string | null
          sale_price?: number | null
          sku_raw?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreement_positions_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_positions_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements_with_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_positions_product_id_fkey"
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
      archived_position_alternatives: {
        Row: {
          archived_position_id: string
          id: string
          notes: string | null
          original_created_at: string | null
          original_created_by: string | null
          product_brand: string | null
          product_description: string | null
          product_id: string | null
          sku: string | null
        }
        Insert: {
          archived_position_id: string
          id?: string
          notes?: string | null
          original_created_at?: string | null
          original_created_by?: string | null
          product_brand?: string | null
          product_description?: string | null
          product_id?: string | null
          sku?: string | null
        }
        Update: {
          archived_position_id?: string
          id?: string
          notes?: string | null
          original_created_at?: string | null
          original_created_by?: string | null
          product_brand?: string | null
          product_description?: string | null
          product_id?: string | null
          sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archived_position_alternatives_archived_position_id_fkey"
            columns: ["archived_position_id"]
            isOneToOne: false
            referencedRelation: "archived_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_position_codes: {
        Row: {
          archived_position_id: string
          client_code: string | null
          client_id: string | null
          client_name: string | null
          code_description: string | null
          ended_reason: string | null
          id: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          archived_position_id: string
          client_code?: string | null
          client_id?: string | null
          client_name?: string | null
          code_description?: string | null
          ended_reason?: string | null
          id?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          archived_position_id?: string
          client_code?: string | null
          client_id?: string | null
          client_name?: string | null
          code_description?: string | null
          ended_reason?: string | null
          id?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archived_position_codes_archived_position_id_fkey"
            columns: ["archived_position_id"]
            isOneToOne: false
            referencedRelation: "archived_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_position_exclusions: {
        Row: {
          archived_position_id: string
          ended_by: string | null
          ended_reason: string | null
          exclusion_reason: string | null
          id: string
          started_by: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          archived_position_id: string
          ended_by?: string | null
          ended_reason?: string | null
          exclusion_reason?: string | null
          id?: string
          started_by?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          archived_position_id?: string
          ended_by?: string | null
          ended_reason?: string | null
          exclusion_reason?: string | null
          id?: string
          started_by?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archived_position_exclusions_archived_position_id_fkey"
            columns: ["archived_position_id"]
            isOneToOne: false
            referencedRelation: "archived_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_position_price_history: {
        Row: {
          archived_position_id: string
          change_reason: string | null
          end_date: string | null
          id: string
          recorded_at: string | null
          recorded_by: string | null
          sale_price: number | null
          start_date: string | null
        }
        Insert: {
          archived_position_id: string
          change_reason?: string | null
          end_date?: string | null
          id?: string
          recorded_at?: string | null
          recorded_by?: string | null
          sale_price?: number | null
          start_date?: string | null
        }
        Update: {
          archived_position_id?: string
          change_reason?: string | null
          end_date?: string | null
          id?: string
          recorded_at?: string | null
          recorded_by?: string | null
          sale_price?: number | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archived_position_price_history_archived_position_id_fkey"
            columns: ["archived_position_id"]
            isOneToOne: false
            referencedRelation: "archived_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_positions: {
        Row: {
          agreement_id: string
          archive_reason: string
          archived_at: string
          archived_by: string | null
          end_date: string | null
          id: string
          observations: string | null
          original_created_at: string | null
          original_position_id: string
          original_published_at: string | null
          original_status: string
          par_price: number | null
          product_brand: string | null
          product_description: string | null
          sale_price: number | null
          sku: string | null
          start_date: string | null
        }
        Insert: {
          agreement_id: string
          archive_reason: string
          archived_at?: string
          archived_by?: string | null
          end_date?: string | null
          id?: string
          observations?: string | null
          original_created_at?: string | null
          original_position_id: string
          original_published_at?: string | null
          original_status: string
          par_price?: number | null
          product_brand?: string | null
          product_description?: string | null
          sale_price?: number | null
          sku?: string | null
          start_date?: string | null
        }
        Update: {
          agreement_id?: string
          archive_reason?: string
          archived_at?: string
          archived_by?: string | null
          end_date?: string | null
          id?: string
          observations?: string | null
          original_created_at?: string | null
          original_position_id?: string
          original_published_at?: string | null
          original_status?: string
          par_price?: number | null
          product_brand?: string | null
          product_description?: string | null
          sale_price?: number | null
          sku?: string | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archived_positions_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archived_positions_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements_with_counts"
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
          source: Database["public"]["Enums"]["code_source"]
          source_reference: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          brand?: string | null
          client_product_id: string
          created_at?: string
          description?: string | null
          id?: string
          source?: Database["public"]["Enums"]["code_source"]
          source_reference?: string | null
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          brand?: string | null
          client_product_id?: string
          created_at?: string
          description?: string | null
          id?: string
          source?: Database["public"]["Enums"]["code_source"]
          source_reference?: string | null
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
          source: Database["public"]["Enums"]["code_source"]
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          client_product_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          source?: Database["public"]["Enums"]["code_source"]
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          client_product_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          source?: Database["public"]["Enums"]["code_source"]
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
          brand: string | null
          client_code: string
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          status: string
        }
        Insert: {
          brand?: string | null
          client_code: string
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          status?: string
        }
        Update: {
          brand?: string | null
          client_code?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
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
      product_history: {
        Row: {
          brand_reference: string | null
          commercial_brand: string | null
          commercial_description: string | null
          created_at: string
          erp_brand: string | null
          erp_description: string | null
          id: string
          product_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          brand_reference?: string | null
          commercial_brand?: string | null
          commercial_description?: string | null
          created_at?: string
          erp_brand?: string | null
          erp_description?: string | null
          id?: string
          product_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          brand_reference?: string | null
          commercial_brand?: string | null
          commercial_description?: string | null
          created_at?: string
          erp_brand?: string | null
          erp_description?: string | null
          id?: string
          product_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          lines_archived: number | null
          lines_draft: number | null
          lines_excluded: number | null
          lines_expired: number | null
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
      _resolve_client_code: {
        Args: {
          p_agreement_id?: string
          p_brand?: string
          p_client_code: string
          p_client_id: string
          p_description: string
          p_product_id: string
          p_source: string
        }
        Returns: {
          client_product_id: string
          client_product_match_id: string
        }[]
      }
      _validate_client_codes: {
        Args: { p_agreement_id: string; p_codes: Json; p_position_id?: string }
        Returns: Json
      }
      archive_agreement_position: {
        Args: { p_position_id: string; p_reason: string }
        Returns: string
      }
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
      compute_position_pending_reason:
        | { Args: { p_position_id: string }; Returns: string }
        | {
            Args: {
              p_agreement_id: string
              p_end_date: string
              p_position_id: string
              p_product_id: string
              p_sale_price: number
              p_start_date: string
            }
            Returns: string
          }
      create_agreement_line: {
        Args: { p_agreement_id: string; p_payload: Json }
        Returns: Json
      }
      create_agreement_tx: {
        Args: {
          p_client_ids: string[]
          p_end_date: string
          p_group_id: string
          p_name: string
          p_observations: string
          p_scope: string
          p_start_date: string
          p_unit_name: string
        }
        Returns: string
      }
      delete_agreement_position: {
        Args: { p_position_id: string }
        Returns: undefined
      }
      exclude_agreement_position: {
        Args: { p_position_id: string; p_reason: string }
        Returns: undefined
      }
      get_agreement_group_participants: {
        Args: { p_group_id: string }
        Returns: {
          email: string
          erp_user_code: string
          full_name: string
          status: string
          user_id: string
        }[]
      }
      get_agreement_participants: {
        Args: { p_agreement_id: string }
        Returns: {
          email: string
          erp_user_code: string
          full_name: string
          status: string
          user_id: string
        }[]
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
      list_assignable_users_for_agreement: {
        Args: { p_agreement_id: string }
        Returns: {
          email: string
          full_name: string
          status: string
          user_id: string
        }[]
      }
      list_assignable_users_for_agreement_group: {
        Args: { p_group_id: string }
        Returns: {
          email: string
          full_name: string
          status: string
          user_id: string
        }[]
      }
      position_covers_today: {
        Args: { p_agr_end: string; p_pos_end: string; p_status: string }
        Returns: boolean
      }
      position_has_sku_conflict: {
        Args: { p_position_id: string }
        Returns: boolean
      }
      publish_positions: { Args: { p_position_ids: string[] }; Returns: Json }
      reactivate_agreement_position: {
        Args: { p_position_id: string; p_reason?: string }
        Returns: undefined
      }
      recalc_sku_conflict: {
        Args: { p_agreement_id: string; p_product_id: string }
        Returns: undefined
      }
      update_agreement_line: {
        Args: {
          p_confirm_n_conflict?: boolean
          p_line_id: string
          p_patch: Json
        }
        Returns: Json
      }
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
      code_source: "agreement" | "manual" | "quotation"
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
    Enums: {
      code_source: ["agreement", "manual", "quotation"],
    },
  },
} as const
