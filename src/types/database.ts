// ARQUIVO GERADO AUTOMATICAMENTE
// Rodar após aplicar migrations: supabase gen types typescript --linked > src/types/database.ts
// Não editar manualmente

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
      profiles: {
        Row: {
          id: string
          full_name: string
          crm: string | null
          role: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          crm?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          crm?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
