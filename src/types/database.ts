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
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      exercise_placements: {
        Row: {
          difficulty: Database["public"]["Enums"]["difficulty"]
          exercise_id: string
          grade: number
          school_type: Database["public"]["Enums"]["school_type"]
          state: Database["public"]["Enums"]["state_code"]
        }
        Insert: {
          difficulty: Database["public"]["Enums"]["difficulty"]
          exercise_id: string
          grade: number
          school_type: Database["public"]["Enums"]["school_type"]
          state: Database["public"]["Enums"]["state_code"]
        }
        Update: {
          difficulty?: Database["public"]["Enums"]["difficulty"]
          exercise_id?: string
          grade?: number
          school_type?: Database["public"]["Enums"]["school_type"]
          state?: Database["public"]["Enums"]["state_code"]
        }
        Relationships: [
          {
            foreignKeyName: "exercise_placements_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_solutions: {
        Row: {
          answer: Json
          exercise_id: string
          hints: Json
          solution: Json
          updated_at: string
        }
        Insert: {
          answer: Json
          exercise_id: string
          hints?: Json
          solution: Json
          updated_at?: string
        }
        Update: {
          answer?: Json
          exercise_id?: string
          hints?: Json
          solution?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_solutions_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: true
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string
          diagram: Json | null
          id: string
          inspiration: string
          key: string
          presentation: Json
          prompt: string
          published_at: string | null
          status: Database["public"]["Enums"]["content_status"]
          subtopic_id: string
          type: Database["public"]["Enums"]["exercise_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          diagram?: Json | null
          id?: string
          inspiration: string
          key: string
          presentation?: Json
          prompt: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          subtopic_id: string
          type: Database["public"]["Enums"]["exercise_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          diagram?: Json | null
          id?: string
          inspiration?: string
          key?: string
          presentation?: Json
          prompt?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          subtopic_id?: string
          type?: Database["public"]["Enums"]["exercise_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercises_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          grade: number | null
          id: string
          onboarding_completed_at: string | null
          privacy_version: string | null
          role: Database["public"]["Enums"]["user_role"]
          school_type: Database["public"]["Enums"]["school_type"] | null
          state: Database["public"]["Enums"]["state_code"] | null
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          grade?: number | null
          id: string
          onboarding_completed_at?: string | null
          privacy_version?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          school_type?: Database["public"]["Enums"]["school_type"] | null
          state?: Database["public"]["Enums"]["state_code"] | null
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          grade?: number | null
          id?: string
          onboarding_completed_at?: string | null
          privacy_version?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          school_type?: Database["public"]["Enums"]["school_type"] | null
          state?: Database["public"]["Enums"]["state_code"] | null
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subtopic_placements: {
        Row: {
          grade: number
          school_type: Database["public"]["Enums"]["school_type"]
          source: string
          state: Database["public"]["Enums"]["state_code"]
          subtopic_id: string
        }
        Insert: {
          grade: number
          school_type: Database["public"]["Enums"]["school_type"]
          source: string
          state: Database["public"]["Enums"]["state_code"]
          subtopic_id: string
        }
        Update: {
          grade?: number
          school_type?: Database["public"]["Enums"]["school_type"]
          source?: string
          state?: Database["public"]["Enums"]["state_code"]
          subtopic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtopic_placements_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
        ]
      }
      subtopic_prerequisites: {
        Row: {
          prerequisite_id: string
          subtopic_id: string
        }
        Insert: {
          prerequisite_id: string
          subtopic_id: string
        }
        Update: {
          prerequisite_id?: string
          subtopic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtopic_prerequisites_prerequisite_id_fkey"
            columns: ["prerequisite_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtopic_prerequisites_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
        ]
      }
      subtopics: {
        Row: {
          created_at: string
          description: string
          exercise_plan: Json
          id: string
          learning_goals: string[]
          slug: string
          sort_order: number
          stage: Database["public"]["Enums"]["learning_stage"]
          title: string
          topic_id: string
          updated_at: string
          video_skip_reason: string | null
        }
        Insert: {
          created_at?: string
          description?: string
          exercise_plan?: Json
          id?: string
          learning_goals?: string[]
          slug: string
          sort_order?: number
          stage: Database["public"]["Enums"]["learning_stage"]
          title: string
          topic_id: string
          updated_at?: string
          video_skip_reason?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          exercise_plan?: Json
          id?: string
          learning_goals?: string[]
          slug?: string
          sort_order?: number
          stage?: Database["public"]["Enums"]["learning_stage"]
          title?: string
          topic_id?: string
          updated_at?: string
          video_skip_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subtopics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          created_at: string
          description: string
          id: string
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          created_at: string
          duration_seconds: number | null
          format: Database["public"]["Enums"]["video_format"]
          id: string
          key_points: string[]
          published_at: string | null
          sort_order: number
          status: Database["public"]["Enums"]["video_status"]
          subtopic_id: string
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          format: Database["public"]["Enums"]["video_format"]
          id?: string
          key_points?: string[]
          published_at?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["video_status"]
          subtopic_id: string
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          format?: Database["public"]["Enums"]["video_format"]
          id?: string
          key_points?: string[]
          published_at?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["video_status"]
          subtopic_id?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      content_status: "review" | "published" | "archived"
      difficulty: "leicht" | "mittel" | "schwer" | "sehr_schwer"
      exercise_type:
        | "multiple_choice"
        | "numeric"
        | "term"
        | "matching"
        | "cloze"
        | "true_false"
        | "ordering"
        | "handwritten"
      learning_stage: "einstieg" | "grundlagen" | "vertiefung" | "anwendung"
      school_type:
        | "gymnasium"
        | "realschule"
        | "gesamtschule"
        | "hauptschule"
        | "mittelschule"
        | "oberschule"
        | "sekundarschule"
        | "stadtteilschule"
      state_code:
        | "BW"
        | "BY"
        | "BE"
        | "BB"
        | "HB"
        | "HH"
        | "HE"
        | "MV"
        | "NI"
        | "NW"
        | "RP"
        | "SL"
        | "SN"
        | "ST"
        | "SH"
        | "TH"
      user_role: "student" | "parent" | "teacher" | "admin"
      video_format: "explainer" | "short"
      video_status: "planned" | "produced" | "published"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      content_status: ["review", "published", "archived"],
      difficulty: ["leicht", "mittel", "schwer", "sehr_schwer"],
      exercise_type: [
        "multiple_choice",
        "numeric",
        "term",
        "matching",
        "cloze",
        "true_false",
        "ordering",
        "handwritten",
      ],
      learning_stage: ["einstieg", "grundlagen", "vertiefung", "anwendung"],
      school_type: [
        "gymnasium",
        "realschule",
        "gesamtschule",
        "hauptschule",
        "mittelschule",
        "oberschule",
        "sekundarschule",
        "stadtteilschule",
      ],
      state_code: [
        "BW",
        "BY",
        "BE",
        "BB",
        "HB",
        "HH",
        "HE",
        "MV",
        "NI",
        "NW",
        "RP",
        "SL",
        "SN",
        "ST",
        "SH",
        "TH",
      ],
      user_role: ["student", "parent", "teacher", "admin"],
      video_format: ["explainer", "short"],
      video_status: ["planned", "produced", "published"],
    },
  },
} as const
