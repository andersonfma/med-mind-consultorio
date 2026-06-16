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
      consultations: {
        Row: {
          anamnesis: Json
          ab4_score: Json | null
          chat_history: Json
          clinical_reasoning: string
          created_at: string
          diagnosis: string | null
          finished_at: string | null
          id: string
          patient_id: string
          physical_exam: Json
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          anamnesis?: Json
          ab4_score?: Json | null
          chat_history?: Json
          clinical_reasoning?: string
          created_at?: string
          diagnosis?: string | null
          finished_at?: string | null
          id?: string
          patient_id: string
          physical_exam?: Json
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          anamnesis?: Json
          ab4_score?: Json | null
          chat_history?: Json
          clinical_reasoning?: string
          created_at?: string
          diagnosis?: string | null
          finished_at?: string | null
          id?: string
          patient_id?: string
          physical_exam?: Json
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_requests: {
        Row: {
          ai_feedback: string
          attempts: number
          consultation_id: string
          created_at: string
          exam_name: string
          id: string
          justification: string
          patient_id: string
          result: string | null
          status: string
          user_id: string
        }
        Insert: {
          ai_feedback?: string
          attempts?: number
          consultation_id: string
          created_at?: string
          exam_name: string
          id?: string
          justification: string
          patient_id: string
          result?: string | null
          status: string
          user_id: string
        }
        Update: {
          ai_feedback?: string
          attempts?: number
          consultation_id?: string
          created_at?: string
          exam_name?: string
          id?: string
          justification?: string
          patient_id?: string
          result?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_requests_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          age: number
          bond_level: number
          chief_complaint: string
          clinical_status: string
          conditions: string[]
          created_at: string
          diagnosis: string | null
          diagnosis_status: string
          difficulty: string
          gender: string
          id: string
          last_consulted_at: string | null
          name: string
          specialty: string
          true_diagnosis: string | null
          case_summary: string | null
          personality: string | null
          user_id: string
        }
        Insert: {
          age: number
          bond_level?: number
          chief_complaint: string
          clinical_status: string
          conditions?: string[]
          created_at?: string
          diagnosis?: string | null
          diagnosis_status?: string
          difficulty: string
          gender: string
          id?: string
          last_consulted_at?: string | null
          name: string
          specialty: string
          true_diagnosis?: string | null
          case_summary?: string | null
          personality?: string | null
          user_id: string
        }
        Update: {
          age?: number
          bond_level?: number
          chief_complaint?: string
          clinical_status?: string
          conditions?: string[]
          created_at?: string
          diagnosis?: string | null
          diagnosis_status?: string
          difficulty?: string
          gender?: string
          id?: string
          last_consulted_at?: string | null
          name?: string
          specialty?: string
          true_diagnosis?: string | null
          case_summary?: string | null
          personality?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          crm: string | null
          full_name: string
          id: string
          role: string
          total_slots: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          crm?: string | null
          full_name: string
          id: string
          role?: string
          total_slots?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          crm?: string | null
          full_name?: string
          id?: string
          role?: string
          total_slots?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_patient: {
        Args: {
          p_age: number
          p_complaint: string
          p_conditions: string[]
          p_difficulty: string
          p_gender: string
          p_name: string
          p_specialty: string
          p_status: string
        }
        Returns: {
          age: number
          bond_level: number
          chief_complaint: string
          clinical_status: string
          conditions: string[]
          created_at: string
          diagnosis: string | null
          diagnosis_status: string
          difficulty: string
          gender: string
          id: string
          last_consulted_at: string | null
          name: string
          specialty: string
          true_diagnosis: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "patients"
          isOneToOne: true
          isSetofReturn: false
        }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
