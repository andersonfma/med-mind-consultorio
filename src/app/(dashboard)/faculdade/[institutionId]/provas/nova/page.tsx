import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE } from '@/lib/routes'
import { managedInstitutions } from '@/lib/faculty/access'
import { EXAM_AREAS, PRE_REQ_SPECIALTIES } from '@/lib/exam/blueprint'
import { CreateExamForm } from './CreateExamForm'

export const dynamic = 'force-dynamic'

export default async function NovaProvaPage({ params }: { params: Promise<{ institutionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  const { institutionId } = await params

  const { institutions } = await managedInstitutions(user.id, user.email)
  const inst = institutions.find((i) => i.id === institutionId)
  if (!inst) notFound()

  const areas = EXAM_AREAS.map((a) => ({ key: a.key, label: a.label }))
  const specialties = PRE_REQ_SPECIALTIES.map((s) => ({ key: s.key, label: s.label }))

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link href={`/faculdade/${institutionId}/provas`} className="text-sm text-muted hover:text-primary">← Provas da turma</Link>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">Criar prova</h1>
        <p className="mt-0.5 text-sm text-muted">Questões originais nos moldes ENARE/ENAMED, iguais para toda a turma.</p>
      </div>
      <CreateExamForm institutionId={institutionId} areas={areas} specialties={specialties} />
    </div>
  )
}
