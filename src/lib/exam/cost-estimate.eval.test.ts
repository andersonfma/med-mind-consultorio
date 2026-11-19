// @vitest-environment node
//
// MEDIÇÃO DE CUSTO do gerador de simulados (gera 12 → expande → verifica), capturando
// os tokens reais de cada chamada e convertendo em USD. NÃO roda na suíte normal.
//   RUN_LIVE_EVAL=1 npx vitest run src/lib/exam/cost-estimate.eval.test.ts
import { describe, it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import OpenAI from 'openai'
import { MODELS } from '@/lib/openai/models'
import { EXAM_AREAS, PRE_REQ_SPECIALTIES, examOptions, isQuantitativeArea, type ExamType, type ExamTrack } from './blueprint'
import { applyExpansion, buildExamPrompt, buildExpandPrompt, buildVerifyPrompt, parseExam } from './prompt'
import { passesSpec } from './validate'

const LIVE = process.env.RUN_LIVE_EVAL === '1'
// gpt-4.1 (MODELS.generation): $2.00 / 1M input, $8.00 / 1M output.
const USD_IN = 2.0 / 1_000_000, USD_OUT = 8.0 / 1_000_000
const REQ = 12 // generateExam pede need+2 para um simulado de 10 questões

type Case = { id: string; exam: ExamType; track: ExamTrack; area: string }
const CASES: Case[] = [
  { id: 'enare-ad-clinica', exam: 'enare', track: 'acesso-direto', area: 'clinica' },
  { id: 'enare-pr-cardiologia', exam: 'enare', track: 'pre-requisito', area: 'cardiologia' },
  { id: 'enamed-clinica', exam: 'enamed', track: 'acesso-direto', area: 'clinica' },
]

function apiKey(): string {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY
  const env = readFileSync(new URL('../../../.env.local', import.meta.url), 'utf8')
  const line = env.split(/\r?\n/).find((l) => l.startsWith('OPENAI_API_KEY='))
  if (!line) throw new Error('OPENAI_API_KEY não encontrado')
  return line.slice('OPENAI_API_KEY='.length).trim().replace(/^["']|["']$/g, '')
}
function resolveArea(c: Case) {
  const preReq = c.exam === 'enare' && c.track === 'pre-requisito'
  const r = preReq ? PRE_REQ_SPECIALTIES.find((s) => s.key === c.area) : EXAM_AREAS.find((a) => a.key === c.area)
  if (!r) throw new Error(`área inválida: ${c.area}`)
  return { label: r.label, topics: r.topics }
}

describe.skipIf(!LIVE)('custo do gerador', () => {
  it('mede tokens e USD por simulado (1 tentativa)', async () => {
    const client = new OpenAI({ apiKey: apiKey() })
    let totIn = 0, totOut = 0, totUsd = 0
    const rows: unknown[] = []

    for (const c of CASES) {
      const preReq = c.exam === 'enare' && c.track === 'pre-requisito'
      const nOpt = examOptions(c.exam)
      const quantitative = !preReq && isQuantitativeArea(c.area)
      const { label, topics } = resolveArea(c)
      let pin = 0, pout = 0

      const gen = await client.chat.completions.create({
        model: MODELS.generation, response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: buildExamPrompt(c.exam, label, topics, REQ, c.track, quantitative) }],
      }, { timeout: 90_000 })
      pin += gen.usage?.prompt_tokens ?? 0; pout += gen.usage?.completion_tokens ?? 0
      const parsed = parseExam(gen.choices[0]?.message?.content ?? '', REQ, nOpt) ?? []

      let expanded = parsed
      const built = buildExpandPrompt(parsed, c.exam, c.track, quantitative)
      if (built) {
        const ex = await client.chat.completions.create({
          model: MODELS.generation, response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: built.prompt }],
        }, { timeout: 90_000 })
        pin += ex.usage?.prompt_tokens ?? 0; pout += ex.usage?.completion_tokens ?? 0
        expanded = applyExpansion(parsed, ex.choices[0]?.message?.content ?? '{}')
      }

      const structural = expanded.filter((q) => passesSpec(q, c.exam, quantitative, c.track))
      const ver = await client.chat.completions.create({
        model: MODELS.generation, response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: buildVerifyPrompt(structural) }],
      }, { timeout: 90_000 })
      pin += ver.usage?.prompt_tokens ?? 0; pout += ver.usage?.completion_tokens ?? 0

      const usd = pin * USD_IN + pout * USD_OUT
      totIn += pin; totOut += pout; totUsd += usd
      rows.push({ case: c.id, in: pin, out: pout, usd: Number(usd.toFixed(4)), aprovadas: `${structural.length}/${parsed.length}` })
      console.log(`[custo] ${c.id}: in=${pin} out=${pout} tok | US$ ${usd.toFixed(4)} | aprovadas=${structural.length}/${parsed.length}`)
    }

    const n = CASES.length
    const media = { in: Math.round(totIn / n), out: Math.round(totOut / n), usd: Number((totUsd / n).toFixed(4)) }
    console.log(`[custo] MÉDIA/simulado(1 tentativa): in=${media.in} out=${media.out} tok | US$ ${media.usd}`)
    writeFileSync(process.env.EVAL_OUT ?? 'cost-out.json', JSON.stringify({ rows, media }, null, 2), 'utf8')
  }, 600_000)
})
