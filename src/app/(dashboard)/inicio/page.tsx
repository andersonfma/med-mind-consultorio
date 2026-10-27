import { redirect } from 'next/navigation'
import Link from 'next/link'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  LOGIN_ROUTE, DASHBOARD_ROUTE, FEED_ROUTE, CHALLENGE_ROUTE, RANKING_ROUTE, PREMIUM_ROUTE,
} from '@/lib/routes'
import { getChallengeToday } from '@/lib/challenge/today'
import { ChallengeBanner } from '../feed/ChallengeBanner'

export const dynamic = 'force-dynamic'

// Hub do ecossistema: a 1ª tela após o login. Cada quadrado leva direto à sua seção.
const TILES = [
  { href: DASHBOARD_ROUTE, icon: '🩺', title: 'Consultório', desc: 'Atenda pacientes virtuais e veja sua avaliação por IA.',
    tone: { bg: 'rgba(34,224,230,.1)', bd: 'rgba(34,224,230,.3)' } },
  { href: FEED_ROUTE, icon: '⚡', title: 'Feed & Stories', desc: 'Casos, dúvidas e stories da comunidade.',
    tone: { bg: 'rgba(255,110,134,.1)', bd: 'rgba(255,110,134,.3)' } },
  { href: CHALLENGE_ROUTE, icon: '🎯', title: 'Desafio da Semana', desc: 'Um quiz por dia e aposte seus MedCoins.',
    tone: { bg: 'rgba(255,194,77,.11)', bd: 'rgba(255,194,77,.32)' } },
  { href: RANKING_ROUTE, icon: '🏆', title: 'Ranking & MedCoin', desc: 'Dispute o topo entre os colegas.',
    tone: { bg: 'rgba(52,229,160,.1)', bd: 'rgba(52,229,160,.3)' } },
]

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  const db = supabase as unknown as SupabaseClient
  const admin = createAdminClient()

  const [{ data: prof }, challenge] = await Promise.all([
    db.from('profiles').select('full_name, is_premium').eq('id', user.id).maybeSingle(),
    getChallengeToday(admin, user.id, new Date().toISOString().slice(0, 10)),
  ])
  const p = prof as { full_name: string | null; is_premium: boolean | null } | null
  const firstName = (p?.full_name ?? '').trim().split(' ')[0] || null

  const todayDay = challenge.days.find((d) => d.dayIndex === challenge.todayDayIndex) ?? challenge.days[challenge.days.length - 1] ?? null
  const banner = challenge.case && todayDay
    ? { title: challenge.case.title, stage: todayDay.stage, answered: !!todayDay.answered, streak: challenge.streak, isToday: challenge.todayDayIndex != null }
    : null

  return (
    <div className="relative">
      <div className="mm-aura" aria-hidden />
      <div className="relative mx-auto max-w-3xl space-y-6 py-2">
        <header>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Bem-vindo{firstName ? ` de volta` : ''}</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {firstName ? <>Olá, {firstName}.</> : 'Por onde começar?'}
          </h1>
          <p className="mt-1.5 text-sm text-muted">Escolha por onde entrar hoje.</p>
        </header>

        {banner && <ChallengeBanner {...banner} />}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {TILES.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-glow-primary)]"
            >
              <span
                className="mb-3 grid h-12 w-12 place-items-center rounded-xl text-2xl"
                style={{ background: t.tone.bg, border: `1px solid ${t.tone.bd}` }}
              >
                {t.icon}
              </span>
              <h2 className="font-display text-lg font-bold tracking-tight text-ink">{t.title}</h2>
              <p className="mt-1 text-sm text-muted">{t.desc}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                Entrar →
              </span>
            </Link>
          ))}
        </div>

        {!p?.is_premium && (
          <Link href={PREMIUM_ROUTE} className="block rounded-xl border px-4 py-3 text-center text-sm font-medium"
            style={{ borderColor: 'rgba(231,178,58,.4)', background: 'rgba(231,178,58,.06)', color: '#E7B23A' }}>
            ✦ Conheça o Med Mind Premium — consultas e especialidades ilimitadas
          </Link>
        )}
      </div>
    </div>
  )
}
