import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE } from '@/lib/routes'
import { ConsultationClient } from './ConsultationClient'
import { ConsultationReadOnly } from './ConsultationReadOnly'
import type { Patient } from '@/types/domain'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)

  const { id } = await params

  const { data: consultation, error } = await supabase
    .from('consultations')
    .select('*, patients(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !consultation) notFound()

  const patient = (consultation as Record<string, unknown>).patients as Patient

  // Consulta finalizada → modo leitura (somente visualização do registro)
  if (consultation.status === 'finished') {
    const { data: finishedExams } = await supabase
      .from('exam_requests')
      .select('exam_name, justification, result, status')
      .eq('consultation_id', consultation.id)
      .eq('user_id', user.id)
    const { data: finishedRx } = await supabase
      .from('prescriptions')
      .select('id, drug_name, posology, adequacy, ai_feedback, status')
      .eq('consultation_id', consultation.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    return (
      <ConsultationReadOnly
        consultation={consultation}
        patient={patient}
        exams={finishedExams ?? []}
        prescriptions={finishedRx ?? []}
      />
    )
  }

  // Fetch approved exam results from the last finished consultation for this patient
  let previousExamResults: Array<{ exam_name: string; result: string | null }> = []
  const { data: lastConsultation } = await supabase
    .from('consultations')
    .select('id')
    .eq('patient_id', patient.id)
    .eq('user_id', user.id)
    .eq('status', 'finished')
    .order('finished_at', { ascending: false })
    .limit(1)
    .single()

  if (lastConsultation) {
    const { data: exams } = await supabase
      .from('exam_requests')
      .select('exam_name, result')
      .eq('consultation_id', lastConsultation.id)
      .eq('user_id', user.id)
      .eq('status', 'approved')
    previousExamResults = exams ?? []
  }

  const { data: activeRx } = await supabase
    .from('prescriptions')
    .select('drug_name, posology')
    .eq('patient_id', patient.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
  const activeMedications = (activeRx ?? []).map(r => ({ drug_name: r.drug_name, posology: r.posology }))

  return (
    <ConsultationClient
      consultation={consultation}
      patient={patient}
      previousExamResults={previousExamResults}
      activeMedications={activeMedications}
    />
  )
}
