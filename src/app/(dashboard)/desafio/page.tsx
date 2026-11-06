import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LOGIN_ROUTE } from '@/lib/routes'
import { getChallengeToday } from '@/lib/challenge/today'
import { ChallengeQuiz } from './ChallengeQuiz'
import { StudyCard } from './StudyCard'

export const dynamic = 'force-dynamic'

const STAGE_LABEL: Record<string, string> = {
  anamnese: 'Anamnese', exame: 'Exame físico', complementares: 'Exames complementares',
  sintese: 'Síntese diagnóstica', conduta: 'Conduta', complicacoes: 'Complicações', conclusao: 'Conclusão',
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
        <StudyCard
          title={data.case.title.replace(/^Caso da Semana:\s*/i, '')}
          diagnosis={data.conclusion.trueDiagnosis}
          review={data.conclusion.review}
          points={data.days
            .filter((d) => d.reveal?.explanation && d.stage !== 'conclusao')
            .map((d) => ({ stage: STAGE_LABEL[d.stage] ?? d.stage, text: (d.reveal!.explanation as string).trim() }))}
        />
      )}
    </div>
  )
}
