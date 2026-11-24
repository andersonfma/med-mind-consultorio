import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LOGIN_ROUTE } from '@/lib/routes'
import { managedInstitutions } from '@/lib/faculty/access'
import { formatDateTimeBR } from '@/lib/datetime'
import { RefreshWhileGenerating } from './RefreshWhileGenerating'

export const dynamic = 'force-dynamic'

type Q = { id: string; ord: number; area: string | null; topic: string | null; prompt: string; options: { key: string; text: string }[]; correct_key: string; explanation: string | null }

export default async function ProvaDetailPage({ params }: { params: Promise<{ institutionId: string; examId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  const { institutionId, examId } = await params

  const { institutions } = await managedInstitutions(user.id, user.email)
  if (!institutions.some((i) => i.id === institutionId)) notFound()

  const admin = createAdminClient()
  const { data: examRow } = await admin
    .from('faculty_exams')
    .select('id, institution_id, title, exam, track, mode, status, total_questions, error, created_at, ready_at')
    .eq('id', examId)
    .single()
  const exam = examRow as null | { id: string; institution_id: string; title: string; exam: string; track: string; mode: string; status: string; total_questions: number; error: string | null; created_at: string; ready_at: string | null }
  if (!exam || exam.institution_id !== institutionId) notFound()

  const { data: qRows } = exam.status === 'ready'
    ? await admin.from('faculty_exam_questions').select('id, ord, area, topic, prompt, options, correct_key, explanation').eq('faculty_exam_id', examId).order('ord', { ascending: true })
    : { data: [] }
  const questions = (qRows ?? []) as Q[]

  const trackLabel = exam.exam === 'enare' ? (exam.track === 'pre-requisito' ? 'ENARE · Pré-requisito' : 'ENARE · Acesso direto') : 'ENAMED'
  const kind = exam.mode === 'blueprint' ? 'Dirigida por temas' : 'IA aleatória'

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/faculdade/${institutionId}/provas`} className="text-sm text-muted hover:text-primary">← Provas da turma</Link>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">{exam.title}</h1>
        <p className="mt-0.5 text-sm text-muted">{trackLabel} · {kind} · criada {formatDateTimeBR(exam.created_at)}</p>
      </div>

      {exam.status === 'generating' && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-5 text-center">
          <RefreshWhileGenerating />
          <p className="font-display text-lg font-bold text-ink">Gerando a prova…</p>
          <p className="mt-1 text-sm text-muted">Cada questão é validada e tem o gabarito verificado — pode levar alguns minutos. Esta página atualiza sozinha.</p>
        </div>
      )}

      {exam.status === 'failed' && (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-5">
          <p className="font-semibold text-danger">Não foi possível gerar a prova.</p>
          <p className="mt-1 text-sm text-muted">{exam.error ?? 'Tente criar novamente com outros parâmetros.'}</p>
        </div>
      )}

      {exam.status === 'ready' && (
        <>
          <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Gabarito do professor</p>
            <span className="text-[11px] text-muted">{questions.length} questões</span>
          </div>
          <ol className="space-y-4">
            {questions.map((q) => (
              <li key={q.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted">Questão {q.ord}</span>
                  {q.area && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{q.area}{q.topic ? ` · ${q.topic}` : ''}</span>}
                </div>
                <p className="mb-3 whitespace-pre-wrap text-sm text-ink">{q.prompt}</p>
                <div className="space-y-1.5">
                  {q.options.map((o) => {
                    const correct = o.key === q.correct_key
                    return (
                      <div key={o.key} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${correct ? 'border-success bg-success/10 text-ink' : 'border-border text-muted'}`}>
                        <span className="font-semibold">{o.key}</span><span>{o.text}</span>
                        {correct && <span className="ml-auto shrink-0 text-[11px] font-semibold text-success">correta</span>}
                      </div>
                    )
                  })}
                </div>
                {q.explanation && <p className="mt-2 rounded-md bg-surface-2/50 p-2 text-xs text-ink"><span className="font-semibold text-muted">Comentário. </span>{q.explanation}</p>}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}
