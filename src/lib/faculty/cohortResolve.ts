import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { normPeriodo } from './cohort'

// Resolve a coorte de uma instituição (mesma regra do painel: união de vínculo
// explícito + institution_members + cupom de fundador + match pelo nome da
// faculdade). Usado pelo envio de e-mail segmentado e pelo resumo de público.

export type InstitutionRow = { id: string; name: string; founder_code: string | null; faculty_match: string | null }
export type CohortMember = { id: string; periodo: string | null }

const UNKNOWN = 'Sem período'

async function loadCohort(inst: InstitutionRow): Promise<CohortMember[]> {
  const admin = createAdminClient()
  const [profRes, memberRes, redRes] = await Promise.all([
    admin.from('profiles').select('id, faculty, faculty_period, institution_id'),
    admin.from('institution_members').select('user_id').eq('institution_id', inst.id),
    inst.founder_code
      ? admin.from('founder_redemptions').select('user_id').eq('code', inst.founder_code)
      : Promise.resolve({ data: [] as Array<{ user_id: string }> }),
  ])
  type Prof = { id: string; faculty: string | null; faculty_period: string | null; institution_id: string | null }
  const profs = (profRes.data ?? []) as Prof[]
  const ids = new Set(((memberRes.data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id))
  for (const r of ((redRes.data ?? []) as Array<{ user_id: string }>)) ids.add(r.user_id)
  const facMatch = normPeriodo(inst.faculty_match)?.toLowerCase() ?? null
  return profs
    .filter((p) => p.institution_id === inst.id || ids.has(p.id) || (facMatch != null && (p.faculty ?? '').trim().toLowerCase() === facMatch))
    .map((p) => ({ id: p.id, periodo: normPeriodo(p.faculty_period) }))
}

/** Conjunto de user ids da coorte, opcionalmente filtrado por períodos selecionados. */
export async function cohortIdsForSend(inst: InstitutionRow, periodos?: string[] | null): Promise<Set<string>> {
  const members = await loadCohort(inst)
  const wanted = periodos && periodos.length > 0 ? new Set(periodos.map((p) => normPeriodo(p) ?? UNKNOWN)) : null
  const out = new Set<string>()
  for (const m of members) {
    if (wanted && !wanted.has(m.periodo ?? UNKNOWN)) continue
    out.add(m.id)
  }
  return out
}

export type AudiencePeriodo = { periodo: string; count: number }
export type InstitutionAudience = { id: string; name: string; total: number; periodos: AudiencePeriodo[] }

/** Resumo de público por instituição (total + períodos com contagem) para o compositor. */
export async function allInstitutionAudiences(): Promise<InstitutionAudience[]> {
  const admin = createAdminClient()
  const { data } = await admin.from('institutions').select('id, name, founder_code, faculty_match').order('name')
  const institutions = (data ?? []) as InstitutionRow[]
  const out: InstitutionAudience[] = []
  for (const inst of institutions) {
    const members = await loadCohort(inst)
    const byPeriodo = new Map<string, number>()
    for (const m of members) {
      const key = m.periodo ?? UNKNOWN
      byPeriodo.set(key, (byPeriodo.get(key) ?? 0) + 1)
    }
    const periodos = [...byPeriodo.entries()]
      .map(([periodo, count]) => ({ periodo, count }))
      .sort((a, b) => (a.periodo === UNKNOWN ? 1 : b.periodo === UNKNOWN ? -1 : b.count - a.count))
    out.push({ id: inst.id, name: inst.name, total: members.length, periodos })
  }
  return out
}
