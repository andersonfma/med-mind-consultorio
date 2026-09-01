import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin/access'
import { LOGIN_ROUTE } from '@/lib/routes'
import { AB4_AXES, COMM_AXES } from '@/lib/consultations/ab4-labels'
import { ab4Averages, commAverages, ab4Of, commOf, type ConsultRow } from '@/lib/admin/stats'
import { AxisBars } from '@/components/admin/AxisBars'
import { DistBars } from '@/components/admin/DistBars'
import { BlockButton } from '@/components/admin/BlockButton'

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

  const [target, profileRes, patientsRes, consultationsRes, examsRes, rxRes] = await Promise.all([
    admin.auth.admin.getUserById(id),
    admin.from('profiles').select('full_name, ai_calls_used, ai_calls_limit, ai_period_start').eq('id', id).single(),
    admin.from('patients').select('id, name, specialty, diagnosis_status').eq('user_id', id),
    admin
      .from('consultations')
      .select('user_id, status, created_at, finished_at, ab4_score, communication_score, patient_id')
      .eq('user_id', id)
      .order('finished_at', { ascending: false }),
    admin.from('exam_requests').select('status, exam_name, attempts').eq('user_id', id),
    admin.from('prescriptions').select('adequacy').eq('user_id', id),
  ])

  const au = target.data?.user as
    | { id: string; email?: string; created_at?: string; last_sign_in_at?: string | null; banned_until?: string | null }
    | undefined
  if (!au) notFound()

  const prof = (profileRes.data ?? null) as { full_name: string | null; ai_calls_used: number | null; ai_calls_limit: number | null } | null
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

  return (
    <div className="space-y-6 p-1 sm:p-2">
      <div>
        <Link href="/admin" className="text-sm text-muted hover:text-primary">← Voltar ao painel</Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{prof?.full_name ?? '—'}</h1>
            {blocked ? (
              <span className="rounded-full border border-danger/40 bg-danger/10 px-2.5 py-0.5 text-xs font-semibold text-danger">Bloqueado</span>
            ) : (
              <span className="rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">Ativo</span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted">{au.email}</p>
          <p className="mt-2 text-xs text-muted">
            Cadastro {fmt(au.created_at)} · último acesso {fmt(au.last_sign_in_at)} · IA {prof?.ai_calls_used ?? 0}/{prof?.ai_calls_limit ?? 0}
          </p>
        </div>
        <BlockButton userId={au.id} blocked={blocked} variant="md" />
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
