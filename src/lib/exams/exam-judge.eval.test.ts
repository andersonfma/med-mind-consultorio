// @vitest-environment node
//
// HARNESS DE AVALIAÇÃO EMPÍRICA do juiz de exames (NÃO roda na suíte normal).
// Roda cada caso pelo MESMO caminho de produção: buildExamValidationPrompt →
// gpt-4.1-mini (MODELS.utility) com response_format json_object, sem temperature —
// idêntico a src/app/api/consultations/[id]/exams/route.ts.
//
// Uso:
//   RUN_LIVE_EVAL=1 EVAL_CASES=<casos.json> EVAL_OUT=<resultados.json> \
//     npx vitest run src/lib/exams/exam-judge.eval.test.ts
//
// EVAL_CASES: JSON array de casos (ver tipo EvalCase abaixo).
// EVAL_OUT:   caminho onde o array de resultados é gravado.
import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import OpenAI from 'openai'
import { buildExamValidationPrompt } from './exam-prompts'
import { MODELS } from '@/lib/openai/models'
import type { Patient } from '@/types/domain'

const LIVE = process.env.RUN_LIVE_EVAL === '1'

interface EvalCase {
  id: string
  name?: string
  age?: number
  gender?: 'M' | 'F'
  specialty?: string
  chief_complaint?: string
  conditions?: string[]
  difficulty?: 'easy' | 'medium' | 'hard'
  exam: string
  justification: string
  clinical_reasoning?: string
  physical_exam_summary?: string
  case_summary?: string | null
  is_followup?: boolean
  expected: 'approve' | 'reject'
  rationale?: string
}

interface EvalResult {
  id: string
  exam: string
  justification: string
  expected: 'approve' | 'reject'
  systemVerdict: 'approve' | 'reject' | 'error'
  match: boolean
  judgeFeedback: string
  rationale?: string
}

function apiKey(): string {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY
  // fallback: parse .env.local (vitest não carrega automaticamente)
  const env = readFileSync(new URL('../../../.env.local', import.meta.url), 'utf8')
  const line = env.split(/\r?\n/).find(l => l.startsWith('OPENAI_API_KEY='))
  if (!line) throw new Error('OPENAI_API_KEY não encontrado em env nem em .env.local')
  return line.slice('OPENAI_API_KEY='.length).trim().replace(/^["']|["']$/g, '')
}

async function runPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker))
  return results
}

describe.skipIf(!LIVE)('exam judge — live empirical eval', () => {
  it('roda a bateria de casos pelo juiz real e grava os resultados', async () => {
    const casesPath = process.env.EVAL_CASES
    const outPath = process.env.EVAL_OUT
    if (!casesPath || !outPath) throw new Error('defina EVAL_CASES e EVAL_OUT')

    const cases = JSON.parse(readFileSync(casesPath, 'utf8')) as EvalCase[]
    const client = new OpenAI({ apiKey: apiKey() })

    const results = await runPool<EvalCase, EvalResult>(cases, 5, async (c) => {
      const patient = {
        name: c.name ?? 'Paciente Teste',
        age: c.age ?? 50,
        gender: c.gender ?? 'M',
        specialty: c.specialty ?? 'Clínica Médica',
        chief_complaint: c.chief_complaint ?? '',
        conditions: c.conditions ?? [],
        difficulty: c.difficulty ?? 'medium',
      } as unknown as Patient

      const isFollowUp = c.is_followup ?? !!(c.case_summary && c.case_summary.trim())
      const prompt = buildExamValidationPrompt(
        patient, c.exam.trim(), c.justification.trim(),
        c.clinical_reasoning ?? '', c.physical_exam_summary ?? '',
        c.case_summary ?? null, isFollowUp,
      )

      try {
        const completion = await client.chat.completions.create({
          model: MODELS.utility,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        }, { timeout: 25_000 })
        const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as Record<string, unknown>
        const approved = parsed.approved === true
        const systemVerdict = approved ? 'approve' : 'reject'
        return {
          id: c.id, exam: c.exam, justification: c.justification, expected: c.expected,
          systemVerdict, match: systemVerdict === c.expected,
          judgeFeedback: String(parsed.feedback ?? ''), rationale: c.rationale,
        }
      } catch (e) {
        return {
          id: c.id, exam: c.exam, justification: c.justification, expected: c.expected,
          systemVerdict: 'error', match: false, judgeFeedback: `ERROR: ${String(e)}`, rationale: c.rationale,
        }
      }
    })

    writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8')

    const matches = results.filter(r => r.match).length
    const errors = results.filter(r => r.systemVerdict === 'error').length
    console.log(`[eval] ${matches}/${results.length} corretos | ${errors} erros | out=${outPath}`)
    expect(errors).toBe(0) // falha só por erro técnico (rede/parse), não por assertividade
  }, 300_000)
})
