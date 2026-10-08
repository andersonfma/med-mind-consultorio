import Link from 'next/link'
import { CHALLENGE_ROUTE } from '@/lib/routes'

const STAGE_LABEL: Record<string, string> = {
  anamnese: 'Anamnese', exame: 'Exame físico', complementares: 'Exames complementares',
  conduta: 'Conduta', conclusao: 'Conclusão',
}

export function ChallengeBanner({ title, stage, answered, streak }: { title: string; stage: string; answered: boolean; streak: number }) {
  return (
    <Link
      href={CHALLENGE_ROUTE}
      className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-lg">🎯</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">Desafio de hoje · {STAGE_LABEL[stage] ?? stage}</p>
        <p className="truncate text-xs text-muted">{title}</p>
      </div>
      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${answered ? 'bg-success/15 text-success' : 'bg-primary text-primary-ink'}`}>
        {answered ? `✓ feito · 🔥${streak}` : 'Responder'}
      </span>
    </Link>
  )
}
