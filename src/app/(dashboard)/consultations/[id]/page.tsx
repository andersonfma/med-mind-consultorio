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

  // Finished consultation → redirect to patient page
  if (consultation.status === 'finished') {
    redirect(patientDetailRoute(consultation.patient_id))
  }

  const patient = (consultation as Record<string, unknown>).patients as Patient

  return <ConsultationClient consultation={consultation} patient={patient} />
}
