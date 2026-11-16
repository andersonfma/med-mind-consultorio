// Métricas comportamentais da turma/aluno para o painel do diretor.
// Puras e testáveis; recebem timestamps (ms) já extraídos das tabelas.

const DAY = 86_400_000

const dayKey = (ms: number) => Math.floor(ms / DAY)

/** Dias distintos com atividade. */
export function activeDays(eventsMs: number[]): number {
  return new Set(eventsMs.map(dayKey)).size
}

/** Dias desde a última atividade (recência). Sem eventos => null. */
export function recencyDays(eventsMs: number[], nowMs: number): number | null {
  if (eventsMs.length === 0) return null
  const last = Math.max(...eventsMs)
  return Math.floor((nowMs - last) / DAY)
}

/**
 * Streak atual: nº de dias consecutivos com atividade terminando hoje ou ontem.
 * (Ontem conta para não zerar quem ainda não usou hoje.)
 */
export function currentStreak(eventsMs: number[], nowMs: number): number {
  if (eventsMs.length === 0) return 0
  const days = new Set(eventsMs.map(dayKey))
  const today = dayKey(nowMs)
  let cursor = days.has(today) ? today : days.has(today - 1) ? today - 1 : null
  if (cursor == null) return 0
  let streak = 0
  while (days.has(cursor)) { streak++; cursor-- }
  return streak
}

/** Em risco: sem atividade há `thresholdDays` ou mais (ou nunca ativou). */
export function isAtRisk(eventsMs: number[], nowMs: number, thresholdDays = 14): boolean {
  const r = recencyDays(eventsMs, nowMs)
  return r == null || r >= thresholdDays
}

export type Funnel = { started: number; finished: number; rate: number }

/** Funil de conclusão de casos: % que finalizou do que começou. */
export function completionFunnel(started: number, finished: number): Funnel {
  const rate = started > 0 ? Math.round((finished / started) * 100) : 0
  return { started, finished, rate }
}

/**
 * Janela de estudo: distribuição por faixa horária do dia (0–23h → 4 blocos) e
 * por dia da semana (0=domingo). Útil para o coordenador planejar.
 */
export type StudyWindow = {
  byBlock: { madrugada: number; manha: number; tarde: number; noite: number }
  byWeekday: number[] // 7 posições, 0=dom
  peakBlock: string
}
export function studyWindow(eventsMs: number[]): StudyWindow {
  const byBlock = { madrugada: 0, manha: 0, tarde: 0, noite: 0 }
  const byWeekday = [0, 0, 0, 0, 0, 0, 0]
  for (const ms of eventsMs) {
    const d = new Date(ms)
    const h = d.getUTCHours()
    if (h < 6) byBlock.madrugada++
    else if (h < 12) byBlock.manha++
    else if (h < 18) byBlock.tarde++
    else byBlock.noite++
    byWeekday[d.getUTCDay()]++
  }
  const peakBlock = (Object.entries(byBlock).sort((a, b) => b[1] - a[1])[0]?.[0]) ?? 'madrugada'
  return { byBlock, byWeekday, peakBlock }
}

export type TrendPoint = { periodKey: string; avg: number; n: number }

/**
 * Evolução temporal de um score (0–100 ou 0–10): média por mês (UTC AAAA-MM).
 * Entrada: pares {ts(ms), value}. Saída ordenada cronologicamente.
 */
export function monthlyTrend(points: Array<{ ts: number; value: number }>): TrendPoint[] {
  const byMonth = new Map<string, { sum: number; n: number }>()
  for (const p of points) {
    if (p.value == null || Number.isNaN(p.value)) continue
    const d = new Date(p.ts)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const cur = byMonth.get(key) ?? { sum: 0, n: 0 }
    cur.sum += p.value; cur.n++
    byMonth.set(key, cur)
  }
  return [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([periodKey, v]) => ({ periodKey, avg: Math.round((v.sum / v.n) * 10) / 10, n: v.n }))
}
