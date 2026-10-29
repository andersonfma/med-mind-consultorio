import { redirect } from 'next/navigation'
import Link from 'next/link'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE, PREMIUM_ROUTE } from '@/lib/routes'
import { EXAM_AREAS } from '@/lib/exam/blueprint'
import { ExamRunner } from './ExamRunner'

export const dynamic = 'force-dynamic'

export default async function ExamsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  const db = supabase as unknown as SupabaseClient
  const { data: prof } = await db.from('profiles').select('is_premium').eq('id', user.id).maybeSingle()
  const isPremium = !!(prof as { is_premium?: boolean } | null)?.is_premium

  const areas = EXAM_AREAS.map((a) => ({ key: a.key, label: a.label }))

  return (
    <div className="mx-auto max-w-2xl space-y-5 py-2">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: '#E7B23A' }}>Premium · Simulados</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">Simulado ENARE / ENAMED</h1>
        <p className="mt-1.5 text-sm text-muted">Questões originais geradas por IA nos moldes das provas — vinheta clínica, 5 alternativas, gabarito comentado.</p>
      </header>

      {isPremium ? (
        <ExamRunner areas={areas} />
      ) : (
        <div className="rounded-2xl border p-6 text-center" style={{ borderColor: 'rgba(231,178,58,.4)', background: 'rgba(231,178,58,.06)' }}>
          <p className="font-display text-xl font-bold" style={{ color: '#E7B23A' }}>Recurso Premium ✦</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">Os simulados ENARE/ENAMED fazem parte do Med Mind Premium. Gere quantos quiser, por área, com gabarito comentado.</p>
          <Link href={PREMIUM_ROUTE} className="mt-4 inline-block rounded-xl px-5 py-2.5 text-sm font-bold text-[#1a1203]"
            style={{ background: 'linear-gradient(140deg,#F5C84B,#E7B23A)' }}>
            Conhecer o Premium →
          </Link>
        </div>
      )}
    </div>
  )
}
