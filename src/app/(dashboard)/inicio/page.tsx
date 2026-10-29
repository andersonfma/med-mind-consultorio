import { redirect } from 'next/navigation'
import Link from 'next/link'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  LOGIN_ROUTE, DASHBOARD_ROUTE, FEED_ROUTE, CHALLENGE_ROUTE, RANKING_ROUTE, PREMIUM_ROUTE, EXAMS_ROUTE,
} from '@/lib/routes'
import { getChallengeToday } from '@/lib/challenge/today'
import { ChallengeBanner } from '../feed/ChallengeBanner'

export const dynamic = 'force-dynamic'

// Hub do ecossistema: a 1ª tela após o login. Cada bloco leva direto à sua seção.
// Direção editorial/tipográfica: índice + nome em display + barra de cor lateral
// (a barra referencia a colunata do logo). Sem pictogramas.
const TILES = [
  { href: DASHBOARD_ROUTE, n: '01', label: 'Simulador', title: 'Consultório', desc: 'Atenda pacientes virtuais e receba a avaliação do seu raciocínio por IA.', color: '#22E0E6' },
  { href: FEED_ROUTE,      n: '02', label: 'Comunidade', title: 'Feed & Stories', desc: 'Poste casos e dúvidas, siga colegas e acompanhe os stories.', color: '#FF6E86' },
  { href: CHALLENGE_ROUTE, n: '03', label: 'Hábito diário', title: 'Desafio da Semana', desc: 'Um quiz por dia — e aposte seus MedCoins no palpite.', color: '#FFC24D' },
  { href: RANKING_ROUTE,   n: '04', label: 'Disputa', title: 'Ranking & MedCoin', desc: 'Suba no ranking e junte moedas treinando com a turma.', color: '#34E5A0' },
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
              className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-5 pl-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-glow-primary)]"
            >
              {/* barra-coluna lateral (motivo do logo), na cor da seção */}
              <span className="absolute left-0 top-0 h-full w-[3px]" aria-hidden
                style={{ background: `linear-gradient(to bottom, ${t.color}, transparent 85%)` }} />
              {/* marca d'água: o símbolo do logo (coluna/pilar), tingido na cor da seção */}
              <svg className="pointer-events-none absolute -bottom-5 -right-3 h-[150px] w-[150px]" viewBox="0 0 32 32"
                fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden style={{ color: t.color, opacity: 0.09 }}>
                <line x1="7.5" y1="8.5" x2="24.5" y2="8.5" />
                <line x1="9.3" y1="11.2" x2="22.7" y2="11.2" />
                <line x1="10.8" y1="11.2" x2="10.8" y2="22.6" />
                <line x1="21.2" y1="11.2" x2="21.2" y2="22.6" />
                <path d="M12.2 11.2 L16 18.8 L19.8 11.2" />
              </svg>

              <p className="relative font-mono text-[10.5px] uppercase tracking-[0.18em]" style={{ color: t.color }}>{t.label}</p>
              <h2 className="mt-1.5 font-display text-xl font-bold tracking-tight text-ink">{t.title}</h2>
              <p className="mt-1.5 max-w-[32ch] text-sm text-muted">{t.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold transition-all group-hover:gap-2"
                style={{ color: t.color }}>Entrar <span aria-hidden>→</span></span>
            </Link>
          ))}
        </div>

        {/* Bloco premium: Simulados ENARE/ENAMED */}
        <Link href={EXAMS_ROUTE} className="group relative block overflow-hidden rounded-2xl border p-5 transition-all hover:-translate-y-0.5"
          style={{ borderColor: 'rgba(231,178,58,.4)', background: 'linear-gradient(90deg, rgba(231,178,58,.1), rgba(231,178,58,.02))' }}>
          <span className="absolute left-0 top-0 h-full w-[3px]" aria-hidden style={{ background: 'linear-gradient(to bottom,#E7B23A,transparent 85%)' }} />
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em]" style={{ color: '#E7B23A' }}>Premium ✦ · Novo</p>
          <h2 className="mt-1.5 font-display text-xl font-bold tracking-tight text-ink">Simulado ENARE / ENAMED</h2>
          <p className="mt-1.5 max-w-[46ch] text-sm text-muted">Questões por IA nos moldes das provas, por área, com gabarito comentado.</p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold transition-all group-hover:gap-2" style={{ color: '#E7B23A' }}>Abrir <span aria-hidden>→</span></span>
        </Link>

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
