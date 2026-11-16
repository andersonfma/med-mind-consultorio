import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { ab4Averages, commAverages, type ConsultRow } from '@/lib/admin/stats'
import { formationIndex, meanIndex, benchmarkPercentile, bandFor, FORMATION_BANDS, type ComponentScores } from './formation'
import { groupByPeriodo, normPeriodo } from './cohort'
import { activeDays, recencyDays, currentStreak, isAtRisk, completionFunnel, studyWindow, monthlyTrend } from './behavioral'
import type { ManagedInstitution } from './access'

export type StudentRow = {
  id: string
  name: string
  periodo: string | null
  index: number | null
  band: string | null
  components: ComponentScores
  activeDays: number
  recency: number | null
  streak: number
  atRisk: boolean
  consultsStarted: number
  consultsFinished: number
  simAvg: number | null
}

export type TurmaRow = {
  periodo: string
  isUnknown: boolean
  n: number
  index: number | null
  ab4: number | null
  comunicacao: number | null
  completion: number
  atRisk: number
  students: StudentRow[]
}

export type FacultyDashboard = {
  institution: ManagedInstitution
  totalStudents: number
  withData: number
  index: number | null
  benchmarkPercentile: number | null
  platformMean: number | null // média do índice de toda a plataforma (marcador "Brasil")
  bandDistribution: Array<{ key: string; label: string; tone: string; count: number }>
  behavior: {
    activeDays7: number // alunos ativos nos últimos 7 dias
    atRisk: number
    completion: number
    study: ReturnType<typeof studyWindow>
  }
  trend: ReturnType<typeof monthlyTrend> // evolução mensal do AB4 da turma
  turmas: TurmaRow[]
  atRiskStudents: StudentRow[]
  platformIndexN: number // tamanho da população de benchmark
}

const DAY = 86_400_000

// Componentes de formação por usuário, a partir das linhas já carregadas.
function componentsFor(
  uid: string,
  consultsByUser: Map<string, ConsultRow[]>,
  rxByUser: Map<string, { adequacy: string | null }[]>,
  patByUser: Map<string, { diagnosis_status: string }[]>,
  simByUser: Map<string, { score: number; total: number }[]>,
): ComponentScores {
  const cons = consultsByUser.get(uid) ?? []
  const ab4 = ab4Averages(cons).overall
  const comm = commAverages(cons).overall
  const rx = (rxByUser.get(uid) ?? []).filter((r) => r.adequacy)
  const conduta = rx.length ? (rx.filter((r) => r.adequacy === 'adequada').length / rx.length) * 100 : null
  const pats = (patByUser.get(uid) ?? []).filter((p) => p.diagnosis_status === 'achieved' || p.diagnosis_status === 'revealed')
  const diagnostico = pats.length ? (pats.filter((p) => p.diagnosis_status === 'achieved').length / pats.length) * 100 : null
  const sims = simByUser.get(uid) ?? []
  const simAvg = sims.length ? (sims.reduce((s, e) => s + (e.total ? e.score / e.total : 0), 0) / sims.length) * 100 : null
  return {
    raciocinio: ab4 != null ? ab4 * 10 : null,
    comunicacao: comm != null ? comm * 10 : null,
    conduta,
    diagnostico,
    simulados: simAvg,
  }
}

