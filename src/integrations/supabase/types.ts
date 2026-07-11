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
      exercises: {
        Row: {
          created_at: string
          created_by: string | null
          equipment: string | null
          id: string
          image_url: string | null
          instructions: string | null
          is_default: boolean
          muscle_group: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          equipment?: string | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          is_default?: boolean
          muscle_group: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          equipment?: string | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          is_default?: boolean
          muscle_group?: string
          name?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_level: string | null
          bio: string | null
          birth_date: string | null
          city: string | null
          contact_phone: string | null
          created_at: string
          cref: string | null
          cycle_last_period_start: string | null
          cycle_length_days: number
          cycle_period_length_days: number
          cycle_tracking_enabled: boolean
          display_name: string | null
          experience_level: string | null
          goal: string | null
          height_cm: number | null
          id: string
          injuries: string | null
          invite_code: string | null
          sex: string | null
          specialties: string | null
          updated_at: string
          uses_enhancers: boolean | null
          weekly_frequency: number | null
          weight_kg: number | null
          years_experience: number | null
        }
        Insert: {
          activity_level?: string | null
          bio?: string | null
          birth_date?: string | null
          city?: string | null
          contact_phone?: string | null
          created_at?: string
          cref?: string | null
          cycle_last_period_start?: string | null
          cycle_length_days?: number
          cycle_period_length_days?: number
          cycle_tracking_enabled?: boolean
          display_name?: string | null
          experience_level?: string | null
          goal?: string | null
          height_cm?: number | null
          id: string
          injuries?: string | null
          invite_code?: string | null
          sex?: string | null
          specialties?: string | null
          updated_at?: string
          uses_enhancers?: boolean | null
          weekly_frequency?: number | null
          weight_kg?: number | null
          years_experience?: number | null
        }
        Update: {
          activity_level?: string | null
          bio?: string | null
          birth_date?: string | null
          city?: string | null
          contact_phone?: string | null
          created_at?: string
          cref?: string | null
          cycle_last_period_start?: string | null
          cycle_length_days?: number
          cycle_period_length_days?: number
          cycle_tracking_enabled?: boolean
          display_name?: string | null
          experience_level?: string | null
          goal?: string | null
          height_cm?: number | null
          id?: string
          injuries?: string | null
          invite_code?: string | null
          sex?: string | null
          specialties?: string | null
          updated_at?: string
          uses_enhancers?: boolean | null
          weekly_frequency?: number | null
          weight_kg?: number | null
          years_experience?: number | null
        }
        Relationships: []
      }
      session_sets: {
        Row: {
          completed_at: string
          exercise_id: string
          id: string
          reps: number | null
          rpe: number | null
          session_id: string
          set_number: number
          weight_kg: number | null
          workout_exercise_id: string | null
        }
        Insert: {
          completed_at?: string
          exercise_id: string
          id?: string
          reps?: number | null
          rpe?: number | null
          session_id: string
          set_number: number
          weight_kg?: number | null
          workout_exercise_id?: string | null
        }
        Update: {
          completed_at?: string
          exercise_id?: string
          id?: string
          reps?: number | null
          rpe?: number | null
          session_id?: string
          set_number?: number
          weight_kg?: number | null
          workout_exercise_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_sets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_sets_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          activity_type: string | null
          avg_hr: number | null
          calories: number | null
          distance_m: number | null
          ended_at: string | null
          id: string
          max_hr: number | null
          notes: string | null
          perceived_effort: number | null
          source: string
          started_at: string
          title: string | null
          user_id: string
          workout_id: string | null
        }
        Insert: {
          activity_type?: string | null
          avg_hr?: number | null
          calories?: number | null
          distance_m?: number | null
          ended_at?: string | null
          id?: string
          max_hr?: number | null
          notes?: string | null
          perceived_effort?: number | null
          source?: string
          started_at?: string
          title?: string | null
          user_id: string
          workout_id?: string | null
        }
        Update: {
          activity_type?: string | null
          avg_hr?: number | null
          calories?: number | null
          distance_m?: number | null
          ended_at?: string | null
          id?: string
          max_hr?: number | null
          notes?: string | null
          perceived_effort?: number | null
          source?: string
          started_at?: string
          title?: string | null
          user_id?: string
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      sleep_logs: {
        Row: {
          created_at: string
          hours: number
          id: string
          log_date: string
          notes: string | null
          quality: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hours: number
          id?: string
          log_date: string
          notes?: string | null
          quality?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hours?: number
          id?: string
          log_date?: string
          notes?: string | null
          quality?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trainer_students: {
        Row: {
          created_at: string
          id: string
          student_id: string
          trainer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          student_id: string
          trainer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          student_id?: string
          trainer_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          exercise_id: string
          id: string
          notes: string | null
          order_idx: number
          target_reps: string
          target_rest_seconds: number
          target_sets: number
          target_weight_kg: number | null
          workout_id: string
        }
        Insert: {
          exercise_id: string
          id?: string
          notes?: string | null
          order_idx?: number
          target_reps?: string
          target_rest_seconds?: number
          target_sets?: number
          target_weight_kg?: number | null
          workout_id: string
        }
        Update: {
          exercise_id?: string
          id?: string
          notes?: string | null
          order_idx?: number
          target_reps?: string
          target_rest_seconds?: number
          target_sets?: number
          target_weight_kg?: number | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          created_at: string
          created_by_trainer_id: string | null
          id: string
          label: string
          name: string
          notes: string | null
          order_idx: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by_trainer_id?: string | null
          id?: string
          label: string
          name: string
          notes?: string | null
          order_idx?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by_trainer_id?: string | null
          id?: string
          label?: string
          name?: string
          notes?: string | null
          order_idx?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_invite_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_trainer_of: {
        Args: { _student: string; _trainer: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "trainer" | "admin"
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
      app_role: ["student", "trainer", "admin"],
    },
  },
} as const
