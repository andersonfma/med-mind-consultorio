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
// Ícones de traço próprios (não emoji) — na cor de cada seção.
const TILES = [
  {
    href: DASHBOARD_ROUTE, title: 'Consultório', desc: 'Atenda pacientes virtuais e veja sua avaliação por IA.',
    color: '#22E0E6', bg: 'rgba(34,224,230,.1)', bd: 'rgba(34,224,230,.3)',
    // Balão de consulta com traçado de ECG (o clínico), em vez do estetoscópio clichê.
    paths: ['M4 5.5h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H10l-4 3v-3H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z', 'M6.5 10.5h2l1.2-2.5 2 5 1.3-2.5H17.5'],
  },
  {
    href: FEED_ROUTE, title: 'Feed & Stories', desc: 'Casos, dúvidas e stories da comunidade.',
    color: '#FF6E86', bg: 'rgba(255,110,134,.1)', bd: 'rgba(255,110,134,.3)',
    // Cartões sobrepostos (posts/stories).
    paths: ['M8 4h11a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z', 'M4 7v11a1 1 0 0 0 1 1h11', 'M10.5 8.5h6M10.5 11.5h4'],
  },
  {
    href: CHALLENGE_ROUTE, title: 'Desafio da Semana', desc: 'Um quiz por dia e aposte seus MedCoins.',
    color: '#FFC24D', bg: 'rgba(255,194,77,.11)', bd: 'rgba(255,194,77,.32)',
    // Bandeira (um desafio a cumprir), em vez do alvo.
    paths: ['M6 21V4', 'M6 4h11l-2.2 3.3L17 11H6'],
  },
  {
    href: RANKING_ROUTE, title: 'Ranking & MedCoin', desc: 'Dispute o topo entre os colegas.',
    color: '#34E5A0', bg: 'rgba(52,229,160,.1)', bd: 'rgba(52,229,160,.3)',
    // Pódio de 3 colunas (a do meio mais alta).
    paths: ['M3 21h18', 'M4.5 21v-4.5h4V21', 'M10 21V9h4v12', 'M15.5 21v-7h4v7'],
  },
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
                className="mb-3 grid h-12 w-12 place-items-center rounded-xl"
                style={{ background: t.bg, border: `1px solid ${t.bd}` }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={t.color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {t.paths.map((d, i) => <path key={i} d={d} />)}
                </svg>
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
