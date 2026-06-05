import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE, patientDetailRoute } from '@/lib/routes'
import { ConsultationClient } from './ConsultationClient'
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

  if (consultation.status === 'finished') {
    redirect(patientDetailRoute(consultation.patient_id))
  }

  const patient = (consultation as Record<string, unknown>).patients as Patient

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

  return (
    <ConsultationClient
      consultation={consultation}
      patient={patient}
      previousExamResults={previousExamResults}
    />
  )
}
