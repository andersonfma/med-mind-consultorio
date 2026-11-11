import { redirect } from 'next/navigation'
import Link from 'next/link'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE, DASHBOARD_ROUTE } from '@/lib/routes'

export const dynamic = 'force-dynamic'

const GOLD = '#E7B23A'

// Ícones em linha (SVG) — sem emojis.
const svg = { width: 20, height: 20, viewBox: '0 0 24 24', 'aria-hidden': true } as const
const line = { ...svg, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const IconStethoscope = () => (
  <svg {...line}><path d="M11 2v2M5 2v2M5 4H4a2 2 0 0 0-2 2v3a6 6 0 0 0 12 0V6a2 2 0 0 0-2-2h-1M8 15a6 6 0 0 0 12 0v-2" /><circle cx="20" cy="11" r="2" /></svg>
)
const IconInfinity = () => (
  <svg {...line}><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z" /></svg>
)
const IconChat = () => (
  <svg {...line}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
)
const IconExam = () => (
  <svg {...line}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="m9 15 2 2 4-4" /></svg>
)
const IconStar = () => (
  <svg {...svg} fill="currentColor"><path d="M12 2.4l2.63 5.56 6.07.86-4.4 4.2 1.06 6.04L12 16.9l-5.43 2.16 1.06-6.04-4.4-4.2 6.07-.86L12 2.4z" /></svg>
)

const BENEFITS = [
  { Icon: IconStethoscope, title: 'Todas as 9 especialidades', desc: 'Sem travas: atenda casos de qualquer área clínica, quando quiser.' },
  { Icon: IconInfinity, title: 'Casos ilimitados', desc: 'Nada de teto mensal — treine o quanto precisar, todos os dias.' },
  { Icon: IconChat, title: 'Consultas de IA ilimitadas', desc: 'Converse com os pacientes e receba avaliação sem limite de uso.' },
  { Icon: IconExam, title: 'Simulados ENARE e ENAMED por IA', desc: 'Questões originais nos moldes das provas, por área, com gabarito comentado.' },
  { Icon: IconStar, title: 'Selo Premium no perfil', desc: 'Destaque na comunidade — o selo Premium aparece no feed e no seu perfil.' },
]

const SOON = [
  { title: 'Relatório de tendências', desc: 'Temas e estruturas que mais caem nas provas, para focar no que importa.' },
  { title: 'Relatórios de evolução', desc: 'Seu raciocínio e comunicação ao longo do tempo, com os pontos a melhorar.' },
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

  // Links de checkout da Hotmart (configuráveis por env); e-mail pré-preenchido
  // para o webhook casar o comprador. Enquanto não houver link, cai no "interesse".
  const withEmail = (url: string) => {
    if (!user.email) return url
    return url + (url.includes('?') ? '&' : '?') + 'email=' + encodeURIComponent(user.email)
  }
  // Checkout da Hotmart (produto Med Mind Premium, ID 8937171). O link base
  // apresenta os dois planos (Anual R$229 / Mensal R$29) para o comprador escolher.
  // As env vars sobrescrevem caso um dia criemos links deep por plano.
  const HOTMART_CHECKOUT = 'https://pay.hotmart.com/I108431179E'
  const checkout = [
    { label: 'Assinar anual · R$229/ano', href: withEmail(process.env.HOTMART_CHECKOUT_ANNUAL_URL || HOTMART_CHECKOUT), primary: true },
    { label: 'Mensal · R$29/mês', href: withEmail(process.env.HOTMART_CHECKOUT_MONTHLY_URL || HOTMART_CHECKOUT), primary: false },
  ] as Array<{ label: string; href: string; primary: boolean }>

  const { PremiumInterestButton } = await import('./PremiumInterestButton')
  const { RedeemFounderCode } = await import('./RedeemFounderCode')

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-2">
      {/* Hero */}
      <header className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
          style={{ color: GOLD, border: `1px solid ${GOLD}55`, background: 'rgba(231,178,58,.08)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2.4l2.63 5.56 6.07.86-4.4 4.2 1.06 6.04L12 16.9l-5.43 2.16 1.06-6.04-4.4-4.2 6.07-.86L12 2.4z" /></svg>
          Med Mind Premium
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
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg" style={{ color: GOLD, background: 'rgba(231,178,58,.1)', border: `1px solid ${GOLD}33` }}>
                <b.Icon />
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
            <p className="inline-flex items-center justify-center gap-2 font-display text-xl font-bold" style={{ color: GOLD }}>
              Você já é Premium
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2.4l2.63 5.56 6.07.86-4.4 4.2 1.06 6.04L12 16.9l-5.43 2.16 1.06-6.04-4.4-4.2 6.07-.86L12 2.4z" /></svg>
            </p>
            <p className="mt-1 text-sm text-muted">Todos os recursos acima estão liberados para você. Bom treino!</p>
            <Link href={DASHBOARD_ROUTE} className="mt-3 inline-block text-sm font-medium text-primary hover:underline">Ir para o consultório →</Link>
          </div>
        ) : checkout.length > 0 ? (
          <div className="space-y-3">
            <p className="text-center text-sm text-muted">Assine e libere tudo agora.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              {checkout.map((c) => (
                <a key={c.label} href={c.href} target="_blank" rel="noopener"
                  className="flex-1 rounded-xl px-5 py-3 text-center text-sm font-bold text-[#1a1203]"
                  style={{ background: c.primary ? 'linear-gradient(140deg,#F5C84B,#E7B23A)' : 'transparent', color: c.primary ? '#1a1203' : GOLD, border: c.primary ? 'none' : `1px solid ${GOLD}66` }}>
                  {c.label}
                </a>
              ))}
            </div>
            <p className="text-center text-[11px] text-muted">Pagamento seguro via Hotmart · Pix, cartão ou boleto</p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-center text-sm text-muted">Preço e assinatura <span className="text-ink font-medium">em breve</span>. Quer ser avisado?</p>
            <PremiumInterestButton registered={registered} />
          </>
        )}
      </div>

      {/* Resgate de código de fundador (ações presenciais, ex.: aulas) */}
      {!isPremium && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <RedeemFounderCode />
        </div>
      )}
    </div>
  )
}
