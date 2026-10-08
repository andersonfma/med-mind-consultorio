import 'server-only'
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
