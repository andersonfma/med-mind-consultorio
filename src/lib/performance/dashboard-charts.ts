import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { EMPTY_REASONING_RECOMMENDATION } from '@/lib/consultations/ab4'
import { EMPTY_COMMUNICATION_RECOMMENDATION } from '@/lib/consultations/communication'

export type VolumeBucket = { label: string; count: number }
export type ScorePoint = { date: string; ab4: number | null; comm: number | null }
export type DashboardCharts = {
  volume: VolumeBucket[]
  totalFinished: number
  scores: ScorePoint[]
}

// overall de um score JSONB, tratando o "vazio" (sentinela de recomendação) como null.
function overallOf(score: unknown, emptyRec: string): number | null {
  if (!score || typeof score !== 'object') return null
  const obj = score as Record<string, unknown>
  if (obj.recommendation === emptyRec) return null
  const o = obj.overall
  return typeof o === 'number' && !Number.isNaN(o) ? o : null
}

// Segunda-feira 00:00 da semana de `d`.
function weekStart(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = (x.getDay() + 6) % 7 // 0 = segunda
  x.setDate(x.getDate() - day)
  return x
}

/**
 * Séries reais do dashboard, determinísticas: volume de consultas finalizadas
 * por semana (últimas 8) e evolução dos scores AB4/Comunicação por consulta.
 */
export async function getDashboardCharts(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<DashboardCharts> {
  const { data } = await supabase
    .from('consultations')
    .select('finished_at, created_at, ab4_score, communication_score')
    .eq('user_id', userId)
    .eq('status', 'finished')
    .order('finished_at', { ascending: true })

  const rows = (data ?? []) as Array<{
    finished_at: string | null
    created_at: string
    ab4_score: unknown
    communication_score: unknown
  }>

  // ---- Volume por semana (últimas 8) ----
  const WEEKS = 8
  const start0 = weekStart(new Date())
  const starts: Date[] = []
  for (let i = WEEKS - 1; i >= 0; i--) {
    const s = new Date(start0)
    s.setDate(s.getDate() - i * 7)
    starts.push(s)
  }
  const counts = new Array(WEEKS).fill(0)
  for (const r of rows) {
    const dt = new Date(r.finished_at ?? r.created_at)
    if (Number.isNaN(dt.getTime())) continue
    for (let i = WEEKS - 1; i >= 0; i--) {
      if (dt >= starts[i]) {
        counts[i]++
        break
      }
    }
  }
  const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`
  const volume: VolumeBucket[] = starts.map((s, i) => ({ label: fmt(s), count: counts[i] }))

  // ---- Evolução dos scores por consulta ----
  const scores: ScorePoint[] = rows.map((r) => ({
    date: (r.finished_at ?? r.created_at ?? '').slice(0, 10),
    ab4: overallOf(r.ab4_score, EMPTY_REASONING_RECOMMENDATION),
    comm: overallOf(r.communication_score, EMPTY_COMMUNICATION_RECOMMENDATION),
  }))

  return { volume, totalFinished: rows.length, scores }
}