export async function loadFacultyDashboard(institution: ManagedInstitution, nowMs: number): Promise<FacultyDashboard> {
  const admin = createAdminClient()

  const [profilesRes, membersRes, redemptionsRes, consRes, rxRes, patRes, simRes, quizRes, mapRes, postRes, reactRes] = await Promise.all([
    admin.from('profiles').select('id, full_name, faculty, faculty_period, institution_id'),
    admin.from('institution_members').select('user_id').eq('institution_id', institution.id),
    institution.founder_code
      ? admin.from('founder_redemptions').select('user_id').eq('code', institution.founder_code)
      : Promise.resolve({ data: [] as Array<{ user_id: string }> }),
    admin.from('consultations').select('user_id, status, created_at, finished_at, ab4_score, communication_score'),
    admin.from('prescriptions').select('user_id, adequacy'),
    admin.from('patients').select('user_id, created_at, diagnosis_status'),
    admin.from('exam_attempts').select('user_id, score, total, created_at'),
    admin.from('quiz_answers').select('user_id, created_at'),
    admin.from('disease_maps').select('user_id, created_at'),
    admin.from('posts').select('author_id, created_at'),
    admin.from('post_reactions').select('user_id, created_at'),
  ])

  type Prof = { id: string; full_name: string | null; faculty: string | null; faculty_period: string | null; institution_id: string | null }
  const profiles = (profilesRes.data ?? []) as Prof[]
  const consultations = (consRes.data ?? []) as Array<ConsultRow & { created_at: string | null }>
  const prescriptions = (rxRes.data ?? []) as Array<{ user_id: string; adequacy: string | null }>
  const patients = (patRes.data ?? []) as Array<{ user_id: string; created_at: string | null; diagnosis_status: string }>
  const sims = (simRes.data ?? []) as Array<{ user_id: string; score: number; total: number; created_at: string | null }>
  const quiz = (quizRes.data ?? []) as Array<{ user_id: string; created_at: string | null }>
  const maps = (mapRes.data ?? []) as Array<{ user_id: string; created_at: string | null }>
  const posts = (postRes.data ?? []) as Array<{ author_id: string; created_at: string | null }>
  const reacts = (reactRes.data ?? []) as Array<{ user_id: string; created_at: string | null }>

  // Índices por user (consulta, conduta, paciente, simulado).
  const consByUser = new Map<string, Array<ConsultRow & { created_at: string | null }>>()
  for (const c of consultations) { const a = consByUser.get(c.user_id); if (a) a.push(c); else consByUser.set(c.user_id, [c]) }
  const rxByUser = new Map<string, { adequacy: string | null }[]>()
  for (const r of prescriptions) { const a = rxByUser.get(r.user_id); if (a) a.push(r); else rxByUser.set(r.user_id, [r]) }
  const patByUser = new Map<string, { diagnosis_status: string }[]>()
  for (const p of patients) { const a = patByUser.get(p.user_id); if (a) a.push(p); else patByUser.set(p.user_id, [p]) }
  const simByUser = new Map<string, { score: number; total: number }[]>()
  for (const s of sims) { const a = simByUser.get(s.user_id); if (a) a.push(s); else simByUser.set(s.user_id, [s]) }

  // Eventos (ms) por user para comportamento.
  const evByUser = new Map<string, number[]>()
  const push = (uid: string | null | undefined, ts: string | null | undefined) => {
    if (!uid || !ts) return
    const t = Date.parse(ts); if (Number.isNaN(t)) return
    const a = evByUser.get(uid); if (a) a.push(t); else evByUser.set(uid, [t])
  }
  for (const c of consultations) push(c.user_id, c.created_at)
  for (const p of patients) push(p.user_id, p.created_at)
  for (const s of sims) push(s.user_id, s.created_at)
  for (const q of quiz) push(q.user_id, q.created_at)
  for (const m of maps) push(m.user_id, m.created_at)
  for (const p of posts) push(p.author_id, p.created_at)
  for (const r of reacts) push(r.user_id, r.created_at)

  // Benchmark nacional-proxy: índice de TODOS os alunos da plataforma.
  const indexByUser = new Map<string, number | null>()
  for (const p of profiles) indexByUser.set(p.id, formationIndex(componentsFor(p.id, consByUser, rxByUser, patByUser, simByUser)))
  const platformPop = [...indexByUser.values()].filter((x): x is number => x != null)

  // Pertença à instituição: união de vínculo, cupom e nome da faculdade.
  const memberIds = new Set(((membersRes.data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id))
  for (const r of ((redemptionsRes.data ?? []) as Array<{ user_id: string }>)) memberIds.add(r.user_id)
  const facMatch = normPeriodo(institution.faculty_match)?.toLowerCase() ?? null
  const inCohort = (p: Prof) =>
    p.institution_id === institution.id ||
    memberIds.has(p.id) ||
    (facMatch != null && (p.faculty ?? '').trim().toLowerCase() === facMatch)
  const cohort = profiles.filter(inCohort)

  // Linha por aluno.
  const studentRow = (p: Prof): StudentRow => {
    const comps = componentsFor(p.id, consByUser, rxByUser, patByUser, simByUser)
    const idx = indexByUser.get(p.id) ?? null
    const ev = evByUser.get(p.id) ?? []
    const mine = consByUser.get(p.id) ?? []
    return {
      id: p.id,
      name: p.full_name ?? '—',
      periodo: p.faculty_period,
      index: idx,
      band: bandFor(idx)?.key ?? null,
      components: comps,
      activeDays: activeDays(ev),
      recency: recencyDays(ev, nowMs),
      streak: currentStreak(ev, nowMs),
      atRisk: isAtRisk(ev, nowMs),
      consultsStarted: mine.length,
      consultsFinished: mine.filter((c) => c.status === 'finished').length,
      simAvg: comps.simulados ?? null,
    }
  }
  const rows = cohort.map(studentRow)
  const rowById = new Map(rows.map((r) => [r.id, r]))

  // Turmas por período.
  const grouped = groupByPeriodo(cohort.map((p) => ({ id: p.id, periodo: p.faculty_period })))
  const turmas: TurmaRow[] = grouped.map((g) => {
    const srs = g.students.map((s) => rowById.get(s.id)!).filter(Boolean)
    const cons = g.students.flatMap((s) => consByUser.get(s.id) ?? [])
    return {
      periodo: g.periodo,
      isUnknown: g.isUnknown,
      n: srs.length,
      index: meanIndex(srs.map((r) => r.index)),
      ab4: ab4Averages(cons).overall,
      comunicacao: commAverages(cons).overall,
      completion: completionFunnel(
        srs.reduce((s, r) => s + r.consultsStarted, 0),
        srs.reduce((s, r) => s + r.consultsFinished, 0),
      ).rate,
      atRisk: srs.filter((r) => r.atRisk).length,
      students: srs,
    }
  })

  // Resumo da instituição.
  const index = meanIndex(rows.map((r) => r.index))
  const bandDistribution = FORMATION_BANDS.map((b) => ({
    key: b.key, label: b.label, tone: b.tone,
    count: rows.filter((r) => r.band === b.key).length,
  }))
  const cohortEvents = cohort.flatMap((p) => evByUser.get(p.id) ?? [])
  const active7 = cohort.filter((p) => { const r = recencyDays(evByUser.get(p.id) ?? [], nowMs); return r != null && r <= 7 }).length
  const allCons = cohort.flatMap((p) => consByUser.get(p.id) ?? [])
  const completion = completionFunnel(allCons.length, allCons.filter((c) => c.status === 'finished').length).rate
  const trendPoints = allCons
    .filter((c) => c.created_at)
    .map((c) => ({ ts: Date.parse(c.created_at as string), value: ab4Averages([c]).overall }))
    .filter((p): p is { ts: number; value: number } => p.value != null && !Number.isNaN(p.ts))

  return {
    institution,
    totalStudents: cohort.length,
    withData: rows.filter((r) => r.index != null).length,
    index,
    benchmarkPercentile: benchmarkPercentile(index, platformPop),
    platformMean: meanIndex(platformPop),
    bandDistribution,
    behavior: { activeDays7: active7, atRisk: rows.filter((r) => r.atRisk).length, completion, study: studyWindow(cohortEvents) },
    trend: monthlyTrend(trendPoints),
    turmas,
    atRiskStudents: rows.filter((r) => r.atRisk).sort((a, b) => (b.recency ?? 1e9) - (a.recency ?? 1e9)),
    platformIndexN: platformPop.length,
  }
}

export { DAY }
