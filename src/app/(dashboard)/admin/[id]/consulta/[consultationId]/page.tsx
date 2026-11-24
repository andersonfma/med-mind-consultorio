import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin/access'
import { LOGIN_ROUTE } from '@/lib/routes'
import { ConsultationReadOnly } from '@/app/(dashboard)/consultations/[id]/ConsultationReadOnly'
import type { Patient, Consultation } from '@/types/domain'

export const dynamic = 'force-dynamic'

// Visualização ADMIN de uma consulta de qualquer aluno (service role, fura o trava
// user_id = próprio aluno). Só admin. Reaproveita a mesma tela de leitura do aluno.
export default async function AdminConsultationPage({ params }: { params: Promise<{ id: string; consultationId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  if (!isAdminEmail(user.email)) notFound()

  const { id, consultationId } = await params
  const admin = createAdminClient()

  const { data: consultation } = await admin
    .from('consultations')
    .select('*, patients(*)')
    .eq('id', consultationId)
    .single()
  // confere que a consulta é mesmo do aluno da URL (integridade do link)
  if (!consultation || (consultation as { user_id?: string }).user_id !== id) notFound()

  const patient = (consultation as Record<string, unknown>).patients as Patient

  const [{ data: exams }, { data: prescriptions }] = await Promise.all([
    admin.from('exam_requests').select('exam_name, justification, result, status').eq('consultation_id', consultationId),
    admin.from('prescriptions').select('id, drug_name, posology, kind, adequacy, ai_feedback, status').eq('consultation_id', consultationId).order('created_at', { ascending: true }),
  ])

  return (
    <div className="space-y-4 p-1 sm:p-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link href={`/admin/${id}`} className="text-sm text-muted hover:text-primary">← Voltar ao aluno</Link>
        <span className="rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-[11px] font-semibold text-warning">Visão do professor</span>
      </div>
      <ConsultationReadOnly
        consultation={consultation as unknown as Consultation}
        patient={patient}
        exams={exams ?? []}
        prescriptions={prescriptions ?? []}
      />
    </div>
  )
}
