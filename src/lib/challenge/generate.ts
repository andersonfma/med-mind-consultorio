import 'server-only'
import { type SupabaseClient } from '@supabase/supabase-js'
import { openai } from '@/lib/openai/client'
import { MODELS } from '@/lib/openai/models'
import { buildWeeklyCasePrompt, parseWeeklyCase, type GeneratedWeek } from './prompts'

/** Gera o caso da semana + 5 quizzes coerentes (Clínica Médica). null em falha. */
export async function generateWeeklyCase(): Promise<GeneratedWeek | null> {
  const completion = await openai.chat.completions.create({
    model: MODELS.generation,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: buildWeeklyCasePrompt() }],
  }, { timeout: 60_000 })
  const raw = completion.choices[0]?.message?.content
  return raw ? parseWeeklyCase(raw) : null
}

/** Segunda-feira da PRÓXIMA semana (UTC), YYYY-MM-DD. */
export function nextMonday(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dow = d.getUTCDay()
  const add = ((8 - dow) % 7) || 7
  d.setUTCDate(d.getUTCDate() + add)
  return d.toISOString().slice(0, 10)
}

/** Segunda-feira da semana CORRENTE (UTC), YYYY-MM-DD. */
export function thisMonday(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dow = d.getUTCDay() // 0=dom..6=sáb
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1))
  return d.toISOString().slice(0, 10)
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export type GenerateResult =
  | { status: 'skipped'; weekStart: string }
  | { status: 'created'; weekStart: string }
  | { status: 'genfail' }
  | { status: 'persistfail' }

/** Idempotente: gera e persiste o caso da PRÓXIMA semana se ainda não existir. */
export async function generateAndPersistNextWeek(admin: SupabaseClient, now: Date): Promise<GenerateResult> {
  return generateAndPersistForWeek(admin, nextMonday(now))
}

/** Idempotente: gera e persiste o caso para a semana `weekStart` (segunda, YYYY-MM-DD). */
export async function generateAndPersistForWeek(admin: SupabaseClient, weekStart: string): Promise<GenerateResult> {
  const { data: existing } = await admin.from('weekly_cases').select('id').eq('week_start', weekStart).maybeSingle()
  if (existing) return { status: 'skipped', weekStart }

  const week = await generateWeeklyCase()
  if (!week) return { status: 'genfail' }

  const { data: wc, error: wcErr } = await admin.from('weekly_cases')
    .insert({ week_start: weekStart, specialty: 'Clínica Médica', title: week.title, true_diagnosis: week.true_diagnosis, overview: week.overview, review: week.review })
    .select('id').single()
  if (wcErr || !wc) return { status: 'persistfail' }
  const caseId = (wc as { id: string }).id

  try {
    for (const d of week.days) {
      const { data: q, error: qErr } = await admin.from('quizzes')
        .insert({ author_id: null, prompt: d.quiz.prompt, options: d.quiz.options, correct_key: d.quiz.correct_key, explanation: d.quiz.explanation })
        .select('id').single()
      if (qErr || !q) throw new Error('quiz insert')
      const { error: dErr } = await admin.from('challenge_days').insert({
        weekly_case_id: caseId, day_index: d.day_index, reveal_date: addDays(weekStart, d.day_index - 1),
        stage: d.stage, narrative: d.narrative, quiz_id: (q as { id: string }).id,
      })
      if (dErr) throw new Error('day insert')
    }
  } catch {
    await admin.from('weekly_cases').delete().eq('id', caseId)
    return { status: 'persistfail' }
  }

  return { status: 'created', weekStart }
}
