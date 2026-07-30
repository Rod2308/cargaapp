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
      body_measurements: {
        Row: {
          arm_cm: number | null
          body_fat_pct: number | null
          calf_cm: number | null
          chest_cm: number | null
          created_at: string
          forearm_cm: number | null
          hip_cm: number | null
          id: string
          log_date: string
          neck_cm: number | null
          notes: string | null
          shoulder_cm: number | null
          thigh_cm: number | null
          updated_at: string
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          arm_cm?: number | null
          body_fat_pct?: number | null
          calf_cm?: number | null
          chest_cm?: number | null
          created_at?: string
          forearm_cm?: number | null
          hip_cm?: number | null
          id?: string
          log_date?: string
          neck_cm?: number | null
          notes?: string | null
          shoulder_cm?: number | null
          thigh_cm?: number | null
          updated_at?: string
          user_id: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          arm_cm?: number | null
          body_fat_pct?: number | null
          calf_cm?: number | null
          chest_cm?: number | null
          created_at?: string
          forearm_cm?: number | null
          hip_cm?: number | null
          id?: string
          log_date?: string
          neck_cm?: number | null
          notes?: string | null
          shoulder_cm?: number | null
          thigh_cm?: number | null
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          client_mutation_id: string | null
          created_at: string
          energy: number
          id: string
          log_date: string
          sleep_hours: number
          sleep_quality: number
          soreness: number
          updated_at: string
          user_id: string
        }
        Insert: {
          client_mutation_id?: string | null
          created_at?: string
          energy: number
          id?: string
          log_date: string
          sleep_hours: number
          sleep_quality: number
          soreness: number
          updated_at?: string
          user_id: string
        }
        Update: {
          client_mutation_id?: string | null
          created_at?: string
          energy?: number
          id?: string
          log_date?: string
          sleep_hours?: number
          sleep_quality?: number
          soreness?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      group_join_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          group_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          group_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          group_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_join_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          current_streak: number
          group_id: string
          joined_at: string
          last_checkin_date: string | null
          longest_streak: number
          user_id: string
        }
        Insert: {
          current_streak?: number
          group_id: string
          joined_at?: string
          last_checkin_date?: string | null
          longest_streak?: number
          user_id: string
        }
        Update: {
          current_streak?: number
          group_id?: string
          joined_at?: string
          last_checkin_date?: string | null
          longest_streak?: number
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
      group_messages: {
        Row: {
          client_mutation_id: string | null
          content: string
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          client_mutation_id?: string | null
          content: string
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          client_mutation_id?: string | null
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_points: {
        Row: {
          checkin_date: string
          created_at: string
          group_id: string
          id: string
          points: number
          reason: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          checkin_date: string
          created_at?: string
          group_id: string
          id?: string
          points: number
          reason: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          checkin_date?: string
          created_at?: string
          group_id?: string
          id?: string
          points?: number
          reason?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_points_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_points_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          archived_at: string | null
          created_at: string
          daily_points_cap: number | null
          description: string | null
          emoji: string | null
          ends_at: string | null
          id: string
          invite_code: string
          join_mode: string
          monthly_points_cap: number | null
          name: string
          owner_id: string
          points_per_checkin: number
          starts_at: string | null
          streak_bonus_enabled: boolean
          streak_bonus_every_days: number
          streak_bonus_points: number
          weekly_points_cap: number | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          daily_points_cap?: number | null
          description?: string | null
          emoji?: string | null
          ends_at?: string | null
          id?: string
          invite_code: string
          join_mode?: string
          monthly_points_cap?: number | null
          name: string
          owner_id: string
          points_per_checkin?: number
          starts_at?: string | null
          streak_bonus_enabled?: boolean
          streak_bonus_every_days?: number
          streak_bonus_points?: number
          weekly_points_cap?: number | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          daily_points_cap?: number | null
          description?: string | null
          emoji?: string | null
          ends_at?: string | null
          id?: string
          invite_code?: string
          join_mode?: string
          monthly_points_cap?: number | null
          name?: string
          owner_id?: string
          points_per_checkin?: number
          starts_at?: string | null
          streak_bonus_enabled?: boolean
          streak_bonus_every_days?: number
          streak_bonus_points?: number
          weekly_points_cap?: number | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          client_mutation_id: string | null
          content: string
          created_at: string
          id: string
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          client_mutation_id?: string | null
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          client_mutation_id?: string | null
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
          units_distance: string
          units_weight: string
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
          units_distance?: string
          units_weight?: string
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
          units_distance?: string
          units_weight?: string
          updated_at?: string
          uses_enhancers?: boolean | null
          weekly_frequency?: number | null
          weight_kg?: number | null
          years_experience?: number | null
        }
        Relationships: []
      }
      progress_photos: {
        Row: {
          created_at: string
          id: string
          note: string | null
          pose: string | null
          storage_path: string
          taken_on: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          pose?: string | null
          storage_path: string
          taken_on?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          pose?: string | null
          storage_path?: string
          taken_on?: string
          user_id?: string
        }
        Relationships: []
      }
      push_outbox: {
        Row: {
          body: string
          created_at: string
          fire_at: string
          id: string
          sent_at: string | null
          tag: string | null
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          fire_at?: string
          id?: string
          sent_at?: string | null
          tag?: string | null
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          fire_at?: string
          id?: string
          sent_at?: string | null
          tag?: string | null
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rest_push_schedules: {
        Row: {
          body: string
          created_at: string
          fire_at: string
          id: string
          sent_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          fire_at: string
          id?: string
          sent_at?: string | null
          title?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          fire_at?: string
          id?: string
          sent_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      session_sets: {
        Row: {
          client_mutation_id: string | null
          completed_at: string
          exercise_id: string
          id: string
          notes: string | null
          reps: number | null
          rpe: number | null
          session_id: string
          set_number: number
          technique: string
          weight_kg: number | null
          workout_exercise_id: string | null
        }
        Insert: {
          client_mutation_id?: string | null
          completed_at?: string
          exercise_id: string
          id?: string
          notes?: string | null
          reps?: number | null
          rpe?: number | null
          session_id: string
          set_number: number
          technique?: string
          weight_kg?: number | null
          workout_exercise_id?: string | null
        }
        Update: {
          client_mutation_id?: string | null
          completed_at?: string
          exercise_id?: string
          id?: string
          notes?: string | null
          reps?: number | null
          rpe?: number | null
          session_id?: string
          set_number?: number
          technique?: string
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
          client_mutation_id: string | null
          distance_m: number | null
          elevation_gain_m: number | null
          elevation_loss_m: number | null
          ended_at: string | null
          id: string
          import_source: string | null
          max_hr: number | null
          notes: string | null
          perceived_effort: number | null
          route_geojson: Json | null
          source: string
          started_at: string
          strava_activity_id: number | null
          title: string | null
          user_id: string
          workout_id: string | null
        }
        Insert: {
          activity_type?: string | null
          avg_hr?: number | null
          calories?: number | null
          client_mutation_id?: string | null
          distance_m?: number | null
          elevation_gain_m?: number | null
          elevation_loss_m?: number | null
          ended_at?: string | null
          id?: string
          import_source?: string | null
          max_hr?: number | null
          notes?: string | null
          perceived_effort?: number | null
          route_geojson?: Json | null
          source?: string
          started_at?: string
          strava_activity_id?: number | null
          title?: string | null
          user_id: string
          workout_id?: string | null
        }
        Update: {
          activity_type?: string | null
          avg_hr?: number | null
          calories?: number | null
          client_mutation_id?: string | null
          distance_m?: number | null
          elevation_gain_m?: number | null
          elevation_loss_m?: number | null
          ended_at?: string | null
          id?: string
          import_source?: string | null
          max_hr?: number | null
          notes?: string | null
          perceived_effort?: number | null
          route_geojson?: Json | null
          source?: string
          started_at?: string
          strava_activity_id?: number | null
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
          client_mutation_id: string | null
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
          client_mutation_id?: string | null
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
          client_mutation_id?: string | null
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
      strava_connections: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          last_sync_at: string | null
          refresh_token: string
          scope: string | null
          strava_athlete_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          last_sync_at?: string | null
          refresh_token: string
          scope?: string | null
          strava_athlete_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          last_sync_at?: string | null
          refresh_token?: string
          scope?: string | null
          strava_athlete_id?: number
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
          client_mutation_id: string | null
          exercise_id: string
          group_key: string | null
          id: string
          notes: string | null
          order_idx: number
          target_reps: string
          target_rest_seconds: number
          target_sets: number
          target_weight_kg: number | null
          technique: string
          workout_id: string
        }
        Insert: {
          client_mutation_id?: string | null
          exercise_id: string
          group_key?: string | null
          id?: string
          notes?: string | null
          order_idx?: number
          target_reps?: string
          target_rest_seconds?: number
          target_sets?: number
          target_weight_kg?: number | null
          technique?: string
          workout_id: string
        }
        Update: {
          client_mutation_id?: string | null
          exercise_id?: string
          group_key?: string | null
          id?: string
          notes?: string | null
          order_idx?: number
          target_reps?: string
          target_rest_seconds?: number
          target_sets?: number
          target_weight_kg?: number | null
          technique?: string
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
      workout_reminder_settings: {
        Row: {
          created_at: string
          enabled: boolean
          remind_at: string
          rest_days: number[]
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          remind_at?: string
          rest_days?: number[]
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          remind_at?: string
          rest_days?: number[]
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workouts: {
        Row: {
          client_mutation_id: string | null
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
          client_mutation_id?: string | null
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
          client_mutation_id?: string | null
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
      create_group: {
        Args: { _description?: string; _emoji?: string; _name: string }
        Returns: {
          archived_at: string | null
          created_at: string
          daily_points_cap: number | null
          description: string | null
          emoji: string | null
          ends_at: string | null
          id: string
          invite_code: string
          join_mode: string
          monthly_points_cap: number | null
          name: string
          owner_id: string
          points_per_checkin: number
          starts_at: string | null
          streak_bonus_enabled: boolean
          streak_bonus_every_days: number
          streak_bonus_points: number
          weekly_points_cap: number | null
        }
        SetofOptions: {
          from: "*"
          to: "groups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_join_request: {
        Args: { _approve: boolean; _id: string }
        Returns: undefined
      }
      generate_invite_code: { Args: never; Returns: string }
      get_group_public_invite: {
        Args: { _code: string }
        Returns: {
          description: string
          emoji: string
          is_archived: boolean
          member_count: number
          name: string
        }[]
      }
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
      join_group_by_code: {
        Args: { _code: string }
        Returns: {
          archived_at: string | null
          created_at: string
          daily_points_cap: number | null
          description: string | null
          emoji: string | null
          ends_at: string | null
          id: string
          invite_code: string
          join_mode: string
          monthly_points_cap: number | null
          name: string
          owner_id: string
          points_per_checkin: number
          starts_at: string | null
          streak_bonus_enabled: boolean
          streak_bonus_every_days: number
          streak_bonus_points: number
          weekly_points_cap: number | null
        }
        SetofOptions: {
          from: "*"
          to: "groups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_or_join_by_code: { Args: { _code: string }; Returns: Json }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
