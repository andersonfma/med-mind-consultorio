import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LOGIN_ROUTE } from '@/lib/routes'
import { managedInstitutions } from '@/lib/faculty/access'
import { formatDateTimeBR } from '@/lib/datetime'

export const dynamic = 'force-dynamic'

const STATUS: Record<string, { label: string; cls: string }> = {
  generating: { label: 'Gerando…', cls: 'border-warning/40 bg-warning/10 text-warning' },
  ready: { label: 'Pronta', cls: 'border-success/40 bg-success/10 text-success' },
  failed: { label: 'Falhou', cls: 'border-danger/40 bg-danger/10 text-danger' },
}

export default async function ProvasPage({ params }: { params: Promise<{ institutionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  const { institutionId } = await params

  const { institutions } = await managedInstitutions(user.id, user.email)
  const inst = institutions.find((i) => i.id === institutionId)
  if (!inst) notFound()

  const admin = createAdminClient()
  const { data: rows } = await admin
    .from('faculty_exams')
    .select('id, title, exam, track, mode, status, total_questions, created_at')
    .eq('institution_id', institutionId)
    .order('created_at', { ascending: false })
  const exams = (rows ?? []) as Array<{ id: string; title: string; exam: string; track: string; mode: string; status: string; total_questions: number; created_at: string }>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href={`/faculdade/${institutionId}`} className="text-sm text-muted hover:text-primary">← {inst.name}</Link>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">Provas da turma</h1>
        </div>
        <Link href={`/faculdade/${institutionId}/provas/nova`} className="btn-electric rounded-xl px-4 py-2.5 text-sm font-semibold">+ Criar prova</Link>
      </div>

      {exams.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-12 text-center text-sm text-muted">
          Nenhuma prova ainda. Crie a primeira — a IA gera questões nos moldes ENARE/ENAMED, de forma aleatória ou dirigida por temas.
        </p>
      ) : (
        <ul className="space-y-2">
          {exams.map((e) => {
            const st = STATUS[e.status] ?? STATUS.generating
            const kind = e.mode === 'blueprint' ? 'Dirigida' : 'Aleatória'
            const trackLabel = e.exam === 'enare' ? (e.track === 'pre-requisito' ? 'ENARE · Pré-requisito' : 'ENARE · Acesso direto') : 'ENAMED'
            return (
              <li key={e.id}>
                <Link href={`/faculdade/${institutionId}/provas/${e.id}`} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-primary/40">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{e.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{trackLabel} · {kind} · {e.total_questions || '—'} questões · {formatDateTimeBR(e.created_at)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
