export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      app_permissions: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          permission_key: string;
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          permission_key: string;
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          permission_key?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      chapter_progress: {
        Row: {
          chapter_id: string;
          completed: boolean;
          completed_at: string | null;
          created_at: string;
          id: string;
          quiz_score: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          chapter_id: string;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          quiz_score?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          chapter_id?: string;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          quiz_score?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      config_entries: {
        Row: {
          country: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          key: string;
          label: string;
          language: string | null;
          notes: string | null;
          position: number;
          section: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          key: string;
          label: string;
          language?: string | null;
          notes?: string | null;
          position?: number;
          section: string;
          updated_at?: string;
          value?: Json;
        };
        Update: {
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          key?: string;
          label?: string;
          language?: string | null;
          notes?: string | null;
          position?: number;
          section?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      email_send_log: {
        Row: {
          created_at: string;
          error_message: string | null;
          id: string;
          message_id: string | null;
          metadata: Json | null;
          recipient_email: string;
          status: string;
          template_name: string;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          message_id?: string | null;
          metadata?: Json | null;
          recipient_email: string;
          status: string;
          template_name: string;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          message_id?: string | null;
          metadata?: Json | null;
          recipient_email?: string;
          status?: string;
          template_name?: string;
        };
        Relationships: [];
      };
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number;
          batch_size: number;
          id: number;
          retry_after_until: string | null;
          send_delay_ms: number;
          transactional_email_ttl_minutes: number;
          updated_at: string;
        };
        Insert: {
          auth_email_ttl_minutes?: number;
          batch_size?: number;
          id?: number;
          retry_after_until?: string | null;
          send_delay_ms?: number;
          transactional_email_ttl_minutes?: number;
          updated_at?: string;
        };
        Update: {
          auth_email_ttl_minutes?: number;
          batch_size?: number;
          id?: number;
          retry_after_until?: string | null;
          send_delay_ms?: number;
          transactional_email_ttl_minutes?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_unsubscribe_tokens: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          token: string;
          used_at: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          token: string;
          used_at?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          token?: string;
          used_at?: string | null;
        };
        Relationships: [];
      };
      faq_entries: {
        Row: {
          answer_md: string;
          audience: Database["public"]["Enums"]["faq_audience"];
          category: string | null;
          country: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          language: string;
          position: number;
          question: string;
          updated_at: string;
        };
        Insert: {
          answer_md: string;
          audience: Database["public"]["Enums"]["faq_audience"];
          category?: string | null;
          country?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          language?: string;
          position?: number;
          question: string;
          updated_at?: string;
        };
        Update: {
          answer_md?: string;
          audience?: Database["public"]["Enums"]["faq_audience"];
          category?: string | null;
          country?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          language?: string;
          position?: number;
          question?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fc_approval_log: {
        Row: {
          actor_id: string | null;
          comment: string | null;
          created_at: string;
          from_status: string | null;
          id: string;
          recipe_id: string;
          role: string | null;
          to_status: string;
          version_id: string | null;
        };
        Insert: {
          actor_id?: string | null;
          comment?: string | null;
          created_at?: string;
          from_status?: string | null;
          id?: string;
          recipe_id: string;
          role?: string | null;
          to_status: string;
          version_id?: string | null;
        };
        Update: {
          actor_id?: string | null;
          comment?: string | null;
          created_at?: string;
          from_status?: string | null;
          id?: string;
          recipe_id?: string;
          role?: string | null;
          to_status?: string;
          version_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fc_approval_log_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "fc_recipes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fc_approval_log_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "fc_recipe_version_cost";
            referencedColumns: ["version_id"];
          },
          {
            foreignKeyName: "fc_approval_log_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "fc_recipe_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      fc_brands: {
        Row: {
          active_in: boolean;
          active_us: boolean;
          brand_since: string | null;
          code: string;
          code_prefix: string | null;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          status: Database["public"]["Enums"]["fc_status"];
          updated_at: string;
        };
        Insert: {
          active_in?: boolean;
          active_us?: boolean;
          brand_since?: string | null;
          code: string;
          code_prefix?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          status?: Database["public"]["Enums"]["fc_status"];
          updated_at?: string;
        };
        Update: {
          active_in?: boolean;
          active_us?: boolean;
          brand_since?: string | null;
          code?: string;
          code_prefix?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          status?: Database["public"]["Enums"]["fc_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      fc_categories: {
        Row: {
          active_in: boolean;
          active_us: boolean;
          brand_id: string;
          colour_note: string | null;
          consistency_note: string | null;
          crc_recipe_id: string | null;
          created_at: string;
          description: string | null;
          hero_image_url: string | null;
          id: string;
          mrp_flat_inr: number;
          mrp_flat_usd: number;
          mrp_mode: string;
          mrp_multiplier_inr: number;
          mrp_multiplier_usd: number;
          name: string;
          packing_container_id: string | null;
          packing_container_id_in: string | null;
          packing_container_id_us: string | null;
          packing_image_url: string | null;
          ppp_flat_inr: number;
          ppp_flat_usd: number;
          ppp_mode: string;
          ppp_multiplier_inr: number;
          ppp_multiplier_usd: number;
          ptr_flat_inr: number;
          ptr_flat_usd: number;
          ptr_mode: string;
          ptr_multiplier_inr: number;
          ptr_multiplier_usd: number;
          serves_max: number | null;
          serves_min: number | null;
          status: Database["public"]["Enums"]["fc_status"];
          taste_note: string | null;
          updated_at: string;
          vcr_image_url: string | null;
          veg_slot_qty: number;
          veg_slot_unit_id: string | null;
          video_url: string | null;
        };
        Insert: {
          active_in?: boolean;
          active_us?: boolean;
          brand_id: string;
          colour_note?: string | null;
          consistency_note?: string | null;
          crc_recipe_id?: string | null;
          created_at?: string;
          description?: string | null;
          hero_image_url?: string | null;
          id?: string;
          mrp_flat_inr?: number;
          mrp_flat_usd?: number;
          mrp_mode?: string;
          mrp_multiplier_inr?: number;
          mrp_multiplier_usd?: number;
          name: string;
          packing_container_id?: string | null;
          packing_container_id_in?: string | null;
          packing_container_id_us?: string | null;
          packing_image_url?: string | null;
          ppp_flat_inr?: number;
          ppp_flat_usd?: number;
          ppp_mode?: string;
          ppp_multiplier_inr?: number;
          ppp_multiplier_usd?: number;
          ptr_flat_inr?: number;
          ptr_flat_usd?: number;
          ptr_mode?: string;
          ptr_multiplier_inr?: number;
          ptr_multiplier_usd?: number;
          serves_max?: number | null;
          serves_min?: number | null;
          status?: Database["public"]["Enums"]["fc_status"];
          taste_note?: string | null;
          updated_at?: string;
          vcr_image_url?: string | null;
          veg_slot_qty?: number;
          veg_slot_unit_id?: string | null;
          video_url?: string | null;
        };
        Update: {
          active_in?: boolean;
          active_us?: boolean;
          brand_id?: string;
          colour_note?: string | null;
          consistency_note?: string | null;
          crc_recipe_id?: string | null;
          created_at?: string;
          description?: string | null;
          hero_image_url?: string | null;
          id?: string;
          mrp_flat_inr?: number;
          mrp_flat_usd?: number;
          mrp_mode?: string;
          mrp_multiplier_inr?: number;
          mrp_multiplier_usd?: number;
          name?: string;
          packing_container_id?: string | null;
          packing_container_id_in?: string | null;
          packing_container_id_us?: string | null;
          packing_image_url?: string | null;
          ppp_flat_inr?: number;
          ppp_flat_usd?: number;
          ppp_mode?: string;
          ppp_multiplier_inr?: number;
          ppp_multiplier_usd?: number;
          ptr_flat_inr?: number;
          ptr_flat_usd?: number;
          ptr_mode?: string;
          ptr_multiplier_inr?: number;
          ptr_multiplier_usd?: number;
          serves_max?: number | null;
          serves_min?: number | null;
          status?: Database["public"]["Enums"]["fc_status"];
          taste_note?: string | null;
          updated_at?: string;
          vcr_image_url?: string | null;
          veg_slot_qty?: number;
          veg_slot_unit_id?: string | null;
          video_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fc_categories_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "fc_brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fc_categories_crc_recipe_id_fkey";
            columns: ["crc_recipe_id"];
            isOneToOne: false;
            referencedRelation: "fc_recipes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fc_categories_packing_container_id_fkey";
            columns: ["packing_container_id"];
            isOneToOne: false;
            referencedRelation: "fc_packing_containers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fc_categories_veg_slot_unit_id_fkey";
            columns: ["veg_slot_unit_id"];
            isOneToOne: false;
            referencedRelation: "fc_units";
            referencedColumns: ["id"];
          },
        ];
      };
      fc_ingredient_price_history: {
        Row: {
          changed_at: string;
          changed_by: string | null;
          currency: Database["public"]["Enums"]["fc_currency"];
          id: string;
          ingredient_id: string;
          new_price: number;
          old_price: number;
          reason: string | null;
        };
        Insert: {
          changed_at?: string;
          changed_by?: string | null;
          currency: Database["public"]["Enums"]["fc_currency"];
          id?: string;
          ingredient_id: string;
          new_price: number;
          old_price: number;
          reason?: string | null;
        };
        Update: {
          changed_at?: string;
          changed_by?: string | null;
          currency?: Database["public"]["Enums"]["fc_currency"];
          id?: string;
          ingredient_id?: string;
          new_price?: number;
          old_price?: number;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fc_ingredient_price_history_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "fc_ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      fc_ingredients: {
        Row: {
          active_in: boolean;
          active_us: boolean;
          base_unit_id: string;
          carbs_g_per_100: number;
          category: Database["public"]["Enums"]["fc_ingredient_category"];
          created_at: string;
          fat_g_per_100: number;
          fibre_g_per_100: number;
          id: string;
          is_animal_origin: boolean;
          is_dairy: boolean;
          kcal_per_100: number;
          last_updated_at: string;
          last_updated_by: string | null;
          manually_used: boolean;
          name: string;
          price_inr: number;
          price_usd: number;
          protein_g_per_100: number;
          status: Database["public"]["Enums"]["fc_status"];
          updated_at: string;
        };
        Insert: {
          active_in?: boolean;
          active_us?: boolean;
          base_unit_id: string;
          carbs_g_per_100?: number;
          category?: Database["public"]["Enums"]["fc_ingredient_category"];
          created_at?: string;
          fat_g_per_100?: number;
          fibre_g_per_100?: number;
          id?: string;
          is_animal_origin?: boolean;
          is_dairy?: boolean;
          kcal_per_100?: number;
          last_updated_at?: string;
          last_updated_by?: string | null;
          manually_used?: boolean;
          name: string;
          price_inr?: number;
          price_usd?: number;
          protein_g_per_100?: number;
          status?: Database["public"]["Enums"]["fc_status"];
          updated_at?: string;
        };
        Update: {
          active_in?: boolean;
          active_us?: boolean;
          base_unit_id?: string;
          carbs_g_per_100?: number;
          category?: Database["public"]["Enums"]["fc_ingredient_category"];
          created_at?: string;
          fat_g_per_100?: number;
          fibre_g_per_100?: number;
          id?: string;
          is_animal_origin?: boolean;
          is_dairy?: boolean;
          kcal_per_100?: number;
          last_updated_at?: string;
          last_updated_by?: string | null;
          manually_used?: boolean;
          name?: string;
          price_inr?: number;
          price_usd?: number;
          protein_g_per_100?: number;
          status?: Database["public"]["Enums"]["fc_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fc_ingredients_base_unit_id_fkey";
            columns: ["base_unit_id"];
            isOneToOne: false;
            referencedRelation: "fc_units";
            referencedColumns: ["id"];
          },
        ];
      };
      fc_packing_containers: {
        Row: {
          active_in: boolean;
          active_us: boolean;
          created_at: string;
          id: string;
          image_url: string | null;
          name: string;
          price_inr: number;
          price_usd: number;
          size_qty: number;
          size_unit_id: string | null;
          status: Database["public"]["Enums"]["fc_status"];
          updated_at: string;
        };
        Insert: {
          active_in?: boolean;
          active_us?: boolean;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          name: string;
          price_inr?: number;
          price_usd?: number;
          size_qty?: number;
          size_unit_id?: string | null;
          status?: Database["public"]["Enums"]["fc_status"];
          updated_at?: string;
        };
        Update: {
          active_in?: boolean;
          active_us?: boolean;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          name?: string;
          price_inr?: number;
          price_usd?: number;
          size_qty?: number;
          size_unit_id?: string | null;
          status?: Database["public"]["Enums"]["fc_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fc_packing_containers_size_unit_id_fkey";
            columns: ["size_unit_id"];
            isOneToOne: false;
            referencedRelation: "fc_units";
            referencedColumns: ["id"];
          },
        ];
      };
      fc_preps: {
        Row: {
          active_in: boolean;
          active_us: boolean;
          base_unit_id: string;
          brand_id: string | null;
          category_id: string | null;
          code: string;
          created_at: string;
          cuisine: string | null;
          currency_mode: Database["public"]["Enums"]["fc_currency_mode"];
          default_batch_size: number | null;
          default_wastage_pct: number;
          default_yield_qty: number | null;
          default_yield_unit_id: string | null;
          description: string | null;
          id: string;
          lump_weight_g: number | null;
          manually_used: boolean;
          name: string;
          preparation_notes: string | null;
          shelf_life_condition: string | null;
          shelf_life_days: number | null;
          status: Database["public"]["Enums"]["fc_status"];
          storage_notes: string | null;
          type: Database["public"]["Enums"]["fc_prep_type"];
          updated_at: string;
        };
        Insert: {
          active_in?: boolean;
          active_us?: boolean;
          base_unit_id: string;
          brand_id?: string | null;
          category_id?: string | null;
          code: string;
          created_at?: string;
          cuisine?: string | null;
          currency_mode?: Database["public"]["Enums"]["fc_currency_mode"];
          default_batch_size?: number | null;
          default_wastage_pct?: number;
          default_yield_qty?: number | null;
          default_yield_unit_id?: string | null;
          description?: string | null;
          id?: string;
          lump_weight_g?: number | null;
          manually_used?: boolean;
          name: string;
          preparation_notes?: string | null;
          shelf_life_condition?: string | null;
          shelf_life_days?: number | null;
          status?: Database["public"]["Enums"]["fc_status"];
          storage_notes?: string | null;
          type?: Database["public"]["Enums"]["fc_prep_type"];
          updated_at?: string;
        };
        Update: {
          active_in?: boolean;
          active_us?: boolean;
          base_unit_id?: string;
          brand_id?: string | null;
          category_id?: string | null;
          code?: string;
          created_at?: string;
          cuisine?: string | null;
          currency_mode?: Database["public"]["Enums"]["fc_currency_mode"];
          default_batch_size?: number | null;
          default_wastage_pct?: number;
          default_yield_qty?: number | null;
          default_yield_unit_id?: string | null;
          description?: string | null;
          id?: string;
          lump_weight_g?: number | null;
          manually_used?: boolean;
          name?: string;
          preparation_notes?: string | null;
          shelf_life_condition?: string | null;
          shelf_life_days?: number | null;
          status?: Database["public"]["Enums"]["fc_status"];
          storage_notes?: string | null;
          type?: Database["public"]["Enums"]["fc_prep_type"];
          updated_at?: string;
        };
        Relationships: [];
      };
      fc_price_list_items: {
        Row: {
          id: string;
          kind: string;
          meta: Json | null;
          mrp_price: number | null;
          name: string;
          packing_price: number | null;
          position: number;
          ppp_price: number | null;
          price_list_id: string;
          ref_id: string;
          total_price: number | null;
          unit_code: string | null;
          unit_price: number;
        };
        Insert: {
          id?: string;
          kind: string;
          meta?: Json | null;
          mrp_price?: number | null;
          name: string;
          packing_price?: number | null;
          position?: number;
          ppp_price?: number | null;
          price_list_id: string;
          ref_id: string;
          total_price?: number | null;
          unit_code?: string | null;
          unit_price?: number;
        };
        Update: {
          id?: string;
          kind?: string;
          meta?: Json | null;
          mrp_price?: number | null;
          name?: string;
          packing_price?: number | null;
          position?: number;
          ppp_price?: number | null;
          price_list_id?: string;
          ref_id?: string;
          total_price?: number | null;
          unit_code?: string | null;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "fc_price_list_items_price_list_id_fkey";
            columns: ["price_list_id"];
            isOneToOne: false;
            referencedRelation: "fc_price_lists";
            referencedColumns: ["id"];
          },
        ];
      };
      fc_price_list_log: {
        Row: {
          actor_id: string | null;
          comment: string | null;
          created_at: string;
          from_status: string | null;
          id: string;
          price_list_id: string;
          role: string | null;
          to_status: string;
        };
        Insert: {
          actor_id?: string | null;
          comment?: string | null;
          created_at?: string;
          from_status?: string | null;
          id?: string;
          price_list_id: string;
          role?: string | null;
          to_status: string;
        };
        Update: {
          actor_id?: string | null;
          comment?: string | null;
          created_at?: string;
          from_status?: string | null;
          id?: string;
          price_list_id?: string;
          role?: string | null;
          to_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fc_price_list_log_price_list_id_fkey";
            columns: ["price_list_id"];
            isOneToOne: false;
            referencedRelation: "fc_price_lists";
            referencedColumns: ["id"];
          },
        ];
      };
      fc_price_lists: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          currency: Database["public"]["Enums"]["fc_currency"];
          generated_at: string;
          generated_by: string | null;
          id: string;
          name: string;
          notes: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          submitted_at: string | null;
          submitted_by: string | null;
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          currency: Database["public"]["Enums"]["fc_currency"];
          generated_at?: string;
          generated_by?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          submitted_at?: string | null;
          submitted_by?: string | null;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          currency?: Database["public"]["Enums"]["fc_currency"];
          generated_at?: string;
          generated_by?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          submitted_at?: string | null;
          submitted_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      fc_products: {
        Row: {
          active_in: boolean;
          active_us: boolean;
          allergens: string[];
          available: boolean;
          brand_id: string;
          category_id: string;
          code: string;
          created_at: string;
          currency_mode: Database["public"]["Enums"]["fc_currency_mode"];
          description: string | null;
          id: string;
          image_url: string | null;
          menu_description: string | null;
          menu_position: number;
          name: string;
          serves_label: string | null;
          spice_level: number;
          status: Database["public"]["Enums"]["fc_status"];
          updated_at: string;
          veg_ingredient_ids: string[];
          veg_mode: Database["public"]["Enums"]["fc_veg_mode"];
          veg_qty_override: number | null;
        };
        Insert: {
          active_in?: boolean;
          active_us?: boolean;
          allergens?: string[];
          available?: boolean;
          brand_id: string;
          category_id: string;
          code: string;
          created_at?: string;
          currency_mode?: Database["public"]["Enums"]["fc_currency_mode"];
          description?: string | null;
          id?: string;
          image_url?: string | null;
          menu_description?: string | null;
          menu_position?: number;
          name: string;
          serves_label?: string | null;
          spice_level?: number;
          status?: Database["public"]["Enums"]["fc_status"];
          updated_at?: string;
          veg_ingredient_ids?: string[];
          veg_mode?: Database["public"]["Enums"]["fc_veg_mode"];
          veg_qty_override?: number | null;
        };
        Update: {
          active_in?: boolean;
          active_us?: boolean;
          allergens?: string[];
          available?: boolean;
          brand_id?: string;
          category_id?: string;
          code?: string;
          created_at?: string;
          currency_mode?: Database["public"]["Enums"]["fc_currency_mode"];
          description?: string | null;
          id?: string;
          image_url?: string | null;
          menu_description?: string | null;
          menu_position?: number;
          name?: string;
          serves_label?: string | null;
          spice_level?: number;
          status?: Database["public"]["Enums"]["fc_status"];
          updated_at?: string;
          veg_ingredient_ids?: string[];
          veg_mode?: Database["public"]["Enums"]["fc_veg_mode"];
          veg_qty_override?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "fc_products_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "fc_brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fc_products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "fc_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      fc_recipe_items: {
        Row: {
          created_at: string;
          id: string;
          ingredient_id: string | null;
          is_veg_slot: boolean;
          notes: string | null;
          position: number;
          prep_id: string | null;
          qty: number;
          unit_id: string;
          version_id: string;
          wastage_pct: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          ingredient_id?: string | null;
          is_veg_slot?: boolean;
          notes?: string | null;
          position?: number;
          prep_id?: string | null;
          qty: number;
          unit_id: string;
          version_id: string;
          wastage_pct?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          ingredient_id?: string | null;
          is_veg_slot?: boolean;
          notes?: string | null;
          position?: number;
          prep_id?: string | null;
          qty?: number;
          unit_id?: string;
          version_id?: string;
          wastage_pct?: number;
        };
        Relationships: [
          {
            foreignKeyName: "fc_recipe_items_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "fc_ingredients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fc_recipe_items_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "fc_units";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fc_recipe_items_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "fc_recipe_version_cost";
            referencedColumns: ["version_id"];
          },
          {
            foreignKeyName: "fc_recipe_items_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "fc_recipe_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      fc_recipe_versions: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          change_summary: string | null;
          created_at: string;
          currency: Database["public"]["Enums"]["fc_currency"];
          id: string;
          mrp_flat: number | null;
          mrp_mode: string | null;
          mrp_multiplier: number | null;
          notes: string | null;
          ppp_flat: number | null;
          ppp_mode: string | null;
          ppp_multiplier: number | null;
          recipe_id: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["fc_version_status"];
          submitted_at: string | null;
          submitted_by: string | null;
          updated_at: string;
          version_no: number;
          wastage_pct: number;
          yield_qty: number | null;
          yield_unit_id: string | null;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          change_summary?: string | null;
          created_at?: string;
          currency: Database["public"]["Enums"]["fc_currency"];
          id?: string;
          mrp_flat?: number | null;
          mrp_mode?: string | null;
          mrp_multiplier?: number | null;
          notes?: string | null;
          ppp_flat?: number | null;
          ppp_mode?: string | null;
          ppp_multiplier?: number | null;
          recipe_id: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["fc_version_status"];
          submitted_at?: string | null;
          submitted_by?: string | null;
          updated_at?: string;
          version_no: number;
          wastage_pct?: number;
          yield_qty?: number | null;
          yield_unit_id?: string | null;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          change_summary?: string | null;
          created_at?: string;
          currency?: Database["public"]["Enums"]["fc_currency"];
          id?: string;
          mrp_flat?: number | null;
          mrp_mode?: string | null;
          mrp_multiplier?: number | null;
          notes?: string | null;
          ppp_flat?: number | null;
          ppp_mode?: string | null;
          ppp_multiplier?: number | null;
          recipe_id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["fc_version_status"];
          submitted_at?: string | null;
          submitted_by?: string | null;
          updated_at?: string;
          version_no?: number;
          wastage_pct?: number;
          yield_qty?: number | null;
          yield_unit_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fc_recipe_versions_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "fc_recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      fc_recipes: {
        Row: {
          category_id: string | null;
          created_at: string;
          created_by: string | null;
          current_version_id: string | null;
          id: string;
          prep_id: string | null;
          product_id: string | null;
          status: Database["public"]["Enums"]["fc_recipe_status"];
          updated_at: string;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_version_id?: string | null;
          id?: string;
          prep_id?: string | null;
          product_id?: string | null;
          status?: Database["public"]["Enums"]["fc_recipe_status"];
          updated_at?: string;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_version_id?: string | null;
          id?: string;
          prep_id?: string | null;
          product_id?: string | null;
          status?: Database["public"]["Enums"]["fc_recipe_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fc_recipes_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "fc_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fc_recipes_current_version_fk";
            columns: ["current_version_id"];
            isOneToOne: false;
            referencedRelation: "fc_recipe_version_cost";
            referencedColumns: ["version_id"];
          },
          {
            foreignKeyName: "fc_recipes_current_version_fk";
            columns: ["current_version_id"];
            isOneToOne: false;
            referencedRelation: "fc_recipe_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fc_recipes_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: true;
            referencedRelation: "fc_products";
            referencedColumns: ["id"];
          },
        ];
      };
      fc_units: {
        Row: {
          code: string;
          id: string;
          kind: string;
          name: string;
        };
        Insert: {
          code: string;
          id?: string;
          kind: string;
          name: string;
        };
        Update: {
          code?: string;
          id?: string;
          kind?: string;
          name?: string;
        };
        Relationships: [];
      };
      kob_lead_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["kob_status"] | null;
          id: string;
          kind: string;
          lead_id: string;
          note: string | null;
          to_status: Database["public"]["Enums"]["kob_status"] | null;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["kob_status"] | null;
          id?: string;
          kind: string;
          lead_id: string;
          note?: string | null;
          to_status?: Database["public"]["Enums"]["kob_status"] | null;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["kob_status"] | null;
          id?: string;
          kind?: string;
          lead_id?: string;
          note?: string | null;
          to_status?: Database["public"]["Enums"]["kob_status"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "kob_lead_events_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "kob_leads";
            referencedColumns: ["id"];
          },
        ];
      };
      kob_leads: {
        Row: {
          assigned_executive_id: string | null;
          brand_interest: string | null;
          city: string | null;
          country: string | null;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          language: string | null;
          notes: string | null;
          partner_type: Database["public"]["Enums"]["partner_type"] | null;
          phone: string | null;
          pin_code: string | null;
          preferred_model: Database["public"]["Enums"]["business_model"] | null;
          source: Database["public"]["Enums"]["kob_source"];
          state: string | null;
          status: Database["public"]["Enums"]["kob_status"];
          updated_at: string;
        };
        Insert: {
          assigned_executive_id?: string | null;
          brand_interest?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          email?: string | null;
          full_name: string;
          id?: string;
          language?: string | null;
          notes?: string | null;
          partner_type?: Database["public"]["Enums"]["partner_type"] | null;
          phone?: string | null;
          pin_code?: string | null;
          preferred_model?:
            Database["public"]["Enums"]["business_model"] | null;
          source?: Database["public"]["Enums"]["kob_source"];
          state?: string | null;
          status?: Database["public"]["Enums"]["kob_status"];
          updated_at?: string;
        };
        Update: {
          assigned_executive_id?: string | null;
          brand_interest?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          language?: string | null;
          notes?: string | null;
          partner_type?: Database["public"]["Enums"]["partner_type"] | null;
          phone?: string | null;
          pin_code?: string | null;
          preferred_model?:
            Database["public"]["Enums"]["business_model"] | null;
          source?: Database["public"]["Enums"]["kob_source"];
          state?: string | null;
          status?: Database["public"]["Enums"]["kob_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      kob_webinar_attendance: {
        Row: {
          attended: boolean;
          attended_at: string | null;
          id: string;
          invited_at: string | null;
          lead_id: string;
          webinar_id: string;
        };
        Insert: {
          attended?: boolean;
          attended_at?: string | null;
          id?: string;
          invited_at?: string | null;
          lead_id: string;
          webinar_id: string;
        };
        Update: {
          attended?: boolean;
          attended_at?: string | null;
          id?: string;
          invited_at?: string | null;
          lead_id?: string;
          webinar_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kob_webinar_attendance_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "kob_leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "kob_webinar_attendance_webinar_id_fkey";
            columns: ["webinar_id"];
            isOneToOne: false;
            referencedRelation: "kob_webinars";
            referencedColumns: ["id"];
          },
        ];
      };
      kob_webinars: {
        Row: {
          created_at: string;
          host_id: string | null;
          id: string;
          language: string;
          meeting_url: string | null;
          recording_url: string | null;
          scheduled_at: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          host_id?: string | null;
          id?: string;
          language?: string;
          meeting_url?: string | null;
          recording_url?: string | null;
          scheduled_at: string;
          title: string;
        };
        Update: {
          created_at?: string;
          host_id?: string | null;
          id?: string;
          language?: string;
          meeting_url?: string | null;
          recording_url?: string | null;
          scheduled_at?: string;
          title?: string;
        };
        Relationships: [];
      };
      le_chapters: {
        Row: {
          course_id: string;
          created_at: string;
          duration_label: string | null;
          id: string;
          intro: string | null;
          position: number;
          subtitle: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          duration_label?: string | null;
          id?: string;
          intro?: string | null;
          position: number;
          subtitle?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          duration_label?: string | null;
          id?: string;
          intro?: string | null;
          position?: number;
          subtitle?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "le_chapters_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "le_courses";
            referencedColumns: ["id"];
          },
        ];
      };
      le_courses: {
        Row: {
          brand_tag: string | null;
          cover_image_url: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          language: string;
          slug: string;
          status: Database["public"]["Enums"]["le_course_status"];
          subtitle: string | null;
          summary: string | null;
          title: string;
          updated_at: string;
          vertical: Database["public"]["Enums"]["le_vertical"];
        };
        Insert: {
          brand_tag?: string | null;
          cover_image_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          language?: string;
          slug: string;
          status?: Database["public"]["Enums"]["le_course_status"];
          subtitle?: string | null;
          summary?: string | null;
          title: string;
          updated_at?: string;
          vertical?: Database["public"]["Enums"]["le_vertical"];
        };
        Update: {
          brand_tag?: string | null;
          cover_image_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          language?: string;
          slug?: string;
          status?: Database["public"]["Enums"]["le_course_status"];
          subtitle?: string | null;
          summary?: string | null;
          title?: string;
          updated_at?: string;
          vertical?: Database["public"]["Enums"]["le_vertical"];
        };
        Relationships: [];
      };
      le_enrollments: {
        Row: {
          course_id: string;
          enrolled_at: string;
          id: string;
          status: string;
          user_id: string;
        };
        Insert: {
          course_id: string;
          enrolled_at?: string;
          id?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          course_id?: string;
          enrolled_at?: string;
          id?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "le_enrollments_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "le_courses";
            referencedColumns: ["id"];
          },
        ];
      };
      le_lesson_progress: {
        Row: {
          completed: boolean;
          completed_at: string | null;
          id: string;
          lesson_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed?: boolean;
          completed_at?: string | null;
          id?: string;
          lesson_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed?: boolean;
          completed_at?: string | null;
          id?: string;
          lesson_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "le_lesson_progress_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "le_lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      le_lesson_sections: {
        Row: {
          body_md: string | null;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["le_section_kind"];
          lesson_id: string;
          media_url: string | null;
          meta: Json | null;
          position: number;
          title: string | null;
        };
        Insert: {
          body_md?: string | null;
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["le_section_kind"];
          lesson_id: string;
          media_url?: string | null;
          meta?: Json | null;
          position: number;
          title?: string | null;
        };
        Update: {
          body_md?: string | null;
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["le_section_kind"];
          lesson_id?: string;
          media_url?: string | null;
          meta?: Json | null;
          position?: number;
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "le_lesson_sections_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "le_lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      le_lessons: {
        Row: {
          audio_url: string | null;
          body_md: string | null;
          chapter_id: string;
          created_at: string;
          estimated_minutes: number | null;
          graphic_url: string | null;
          id: string;
          image_url: string | null;
          language: string;
          mandatory: boolean;
          pass_requirement: number | null;
          position: number;
          screenshot_url: string | null;
          short_desc: string | null;
          sop_md: string | null;
          title: string;
          updated_at: string;
          video_url: string | null;
        };
        Insert: {
          audio_url?: string | null;
          body_md?: string | null;
          chapter_id: string;
          created_at?: string;
          estimated_minutes?: number | null;
          graphic_url?: string | null;
          id?: string;
          image_url?: string | null;
          language?: string;
          mandatory?: boolean;
          pass_requirement?: number | null;
          position: number;
          screenshot_url?: string | null;
          short_desc?: string | null;
          sop_md?: string | null;
          title: string;
          updated_at?: string;
          video_url?: string | null;
        };
        Update: {
          audio_url?: string | null;
          body_md?: string | null;
          chapter_id?: string;
          created_at?: string;
          estimated_minutes?: number | null;
          graphic_url?: string | null;
          id?: string;
          image_url?: string | null;
          language?: string;
          mandatory?: boolean;
          pass_requirement?: number | null;
          position?: number;
          screenshot_url?: string | null;
          short_desc?: string | null;
          sop_md?: string | null;
          title?: string;
          updated_at?: string;
          video_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "le_lessons_chapter_id_fkey";
            columns: ["chapter_id"];
            isOneToOne: false;
            referencedRelation: "le_chapters";
            referencedColumns: ["id"];
          },
        ];
      };
      le_path_assignments: {
        Row: {
          created_at: string;
          id: string;
          path_id: string;
          scope_node_id: string | null;
          scope_role: Database["public"]["Enums"]["app_role"] | null;
          scope_type: Database["public"]["Enums"]["le_scope_type"];
          scope_user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          path_id: string;
          scope_node_id?: string | null;
          scope_role?: Database["public"]["Enums"]["app_role"] | null;
          scope_type: Database["public"]["Enums"]["le_scope_type"];
          scope_user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          path_id?: string;
          scope_node_id?: string | null;
          scope_role?: Database["public"]["Enums"]["app_role"] | null;
          scope_type?: Database["public"]["Enums"]["le_scope_type"];
          scope_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "le_path_assignments_path_id_fkey";
            columns: ["path_id"];
            isOneToOne: false;
            referencedRelation: "le_training_paths";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "le_path_assignments_scope_node_id_fkey";
            columns: ["scope_node_id"];
            isOneToOne: false;
            referencedRelation: "le_taxonomy_node";
            referencedColumns: ["id"];
          },
        ];
      };
      le_path_courses: {
        Row: {
          course_id: string;
          id: string;
          path_id: string;
          position: number;
        };
        Insert: {
          course_id: string;
          id?: string;
          path_id: string;
          position: number;
        };
        Update: {
          course_id?: string;
          id?: string;
          path_id?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "le_path_courses_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "le_courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "le_path_courses_path_id_fkey";
            columns: ["path_id"];
            isOneToOne: false;
            referencedRelation: "le_training_paths";
            referencedColumns: ["id"];
          },
        ];
      };
      le_practical_evaluations: {
        Row: {
          evaluated_at: string;
          evaluator_id: string | null;
          id: string;
          max_score: number;
          notes: string | null;
          passed: boolean;
          path_id: string;
          score: number;
          user_id: string;
        };
        Insert: {
          evaluated_at?: string;
          evaluator_id?: string | null;
          id?: string;
          max_score?: number;
          notes?: string | null;
          passed?: boolean;
          path_id: string;
          score: number;
          user_id: string;
        };
        Update: {
          evaluated_at?: string;
          evaluator_id?: string | null;
          id?: string;
          max_score?: number;
          notes?: string | null;
          passed?: boolean;
          path_id?: string;
          score?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "le_practical_evaluations_path_id_fkey";
            columns: ["path_id"];
            isOneToOne: false;
            referencedRelation: "le_training_paths";
            referencedColumns: ["id"];
          },
        ];
      };
      le_question_options: {
        Row: {
          id: string;
          is_correct: boolean;
          label: string;
          position: number;
          question_id: string;
        };
        Insert: {
          id?: string;
          is_correct?: boolean;
          label: string;
          position: number;
          question_id: string;
        };
        Update: {
          id?: string;
          is_correct?: boolean;
          label?: string;
          position?: number;
          question_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "le_question_options_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "le_questions";
            referencedColumns: ["id"];
          },
        ];
      };
      le_questions: {
        Row: {
          blocks_progress: boolean;
          chapter_id: string | null;
          created_at: string;
          explanation: string | null;
          id: string;
          image_url: string | null;
          is_checkpoint: boolean;
          kind: Database["public"]["Enums"]["le_question_kind"];
          lesson_id: string | null;
          position: number;
          prompt: string;
        };
        Insert: {
          blocks_progress?: boolean;
          chapter_id?: string | null;
          created_at?: string;
          explanation?: string | null;
          id?: string;
          image_url?: string | null;
          is_checkpoint?: boolean;
          kind?: Database["public"]["Enums"]["le_question_kind"];
          lesson_id?: string | null;
          position?: number;
          prompt: string;
        };
        Update: {
          blocks_progress?: boolean;
          chapter_id?: string | null;
          created_at?: string;
          explanation?: string | null;
          id?: string;
          image_url?: string | null;
          is_checkpoint?: boolean;
          kind?: Database["public"]["Enums"]["le_question_kind"];
          lesson_id?: string | null;
          position?: number;
          prompt?: string;
        };
        Relationships: [
          {
            foreignKeyName: "le_questions_chapter_id_fkey";
            columns: ["chapter_id"];
            isOneToOne: false;
            referencedRelation: "le_chapters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "le_questions_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "le_lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      le_quiz_attempts: {
        Row: {
          attempted_at: string;
          chapter_id: string;
          id: string;
          max_score: number;
          passed: boolean;
          score: number;
          user_id: string;
        };
        Insert: {
          attempted_at?: string;
          chapter_id: string;
          id?: string;
          max_score: number;
          passed?: boolean;
          score: number;
          user_id: string;
        };
        Update: {
          attempted_at?: string;
          chapter_id?: string;
          id?: string;
          max_score?: number;
          passed?: boolean;
          score?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "le_quiz_attempts_chapter_id_fkey";
            columns: ["chapter_id"];
            isOneToOne: false;
            referencedRelation: "le_chapters";
            referencedColumns: ["id"];
          },
        ];
      };
      le_taxonomy_node: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          label: string;
          parent_id: string | null;
          type: Database["public"]["Enums"]["le_taxonomy_type"];
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          label: string;
          parent_id?: string | null;
          type: Database["public"]["Enums"]["le_taxonomy_type"];
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          label?: string;
          parent_id?: string | null;
          type?: Database["public"]["Enums"]["le_taxonomy_type"];
        };
        Relationships: [
          {
            foreignKeyName: "le_taxonomy_node_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "le_taxonomy_node";
            referencedColumns: ["id"];
          },
        ];
      };
      le_trainer_certifications: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          id: string;
          notes: string | null;
          path_id: string;
          practical_score: number | null;
          quiz_score: number | null;
          status: Database["public"]["Enums"]["le_cert_status"];
          updated_at: string;
          user_id: string;
          valid_until: string | null;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          path_id: string;
          practical_score?: number | null;
          quiz_score?: number | null;
          status?: Database["public"]["Enums"]["le_cert_status"];
          updated_at?: string;
          user_id: string;
          valid_until?: string | null;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          path_id?: string;
          practical_score?: number | null;
          quiz_score?: number | null;
          status?: Database["public"]["Enums"]["le_cert_status"];
          updated_at?: string;
          user_id?: string;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "le_trainer_certifications_path_id_fkey";
            columns: ["path_id"];
            isOneToOne: false;
            referencedRelation: "le_training_paths";
            referencedColumns: ["id"];
          },
        ];
      };
      le_trainer_feedback: {
        Row: {
          by_user_id: string | null;
          comment: string | null;
          created_at: string;
          id: string;
          rating: number;
          session_id: string | null;
          trainer_id: string;
        };
        Insert: {
          by_user_id?: string | null;
          comment?: string | null;
          created_at?: string;
          id?: string;
          rating: number;
          session_id?: string | null;
          trainer_id: string;
        };
        Update: {
          by_user_id?: string | null;
          comment?: string | null;
          created_at?: string;
          id?: string;
          rating?: number;
          session_id?: string | null;
          trainer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "le_trainer_feedback_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "le_trainer_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      le_trainer_sessions: {
        Row: {
          conducted_at: string;
          id: string;
          location: string | null;
          notes: string | null;
          path_id: string | null;
          trainee_count: number;
          trainer_id: string;
        };
        Insert: {
          conducted_at?: string;
          id?: string;
          location?: string | null;
          notes?: string | null;
          path_id?: string | null;
          trainee_count?: number;
          trainer_id: string;
        };
        Update: {
          conducted_at?: string;
          id?: string;
          location?: string | null;
          notes?: string | null;
          path_id?: string | null;
          trainee_count?: number;
          trainer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "le_trainer_sessions_path_id_fkey";
            columns: ["path_id"];
            isOneToOne: false;
            referencedRelation: "le_training_paths";
            referencedColumns: ["id"];
          },
        ];
      };
      le_training_paths: {
        Row: {
          brand_id: string | null;
          certification_valid_days: number | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          language_id: string | null;
          level_id: string | null;
          pass_threshold: number;
          slug: string;
          status: Database["public"]["Enums"]["le_course_status"];
          title: string;
          trainer_type_id: string | null;
          updated_at: string;
          vertical_id: string | null;
        };
        Insert: {
          brand_id?: string | null;
          certification_valid_days?: number | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          language_id?: string | null;
          level_id?: string | null;
          pass_threshold?: number;
          slug: string;
          status?: Database["public"]["Enums"]["le_course_status"];
          title: string;
          trainer_type_id?: string | null;
          updated_at?: string;
          vertical_id?: string | null;
        };
        Update: {
          brand_id?: string | null;
          certification_valid_days?: number | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          language_id?: string | null;
          level_id?: string | null;
          pass_threshold?: number;
          slug?: string;
          status?: Database["public"]["Enums"]["le_course_status"];
          title?: string;
          trainer_type_id?: string | null;
          updated_at?: string;
          vertical_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "le_training_paths_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "le_taxonomy_node";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "le_training_paths_language_id_fkey";
            columns: ["language_id"];
            isOneToOne: false;
            referencedRelation: "le_taxonomy_node";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "le_training_paths_level_id_fkey";
            columns: ["level_id"];
            isOneToOne: false;
            referencedRelation: "le_taxonomy_node";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "le_training_paths_trainer_type_id_fkey";
            columns: ["trainer_type_id"];
            isOneToOne: false;
            referencedRelation: "le_taxonomy_node";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "le_training_paths_vertical_id_fkey";
            columns: ["vertical_id"];
            isOneToOne: false;
            referencedRelation: "le_taxonomy_node";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_certificates: {
        Row: {
          code: string;
          course_id: string;
          created_at: string;
          file_path: string | null;
          id: string;
          issued_at: string;
          user_id: string;
        };
        Insert: {
          code: string;
          course_id: string;
          created_at?: string;
          file_path?: string | null;
          id?: string;
          issued_at?: string;
          user_id: string;
        };
        Update: {
          code?: string;
          course_id?: string;
          created_at?: string;
          file_path?: string | null;
          id?: string;
          issued_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lp_certificates_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "lp_courses";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_course_days: {
        Row: {
          course_id: string;
          created_at: string;
          day_no: number;
          id: string;
          sort_order: number;
          summary: string | null;
          title: string;
          unlock_after_days: number;
          updated_at: string;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          day_no: number;
          id?: string;
          sort_order?: number;
          summary?: string | null;
          title?: string;
          unlock_after_days?: number;
          updated_at?: string;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          day_no?: number;
          id?: string;
          sort_order?: number;
          summary?: string | null;
          title?: string;
          unlock_after_days?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lp_course_days_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "lp_courses";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_courses: {
        Row: {
          certificate_template: Json;
          cover_url: string | null;
          created_at: string;
          day5_gate_days: number;
          duration_label: string | null;
          id: string;
          inspection_rubric: Json;
          issues_certificate: boolean;
          journey_steps: Json;
          max_attempts: number | null;
          pass_pct: number;
          product_brief: Json;
          program_id: string;
          published: boolean;
          requires_inspection: boolean;
          requires_product_upload: boolean;
          resource_categories: string[];
          section_order: Json;
          slug: string;
          sort_order: number;
          summary: string | null;
          supported_languages: string[];
          title: string;
          updated_at: string;
          video_categories: string[];
          welcome_letter: Json;
        };
        Insert: {
          certificate_template?: Json;
          cover_url?: string | null;
          created_at?: string;
          day5_gate_days?: number;
          duration_label?: string | null;
          id?: string;
          inspection_rubric?: Json;
          issues_certificate?: boolean;
          journey_steps?: Json;
          max_attempts?: number | null;
          pass_pct?: number;
          product_brief?: Json;
          program_id: string;
          published?: boolean;
          requires_inspection?: boolean;
          requires_product_upload?: boolean;
          resource_categories?: string[];
          section_order?: Json;
          slug: string;
          sort_order?: number;
          summary?: string | null;
          supported_languages?: string[];
          title: string;
          updated_at?: string;
          video_categories?: string[];
          welcome_letter?: Json;
        };
        Update: {
          certificate_template?: Json;
          cover_url?: string | null;
          created_at?: string;
          day5_gate_days?: number;
          duration_label?: string | null;
          id?: string;
          inspection_rubric?: Json;
          issues_certificate?: boolean;
          journey_steps?: Json;
          max_attempts?: number | null;
          pass_pct?: number;
          product_brief?: Json;
          program_id?: string;
          published?: boolean;
          requires_inspection?: boolean;
          requires_product_upload?: boolean;
          resource_categories?: string[];
          section_order?: Json;
          slug?: string;
          sort_order?: number;
          summary?: string | null;
          supported_languages?: string[];
          title?: string;
          updated_at?: string;
          video_categories?: string[];
          welcome_letter?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "lp_courses_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "lp_programs";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_cuisines: {
        Row: {
          active: boolean;
          course_id: string;
          created_at: string;
          id: string;
          name: string;
          show_count: number;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          course_id: string;
          created_at?: string;
          id?: string;
          name: string;
          show_count?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          course_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          show_count?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lp_cuisines_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "lp_courses";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_enrolments: {
        Row: {
          completed_at: string | null;
          course_id: string;
          created_at: string;
          enrolled_at: string;
          id: string;
          status: Database["public"]["Enums"]["lp_enrolment_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          course_id: string;
          created_at?: string;
          enrolled_at?: string;
          id?: string;
          status?: Database["public"]["Enums"]["lp_enrolment_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          course_id?: string;
          created_at?: string;
          enrolled_at?: string;
          id?: string;
          status?: Database["public"]["Enums"]["lp_enrolment_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lp_enrolments_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "lp_courses";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_inspection_bookings: {
        Row: {
          booked_at: string;
          created_at: string;
          id: string;
          remarks: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          rubric: Json;
          slot_id: string;
          status: Database["public"]["Enums"]["lp_booking_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          booked_at?: string;
          created_at?: string;
          id?: string;
          remarks?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          rubric?: Json;
          slot_id: string;
          status?: Database["public"]["Enums"]["lp_booking_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          booked_at?: string;
          created_at?: string;
          id?: string;
          remarks?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          rubric?: Json;
          slot_id?: string;
          status?: Database["public"]["Enums"]["lp_booking_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lp_inspection_bookings_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "lp_inspection_slots";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_inspection_slots: {
        Row: {
          capacity: number;
          course_id: string;
          created_at: string;
          ends_at: string;
          id: string;
          location: string | null;
          notes: string | null;
          starts_at: string;
          trainer_id: string | null;
          updated_at: string;
        };
        Insert: {
          capacity?: number;
          course_id: string;
          created_at?: string;
          ends_at: string;
          id?: string;
          location?: string | null;
          notes?: string | null;
          starts_at: string;
          trainer_id?: string | null;
          updated_at?: string;
        };
        Update: {
          capacity?: number;
          course_id?: string;
          created_at?: string;
          ends_at?: string;
          id?: string;
          location?: string | null;
          notes?: string | null;
          starts_at?: string;
          trainer_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lp_inspection_slots_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "lp_courses";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_module_progress: {
        Row: {
          completed_at: string | null;
          created_at: string;
          id: string;
          module_id: string;
          progress_pct: number;
          started_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          module_id: string;
          progress_pct?: number;
          started_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          module_id?: string;
          progress_pct?: number;
          started_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lp_module_progress_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: false;
            referencedRelation: "lp_modules";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_module_quiz_attempts: {
        Row: {
          answers: Json;
          attempt_no: number;
          created_at: string;
          id: string;
          module_id: string;
          passed: boolean | null;
          placement: string;
          question_ids: Json;
          score_pct: number | null;
          user_id: string;
        };
        Insert: {
          answers?: Json;
          attempt_no: number;
          created_at?: string;
          id?: string;
          module_id: string;
          passed?: boolean | null;
          placement?: string;
          question_ids?: Json;
          score_pct?: number | null;
          user_id: string;
        };
        Update: {
          answers?: Json;
          attempt_no?: number;
          created_at?: string;
          id?: string;
          module_id?: string;
          passed?: boolean | null;
          placement?: string;
          question_ids?: Json;
          score_pct?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lp_module_quiz_attempts_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: false;
            referencedRelation: "lp_modules";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_modules: {
        Row: {
          autoplay_advance: boolean | null;
          course_id: string;
          created_at: string;
          day_id: string | null;
          deck_id: string | null;
          default_slide_seconds: number | null;
          est_minutes: number | null;
          id: string;
          language: string | null;
          published: boolean;
          quiz_enabled: boolean;
          quiz_pass_pct: number | null;
          quiz_placement: string;
          quiz_questions: Json;
          reading_md: string | null;
          slide_overrides: Json;
          sort_order: number;
          speed: number | null;
          summary: string | null;
          title: string;
          type: Database["public"]["Enums"]["lp_module_type"];
          updated_at: string;
          video_url: string | null;
          voice: string | null;
        };
        Insert: {
          autoplay_advance?: boolean | null;
          course_id: string;
          created_at?: string;
          day_id?: string | null;
          deck_id?: string | null;
          default_slide_seconds?: number | null;
          est_minutes?: number | null;
          id?: string;
          language?: string | null;
          published?: boolean;
          quiz_enabled?: boolean;
          quiz_pass_pct?: number | null;
          quiz_placement?: string;
          quiz_questions?: Json;
          reading_md?: string | null;
          slide_overrides?: Json;
          sort_order?: number;
          speed?: number | null;
          summary?: string | null;
          title: string;
          type: Database["public"]["Enums"]["lp_module_type"];
          updated_at?: string;
          video_url?: string | null;
          voice?: string | null;
        };
        Update: {
          autoplay_advance?: boolean | null;
          course_id?: string;
          created_at?: string;
          day_id?: string | null;
          deck_id?: string | null;
          default_slide_seconds?: number | null;
          est_minutes?: number | null;
          id?: string;
          language?: string | null;
          published?: boolean;
          quiz_enabled?: boolean;
          quiz_pass_pct?: number | null;
          quiz_placement?: string;
          quiz_questions?: Json;
          reading_md?: string | null;
          slide_overrides?: Json;
          sort_order?: number;
          speed?: number | null;
          summary?: string | null;
          title?: string;
          type?: Database["public"]["Enums"]["lp_module_type"];
          updated_at?: string;
          video_url?: string | null;
          voice?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lp_modules_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "lp_courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lp_modules_day_id_fkey";
            columns: ["day_id"];
            isOneToOne: false;
            referencedRelation: "lp_course_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lp_modules_deck_id_fkey";
            columns: ["deck_id"];
            isOneToOne: false;
            referencedRelation: "sft_deck_setup";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_partner_events: {
        Row: {
          course_id: string;
          created_at: string;
          event_type: string;
          id: string;
          invite_id: string | null;
          payload: Json;
          user_id: string | null;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          event_type: string;
          id?: string;
          invite_id?: string | null;
          payload?: Json;
          user_id?: string | null;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          invite_id?: string | null;
          payload?: Json;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lp_partner_events_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "lp_courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lp_partner_events_invite_id_fkey";
            columns: ["invite_id"];
            isOneToOne: false;
            referencedRelation: "lp_partner_invites";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_partner_invites: {
        Row: {
          accepted_at: string | null;
          course_id: string;
          created_at: string;
          id: string;
          invited_by: string | null;
          kitchen_location: string | null;
          message: string | null;
          opened_at: string | null;
          recipient_email: string;
          recipient_name: string;
          revoked_at: string | null;
          sent_at: string;
          status: string;
          token: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          accepted_at?: string | null;
          course_id: string;
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          kitchen_location?: string | null;
          message?: string | null;
          opened_at?: string | null;
          recipient_email: string;
          recipient_name: string;
          revoked_at?: string | null;
          sent_at?: string;
          status?: string;
          token?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          course_id?: string;
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          kitchen_location?: string | null;
          message?: string | null;
          opened_at?: string | null;
          recipient_email?: string;
          recipient_name?: string;
          revoked_at?: string | null;
          sent_at?: string;
          status?: string;
          token?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lp_partner_invites_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "lp_courses";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_physical_visit_history: {
        Row: {
          attempt_no: number;
          comments: string | null;
          created_at: string;
          decision: string | null;
          id: string;
          photos: Json;
          submitted_at: string | null;
          visit_id: string;
          visitor_email: string | null;
          visitor_name: string | null;
        };
        Insert: {
          attempt_no: number;
          comments?: string | null;
          created_at?: string;
          decision?: string | null;
          id?: string;
          photos?: Json;
          submitted_at?: string | null;
          visit_id: string;
          visitor_email?: string | null;
          visitor_name?: string | null;
        };
        Update: {
          attempt_no?: number;
          comments?: string | null;
          created_at?: string;
          decision?: string | null;
          id?: string;
          photos?: Json;
          submitted_at?: string | null;
          visit_id?: string;
          visitor_email?: string | null;
          visitor_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lp_physical_visit_history_visit_id_fkey";
            columns: ["visit_id"];
            isOneToOne: false;
            referencedRelation: "lp_physical_visits";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_physical_visit_photos: {
        Row: {
          caption: string | null;
          id: string;
          image_path: string;
          uploaded_at: string;
          uploaded_by: string | null;
          visit_id: string;
        };
        Insert: {
          caption?: string | null;
          id?: string;
          image_path: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
          visit_id: string;
        };
        Update: {
          caption?: string | null;
          id?: string;
          image_path?: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
          visit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lp_physical_visit_photos_visit_id_fkey";
            columns: ["visit_id"];
            isOneToOne: false;
            referencedRelation: "lp_physical_visits";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_physical_visit_tokens: {
        Row: {
          created_at: string;
          expires_at: string | null;
          id: string;
          token: string;
          visit_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          token: string;
          visit_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          token?: string;
          visit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lp_physical_visit_tokens_visit_id_fkey";
            columns: ["visit_id"];
            isOneToOne: true;
            referencedRelation: "lp_physical_visits";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_physical_visits: {
        Row: {
          assigned_at: string | null;
          assigned_by: string | null;
          attempt_no: number;
          course_id: string;
          created_at: string;
          cuisine_id: string | null;
          decision_comments: string | null;
          email_status: Database["public"]["Enums"]["lp_email_status"];
          final_decision:
            Database["public"]["Enums"]["lp_final_decision"] | null;
          form_photo_url: string | null;
          form_status: Database["public"]["Enums"]["lp_form_status"];
          form_submitted_at: string | null;
          google_form_url: string | null;
          hygiene_rating: number | null;
          id: string;
          last_email_kind: string | null;
          partner_address: string | null;
          partner_country: string | null;
          partner_email_sent_at: string | null;
          partner_location: string | null;
          partner_phone: string | null;
          partner_state: string | null;
          presentation_rating: number | null;
          recipe_id: string | null;
          remarks: string | null;
          status: Database["public"]["Enums"]["lp_visit_status"];
          submission_id: string | null;
          submitted_at: string | null;
          taste_rating: number | null;
          time_food_cooked: string | null;
          updated_at: string;
          user_id: string;
          visit_date: string | null;
          visit_time: string | null;
          visitor_comments: string | null;
          visitor_email: string | null;
          visitor_email_sent_at: string | null;
          visitor_name: string | null;
          visitor_phone: string | null;
        };
        Insert: {
          assigned_at?: string | null;
          assigned_by?: string | null;
          attempt_no?: number;
          course_id: string;
          created_at?: string;
          cuisine_id?: string | null;
          decision_comments?: string | null;
          email_status?: Database["public"]["Enums"]["lp_email_status"];
          final_decision?:
            Database["public"]["Enums"]["lp_final_decision"] | null;
          form_photo_url?: string | null;
          form_status?: Database["public"]["Enums"]["lp_form_status"];
          form_submitted_at?: string | null;
          google_form_url?: string | null;
          hygiene_rating?: number | null;
          id?: string;
          last_email_kind?: string | null;
          partner_address?: string | null;
          partner_country?: string | null;
          partner_email_sent_at?: string | null;
          partner_location?: string | null;
          partner_phone?: string | null;
          partner_state?: string | null;
          presentation_rating?: number | null;
          recipe_id?: string | null;
          remarks?: string | null;
          status?: Database["public"]["Enums"]["lp_visit_status"];
          submission_id?: string | null;
          submitted_at?: string | null;
          taste_rating?: number | null;
          time_food_cooked?: string | null;
          updated_at?: string;
          user_id: string;
          visit_date?: string | null;
          visit_time?: string | null;
          visitor_comments?: string | null;
          visitor_email?: string | null;
          visitor_email_sent_at?: string | null;
          visitor_name?: string | null;
          visitor_phone?: string | null;
        };
        Update: {
          assigned_at?: string | null;
          assigned_by?: string | null;
          attempt_no?: number;
          course_id?: string;
          created_at?: string;
          cuisine_id?: string | null;
          decision_comments?: string | null;
          email_status?: Database["public"]["Enums"]["lp_email_status"];
          final_decision?:
            Database["public"]["Enums"]["lp_final_decision"] | null;
          form_photo_url?: string | null;
          form_status?: Database["public"]["Enums"]["lp_form_status"];
          form_submitted_at?: string | null;
          google_form_url?: string | null;
          hygiene_rating?: number | null;
          id?: string;
          last_email_kind?: string | null;
          partner_address?: string | null;
          partner_country?: string | null;
          partner_email_sent_at?: string | null;
          partner_location?: string | null;
          partner_phone?: string | null;
          partner_state?: string | null;
          presentation_rating?: number | null;
          recipe_id?: string | null;
          remarks?: string | null;
          status?: Database["public"]["Enums"]["lp_visit_status"];
          submission_id?: string | null;
          submitted_at?: string | null;
          taste_rating?: number | null;
          time_food_cooked?: string | null;
          updated_at?: string;
          user_id?: string;
          visit_date?: string | null;
          visit_time?: string | null;
          visitor_comments?: string | null;
          visitor_email?: string | null;
          visitor_email_sent_at?: string | null;
          visitor_name?: string | null;
          visitor_phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lp_physical_visits_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "lp_courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lp_physical_visits_cuisine_id_fkey";
            columns: ["cuisine_id"];
            isOneToOne: false;
            referencedRelation: "lp_cuisines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lp_physical_visits_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "lp_recipes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lp_physical_visits_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: true;
            referencedRelation: "lp_product_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_product_assignments: {
        Row: {
          assigned_at: string;
          course_id: string;
          cuisine_id: string;
          id: string;
          recipe_id: string;
          user_id: string;
        };
        Insert: {
          assigned_at?: string;
          course_id: string;
          cuisine_id: string;
          id?: string;
          recipe_id: string;
          user_id: string;
        };
        Update: {
          assigned_at?: string;
          course_id?: string;
          cuisine_id?: string;
          id?: string;
          recipe_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lp_product_assignments_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "lp_courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lp_product_assignments_cuisine_id_fkey";
            columns: ["cuisine_id"];
            isOneToOne: false;
            referencedRelation: "lp_cuisines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lp_product_assignments_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "lp_recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_product_submissions: {
        Row: {
          course_id: string;
          created_at: string;
          feedback: string | null;
          files: Json;
          id: string;
          notes: string | null;
          recipe_id: string | null;
          reviewed_at: string | null;
          reviewer_id: string | null;
          status: Database["public"]["Enums"]["lp_submission_status"];
          submitted_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          feedback?: string | null;
          files?: Json;
          id?: string;
          notes?: string | null;
          recipe_id?: string | null;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          status?: Database["public"]["Enums"]["lp_submission_status"];
          submitted_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          feedback?: string | null;
          files?: Json;
          id?: string;
          notes?: string | null;
          recipe_id?: string | null;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          status?: Database["public"]["Enums"]["lp_submission_status"];
          submitted_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lp_product_submissions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "lp_courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lp_product_submissions_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "lp_recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_product_uploads: {
        Row: {
          admin_comment: string | null;
          approved_at: string | null;
          assignment_id: string;
          course_id: string;
          created_at: string;
          cuisine_id: string;
          id: string;
          image_path: string;
          notes: string | null;
          recipe_id: string;
          reviewed_at: string | null;
          reviewer_id: string | null;
          status: string;
          submitted_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          admin_comment?: string | null;
          approved_at?: string | null;
          assignment_id: string;
          course_id: string;
          created_at?: string;
          cuisine_id: string;
          id?: string;
          image_path: string;
          notes?: string | null;
          recipe_id: string;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          status?: string;
          submitted_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          admin_comment?: string | null;
          approved_at?: string | null;
          assignment_id?: string;
          course_id?: string;
          created_at?: string;
          cuisine_id?: string;
          id?: string;
          image_path?: string;
          notes?: string | null;
          recipe_id?: string;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          status?: string;
          submitted_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lp_product_uploads_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "lp_product_assignments";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_programs: {
        Row: {
          cover_url: string | null;
          created_at: string;
          id: string;
          published: boolean;
          slug: string;
          sort_order: number;
          summary: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          cover_url?: string | null;
          created_at?: string;
          id?: string;
          published?: boolean;
          slug: string;
          sort_order?: number;
          summary?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          cover_url?: string | null;
          created_at?: string;
          id?: string;
          published?: boolean;
          slug?: string;
          sort_order?: number;
          summary?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lp_questions: {
        Row: {
          correct: Json;
          course_id: string;
          created_at: string;
          explanation: string | null;
          id: string;
          options: Json;
          points: number;
          prompt: string;
          type: Database["public"]["Enums"]["lp_question_type"];
          updated_at: string;
        };
        Insert: {
          correct?: Json;
          course_id: string;
          created_at?: string;
          explanation?: string | null;
          id?: string;
          options?: Json;
          points?: number;
          prompt: string;
          type: Database["public"]["Enums"]["lp_question_type"];
          updated_at?: string;
        };
        Update: {
          correct?: Json;
          course_id?: string;
          created_at?: string;
          explanation?: string | null;
          id?: string;
          options?: Json;
          points?: number;
          prompt?: string;
          type?: Database["public"]["Enums"]["lp_question_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lp_questions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "lp_courses";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_quiz_attempts: {
        Row: {
          answers: Json;
          created_at: string;
          id: string;
          passed: boolean | null;
          quiz_id: string;
          score_pct: number | null;
          started_at: string;
          submitted_at: string | null;
          user_id: string;
        };
        Insert: {
          answers?: Json;
          created_at?: string;
          id?: string;
          passed?: boolean | null;
          quiz_id: string;
          score_pct?: number | null;
          started_at?: string;
          submitted_at?: string | null;
          user_id: string;
        };
        Update: {
          answers?: Json;
          created_at?: string;
          id?: string;
          passed?: boolean | null;
          quiz_id?: string;
          score_pct?: number | null;
          started_at?: string;
          submitted_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lp_quiz_attempts_quiz_id_fkey";
            columns: ["quiz_id"];
            isOneToOne: false;
            referencedRelation: "lp_quizzes";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_quiz_questions: {
        Row: {
          question_id: string;
          quiz_id: string;
          sort_order: number;
        };
        Insert: {
          question_id: string;
          quiz_id: string;
          sort_order?: number;
        };
        Update: {
          question_id?: string;
          quiz_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "lp_quiz_questions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "lp_questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lp_quiz_questions_quiz_id_fkey";
            columns: ["quiz_id"];
            isOneToOne: false;
            referencedRelation: "lp_quizzes";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_quizzes: {
        Row: {
          course_id: string;
          created_at: string;
          id: string;
          is_final: boolean;
          max_attempts: number | null;
          module_id: string | null;
          pass_pct: number;
          shuffle: boolean;
          time_limit_sec: number | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          id?: string;
          is_final?: boolean;
          max_attempts?: number | null;
          module_id?: string | null;
          pass_pct?: number;
          shuffle?: boolean;
          time_limit_sec?: number | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          id?: string;
          is_final?: boolean;
          max_attempts?: number | null;
          module_id?: string | null;
          pass_pct?: number;
          shuffle?: boolean;
          time_limit_sec?: number | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lp_quizzes_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "lp_courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lp_quizzes_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: false;
            referencedRelation: "lp_modules";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_recipe_assignments: {
        Row: {
          assigned_at: string;
          assigned_by: string | null;
          assigned_method: string;
          course_id: string;
          id: string;
          partner_user_id: string;
          recipe_id: string;
          updated_at: string;
        };
        Insert: {
          assigned_at?: string;
          assigned_by?: string | null;
          assigned_method?: string;
          course_id: string;
          id?: string;
          partner_user_id: string;
          recipe_id: string;
          updated_at?: string;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string | null;
          assigned_method?: string;
          course_id?: string;
          id?: string;
          partner_user_id?: string;
          recipe_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lp_recipe_assign_recipe_fk";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "lp_recipes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lp_recipe_assignments_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "lp_courses";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_recipes: {
        Row: {
          active: boolean;
          cook_steps_md: string | null;
          course_id: string;
          created_at: string;
          created_by: string | null;
          cuisine_id: string | null;
          food_name: string;
          id: string;
          image_path: string | null;
          ingredients_md: string;
          prep_steps_md: string | null;
          sort_order: number;
          status: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          cook_steps_md?: string | null;
          course_id: string;
          created_at?: string;
          created_by?: string | null;
          cuisine_id?: string | null;
          food_name: string;
          id?: string;
          image_path?: string | null;
          ingredients_md?: string;
          prep_steps_md?: string | null;
          sort_order?: number;
          status?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          cook_steps_md?: string | null;
          course_id?: string;
          created_at?: string;
          created_by?: string | null;
          cuisine_id?: string | null;
          food_name?: string;
          id?: string;
          image_path?: string | null;
          ingredients_md?: string;
          prep_steps_md?: string | null;
          sort_order?: number;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lp_recipes_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "lp_courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lp_recipes_cuisine_id_fkey";
            columns: ["cuisine_id"];
            isOneToOne: false;
            referencedRelation: "lp_cuisines";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_resources: {
        Row: {
          category: string;
          course_id: string;
          created_at: string;
          file_path: string;
          id: string;
          kind: Database["public"]["Enums"]["lp_resource_kind"];
          mime_type: string | null;
          module_id: string | null;
          size_bytes: number | null;
          sort_order: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          category?: string;
          course_id: string;
          created_at?: string;
          file_path: string;
          id?: string;
          kind?: Database["public"]["Enums"]["lp_resource_kind"];
          mime_type?: string | null;
          module_id?: string | null;
          size_bytes?: number | null;
          sort_order?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          course_id?: string;
          created_at?: string;
          file_path?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["lp_resource_kind"];
          mime_type?: string | null;
          module_id?: string | null;
          size_bytes?: number | null;
          sort_order?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lp_resources_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "lp_courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lp_resources_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: false;
            referencedRelation: "lp_modules";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_sample_image_guide: {
        Row: {
          course_id: string;
          guidelines_md: string | null;
          sample_image_path: string | null;
          updated_at: string;
        };
        Insert: {
          course_id: string;
          guidelines_md?: string | null;
          sample_image_path?: string | null;
          updated_at?: string;
        };
        Update: {
          course_id?: string;
          guidelines_md?: string | null;
          sample_image_path?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lp_sample_image_guide_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: true;
            referencedRelation: "lp_courses";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_performance_reports: {
        Row: {
          abc_score: number | null;
          attendance_pct: number | null;
          certification_status: string | null;
          generated_at: string;
          go_live_ready: boolean;
          htc_score: number | null;
          hygiene_score: number | null;
          id: string;
          modules_completed: number | null;
          modules_total: number | null;
          partner_id: string;
          practice_score: number | null;
          quiz_score: number | null;
          recipe_readiness_score: number | null;
          recommended_followup: string | null;
          risk_remarks: string | null;
          trainer_remarks: string | null;
          training_id: string | null;
        };
        Insert: {
          abc_score?: number | null;
          attendance_pct?: number | null;
          certification_status?: string | null;
          generated_at?: string;
          go_live_ready?: boolean;
          htc_score?: number | null;
          hygiene_score?: number | null;
          id?: string;
          modules_completed?: number | null;
          modules_total?: number | null;
          partner_id: string;
          practice_score?: number | null;
          quiz_score?: number | null;
          recipe_readiness_score?: number | null;
          recommended_followup?: string | null;
          risk_remarks?: string | null;
          trainer_remarks?: string | null;
          training_id?: string | null;
        };
        Update: {
          abc_score?: number | null;
          attendance_pct?: number | null;
          certification_status?: string | null;
          generated_at?: string;
          go_live_ready?: boolean;
          htc_score?: number | null;
          hygiene_score?: number | null;
          id?: string;
          modules_completed?: number | null;
          modules_total?: number | null;
          partner_id?: string;
          practice_score?: number | null;
          quiz_score?: number | null;
          recipe_readiness_score?: number | null;
          recommended_followup?: string | null;
          risk_remarks?: string | null;
          trainer_remarks?: string | null;
          training_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "partner_performance_reports_training_id_fkey";
            columns: ["training_id"];
            isOneToOne: false;
            referencedRelation: "sft_partner_training";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      retraining_triggers: {
        Row: {
          assigned_trainer_id: string | null;
          detail: string | null;
          id: string;
          partner_id: string;
          reason: Database["public"]["Enums"]["retraining_reason"];
          resolution_notes: string | null;
          resolved_at: string | null;
          status: string;
          triggered_at: string;
        };
        Insert: {
          assigned_trainer_id?: string | null;
          detail?: string | null;
          id?: string;
          partner_id: string;
          reason: Database["public"]["Enums"]["retraining_reason"];
          resolution_notes?: string | null;
          resolved_at?: string | null;
          status?: string;
          triggered_at?: string;
        };
        Update: {
          assigned_trainer_id?: string | null;
          detail?: string | null;
          id?: string;
          partner_id?: string;
          reason?: Database["public"]["Enums"]["retraining_reason"];
          resolution_notes?: string | null;
          resolved_at?: string | null;
          status?: string;
          triggered_at?: string;
        };
        Relationships: [];
      };
      sft_certificate_template: {
        Row: {
          cert_body_md: string;
          cert_title: string;
          email_body_md: string;
          id: number;
          logo_url: string | null;
          signer_name: string | null;
          signer_title: string | null;
          subject: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          cert_body_md: string;
          cert_title: string;
          email_body_md: string;
          id?: number;
          logo_url?: string | null;
          signer_name?: string | null;
          signer_title?: string | null;
          subject: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          cert_body_md?: string;
          cert_title?: string;
          email_body_md?: string;
          id?: number;
          logo_url?: string | null;
          signer_name?: string | null;
          signer_title?: string | null;
          subject?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      sft_course_day_progress: {
        Row: {
          day_no: number;
          end_quiz_max: number | null;
          end_quiz_score: number | null;
          id: string;
          invite_id: string;
          mid_quiz_max: number | null;
          mid_quiz_score: number | null;
          passed_at: string | null;
          slides_seen: number;
          slides_total: number;
          total_ms: number;
          updated_at: string;
        };
        Insert: {
          day_no: number;
          end_quiz_max?: number | null;
          end_quiz_score?: number | null;
          id?: string;
          invite_id: string;
          mid_quiz_max?: number | null;
          mid_quiz_score?: number | null;
          passed_at?: string | null;
          slides_seen?: number;
          slides_total?: number;
          total_ms?: number;
          updated_at?: string;
        };
        Update: {
          day_no?: number;
          end_quiz_max?: number | null;
          end_quiz_score?: number | null;
          id?: string;
          invite_id?: string;
          mid_quiz_max?: number | null;
          mid_quiz_score?: number | null;
          passed_at?: string | null;
          slides_seen?: number;
          slides_total?: number;
          total_ms?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sft_course_day_progress_invite_id_fkey";
            columns: ["invite_id"];
            isOneToOne: false;
            referencedRelation: "sft_course_engagement_v";
            referencedColumns: ["invite_id"];
          },
          {
            foreignKeyName: "sft_course_day_progress_invite_id_fkey";
            columns: ["invite_id"];
            isOneToOne: false;
            referencedRelation: "sft_course_invite";
            referencedColumns: ["id"];
          },
        ];
      };
      sft_course_invite: {
        Row: {
          certificate_message_id: string | null;
          certificate_sent_at: string | null;
          completed_at: string | null;
          completion_approved_at: string | null;
          completion_approved_by: string | null;
          created_at: string;
          email_message_id: string | null;
          first_play_at: string | null;
          id: string;
          last_play_at: string | null;
          lead_id: string | null;
          notes: string | null;
          opened_at: string | null;
          partner_id: string | null;
          recipient_email: string;
          recipient_name: string | null;
          revoked_at: string | null;
          sent_at: string;
          sent_by: string | null;
          token: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          certificate_message_id?: string | null;
          certificate_sent_at?: string | null;
          completed_at?: string | null;
          completion_approved_at?: string | null;
          completion_approved_by?: string | null;
          created_at?: string;
          email_message_id?: string | null;
          first_play_at?: string | null;
          id?: string;
          last_play_at?: string | null;
          lead_id?: string | null;
          notes?: string | null;
          opened_at?: string | null;
          partner_id?: string | null;
          recipient_email: string;
          recipient_name?: string | null;
          revoked_at?: string | null;
          sent_at?: string;
          sent_by?: string | null;
          token?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          certificate_message_id?: string | null;
          certificate_sent_at?: string | null;
          completed_at?: string | null;
          completion_approved_at?: string | null;
          completion_approved_by?: string | null;
          created_at?: string;
          email_message_id?: string | null;
          first_play_at?: string | null;
          id?: string;
          last_play_at?: string | null;
          lead_id?: string | null;
          notes?: string | null;
          opened_at?: string | null;
          partner_id?: string | null;
          recipient_email?: string;
          recipient_name?: string | null;
          revoked_at?: string | null;
          sent_at?: string;
          sent_by?: string | null;
          token?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      sft_course_session: {
        Row: {
          day_no: number | null;
          ended_at: string | null;
          id: string;
          invite_id: string;
          mode: string;
          started_at: string;
          user_agent: string | null;
        };
        Insert: {
          day_no?: number | null;
          ended_at?: string | null;
          id?: string;
          invite_id: string;
          mode: string;
          started_at?: string;
          user_agent?: string | null;
        };
        Update: {
          day_no?: number | null;
          ended_at?: string | null;
          id?: string;
          invite_id?: string;
          mode?: string;
          started_at?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sft_course_session_invite_id_fkey";
            columns: ["invite_id"];
            isOneToOne: false;
            referencedRelation: "sft_course_engagement_v";
            referencedColumns: ["invite_id"];
          },
          {
            foreignKeyName: "sft_course_session_invite_id_fkey";
            columns: ["invite_id"];
            isOneToOne: false;
            referencedRelation: "sft_course_invite";
            referencedColumns: ["id"];
          },
        ];
      };
      sft_deck_setup: {
        Row: {
          active: boolean;
          autoplay_advance: boolean;
          file_path: string;
          id: string;
          name: string;
          pdf_path: string | null;
          speed: number;
          uploaded_at: string;
          uploaded_by: string | null;
          voice: string;
        };
        Insert: {
          active?: boolean;
          autoplay_advance?: boolean;
          file_path: string;
          id?: string;
          name: string;
          pdf_path?: string | null;
          speed?: number;
          uploaded_at?: string;
          uploaded_by?: string | null;
          voice?: string;
        };
        Update: {
          active?: boolean;
          autoplay_advance?: boolean;
          file_path?: string;
          id?: string;
          name?: string;
          pdf_path?: string | null;
          speed?: number;
          uploaded_at?: string;
          uploaded_by?: string | null;
          voice?: string;
        };
        Relationships: [];
      };
      sft_email_event: {
        Row: {
          at: string;
          id: string;
          invite_id: string;
          kind: string;
          meta: Json;
        };
        Insert: {
          at?: string;
          id?: string;
          invite_id: string;
          kind: string;
          meta?: Json;
        };
        Update: {
          at?: string;
          id?: string;
          invite_id?: string;
          kind?: string;
          meta?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "sft_email_event_invite_id_fkey";
            columns: ["invite_id"];
            isOneToOne: false;
            referencedRelation: "sft_course_engagement_v";
            referencedColumns: ["invite_id"];
          },
          {
            foreignKeyName: "sft_email_event_invite_id_fkey";
            columns: ["invite_id"];
            isOneToOne: false;
            referencedRelation: "sft_course_invite";
            referencedColumns: ["id"];
          },
        ];
      };
      sft_partner_resources: {
        Row: {
          brand_id: string | null;
          bucket: string;
          category: string;
          course_id: string | null;
          created_at: string;
          created_by: string | null;
          file_path: string;
          id: string;
          sort_order: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          brand_id?: string | null;
          bucket?: string;
          category?: string;
          course_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          file_path: string;
          id?: string;
          sort_order?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          brand_id?: string | null;
          bucket?: string;
          category?: string;
          course_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          file_path?: string;
          id?: string;
          sort_order?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sft_partner_resources_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "lp_courses";
            referencedColumns: ["id"];
          },
        ];
      };
      sft_partner_tasks: {
        Row: {
          body: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          due_at: string | null;
          id: string;
          invite_id: string;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          body?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          due_at?: string | null;
          id?: string;
          invite_id: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          due_at?: string | null;
          id?: string;
          invite_id?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sft_partner_tasks_invite_id_fkey";
            columns: ["invite_id"];
            isOneToOne: false;
            referencedRelation: "lp_partner_invites";
            referencedColumns: ["id"];
          },
        ];
      };
      sft_partner_training: {
        Row: {
          abc_score: number | null;
          certificate_issued: boolean;
          certificate_issued_at: string | null;
          course_completed_at: string | null;
          course_started_at: string | null;
          day1_status: Database["public"]["Enums"]["sft_day_status"];
          day2_status: Database["public"]["Enums"]["sft_day_status"];
          day3_status: Database["public"]["Enums"]["sft_day_status"];
          day4_status: Database["public"]["Enums"]["sft_day_status"];
          day5_status: Database["public"]["Enums"]["sft_day_status"];
          day6_status: Database["public"]["Enums"]["sft_day_status"];
          day7_status: Database["public"]["Enums"]["sft_day_status"];
          go_live_ready: boolean;
          htc_score: number | null;
          hygiene_score: number | null;
          id: string;
          partner_id: string;
          practice_score: number | null;
          quiz_score: number | null;
          recipe_score: number | null;
          risk_remarks: string | null;
          source_lead_id: string | null;
          trainer_remarks: string | null;
          updated_at: string;
        };
        Insert: {
          abc_score?: number | null;
          certificate_issued?: boolean;
          certificate_issued_at?: string | null;
          course_completed_at?: string | null;
          course_started_at?: string | null;
          day1_status?: Database["public"]["Enums"]["sft_day_status"];
          day2_status?: Database["public"]["Enums"]["sft_day_status"];
          day3_status?: Database["public"]["Enums"]["sft_day_status"];
          day4_status?: Database["public"]["Enums"]["sft_day_status"];
          day5_status?: Database["public"]["Enums"]["sft_day_status"];
          day6_status?: Database["public"]["Enums"]["sft_day_status"];
          day7_status?: Database["public"]["Enums"]["sft_day_status"];
          go_live_ready?: boolean;
          htc_score?: number | null;
          hygiene_score?: number | null;
          id?: string;
          partner_id: string;
          practice_score?: number | null;
          quiz_score?: number | null;
          recipe_score?: number | null;
          risk_remarks?: string | null;
          source_lead_id?: string | null;
          trainer_remarks?: string | null;
          updated_at?: string;
        };
        Update: {
          abc_score?: number | null;
          certificate_issued?: boolean;
          certificate_issued_at?: string | null;
          course_completed_at?: string | null;
          course_started_at?: string | null;
          day1_status?: Database["public"]["Enums"]["sft_day_status"];
          day2_status?: Database["public"]["Enums"]["sft_day_status"];
          day3_status?: Database["public"]["Enums"]["sft_day_status"];
          day4_status?: Database["public"]["Enums"]["sft_day_status"];
          day5_status?: Database["public"]["Enums"]["sft_day_status"];
          day6_status?: Database["public"]["Enums"]["sft_day_status"];
          day7_status?: Database["public"]["Enums"]["sft_day_status"];
          go_live_ready?: boolean;
          htc_score?: number | null;
          hygiene_score?: number | null;
          id?: string;
          partner_id?: string;
          practice_score?: number | null;
          quiz_score?: number | null;
          recipe_score?: number | null;
          risk_remarks?: string | null;
          source_lead_id?: string | null;
          trainer_remarks?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sft_partner_training_source_lead_id_fkey";
            columns: ["source_lead_id"];
            isOneToOne: false;
            referencedRelation: "kob_leads";
            referencedColumns: ["id"];
          },
        ];
      };
      sft_practice_submissions: {
        Row: {
          appearance_score: number | null;
          cooking_video_url: string | null;
          final_photo_url: string | null;
          hygiene_score: number | null;
          id: string;
          overall_score: number | null;
          packing_photo_url: string | null;
          packing_score: number | null;
          partner_id: string;
          portion_score: number | null;
          product_photo_url: string | null;
          recipe_name: string;
          reviewed_at: string | null;
          self_declaration: Json | null;
          sop_score: number | null;
          submitted_at: string;
          texture_score: number | null;
          timing_score: number | null;
          trainer_id: string | null;
          trainer_notes: string | null;
          training_id: string;
        };
        Insert: {
          appearance_score?: number | null;
          cooking_video_url?: string | null;
          final_photo_url?: string | null;
          hygiene_score?: number | null;
          id?: string;
          overall_score?: number | null;
          packing_photo_url?: string | null;
          packing_score?: number | null;
          partner_id: string;
          portion_score?: number | null;
          product_photo_url?: string | null;
          recipe_name: string;
          reviewed_at?: string | null;
          self_declaration?: Json | null;
          sop_score?: number | null;
          submitted_at?: string;
          texture_score?: number | null;
          timing_score?: number | null;
          trainer_id?: string | null;
          trainer_notes?: string | null;
          training_id: string;
        };
        Update: {
          appearance_score?: number | null;
          cooking_video_url?: string | null;
          final_photo_url?: string | null;
          hygiene_score?: number | null;
          id?: string;
          overall_score?: number | null;
          packing_photo_url?: string | null;
          packing_score?: number | null;
          partner_id?: string;
          portion_score?: number | null;
          product_photo_url?: string | null;
          recipe_name?: string;
          reviewed_at?: string | null;
          self_declaration?: Json | null;
          sop_score?: number | null;
          submitted_at?: string;
          texture_score?: number | null;
          timing_score?: number | null;
          trainer_id?: string | null;
          trainer_notes?: string | null;
          training_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sft_practice_submissions_training_id_fkey";
            columns: ["training_id"];
            isOneToOne: false;
            referencedRelation: "sft_partner_training";
            referencedColumns: ["id"];
          },
        ];
      };
      sft_practice_upload: {
        Row: {
          caption: string | null;
          day_no: number | null;
          file_path: string;
          id: string;
          invite_id: string;
          review_notes: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          uploaded_at: string;
        };
        Insert: {
          caption?: string | null;
          day_no?: number | null;
          file_path: string;
          id?: string;
          invite_id: string;
          review_notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          uploaded_at?: string;
        };
        Update: {
          caption?: string | null;
          day_no?: number | null;
          file_path?: string;
          id?: string;
          invite_id?: string;
          review_notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          uploaded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sft_practice_upload_invite_id_fkey";
            columns: ["invite_id"];
            isOneToOne: false;
            referencedRelation: "sft_course_engagement_v";
            referencedColumns: ["invite_id"];
          },
          {
            foreignKeyName: "sft_practice_upload_invite_id_fkey";
            columns: ["invite_id"];
            isOneToOne: false;
            referencedRelation: "sft_course_invite";
            referencedColumns: ["id"];
          },
        ];
      };
      sft_quiz_attempt: {
        Row: {
          answers: Json;
          attempted_at: string;
          day_no: number;
          id: string;
          invite_id: string;
          max_score: number;
          position: string;
          score: number;
        };
        Insert: {
          answers: Json;
          attempted_at?: string;
          day_no: number;
          id?: string;
          invite_id: string;
          max_score: number;
          position: string;
          score: number;
        };
        Update: {
          answers?: Json;
          attempted_at?: string;
          day_no?: number;
          id?: string;
          invite_id?: string;
          max_score?: number;
          position?: string;
          score?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sft_quiz_attempt_invite_id_fkey";
            columns: ["invite_id"];
            isOneToOne: false;
            referencedRelation: "sft_course_engagement_v";
            referencedColumns: ["invite_id"];
          },
          {
            foreignKeyName: "sft_quiz_attempt_invite_id_fkey";
            columns: ["invite_id"];
            isOneToOne: false;
            referencedRelation: "sft_course_invite";
            referencedColumns: ["id"];
          },
        ];
      };
      sft_quiz_questions: {
        Row: {
          active: boolean;
          correct_index: number;
          created_at: string;
          created_by: string | null;
          day_no: number;
          explanation: string | null;
          id: string;
          options: Json;
          position: string;
          question: string;
          sort_order: number;
          source_slide_index: number | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          correct_index: number;
          created_at?: string;
          created_by?: string | null;
          day_no: number;
          explanation?: string | null;
          id?: string;
          options: Json;
          position: string;
          question: string;
          sort_order?: number;
          source_slide_index?: number | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          correct_index?: number;
          created_at?: string;
          created_by?: string | null;
          day_no?: number;
          explanation?: string | null;
          id?: string;
          options?: Json;
          position?: string;
          question?: string;
          sort_order?: number;
          source_slide_index?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      sft_slide_event: {
        Row: {
          day_no: number;
          dwell_ms: number;
          entered_at: string;
          id: number;
          invite_id: string;
          session_id: string;
          slide_index: number;
          slide_kind: string | null;
        };
        Insert: {
          day_no: number;
          dwell_ms?: number;
          entered_at?: string;
          id?: number;
          invite_id: string;
          session_id: string;
          slide_index: number;
          slide_kind?: string | null;
        };
        Update: {
          day_no?: number;
          dwell_ms?: number;
          entered_at?: string;
          id?: number;
          invite_id?: string;
          session_id?: string;
          slide_index?: number;
          slide_kind?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sft_slide_event_invite_id_fkey";
            columns: ["invite_id"];
            isOneToOne: false;
            referencedRelation: "sft_course_engagement_v";
            referencedColumns: ["invite_id"];
          },
          {
            foreignKeyName: "sft_slide_event_invite_id_fkey";
            columns: ["invite_id"];
            isOneToOne: false;
            referencedRelation: "sft_course_invite";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sft_slide_event_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sft_course_session";
            referencedColumns: ["id"];
          },
        ];
      };
      sft_videos: {
        Row: {
          brand_id: string | null;
          bucket: string;
          category: string;
          course_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          external_url: string | null;
          id: string;
          sort_order: number;
          thumbnail_path: string | null;
          title: string;
          updated_at: string;
          video_path: string | null;
        };
        Insert: {
          brand_id?: string | null;
          bucket?: string;
          category?: string;
          course_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          external_url?: string | null;
          id?: string;
          sort_order?: number;
          thumbnail_path?: string | null;
          title: string;
          updated_at?: string;
          video_path?: string | null;
        };
        Update: {
          brand_id?: string | null;
          bucket?: string;
          category?: string;
          course_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          external_url?: string | null;
          id?: string;
          sort_order?: number;
          thumbnail_path?: string | null;
          title?: string;
          updated_at?: string;
          video_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sft_videos_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "lp_courses";
            referencedColumns: ["id"];
          },
        ];
      };
      suppressed_emails: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          metadata: Json | null;
          reason: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          metadata?: Json | null;
          reason: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          metadata?: Json | null;
          reason?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      vulnerable_feedback: {
        Row: {
          description: string | null;
          feedback_type: Database["public"]["Enums"]["vulnerable_feedback_type"];
          id: string;
          order_ref: string | null;
          partner_id: string;
          reported_at: string;
          reported_by: string | null;
        };
        Insert: {
          description?: string | null;
          feedback_type: Database["public"]["Enums"]["vulnerable_feedback_type"];
          id?: string;
          order_ref?: string | null;
          partner_id: string;
          reported_at?: string;
          reported_by?: string | null;
        };
        Update: {
          description?: string | null;
          feedback_type?: Database["public"]["Enums"]["vulnerable_feedback_type"];
          id?: string;
          order_ref?: string | null;
          partner_id?: string;
          reported_at?: string;
          reported_by?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      fc_prep_costs: {
        Row: {
          code: string | null;
          name: string | null;
          prep_id: string | null;
          type: Database["public"]["Enums"]["fc_prep_type"] | null;
          unit_cost_inr: number | null;
          unit_cost_usd: number | null;
        };
        Insert: {
          code?: string | null;
          name?: string | null;
          prep_id?: string | null;
          type?: Database["public"]["Enums"]["fc_prep_type"] | null;
          unit_cost_inr?: never;
          unit_cost_usd?: never;
        };
        Update: {
          code?: string | null;
          name?: string | null;
          prep_id?: string | null;
          type?: Database["public"]["Enums"]["fc_prep_type"] | null;
          unit_cost_inr?: never;
          unit_cost_usd?: never;
        };
        Relationships: [];
      };
      fc_recipe_version_cost: {
        Row: {
          cost_inr: number | null;
          cost_usd: number | null;
          recipe_id: string | null;
          version_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fc_recipe_versions_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "fc_recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      le_question_options_public: {
        Row: {
          id: string | null;
          label: string | null;
          position: number | null;
          question_id: string | null;
        };
        Insert: {
          id?: string | null;
          label?: string | null;
          position?: number | null;
          question_id?: string | null;
        };
        Update: {
          id?: string | null;
          label?: string | null;
          position?: number | null;
          question_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "le_question_options_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "le_questions";
            referencedColumns: ["id"];
          },
        ];
      };
      sft_course_engagement_v: {
        Row: {
          certificate_sent_at: string | null;
          completed_at: string | null;
          completion_approved_at: string | null;
          days_passed: number | null;
          first_play_at: string | null;
          invite_id: string | null;
          last_play_at: string | null;
          lead_id: string | null;
          opened_at: string | null;
          partner_id: string | null;
          recipient_email: string | null;
          recipient_name: string | null;
          revoked_at: string | null;
          sent_at: string | null;
          slides_seen: number | null;
          slides_total: number | null;
          total_ms: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string };
        Returns: boolean;
      };
      enqueue_email: {
        Args: { payload: Json; queue_name: string };
        Returns: number;
      };
      fc_base_unit_code: { Args: { _ingredient: string }; Returns: string };
      fc_category_base_cost: {
        Args: {
          _category_id: string;
          _currency: Database["public"]["Enums"]["fc_currency"];
        };
        Returns: number;
      };
      fc_category_nutrition: { Args: { _category_id: string }; Returns: Json };
      fc_data_health: { Args: { _country: string }; Returns: Json };
      fc_mix_veg_unit_cost: {
        Args: { _currency: Database["public"]["Enums"]["fc_currency"] };
        Returns: number;
      };
      fc_prep_nutrition_per_g: { Args: { _prep_id: string }; Returns: Json };
      fc_prep_unit_cost: {
        Args: {
          _currency: Database["public"]["Enums"]["fc_currency"];
          _prep_id: string;
        };
        Returns: number;
      };
      fc_product_cost: {
        Args: {
          _currency: Database["public"]["Enums"]["fc_currency"];
          _product_id: string;
        };
        Returns: number;
      };
      fc_to_base: {
        Args: { _qty: number; _unit_code: string };
        Returns: number;
      };
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][];
          _user_id: string;
        };
        Returns: boolean;
      };
      has_permission: {
        Args: { _key: string; _user_id: string };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_le_editor: { Args: { _user_id: string }; Returns: boolean };
      lp_is_editor: { Args: { _user_id: string }; Returns: boolean };
      move_to_dlq: {
        Args: {
          dlq_name: string;
          message_id: number;
          payload: Json;
          source_queue: string;
        };
        Returns: number;
      };
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number };
        Returns: {
          message: Json;
          msg_id: number;
          read_ct: number;
        }[];
      };
      sft_get_invite_by_token: { Args: { _token: string }; Returns: Json };
      sft_is_invited_partner: { Args: { _user_id: string }; Returns: boolean };
      sft_partner_has_course: {
        Args: { _course_id: string; _user_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "trainer"
        | "partner_lead"
        | "pse"
        | "kitchen_partner"
        | "inspector"
        | "partner";
      business_model: "branded" | "unbranded";
      faq_audience: "kob_lead" | "sft_partner";
      fc_currency: "inr" | "usd";
      fc_currency_mode: "inr" | "usd" | "both";
      fc_ingredient_category:
        | "grocery"
        | "vegetable"
        | "spice"
        | "oil"
        | "dairy"
        | "packing"
        | "other";
      fc_prep_type:
        | "base"
        | "paste"
        | "extract"
        | "seasoning"
        | "masala_mix"
        | "other"
        | "gravy_base"
        | "boiled_cooked"
        | "fried_roasted";
      fc_recipe_status:
        | "draft"
        | "submitted"
        | "change_pending_approval"
        | "approved"
        | "rejected";
      fc_status: "active" | "inactive";
      fc_veg_mode: "single" | "multi" | "mix" | "none";
      fc_version_status:
        "draft" | "submitted" | "approved" | "rejected" | "superseded";
      kob_source:
        | "marketing"
        | "social_media"
        | "referral"
        | "website"
        | "field_team"
        | "whatsapp"
        | "inbound_call"
        | "other";
      kob_status:
        | "new_lead"
        | "language_assigned"
        | "first_call_pending"
        | "first_call_completed"
        | "webinar_invited"
        | "webinar_attended"
        | "webinar_missed"
        | "faq_pending"
        | "interested"
        | "not_interested"
        | "documents_pending"
        | "payment_pending"
        | "agreement_pending"
        | "agreement_signed"
        | "onboarding_approved"
        | "transferred_to_sft"
        | "hold"
        | "dropped"
        | "rejected";
      le_cert_status:
        | "not_started"
        | "in_progress"
        | "checkpoint_failed"
        | "quiz_pending"
        | "practical_pending"
        | "approval_pending"
        | "certified"
        | "expired"
        | "retraining_required"
        | "revoked";
      le_course_status: "draft" | "published" | "archived";
      le_question_kind:
        | "single_choice"
        | "multi_choice"
        | "true_false"
        | "short_answer"
        | "image_choice"
        | "checklist";
      le_scope_type:
        "user" | "role" | "department" | "country" | "vertical" | "brand";
      le_section_kind:
        | "intro"
        | "text"
        | "graphic"
        | "screenshot"
        | "video"
        | "in_lesson_question"
        | "mini_quiz"
        | "practical_task"
        | "final_assessment";
      le_taxonomy_type:
        | "country"
        | "vertical"
        | "department"
        | "sub_team"
        | "role"
        | "brand"
        | "language"
        | "training_level"
        | "trainer_type";
      le_vertical:
        "partner_academy" | "pse_academy" | "internal_ops" | "compliance";
      lp_booking_status:
        "booked" | "passed" | "failed" | "reschedule" | "cancelled";
      lp_email_status: "pending" | "sent" | "failed";
      lp_enrolment_status: "active" | "completed" | "withdrawn";
      lp_final_decision: "approved" | "rejected";
      lp_form_status: "not_sent" | "pending" | "submitted";
      lp_module_type: "slides" | "video" | "reading" | "mixed";
      lp_question_type: "single" | "multi" | "tf";
      lp_resource_kind:
        "chart" | "recipe" | "checklist" | "worksheet" | "reference" | "other";
      lp_submission_status: "pending" | "approved" | "redo" | "rejected";
      lp_visit_status:
        | "eligible"
        | "visitor_assigned"
        | "visit_scheduled"
        | "email_sent"
        | "form_pending"
        | "form_submitted"
        | "visit_completed"
        | "approved"
        | "rejected"
        | "rescheduled"
        | "waiting_admin_reschedule"
        | "certified";
      partner_type:
        | "homemaker"
        | "work_from_home"
        | "part_time"
        | "full_time"
        | "small_entrepreneur"
        | "existing_home_maker";
      retraining_reason:
        | "bad_review"
        | "delayed_delivery"
        | "apa_failure"
        | "repeated_cancellation"
        | "rating_drop"
        | "packing_complaint"
        | "taste_complaint"
        | "hygiene_complaint"
        | "cvat_downgrade"
        | "scv_drop";
      sft_day_status:
        "locked" | "in_progress" | "submitted" | "passed" | "failed";
      vulnerable_feedback_type:
        | "taste_mismatch"
        | "excess_oil"
        | "low_quantity"
        | "leakage"
        | "late_preparation"
        | "wrong_item"
        | "poor_packing"
        | "hygiene_complaint"
        | "not_fresh"
        | "spice_imbalance"
        | "missing_item";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "admin",
        "trainer",
        "partner_lead",
        "pse",
        "kitchen_partner",
        "inspector",
        "partner",
      ],
      business_model: ["branded", "unbranded"],
      faq_audience: ["kob_lead", "sft_partner"],
      fc_currency: ["inr", "usd"],
      fc_currency_mode: ["inr", "usd", "both"],
      fc_ingredient_category: [
        "grocery",
        "vegetable",
        "spice",
        "oil",
        "dairy",
        "packing",
        "other",
      ],
      fc_prep_type: [
        "base",
        "paste",
        "extract",
        "seasoning",
        "masala_mix",
        "other",
        "gravy_base",
        "boiled_cooked",
        "fried_roasted",
      ],
      fc_recipe_status: [
        "draft",
        "submitted",
        "change_pending_approval",
        "approved",
        "rejected",
      ],
      fc_status: ["active", "inactive"],
      fc_veg_mode: ["single", "multi", "mix", "none"],
      fc_version_status: [
        "draft",
        "submitted",
        "approved",
        "rejected",
        "superseded",
      ],
      kob_source: [
        "marketing",
        "social_media",
        "referral",
        "website",
        "field_team",
        "whatsapp",
        "inbound_call",
        "other",
      ],
      kob_status: [
        "new_lead",
        "language_assigned",
        "first_call_pending",
        "first_call_completed",
        "webinar_invited",
        "webinar_attended",
        "webinar_missed",
        "faq_pending",
        "interested",
        "not_interested",
        "documents_pending",
        "payment_pending",
        "agreement_pending",
        "agreement_signed",
        "onboarding_approved",
        "transferred_to_sft",
        "hold",
        "dropped",
        "rejected",
      ],
      le_cert_status: [
        "not_started",
        "in_progress",
        "checkpoint_failed",
        "quiz_pending",
        "practical_pending",
        "approval_pending",
        "certified",
        "expired",
        "retraining_required",
        "revoked",
      ],
      le_course_status: ["draft", "published", "archived"],
      le_question_kind: [
        "single_choice",
        "multi_choice",
        "true_false",
        "short_answer",
        "image_choice",
        "checklist",
      ],
      le_scope_type: [
        "user",
        "role",
        "department",
        "country",
        "vertical",
        "brand",
      ],
      le_section_kind: [
        "intro",
        "text",
        "graphic",
        "screenshot",
        "video",
        "in_lesson_question",
        "mini_quiz",
        "practical_task",
        "final_assessment",
      ],
      le_taxonomy_type: [
        "country",
        "vertical",
        "department",
        "sub_team",
        "role",
        "brand",
        "language",
        "training_level",
        "trainer_type",
      ],
      le_vertical: [
        "partner_academy",
        "pse_academy",
        "internal_ops",
        "compliance",
      ],
      lp_booking_status: [
        "booked",
        "passed",
        "failed",
        "reschedule",
        "cancelled",
      ],
      lp_email_status: ["pending", "sent", "failed"],
      lp_enrolment_status: ["active", "completed", "withdrawn"],
      lp_final_decision: ["approved", "rejected"],
      lp_form_status: ["not_sent", "pending", "submitted"],
      lp_module_type: ["slides", "video", "reading", "mixed"],
      lp_question_type: ["single", "multi", "tf"],
      lp_resource_kind: [
        "chart",
        "recipe",
        "checklist",
        "worksheet",
        "reference",
        "other",
      ],
      lp_submission_status: ["pending", "approved", "redo", "rejected"],
      lp_visit_status: [
        "eligible",
        "visitor_assigned",
        "visit_scheduled",
        "email_sent",
        "form_pending",
        "form_submitted",
        "visit_completed",
        "approved",
        "rejected",
        "rescheduled",
        "waiting_admin_reschedule",
        "certified",
      ],
      partner_type: [
        "homemaker",
        "work_from_home",
        "part_time",
        "full_time",
        "small_entrepreneur",
        "existing_home_maker",
      ],
      retraining_reason: [
        "bad_review",
        "delayed_delivery",
        "apa_failure",
        "repeated_cancellation",
        "rating_drop",
        "packing_complaint",
        "taste_complaint",
        "hygiene_complaint",
        "cvat_downgrade",
        "scv_drop",
      ],
      sft_day_status: [
        "locked",
        "in_progress",
        "submitted",
        "passed",
        "failed",
      ],
      vulnerable_feedback_type: [
        "taste_mismatch",
        "excess_oil",
        "low_quantity",
        "leakage",
        "late_preparation",
        "wrong_item",
        "poor_packing",
        "hygiene_complaint",
        "not_fresh",
        "spice_imbalance",
        "missing_item",
      ],
    },
  },
} as const;
