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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          group_id: string | null
          id: string
          properties: Json
          screen: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          group_id?: string | null
          id?: string
          properties?: Json
          screen?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          group_id?: string | null
          id?: string
          properties?: Json
          screen?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_group_optouts: {
        Row: {
          admin_id: string
          created_at: string
          group_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          group_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_group_optouts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      allowed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      karma_events: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["karma_event_type"]
          id: string
          order_item_id: string | null
          points: number
          run_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["karma_event_type"]
          id?: string
          order_item_id?: string | null
          points: number
          run_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["karma_event_type"]
          id?: string
          order_item_id?: string | null
          points?: number
          run_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "karma_events_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "karma_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      run_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          run_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          run_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          run_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_reactions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      run_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rater_id: string
          run_id: string
          thumbs_up: boolean | null
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rater_id: string
          run_id: string
          thumbs_up?: boolean | null
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rater_id?: string
          run_id?: string
          thumbs_up?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_ratings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      run_product_feedback: {
        Row: {
          comment: string
          created_at: string
          id: string
          run_id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          run_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          run_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_product_feedback_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      group_notification_mutes: {
        Row: {
          created_at: string
          group_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_notification_mutes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          delivery_mode: string
          notify_live_activities: boolean
          notify_run_posted: boolean
          notify_scheduled_runs: boolean
          notify_status_updates: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_mode?: string
          notify_live_activities?: boolean
          notify_run_posted?: boolean
          notify_scheduled_runs?: boolean
          notify_status_updates?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivery_mode?: string
          notify_live_activities?: boolean
          notify_run_posted?: boolean
          notify_scheduled_runs?: boolean
          notify_status_updates?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          run_id: string | null
          sent_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          category: string
          created_at?: string
          id?: string
          run_id?: string | null
          sent_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          run_id?: string | null
          sent_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invites: {
        Row: {
          created_at: string
          created_by: string
          email: string
          group_id: string
          id: string
          invite_code: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          email: string
          group_id: string
          id?: string
          invite_code?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string
          group_id?: string
          id?: string
          invite_code?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invite_code?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          is_picked_up: boolean
          item_name: string
          order_id: string
          quantity: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          is_picked_up?: boolean
          item_name: string
          order_id: string
          quantity?: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          is_picked_up?: boolean
          item_name?: string
          order_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          dropped_off_at: string | null
          id: string
          is_complete: boolean
          run_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dropped_off_at?: string | null
          id?: string
          is_complete?: boolean
          run_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dropped_off_at?: string | null
          id?: string
          is_complete?: boolean
          run_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      runs: {
        Row: {
          closes_at: string
          created_at: string
          frozen_allowed: boolean
          group_id: string
          id: string
          max_orders_per_person: number | null
          max_total_orders: number | null
          note: string | null
          runner_id: string
          scheduled_at: string | null
          scheduled_reminder_sent_at: string | null
          status: Database["public"]["Enums"]["run_status"]
          store_names: string
          updated_at: string
        }
        Insert: {
          closes_at: string
          created_at?: string
          frozen_allowed?: boolean
          group_id: string
          id?: string
          max_orders_per_person?: number | null
          max_total_orders?: number | null
          note?: string | null
          runner_id: string
          scheduled_at?: string | null
          scheduled_reminder_sent_at?: string | null
          status?: Database["public"]["Enums"]["run_status"]
          store_names: string
          updated_at?: string
        }
        Update: {
          closes_at?: string
          created_at?: string
          frozen_allowed?: boolean
          group_id?: string
          id?: string
          max_orders_per_person?: number | null
          max_total_orders?: number | null
          note?: string | null
          runner_id?: string
          scheduled_at?: string | null
          scheduled_reminder_sent_at?: string | null
          status?: Database["public"]["Enums"]["run_status"]
          store_names?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "runs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      karma_totals: {
        Row: {
          karma_total: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_can_view_group: {
        Args: { _admin_id: string; _group_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      redeem_invite: {
        Args: { p_code: string }
        Returns: undefined
      }
      shares_group_with: {
        Args: { _other_user_id: string; _user_id: string }
        Returns: boolean
      }
      validate_invite: {
        Args: { p_code: string; p_email: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
      karma_event_type: "run_posted" | "item_picked"
      run_status:
        | "open"
        | "closed"
        | "shopping"
        | "completed"
        | "dropped_off"
        | "cancelled"
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
      app_role: ["admin", "user"],
      karma_event_type: ["run_posted", "item_picked"],
      run_status: ["open", "closed", "shopping", "completed", "dropped_off", "cancelled"],
    },
  },
} as const
