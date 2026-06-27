export type Adequacy = 'adequada' | 'parcial' | 'inadequada'
export type PrescriptionSource = 'catalog' | 'free'
export type PrescriptionStatus = 'active' | 'suspended'
export type Adherence = 'alta' | 'média' | 'baixa'

/** Linha retornada ao cliente (sem user_id/patient_id). */
export interface Prescription {
  id: string
  consultation_id: string
  drug_name: string
  posology: string
  source: PrescriptionSource
  justification: string | null
  adequacy: Adequacy | null
  ai_feedback: string | null
  status: PrescriptionStatus
  created_at: string
}
