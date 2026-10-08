import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LOGIN_ROUTE } from '@/lib/routes'
import { getChallengeToday } from '@/lib/challenge/today'
import { ChallengeQuiz } from './ChallengeQuiz'

export const dynamic = 'force-dynamic'

const STAGE_LABEL: Record<string, string> = {
  anamnese: 'Anamnese', exame: 'Exame físico', complementares: 'Exames complementares',
  conduta: 'Conduta', conclusao: 'Conclusão',
}

function todayISO() { return new Date().toISOString().slice(0, 10) }

export default async function DesafioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)

  const admin = createAdminClient()
  const data = await getChallengeToday(admin, user.id, todayISO())

  if (!data.case) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold text-ink">Desafio da semana</h1>
        <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-muted">
          Ainda não há um caso ativo. Volte em breve — todo começo de semana abre um novo caso de Clínica Médica.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{data.case.title}</h1>
          <p className="mt-0.5 text-sm text-muted">Caso da semana · Clínica Médica</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-lg font-bold text-primary tabular-nums">{data.balance.toLocaleString('pt-BR')} <span className="text-xs">MC</span></p>
          <p className="text-[11px] text-muted">🔥 streak {data.streak}</p>
        </div>
      </header>

      <p className="rounded-xl border border-border bg-surface p-4 text-sm text-ink">{data.case.overview}</p>

      <ol className="space-y-4">
        {data.days.map(d => {
          const isToday = d.dayIndex === data.todayDayIndex
          return (
            <li key={d.dayIndex} className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">Dia {d.dayIndex} · {STAGE_LABEL[d.stage] ?? d.stage}</span>
                {isToday && !d.answered && <span className="text-[11px] font-medium text-warning">responder hoje</span>}
                {d.answered && <span className="text-[11px] font-medium text-success">{d.answered.isCorrect ? '✓ acertou' : '✕ errou'}</span>}
              </div>
              <p className="mb-3 whitespace-pre-wrap text-sm text-ink">{d.narrative}</p>
              <ChallengeQuiz
                quizId={d.quiz.id}
                prompt={d.quiz.prompt}
                options={d.quiz.options}
                answerable={isToday && !d.answered}
                answered={d.answered}
                reveal={d.reveal}
                balance={data.balance}
                isConclusion={d.stage === 'conclusao'}
              />
            </li>
          )
        })}
      </ol>

      {data.conclusion && (
        <section className="rounded-xl border border-success/30 bg-success/10 p-4">
          <h2 className="text-sm font-semibold text-success">Diagnóstico do caso</h2>
          <p className="mt-1 font-medium text-ink">{data.conclusion.trueDiagnosis}</p>
          <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Revisão</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{data.conclusion.review}</p>
        </section>
      )}
    </div>
  )
}
