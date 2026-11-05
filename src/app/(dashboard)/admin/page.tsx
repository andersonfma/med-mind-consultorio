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
import { DistBars } from '@/components/admin/DistBars'
import { BlockButton } from '@/components/admin/BlockButton'
import { GenerateCaseButton } from './GenerateCaseButton'
import { ReportsQueue } from './ReportsQueue'
import { EmailBroadcast } from './EmailBroadcast'
import { InstitutionsPanel } from './InstitutionsPanel'

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

function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-border pb-1.5 pt-2">
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{children}</h2>
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </div>
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

  const [usersRes, profilesRes, patientsRes, consultationsRes, examsRes, rxRes, interestRes, quizAnsRes, examAttRes, instRes] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from('profiles').select('id, full_name, ai_calls_used, ai_calls_limit, is_premium'),
    admin.from('patients').select('user_id, specialty, created_at, diagnosis_status'),
    admin.from('consultations').select('user_id, status, created_at, finished_at, ab4_score, communication_score'),
    admin.from('exam_requests').select('user_id, status, exam_name, attempts'),
    admin.from('prescriptions').select('user_id, adequacy'),
    admin.from('premium_interest').select('user_id', { count: 'exact', head: true }),
    admin.from('quiz_answers').select('user_id, is_correct'),
    admin.from('exam_attempts').select('user_id, exam, area, score, total'),
    admin.from('institutions').select('id, name, invite_code, created_at'),
  ])

  type AuthUser = { id: string; email?: string; created_at?: string; last_sign_in_at?: string | null; banned_until?: string | null }
  const authUsers = (usersRes.data?.users ?? []) as AuthUser[]
  const profilesBase = (profilesRes.data ?? []) as Array<{
    id: string; full_name: string | null; ai_calls_used: number | null; ai_calls_limit: number | null; is_premium: boolean | null
  }>
  // institution_id em query separada e guardada (coluna pode não existir antes da migration).
  const { data: instLinks } = await admin.from('profiles').select('id, institution_id')
  const instByUser = new Map(((instLinks ?? []) as Array<{ id: string; institution_id: string | null }>).map((r) => [r.id, r.institution_id]))
  const profiles = profilesBase.map((p) => ({ ...p, institution_id: instByUser.get(p.id) ?? null }))
  const premiumCount = profiles.filter((p) => p.is_premium).length
  const interestCount = interestRes.count ?? 0
  const patients = (patientsRes.data ?? []) as Array<{ user_id: string; specialty: string; created_at: string; diagnosis_status: string }>
  const consultations = (consultationsRes.data ?? []) as ConsultRow[]
  const exams = (examsRes.data ?? []) as Array<{ user_id: string; status: string; exam_name: string; attempts: number | null }>
  const prescriptions = (rxRes.data ?? []) as Array<{ user_id: string; adequacy: string | null }>

  // Indicadores pedagógicos
  // 1) Coerência dos pedidos de exame
  const examTotal = exams.length
  const examRejected = exams.filter((e) => e.status === 'rejected').length
  const examReformulated = exams.filter((e) => (e.attempts ?? 1) > 1).length
  const rejByExam = new Map<string, number>()
  for (const e of exams) if (e.status === 'rejected') rejByExam.set(e.exam_name, (rejByExam.get(e.exam_name) ?? 0) + 1)
  const topRejected = [...rejByExam.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  // 2) Adequação das condutas (só as avaliadas pela IA)
  const rxScored = prescriptions.filter((r) => r.adequacy)
  const rxAd = rxScored.filter((r) => r.adequacy === 'adequada').length
  const rxPar = rxScored.filter((r) => r.adequacy === 'parcial').length
  const rxIna = rxScored.filter((r) => r.adequacy === 'inadequada').length
  const rxN = rxScored.length

  // 3) Fecho diagnóstico
  const dxAchieved = patients.filter((p) => p.diagnosis_status === 'achieved').length
  const dxRevealed = patients.filter((p) => p.diagnosis_status === 'revealed').length
  const dxClosed = dxAchieved + dxRevealed

  const quizAns = (quizAnsRes.data ?? []) as Array<{ user_id: string; is_correct: boolean }>
  const examAtt = (examAttRes.data ?? []) as Array<{ user_id: string; exam: string; area: string; score: number; total: number }>
  const institutions = (instRes.data ?? []) as Array<{ id: string; name: string; invite_code: string; created_at: string }>

  const profileById = new Map(profiles.map((p) => [p.id, p]))
  const isBlocked = (u: AuthUser) => !!u.banned_until && Date.parse(u.banned_until) > Date.now()

  const now = new Date()
  const since7 = new Date(now.getTime() - 7 * 86_400_000)
  const since30 = new Date(now.getTime() - 30 * 86_400_000)

  const totalUsers = authUsers.length
  const new7 = authUsers.filter((u) => u.created_at && new Date(u.created_at) >= since7).length
  const new30 = authUsers.filter((u) => u.created_at && new Date(u.created_at) >= since30).length
  const active7 = authUsers.filter((u) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= since7).length
  const active30 = authUsers.filter((u) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= since30).length
  // Retenção (proxy): voltou ao menos uma vez depois de ~1 dia do cadastro.
  const returned = authUsers.filter((u) => u.created_at && u.last_sign_in_at
    && Date.parse(u.last_sign_in_at) - Date.parse(u.created_at) > 20 * 3_600_000).length

  // Desafio diário
  const challengePlayers = new Set(quizAns.map((q) => q.user_id)).size
  const quizCorrectPct = quizAns.length ? pct(quizAns.filter((q) => q.is_correct).length, quizAns.length) : 0

  // Simulados ENARE/ENAMED
  const simUsers = new Set(examAtt.map((e) => e.user_id)).size
  const simCount = examAtt.length
  const simAvg = simCount ? Math.round(examAtt.reduce((s, e) => s + (e.total ? e.score / e.total : 0), 0) / simCount * 100) : 0

  // Instituições (B2B): nº de alunos por instituição
  const studentsByInst = new Map<string, number>()
  for (const p of profiles) if (p.institution_id) studentsByInst.set(p.institution_id, (studentsByInst.get(p.institution_id) ?? 0) + 1)
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

  const instNameById = new Map(institutions.map((i) => [i.id, i.name]))
  const rows = authUsers
    .map((u) => {
      const prof = profileById.get(u.id)
      const mine = consByUser.get(u.id) ?? []
      return {
        id: u.id,
        email: u.email ?? '—',
        name: prof?.full_name ?? '—',
        institution: prof?.institution_id ? (instNameById.get(prof.institution_id) ?? null) : null,
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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Painel do coordenador</h1>
          <p className="text-sm text-muted">Diagnóstico da turma e de cada aluno · janela de IA de 30 dias</p>
        </div>
        <GenerateCaseButton />
      </header>

      {/* ───────── VISÃO GERAL ───────── */}
      <SectionTitle>Visão geral</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Alunos" value={totalUsers} sub={new7 > 0 ? `+${new7} em 7 dias · +${new30} em 30` : `+${new30} em 30 dias`} accent />
        <StatCard label="Ativos (7 dias)" value={active7} sub={`${pct(active7, totalUsers)}% · ${active30} em 30 dias`} />
        <StatCard label="Retenção" value={`${pct(returned, totalUsers)}%`} sub={`${returned} voltaram após o 1º dia`} accent />
        <StatCard label="Pacientes criados" value={totalPatients} />
        <StatCard label="Consultas" value={totalConsults} sub={`${finished} finalizadas · ${completion}%`} />
        <StatCard label="Bloqueados" value={blockedCount} sub={blockedCount ? 'sem acesso' : 'nenhum'} />
        <StatCard label="Premium (selo)" value={premiumCount} sub={`${pct(premiumCount, totalUsers)}% dos alunos`} />
        <StatCard label="Interesse no Premium" value={interestCount} sub="clicaram em 'Tenho interesse'" accent />
        <StatCard label="Potencial de conversão" value={`${pct(interestCount, totalUsers)}%`} sub="interessados / alunos" />
      </div>

      {/* ───────── ENGAJAMENTO ───────── */}
      <SectionTitle>Engajamento no ecossistema</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Desafio da semana" hint="quiz diário + aposta">
          <div className="mb-3 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold tabular-nums text-ink">{challengePlayers}</span>
            <span className="text-sm text-muted">alunos participaram · {pct(challengePlayers, totalUsers)}%</span>
          </div>
          <p className="text-xs text-muted">{quizAns.length} respostas · {quizCorrectPct}% de acerto</p>
        </Panel>
        <Panel title="Simulados ENARE/ENAMED" hint="recurso premium">
          <div className="mb-3 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold tabular-nums text-ink">{simCount}</span>
            <span className="text-sm text-muted">simulados feitos · {simUsers} alunos</span>
          </div>
          <p className="text-xs text-muted">{simCount ? `${simAvg}% de acerto médio` : 'Nenhum simulado ainda.'}</p>
        </Panel>
      </div>

      {/* ───────── QUALIDADE PEDAGÓGICA ───────── */}
      <SectionTitle hint="diagnóstico da turma no simulador">Qualidade pedagógica</SectionTitle>
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

      {/* Indicadores pedagógicos — onde intervir */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Coerência dos pedidos de exame" hint={`${examTotal} pedidos`}>
          {examTotal === 0 ? (
            <p className="text-xs text-muted">Nenhum exame solicitado ainda.</p>
          ) : (
            <>
              <div className="mb-1 flex items-baseline gap-2">
                <span className={`font-display text-3xl font-bold tabular-nums ${pct(examRejected, examTotal) >= 30 ? 'text-danger' : 'text-ink'}`}>
                  {pct(examRejected, examTotal)}%
                </span>
                <span className="text-sm text-muted">recusados por incoerência</span>
              </div>
              <p className="mb-3 text-xs text-muted">
                {examRejected} de {examTotal} · {examReformulated} precisaram ser reformulados
              </p>
              {topRejected.length > 0 && (
                <>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Mais recusados</p>
                  <ul className="space-y-1.5">
                    {topRejected.map(([name, n]) => (
                      <li key={name} className="flex items-center justify-between gap-3 text-xs">
                        <span className="truncate text-ink">{name}</span>
                        <span className="shrink-0 tabular-nums text-danger">{n}×</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </Panel>

        <Panel title="Adequação das condutas" hint={`${rxN} avaliadas`}>
          {rxN === 0 ? (
            <p className="text-xs text-muted">Nenhuma conduta avaliada ainda.</p>
          ) : (
            <>
              <div className="mb-3 flex items-baseline gap-2">
                <span className={`font-display text-3xl font-bold tabular-nums ${pct(rxIna, rxN) >= 25 ? 'text-danger' : 'text-ink'}`}>
                  {pct(rxIna, rxN)}%
                </span>
                <span className="text-sm text-muted">inadequadas</span>
              </div>
              <DistBars
                items={[
                  { label: 'Adequada', count: rxAd, pctv: pct(rxAd, rxN), tone: 'bg-success' },
                  { label: 'Parcial', count: rxPar, pctv: pct(rxPar, rxN), tone: 'bg-warning' },
                  { label: 'Inadequada', count: rxIna, pctv: pct(rxIna, rxN), tone: 'bg-danger' },
                ]}
              />
            </>
          )}
        </Panel>

        <Panel title="Fecho diagnóstico" hint={`${dxClosed} encerrados`}>
          {dxClosed === 0 ? (
            <p className="text-xs text-muted">Nenhum caso encerrado ainda.</p>
          ) : (
            <>
              <div className="mb-3 flex items-baseline gap-2">
                <span className={`font-display text-3xl font-bold tabular-nums ${pct(dxAchieved, dxClosed) < 60 ? 'text-danger' : 'text-ink'}`}>
                  {pct(dxAchieved, dxClosed)}%
                </span>
                <span className="text-sm text-muted">chegaram ao diagnóstico</span>
              </div>
              <DistBars
                items={[
                  { label: 'Diagnosticou', count: dxAchieved, pctv: pct(dxAchieved, dxClosed), tone: 'bg-success' },
                  { label: 'Desistiu (revelou)', count: dxRevealed, pctv: pct(dxRevealed, dxClosed), tone: 'bg-warning' },
                ]}
              />
            </>
          )}
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

      {/* ───────── INSTITUIÇÕES (B2B) ───────── */}
      <SectionTitle hint="faculdades e turmas">Instituições</SectionTitle>
      <Panel title="Faculdades / turmas" hint={`${institutions.length} cadastradas`}>
        <InstitutionsPanel
          institutions={institutions.map((i) => ({ id: i.id, name: i.name, code: i.invite_code, students: studentsByInst.get(i.id) ?? 0 }))}
        />
      </Panel>

      {/* ───────── OPERAÇÃO ───────── */}
      <SectionTitle>Operação</SectionTitle>
      <Panel title="Email — como funciona (onboarding)" hint="explicativo + a aposta">
        <EmailBroadcast totalUsers={totalUsers} />
      </Panel>
      <Panel title="Denúncias" hint="conteúdo reportado pela rede">
        <ReportsQueue />
      </Panel>

      {/* ───────── ALUNOS ───────── */}
      <SectionTitle>Alunos</SectionTitle>
      <Panel title="Alunos" hint="clique no nome para o diagnóstico individual">
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-3 py-2 font-medium">Aluno</th>
                <th className="px-3 py-2 font-medium">Instituição</th>
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
                  <td colSpan={9} className="px-3 py-8 text-center text-muted">Nenhum aluno ainda.</td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/${r.id}`} className="font-medium text-ink hover:text-primary">{r.name}</Link>
                    <div className="text-xs text-muted">{r.email}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted">{r.institution ?? '—'}</td>
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
