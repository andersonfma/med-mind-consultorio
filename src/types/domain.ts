import type { Database } from './database'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Patient = Database['public']['Tables']['patients']['Row']

export type Consultation = Database['public']['Tables']['consultations']['Row']

export type Role = 'student' | 'resident' | 'physician'
