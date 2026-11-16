import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin/access'
import { LOGIN_ROUTE } from '@/lib/routes'
import { AB4_AXES, COMM_AXES } from '@/lib/consultations/ab4-labels'
import { ab4Averages, commAverages, ab4Of, commOf, type ConsultRow } from '@/lib/admin/stats'
import { isMature, isRetainedD7, type Feature, type UserActivity } from '@/lib/admin/retention'
import { AxisBars } from '@/components/admin/AxisBars'
import { DistBars } from '@/components/admin/DistBars'
import { BlockButton } from '@/components/admin/BlockButton'
import { PremiumButton } from '@/components/admin/PremiumButton'
import { PremiumBadge } from '@/components/social/PremiumBadge'
import { premiumSource, PREMIUM_SOURCE_LABEL } from '@/lib/admin/segments'

export const dynamic = 'force-dynamic'

function fmt(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  if (!isAdminEmail(user.email)) notFound()

  const { id } = await params
  const admin = createAdminClient()

  const [target, profileRes, patientsRes, consultationsRes, examsRes, rxRes, quizRes, simRes, mapsRes, postsRes, reactsRes] = await Promise.all([
    admin.auth.admin.getUserById(id),
    admin.from('profiles').select('full_name, ai_calls_used, ai_calls_limit, ai_period_start, is_premium').eq('id', id).single(),
    admin.from('patients').select('id, name, specialty, diagnosis_status').eq('user_id', id),
    admin
      .from('consultations')
      .select('user_id, status, created_at, finished_at, ab4_score, communication_score, patient_id')
      .eq('user_id', id)
      .order('finished_at', { ascending: false }),
    admin.from('exam_requests').select('status, exam_name, attempts').eq('user_id', id),
    admin.from('prescriptions').select('adequacy').eq('user_id', id),
    admin.from('quiz_answers').select('is_correct, created_at').eq('user_id', id),
    admin.from('exam_attempts').select('score, total, created_at').eq('user_id', id),
    admin.from('disease_maps').select('id, disease, created_at').eq('user_id', id),
    admin.from('posts').select('created_at').eq('author_id', id),
    admin.from('post_reactions').select('created_at').eq('user_id', id),
  ])

  const au = target.data?.user as
    | { id: string; email?: string; created_at?: string; last_sign_in_at?: string | null; banned_until?: string | null }
    | undefined
  if (!au) notFound()

  const prof = (profileRes.data ?? null) as { full_name: string | null; ai_calls_used: number | null; ai_calls_limit: number | null; is_premium: boolean | null } | null

  // Formação + origem do Premium (queries guardadas: colunas/linhas podem faltar).
  const [{ data: facData }, { data: redData }, { data: payData }] = await Promise.all([
    admin.from('profiles').select('user_type, faculty, faculty_period').eq('id', id).maybeSingle(),
    admin.from('founder_redemptions').select('code, granted_until').eq('user_id', id),
    admin.from('payment_events').select('event, created_at').eq('user_id', id),
  ])
  const formacao = (facData ?? null) as { user_type: string | null; faculty: string | null; faculty_period: string | null } | null
  const redemptions = (redData ?? []) as Array<{ code: string; granted_until: string }>
  const payments = (payData ?? []) as Array<{ event: string; created_at: string }>
  const hasPaid = payments.some((p) => /APPROVED|COMPLETE|COMPLETED/i.test(p.event))
  const pSource = premiumSource(!!prof?.is_premium, redemptions.length > 0, hasPaid)
  const patients = (patientsRes.data ?? []) as Array<{ id: string; name: string; specialty: string; diagnosis_status: string }>
  const consultations = (consultationsRes.data ?? []) as (ConsultRow & { patient_id: string })[]
  const exams = (examsRes.data ?? []) as Array<{ status: string; exam_name: string; attempts: number | null }>
  const prescriptions = (rxRes.data ?? []) as Array<{ adequacy: string | null }>
  const specById = new Map(patients.map((p) => [p.id, p.specialty]))
  const nameById = new Map(patients.map((p) => [p.id, p.name]))

  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)

  // Indicadores pedagógicos do aluno
  const examTotal = exams.length
  const examRejected = exams.filter((e) => e.status === 'rejected').length
  const topRejected = [...exams
    .filter((e) => e.status === 'rejected')
    .reduce((m, e) => m.set(e.exam_name, (m.get(e.exam_name) ?? 0) + 1), new Map<string, number>())
    .entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  const rxScored = prescriptions.filter((r) => r.adequacy)
  const rxAd = rxScored.filter((r) => r.adequacy === 'adequada').length
  const rxPar = rxScored.filter((r) => r.adequacy === 'parcial').length
  const rxIna = rxScored.filter((r) => r.adequacy === 'inadequada').length
  const rxN = rxScored.length

  const dxAchieved = patients.filter((p) => p.diagnosis_status === 'achieved').length
  const dxRevealed = patients.filter((p) => p.diagnosis_status === 'revealed').length
  const dxClosed = dxAchieved + dxRevealed

  const blocked = !!au.banned_until && Date.parse(au.banned_until) > Date.now()
  const finishedC = consultations.filter((c) => c.status === 'finished')

  const ab4 = ab4Averages(consultations)
  const comm = commAverages(consultations)
  const ab4Axes = AB4_AXES.map((ax) => ({ label: ax.label, value: ab4[ax.key] }))
  const commAxesData = COMM_AXES.map((ax) => ({ label: ax.label, value: comm[ax.key] }))

  // Ponto fraco (menor média entre os 4 eixos do raciocínio)
  const weakest = ab4Axes
    .filter((a) => a.value != null)
    .sort((a, b) => (a.value as number) - (b.value as number))[0]

  const history = finishedC.map((c) => ({
    date: c.finished_at,
    specialty: specById.get(c.patient_id) ?? '—',
    patient: nameById.get(c.patient_id) ?? '—',
    ab4: ab4Of(c.ab4_score)?.overall ?? null,
    comm: commOf(c.communication_score)?.overall ?? null,
  }))

  // Desempenho por recurso + status de retenção (mesma régua da lib)
  const quiz = (quizRes.data ?? []) as Array<{ is_correct: boolean; created_at: string | null }>
  const sims = (simRes.data ?? []) as Array<{ score: number; total: number; created_at: string | null }>
  const maps = (mapsRes.data ?? []) as Array<{ id: string; disease: string; created_at: string | null }>
  const myPosts = (postsRes.data ?? []) as Array<{ created_at: string | null }>
  const myReacts = (reactsRes.data ?? []) as Array<{ created_at: string | null }>
  const quizAcc = quiz.length ? pct(quiz.filter((q) => q.is_correct).length, quiz.length) : null
  const simAvg = sims.length ? Math.round(sims.reduce((s, e) => s + (e.total ? e.score / e.total : 0), 0) / sims.length * 100) : null

  const nowMs = Date.now()
  const ev: { feature: Feature; ts: number }[] = []
  const pushEv = (f: Feature, ts: string | null | undefined) => { if (!ts) return; const t = Date.parse(ts); if (!Number.isNaN(t)) ev.push({ feature: f, ts: t }) }
  for (const c of consultations) pushEv('simulador', c.created_at)
  for (const q of quiz) pushEv('desafio', q.created_at)
  for (const s of sims) pushEv('simulados', s.created_at)
  for (const m of maps) pushEv('mapas', m.created_at)
  for (const p of myPosts) pushEv('social', p.created_at)
  for (const r of myReacts) pushEv('social', r.created_at)
  const uact: UserActivity = { id: au.id, signup: au.created_at ? Date.parse(au.created_at) : nowMs, events: ev }
  const retencaoStatus = !isMature(uact, nowMs) ? { label: 'Novo', cls: 'border-border text-muted' }
    : isRetainedD7(uact, nowMs) ? { label: 'Retido', cls: 'border-success/40 bg-success/10 text-success' }
    : { label: 'Em risco', cls: 'border-danger/40 bg-danger/10 text-danger' }
  const timeline = [...ev].sort((a, b) => a.ts - b.ts)

  return (
    <div className="space-y-6 p-1 sm:p-2">
      <div>
        <Link href="/admin" className="text-sm text-muted hover:text-primary">← Voltar ao painel</Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{prof?.full_name ?? '—'}</h1>
            {prof?.is_premium && <PremiumBadge label />}
            {blocked ? (
              <span className="rounded-full border border-danger/40 bg-danger/10 px-2.5 py-0.5 text-xs font-semibold text-danger">Bloqueado</span>
            ) : (
              <span className="rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">Ativo</span>
            )}
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${retencaoStatus.cls}`}>{retencaoStatus.label}</span>
          </div>
          <p className="mt-0.5 text-sm text-muted">{au.email}</p>
          <p className="mt-1 text-xs text-muted">
            {formacao?.user_type === 'doctor' ? 'Médico(a)' : 'Estudante'}
            {formacao?.faculty ? <> · <span className="text-ink">{formacao.faculty}</span></> : <> · <span className="italic">faculdade não informada</span></>}
            {formacao?.faculty_period ? ` · ${formacao.faculty_period}` : ''}
          </p>
          {prof?.is_premium && (
            <p className="mt-1 text-xs">
              <span className="text-muted">Premium: </span>
              <span className={pSource === 'hotmart' ? 'font-semibold text-success' : pSource === 'manual' ? 'font-semibold text-warning' : 'font-semibold text-chart-2'}>
                {PREMIUM_SOURCE_LABEL[pSource]}
              </span>
              {redemptions.length > 0 && <span className="text-muted"> · cupom {redemptions.map((r) => r.code).join(', ')}</span>}
              {pSource === 'manual' && <span className="text-warning"> · sem venda nem cupom — concessão manual</span>}
            </p>
          )}
          <p className="mt-2 text-xs text-muted">
            Cadastro {fmt(au.created_at)} · último acesso {fmt(au.last_sign_in_at)} · IA {prof?.ai_calls_used ?? 0}/{prof?.ai_calls_limit ?? 0}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <PremiumButton userId={au.id} premium={!!prof?.is_premium} />
          <BlockButton userId={au.id} blocked={blocked} variant="md" />
        </div>
      </header>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Raciocínio médio</p>
          <p className="mt-1 font-display text-3xl font-bold tabular-nums text-ink">
            {ab4.overall != null ? ab4.overall.toFixed(1) : '—'}<span className="text-sm text-muted">/10</span>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Comunicação média</p>
          <p className="mt-1 font-display text-3xl font-bold tabular-nums text-ink">
            {comm.overall != null ? comm.overall.toFixed(1) : '—'}<span className="text-sm text-muted">/10</span>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Consultas finalizadas</p>
          <p className="mt-1 font-display text-3xl font-bold tabular-nums text-ink">{finishedC.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">A fortalecer</p>
          <p className="mt-1 font-display text-xl font-bold text-warning">{weakest ? weakest.label : '—'}</p>
        </div>
      </div>

      {/* Desempenho por recurso */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Desempenho por recurso</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Simulador</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">{consultations.length}</p>
            <p className="text-xs text-muted">{finishedC.length} finalizadas</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Desafio</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">{quiz.length}</p>
            <p className="text-xs text-muted">respostas{quizAcc != null ? ` · ${quizAcc}% de acerto` : ''}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Simulados</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">{sims.length}</p>
            <p className="text-xs text-muted">{simAvg != null ? `${simAvg}% médio` : 'nenhum ainda'}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Mapas da Doença</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">{maps.length}</p>
            <p className="truncate text-xs text-muted">{maps.length ? maps.map((m) => m.disease).slice(0, 3).join(', ') : 'nenhum ainda'}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Comunidade</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">{myPosts.length + myReacts.length}</p>
            <p className="text-xs text-muted">{myPosts.length} posts · {myReacts.length} curtidas</p>
          </div>
        </div>
        {timeline.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Linha do tempo</p>
            <div className="flex flex-wrap gap-1.5">
              {timeline.slice(-20).map((e, i) => (
                <span key={i} className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">
                  {e.feature} · {new Date(e.ts).toLocaleDateString('pt-BR')}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Critérios objetivos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Raciocínio clínico — por critério</h2>
          <AxisBars axes={ab4Axes} />
        </section>
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Comunicação — por critério</h2>
          <AxisBars axes={commAxesData} fill="bg-chart-2" />
        </section>
      </div>

      {/* Indicadores pedagógicos do aluno */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Pedidos de exame</h2>
          {examTotal === 0 ? (
            <p className="text-xs text-muted">Nenhum exame solicitado.</p>
          ) : (
            <>
              <div className="mb-1 flex items-baseline gap-2">
                <span className={`font-display text-2xl font-bold tabular-nums ${pct(examRejected, examTotal) >= 30 ? 'text-danger' : 'text-ink'}`}>
                  {pct(examRejected, examTotal)}%
                </span>
                <span className="text-xs text-muted">recusados ({examRejected}/{examTotal})</span>
              </div>
              {topRejected.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {topRejected.map(([name, n]) => (
                    <li key={name} className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate text-ink">{name}</span>
                      <span className="shrink-0 tabular-nums text-danger">{n}×</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Condutas</h2>
          {rxN === 0 ? (
            <p className="text-xs text-muted">Nenhuma conduta avaliada.</p>
          ) : (
            <DistBars
              items={[
                { label: 'Adequada', count: rxAd, pctv: pct(rxAd, rxN), tone: 'bg-success' },
                { label: 'Parcial', count: rxPar, pctv: pct(rxPar, rxN), tone: 'bg-warning' },
                { label: 'Inadequada', count: rxIna, pctv: pct(rxIna, rxN), tone: 'bg-danger' },
              ]}
            />
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Fecho diagnóstico</h2>
          {dxClosed === 0 ? (
            <p className="text-xs text-muted">Nenhum caso encerrado.</p>
          ) : (
            <>
              <div className="mb-2 flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold tabular-nums text-ink">{pct(dxAchieved, dxClosed)}%</span>
                <span className="text-xs text-muted">diagnosticou</span>
              </div>
              <DistBars
                items={[
                  { label: 'Diagnosticou', count: dxAchieved, pctv: pct(dxAchieved, dxClosed), tone: 'bg-success' },
                  { label: 'Desistiu', count: dxRevealed, pctv: pct(dxRevealed, dxClosed), tone: 'bg-warning' },
                ]}
              />
            </>
          )}
        </section>
      </div>

      {/* Histórico */}
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink">Histórico de consultas finalizadas</h2>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Paciente</th>
                <th className="px-3 py-2 font-medium">Especialidade</th>
                <th className="px-3 py-2 text-right font-medium">Racioc.</th>
                <th className="px-3 py-2 text-right font-medium">Comun.</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted">Nenhuma consulta finalizada ainda.</td>
                </tr>
              )}
              {history.map((h, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted">{fmt(h.date)}</td>
                  <td className="px-3 py-2.5 text-ink">{h.patient}</td>
                  <td className="px-3 py-2.5 text-muted">{h.specialty}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{h.ab4 != null ? h.ab4.toFixed(1) : '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{h.comm != null ? h.comm.toFixed(1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
