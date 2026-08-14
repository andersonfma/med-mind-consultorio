import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { radarFromRows, type RadarResult } from './radar'

/**
 * Agrega os scores do aluno (todas as tabelas têm user_id → filtro direto, RLS-backed)
 * e devolve o RadarResult. Determinístico, sem IA.
 */
export async function getRadarData(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<RadarResult> {
  const [consultations, patients, exams, prescriptions] = await Promise.all([
    supabase.from('consultations').select('ab4_score, communication_score, status').eq('user_id', userId),
    supabase.from('patients').select('diagnosis_status').eq('user_id', userId),
    supabase.from('exam_requests').select('status').eq('user_id', userId),
    supabase.from('prescriptions').select('adequacy').eq('user_id', userId),
  ])
  return radarFromRows({
    consultations: consultations.data ?? [],
    patients: patients.data ?? [],
    exams: exams.data ?? [],
    prescriptions: prescriptions.data ?? [],
  })
}
