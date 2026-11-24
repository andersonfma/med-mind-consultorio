import 'server-only'
import { type SupabaseClient } from '@supabase/supabase-js'
import { EXAM_AREAS, PRE_REQ_SPECIALTIES, isQuantitativeArea, type ExamType, type ExamTrack } from '@/lib/exam/blueprint'
import { generateQuestions, type ExamQuestion } from '@/lib/exam/generate'

export type ExamMode = 'random' | 'blueprint'
export type BlueprintRow = { area: string; topic?: string; n: number }
export type ExamSpec = { total?: number; rows?: BlueprintRow[] }
type PlanRow = { areaKey: string; label: string; topics: string; quantitative: boolean; n: number }

const PER_ROW_CAP = 30
const TOTAL_CAP = 50

function areaInfo(exam: ExamType, track: ExamTrack, areaKey: string): { label: string; topics: string; quantitative: boolean } | null {
  const preReq = exam === 'enare' && track === 'pre-requisito'
  const r = preReq ? PRE_REQ_SPECIALTIES.find((s) => s.key === areaKey) : EXAM_AREAS.find((a) => a.key === areaKey)
  if (!r) return null
  return { label: r.label, topics: r.topics, quantitative: !preReq && isQuantitativeArea(areaKey) }
}

/** Monta o plano de geração (uma entrada por área/tema, com nº de questões). */
export function buildPlan(exam: ExamType, track: ExamTrack, mode: ExamMode, spec: ExamSpec): PlanRow[] {
  const preReq = exam === 'enare' && track === 'pre-requisito'
  const areas = (preReq ? PRE_REQ_SPECIALTIES : EXAM_AREAS) as ReadonlyArray<{ key: string; label: string; topics: string; weight?: number }>

  if (mode === 'blueprint') {
    const plan: PlanRow[] = []
    for (const row of spec.rows ?? []) {
      const info = areaInfo(exam, track, row.area)
      const n = Math.min(Math.max(0, Math.floor(Number(row.n) || 0)), PER_ROW_CAP)
      if (!info || n <= 0) continue
      plan.push({ areaKey: row.area, label: info.label, topics: row.topic?.trim() || info.topics, quantitative: info.quantitative, n })
    }
    return plan
  }

  // random: distribui o total pelas áreas por peso (PRE_REQ não tem peso → igual).
  const total = Math.min(Math.max(1, Math.floor(Number(spec.total) || 10)), TOTAL_CAP)
  const weights = areas.map((a) => a.weight ?? 1)
  const wsum = weights.reduce((s, w) => s + w, 0)
  const alloc = weights.map((w) => Math.floor((total * w) / wsum))
  let used = alloc.reduce((s, n) => s + n, 0)
  const order = areas.map((_, i) => i).sort((x, y) => weights[y] - weights[x])
  for (let k = 0; used < total; k++, used++) alloc[order[k % order.length]]++
  const plan: PlanRow[] = []
  areas.forEach((a, i) => {
    if (alloc[i] <= 0) return
    const info = areaInfo(exam, track, a.key)!
    plan.push({ areaKey: a.key, label: info.label, topics: info.topics, quantitative: info.quantitative, n: alloc[i] })
  })
  return plan
}

/** Gera a prova (uma vez), persiste as questões e marca status. Degrada para 'failed' em erro.
 *  Roda em background (servidor Docker persistente) — pode levar minutos. */
export async function generateFacultyExam(admin: SupabaseClient, examId: string): Promise<void> {
  try {
    const { data } = await admin.from('faculty_exams').select('exam, track, mode, spec').eq('id', examId).single()
    const row = data as { exam: ExamType; track: ExamTrack; mode: ExamMode; spec: ExamSpec } | null
    if (!row) return
    const plan = buildPlan(row.exam, row.track, row.mode, row.spec)

    const all: Array<ExamQuestion & { area: string }> = []
    for (const p of plan) {
      const qs = await generateQuestions(row.exam, p.label, p.topics, p.n, row.track, p.quantitative)
      for (const q of qs) all.push({ ...q, area: p.label })
    }

    if (all.length === 0) {
      await admin.from('faculty_exams').update({ status: 'failed', error: 'Nenhuma questão pôde ser gerada.' } as never).eq('id', examId)
      return
    }
    const qRows = all.map((q, i) => ({
      faculty_exam_id: examId, ord: i + 1, area: q.area, topic: q.topic,
      prompt: q.prompt, options: q.options, correct_key: q.correct_key, explanation: q.explanation,
    }))
    await admin.from('faculty_exam_questions').insert(qRows as never)
    await admin.from('faculty_exams').update({ status: 'ready', total_questions: all.length, ready_at: new Date().toISOString() } as never).eq('id', examId)
  } catch (e) {
    try { await admin.from('faculty_exams').update({ status: 'failed', error: String(e).slice(0, 300) } as never).eq('id', examId) } catch { /* noop */ }
  }
}
