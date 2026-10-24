import { redirect } from 'next/navigation'
import Link from 'next/link'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE, DASHBOARD_ROUTE } from '@/lib/routes'

export const dynamic = 'force-dynamic'

const GOLD = '#E7B23A'

const BENEFITS = [
  { icon: '🩺', title: 'Todas as 9 especialidades', desc: 'Sem travas: atenda casos de qualquer área clínica, quando quiser.' },
  { icon: '∞', title: 'Casos ilimitados', desc: 'Nada de teto mensal — treine o quanto precisar, todos os dias.' },
  { icon: '⚡', title: 'Consultas de IA ilimitadas', desc: 'Converse com os pacientes e receba avaliação sem limite de uso.' },
  { icon: '✦', title: 'Selo Premium no perfil', desc: 'Destaque na comunidade — seu ✦ aparece no feed e no seu perfil.' },
]

const SOON = [
  { title: 'Simulados ENAMED/ENARE por IA', desc: 'Simulados originais nos moldes das provas, fiéis à estrutura real.' },
  { title: 'Relatório de tendências', desc: 'Temas e estruturas que mais caem, para estudar o que importa.' },
  { title: 'Relatórios de evolução', desc: 'Seu raciocínio e comunicação ao longo do tempo, com pontos fracos.' },
]

export default async function PremiumPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  const db = supabase as unknown as SupabaseClient

  const [{ data: prof }, { data: interest }] = await Promise.all([
    db.from('profiles').select('is_premium').eq('id', user.id).maybeSingle(),
    db.from('premium_interest').select('user_id').eq('user_id', user.id).maybeSingle(),
  ])
  const isPremium = !!(prof as { is_premium?: boolean } | null)?.is_premium
  const registered = !!interest

  const { PremiumInterestButton } = await import('./PremiumInterestButton')

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-2">
      {/* Hero */}
      <header className="text-center">
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
          style={{ color: GOLD, border: `1px solid ${GOLD}55`, background: 'rgba(231,178,58,.08)' }}
        >
          ✦ Med Mind Premium
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Treine sem limites.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-muted">
          O essencial do Med Mind é grátis. O Premium tira os limites e aprofunda — para quem leva o treino a sério.
        </p>
      </header>

      {/* Benefícios */}
      <div className="grid gap-3 sm:grid-cols-2">
        {BENEFITS.map((b) => (
          <div key={b.title} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg" style={{ color: GOLD, background: 'rgba(231,178,58,.1)', border: `1px solid ${GOLD}33` }}>
                {b.icon}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-ink">{b.title}</h3>
                <p className="mt-0.5 text-xs text-muted">{b.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Grátis vs Premium */}
      <div className="rounded-xl border border-border bg-surface p-4 text-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">No plano grátis você continua com</p>
        <p className="text-muted">
          Rede social completa, desafio da semana com quiz e MedCoin, compartilhar resultados, e
          <span className="text-ink"> 5 casos por mês em 2 especialidades</span>.
        </p>
      </div>

      {/* Em breve */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Em breve, exclusivo do Premium</p>
        <div className="space-y-2">
          {SOON.map((s) => (
            <div key={s.title} className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-surface/50 p-3">
              <span className="mt-0.5 text-xs font-bold" style={{ color: GOLD }}>em breve</span>
              <div>
                <h3 className="text-sm font-medium text-ink">{s.title}</h3>
                <p className="text-xs text-muted">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-2xl border p-5" style={{ borderColor: `${GOLD}44`, background: 'rgba(231,178,58,.05)' }}>
        {isPremium ? (
          <div className="text-center">
            <p className="font-display text-xl font-bold" style={{ color: GOLD }}>Você já é Premium ✦</p>
            <p className="mt-1 text-sm text-muted">Todos os recursos acima estão liberados para você. Bom treino!</p>
            <Link href={DASHBOARD_ROUTE} className="mt-3 inline-block text-sm font-medium text-primary hover:underline">Ir para o consultório →</Link>
          </div>
        ) : (
          <>
            <p className="mb-3 text-center text-sm text-muted">Preço e assinatura <span className="text-ink font-medium">em breve</span>. Quer ser avisado?</p>
            <PremiumInterestButton registered={registered} />
          </>
        )}
      </div>
    </div>
  )
}
