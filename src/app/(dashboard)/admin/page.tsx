import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin/access'
import { LOGIN_ROUTE } from '@/lib/routes'
import { AB4_AXES, COMM_AXES } from '@/lib/consultations/ab4-labels'
import { ab4Averages, commAverages, type ConsultRow } from '@/lib/admin/stats'
import { AxisBars } from '@/components/admin/AxisBars'
import { BlockButton } from '@/components/admin/BlockButton'

export const dynamic = 'force-dynamic'

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)

function fmt(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
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

  type AuthUser = { id: string; email?: string; created_at?: string; last_sign_in_at?: string | null; banned_until?: string | null }
  const authUsers = (usersRes.data?.users ?? []) as AuthUser[]
  const profiles = (profilesRes.data ?? []) as Array<{
    id: string; full_name: string | null; ai_calls_used: number | null; ai_calls_limit: number | null
  }>
  const patients = (patientsRes.data ?? []) as Array<{ user_id: string; specialty: string; created_at: string }>
  const consultations = (consultationsRes.data ?? []) as ConsultRow[]

  const profileById = new Map(profiles.map((p) => [p.id, p]))
  const isBlocked = (u: AuthUser) => !!u.banned_until && Date.parse(u.banned_until) > Date.now()

  const now = new Date()
  const since7 = new Date(now.getTime() - 7 * 86_400_000)

  const totalUsers = authUsers.length
  const new7 = authUsers.filter((u) => u.created_at && new Date(u.created_at) >= since7).length
  const active7 = authUsers.filter((u) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= since7).length
  const blockedCount = authUsers.filter(isBlocked).length
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

  // Diagnóstico da turma — critérios objetivos (médias)
  const cohortAb4 = ab4Averages(consultations)
  const cohortComm = commAverages(consultations)
  const ab4Axes = AB4_AXES.map((ax) => ({ label: ax.label, value: cohortAb4[ax.key] }))
  const commAxesData = COMM_AXES.map((ax) => ({ label: ax.label, value: cohortComm[ax.key] }))

  // Distribuição por especialidade
  const bySpec = new Map<string, number>()
  for (const p of patients) bySpec.set(p.specialty, (bySpec.get(p.specialty) ?? 0) + 1)
  const specRows = [...bySpec.entries()].sort((a, b) => b[1] - a[1])
  const maxSpec = Math.max(1, ...specRows.map((r) => r[1]))

  // Agregados por usuário
  const patientCount = new Map<string, number>()
  for (const p of patients) patientCount.set(p.user_id, (patientCount.get(p.user_id) ?? 0) + 1)
  const consByUser = new Map<string, ConsultRow[]>()
  for (const c of consultations) {
    const arr = consByUser.get(c.user_id)
    if (arr) arr.push(c)
    else consByUser.set(c.user_id, [c])
  }

  const rows = authUsers
    .map((u) => {
      const prof = profileById.get(u.id)
      const mine = consByUser.get(u.id) ?? []
      return {
        id: u.id,
        email: u.email ?? '—',
        name: prof?.full_name ?? '—',
        lastSignIn: u.last_sign_in_at,
        blocked: isBlocked(u),
        patients: patientCount.get(u.id) ?? 0,
        consults: mine.length,
        finished: mine.filter((c) => c.status === 'finished').length,
        ab4: ab4Averages(mine).overall,
        aiUsed: prof?.ai_calls_used ?? 0,
        aiLimit: prof?.ai_calls_limit ?? 0,
      }
    })
    .sort((a, b) => (b.lastSignIn ? Date.parse(b.lastSignIn) : 0) - (a.lastSignIn ? Date.parse(a.lastSignIn) : 0))

  return (
    <div className="space-y-6 p-1 sm:p-2">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Painel do coordenador</h1>
        <p className="text-sm text-muted">Diagnóstico da turma e de cada aluno · janela de IA de 30 dias</p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Alunos" value={totalUsers} sub={new7 > 0 ? `+${new7} nos últimos 7 dias` : 'nenhum novo em 7 dias'} accent />
        <StatCard label="Ativos (7 dias)" value={active7} sub={`${pct(active7, totalUsers)}% do total`} />
        <StatCard label="Bloqueados" value={blockedCount} sub={blockedCount ? 'sem acesso' : 'nenhum'} />
        <StatCard label="Pacientes criados" value={totalPatients} />
        <StatCard label="Consultas" value={totalConsults} sub={`${finished} finalizadas`} />
        <StatCard label="Taxa de conclusão" value={`${completion}%`} sub="consultas finalizadas" />
      </div>

      {/* Diagnóstico da turma — critérios objetivos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Raciocínio clínico — média da turma" hint={`${cohortAb4.n} consultas avaliadas`}>
          <div className="mb-3 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold tabular-nums text-ink">
              {cohortAb4.overall != null ? cohortAb4.overall.toFixed(1) : '—'}
            </span>
            <span className="text-sm text-muted">/10 geral</span>
          </div>
          <AxisBars axes={ab4Axes} />
        </Panel>
        <Panel title="Comunicação — média da turma" hint={`${cohortComm.n} consultas avaliadas`}>
          <div className="mb-3 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold tabular-nums text-ink">
              {cohortComm.overall != null ? cohortComm.overall.toFixed(1) : '—'}
            </span>
            <span className="text-sm text-muted">/10 geral</span>
          </div>
          <AxisBars axes={commAxesData} fill="bg-chart-2" />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Funil */}
        <Panel title="Funil de engajamento" hint={`${totalUsers} alunos`}>
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
      </div>

      {/* Alunos */}
      <Panel title="Alunos" hint="clique no nome para o diagnóstico individual">
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-3 py-2 font-medium">Aluno</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Último acesso</th>
                <th className="px-3 py-2 text-right font-medium">Pac.</th>
                <th className="px-3 py-2 text-right font-medium">Cons.</th>
                <th className="px-3 py-2 text-right font-medium">Racioc.</th>
                <th className="px-3 py-2 text-right font-medium">IA</th>
                <th className="px-3 py-2 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted">Nenhum aluno ainda.</td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/${r.id}`} className="font-medium text-ink hover:text-primary">{r.name}</Link>
                    <div className="text-xs text-muted">{r.email}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    {r.blocked ? (
                      <span className="rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 text-[11px] font-semibold text-danger">Bloqueado</span>
                    ) : (
                      <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">Ativo</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted">{fmt(r.lastSignIn)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{r.patients}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{r.consults}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{r.ab4 != null ? r.ab4.toFixed(1) : '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                    <span className={r.aiUsed >= r.aiLimit && r.aiLimit > 0 ? 'font-semibold text-danger' : 'text-ink'}>{r.aiUsed}</span>
                    <span className="text-muted">/{r.aiLimit}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <BlockButton userId={r.id} blocked={r.blocked} />
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
