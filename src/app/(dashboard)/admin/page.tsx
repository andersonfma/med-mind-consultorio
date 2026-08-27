import { redirect, notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin/access'
import { LOGIN_ROUTE } from '@/lib/routes'
import { EMPTY_REASONING_RECOMMENDATION } from '@/lib/consultations/ab4'
import { EMPTY_COMMUNICATION_RECOMMENDATION } from '@/lib/consultations/communication'

export const dynamic = 'force-dynamic'

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)

function fmt(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

// overall de um score JSONB, tratando o "vazio" (sentinela) como null.
function overallOf(score: unknown, emptyRec: string): number | null {
  if (!score || typeof score !== 'object') return null
  const o = score as Record<string, unknown>
  if (o.recommendation === emptyRec) return null
  return typeof o.overall === 'number' ? o.overall : null
}

function StatCard({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 sm:p-5 ${accent ? 'border-primary/30 bg-primary/5' : 'border-border bg-surface'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold tabular-nums text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  )
}

function Panel({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

export default async function AdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  if (!isAdminEmail(user.email)) notFound()

  const admin = createAdminClient()

  const [usersRes, profilesRes, patientsRes, consultationsRes] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from('profiles').select('id, full_name, ai_calls_used, ai_calls_limit'),
    admin.from('patients').select('user_id, specialty, created_at'),
    admin.from('consultations').select('user_id, status, created_at, finished_at, ab4_score, communication_score'),
  ])

  const authUsers = usersRes.data?.users ?? []
  const profiles = (profilesRes.data ?? []) as Array<{
    id: string; full_name: string | null; ai_calls_used: number | null; ai_calls_limit: number | null
  }>
  const patients = (patientsRes.data ?? []) as Array<{ user_id: string; specialty: string; created_at: string }>
  const consultations = (consultationsRes.data ?? []) as Array<{
    user_id: string; status: string; created_at: string; finished_at: string | null; ab4_score: unknown; communication_score: unknown
  }>

  const profileById = new Map(profiles.map((p) => [p.id, p]))

  // Janelas de tempo
  const now = new Date()
  const since7 = new Date(now.getTime() - 7 * 86_400_000)

  // KPIs
  const totalUsers = authUsers.length
  const new7 = authUsers.filter((u) => u.created_at && new Date(u.created_at) >= since7).length
  const active7 = authUsers.filter((u) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= since7).length
  const totalPatients = patients.length
  const totalConsults = consultations.length
  const finished = consultations.filter((c) => c.status === 'finished').length
  const completion = pct(finished, totalConsults)
  const totalAi = profiles.reduce((s, p) => s + (p.ai_calls_used ?? 0), 0)

  // Funil de engajamento
  const usersWithPatient = new Set(patients.map((p) => p.user_id)).size
  const usersWithConsult = new Set(consultations.map((c) => c.user_id)).size
  const usersWithFinished = new Set(consultations.filter((c) => c.status === 'finished').map((c) => c.user_id)).size
  const funnel = [
    { label: 'Cadastraram', n: totalUsers },
    { label: 'Criaram paciente', n: usersWithPatient },
    { label: 'Fizeram consulta', n: usersWithConsult },
    { label: 'Finalizaram consulta', n: usersWithFinished },
  ]

  // Cadastros por dia (14 dias)
  const days: { key: string; label: string; count: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    days.push({ key: d.toISOString().slice(0, 10), label: `${d.getDate()}/${d.getMonth() + 1}`, count: 0 })
  }
  const dayIndex = new Map(days.map((d, i) => [d.key, i]))
  for (const u of authUsers) {
    const idx = dayIndex.get((u.created_at ?? '').slice(0, 10))
    if (idx != null) days[idx].count++
  }
  const maxDay = Math.max(1, ...days.map((d) => d.count))

  // Distribuição por especialidade
  const bySpec = new Map<string, number>()
  for (const p of patients) bySpec.set(p.specialty, (bySpec.get(p.specialty) ?? 0) + 1)
  const specRows = [...bySpec.entries()].sort((a, b) => b[1] - a[1])
  const maxSpec = Math.max(1, ...specRows.map((r) => r[1]))

  // Desempenho médio (consultas finalizadas)
  let ab4Sum = 0, ab4N = 0, commSum = 0, commN = 0
  for (const c of consultations) {
    const a = overallOf(c.ab4_score, EMPTY_REASONING_RECOMMENDATION)
    if (a != null) { ab4Sum += a; ab4N++ }
    const cm = overallOf(c.communication_score, EMPTY_COMMUNICATION_RECOMMENDATION)
    if (cm != null) { commSum += cm; commN++ }
  }
  const avgAb4 = ab4N ? ab4Sum / ab4N : null
  const avgComm = commN ? commSum / commN : null

  // Tabela por testador
  const patientCount = new Map<string, number>()
  for (const p of patients) patientCount.set(p.user_id, (patientCount.get(p.user_id) ?? 0) + 1)
  const consultTotal = new Map<string, number>()
  const consultFinished = new Map<string, number>()
  for (const c of consultations) {
    consultTotal.set(c.user_id, (consultTotal.get(c.user_id) ?? 0) + 1)
    if (c.status === 'finished') consultFinished.set(c.user_id, (consultFinished.get(c.user_id) ?? 0) + 1)
  }
  const rows = authUsers
    .map((u) => {
      const prof = profileById.get(u.id)
      return {
        id: u.id,
        email: u.email ?? '—',
        name: prof?.full_name ?? '—',
        created: u.created_at,
        lastSignIn: u.last_sign_in_at,
        patients: patientCount.get(u.id) ?? 0,
        consults: consultTotal.get(u.id) ?? 0,
        finished: consultFinished.get(u.id) ?? 0,
        aiUsed: prof?.ai_calls_used ?? 0,
        aiLimit: prof?.ai_calls_limit ?? 0,
      }
    })
    .sort((a, b) => (b.lastSignIn ? Date.parse(b.lastSignIn) : 0) - (a.lastSignIn ? Date.parse(a.lastSignIn) : 0))

  return (
    <div className="space-y-6 p-1 sm:p-2">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Painel de testes</h1>
        <p className="text-sm text-muted">
          Acompanhamento de acessos e uso · janela de IA de 30 dias
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Testadores" value={totalUsers} sub={new7 > 0 ? `+${new7} nos últimos 7 dias` : 'nenhum novo em 7 dias'} accent />
        <StatCard label="Ativos (7 dias)" value={active7} sub={`${pct(active7, totalUsers)}% do total`} />
        <StatCard label="Chamadas de IA" value={totalAi} sub="somadas no período" />
        <StatCard label="Pacientes criados" value={totalPatients} />
        <StatCard label="Consultas" value={totalConsults} sub={`${finished} finalizadas`} />
        <StatCard label="Taxa de conclusão" value={`${completion}%`} sub="consultas finalizadas" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Funil */}
        <Panel title="Funil de engajamento" hint={`${totalUsers} testadores`}>
          <div className="space-y-3">
            {funnel.map((f) => (
              <div key={f.label}>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="text-muted">{f.label}</span>
                  <span className="font-semibold tabular-nums text-ink">
                    {f.n} <span className="text-muted">· {pct(f.n, totalUsers)}%</span>
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct(f.n, totalUsers)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Cadastros por dia */}
        <Panel title="Cadastros por dia" hint="últimos 14 dias">
          <div className="flex h-32 items-end gap-1">
            {days.map((d) => (
              <div key={d.key} className="flex flex-1 flex-col items-center justify-end" title={`${d.label}: ${d.count}`}>
                <div
                  className="w-full rounded-t bg-primary/70"
                  style={{ height: `${Math.round((d.count / maxDay) * 100)}%`, minHeight: d.count > 0 ? '4px' : '0' }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted">
            <span>{days[0].label}</span>
            <span>hoje</span>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Especialidades */}
        <Panel title="Pacientes por especialidade">
          {specRows.length === 0 ? (
            <p className="text-xs text-muted">Nenhum paciente criado ainda.</p>
          ) : (
            <div className="space-y-2.5">
              {specRows.map(([spec, n]) => (
                <div key={spec} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-xs text-muted">{spec}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-chart-2" style={{ width: `${Math.round((n / maxSpec) * 100)}%` }} />
                  </div>
                  <span className="w-6 text-right text-xs font-semibold tabular-nums text-ink">{n}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Desempenho médio */}
        <Panel title="Desempenho médio" hint="consultas finalizadas">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Raciocínio</p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums text-ink">
                {avgAb4 != null ? avgAb4.toFixed(1) : '—'}
                <span className="text-sm text-muted">/10</span>
              </p>
              <p className="mt-0.5 text-xs text-muted">{ab4N} avaliadas</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Comunicação</p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums text-ink">
                {avgComm != null ? avgComm.toFixed(1) : '—'}
                <span className="text-sm text-muted">/10</span>
              </p>
              <p className="mt-0.5 text-xs text-muted">{commN} avaliadas</p>
            </div>
          </div>
        </Panel>
      </div>

      {/* Tabela por testador */}
      <Panel title="Atividade por testador" hint={`${rows.length} usuários`}>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-3 py-2 font-medium">Usuário</th>
                <th className="px-3 py-2 font-medium">Cadastro</th>
                <th className="px-3 py-2 font-medium">Último login</th>
                <th className="px-3 py-2 text-right font-medium">Pac.</th>
                <th className="px-3 py-2 text-right font-medium">Cons.</th>
                <th className="px-3 py-2 text-right font-medium">Final.</th>
                <th className="px-3 py-2 text-right font-medium">IA</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted">Nenhum usuário ainda.</td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-ink">{r.name}</div>
                    <div className="text-xs text-muted">{r.email}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted">{fmt(r.created)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted">{fmt(r.lastSignIn)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{r.patients}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{r.consults}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{r.finished}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                    <span className={r.aiUsed >= r.aiLimit && r.aiLimit > 0 ? 'font-semibold text-danger' : 'text-ink'}>{r.aiUsed}</span>
                    <span className="text-muted">/{r.aiLimit}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
