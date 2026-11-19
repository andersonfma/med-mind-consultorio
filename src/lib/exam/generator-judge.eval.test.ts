// @vitest-environment node
//
// JUDGE DO GERADOR DE SIMULADOS — mede empiricamente a saída do gerador contra o
// blueprint estrutural das provas reais (examStructuralSpec). NÃO roda na suíte normal
// (precisa de chave + chamadas ao modelo). Usa o MESMO caminho de produção:
// buildExamPrompt → MODELS.generation (gpt-4.1, json_object) → parseExam → passesSpec.
//
// Uso:
//   RUN_LIVE_EVAL=1 [EVAL_OUT=<out.json>] [EVAL_N=8] \
//     npx vitest run src/lib/exam/generator-judge.eval.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import OpenAI from 'openai'
import { MODELS } from '@/lib/openai/models'
import { EXAM_AREAS, PRE_REQ_SPECIALTIES, examOptions, examStructuralSpec, isQuantitativeArea, type ExamType, type ExamTrack } from './blueprint'
import { applyExpansion, buildExamPrompt, buildExpandPrompt, parseExam } from './prompt'
import { passesSpec, type ExamQuestion } from './validate'

const LIVE = process.env.RUN_LIVE_EVAL === '1'
const N = Number(process.env.EVAL_N ?? 8)

type Case = { id: string; exam: ExamType; track: ExamTrack; area: string }
const CASES: Case[] = [
  { id: 'enare-ad-clinica', exam: 'enare', track: 'acesso-direto', area: 'clinica' },
  { id: 'enare-ad-preventiva', exam: 'enare', track: 'acesso-direto', area: 'preventiva' },
  { id: 'enare-pr-cardiologia', exam: 'enare', track: 'pre-requisito', area: 'cardiologia' },
  { id: 'enamed-clinica', exam: 'enamed', track: 'acesso-direto', area: 'clinica' },
]

const wc = (s: string): number => (s.match(/\p{L}+/gu) ?? []).length
const numData = (s: string): number => (s.match(/\d[\d.,]*/g) ?? []).length
const VIGNETTE = /\b(anos|meses|paciente|mulher|homem|lactente|rec[eé]m[- ]nascido|crian[çc]a|gestante|menina|menino|idade)\b/i
const median = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : 0 }
const pct = (xs: number[], p: number): number => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.round((p / 100) * (s.length - 1)))] : 0 }

function apiKey(): string {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY
  const env = readFileSync(new URL('../../../.env.local', import.meta.url), 'utf8')
  const line = env.split(/\r?\n/).find((l) => l.startsWith('OPENAI_API_KEY='))
  if (!line) throw new Error('OPENAI_API_KEY não encontrado em env nem em .env.local')
  return line.slice('OPENAI_API_KEY='.length).trim().replace(/^["']|["']$/g, '')
}

function resolveArea(c: Case): { label: string; topics: string } {
  const preReq = c.exam === 'enare' && c.track === 'pre-requisito'
  const r = preReq ? PRE_REQ_SPECIALTIES.find((s) => s.key === c.area) : EXAM_AREAS.find((a) => a.key === c.area)
  if (!r) throw new Error(`área inválida: ${c.area}`)
  return { label: r.label, topics: r.topics }
}

describe.skipIf(!LIVE)('generator judge — saída do gerador × blueprint real', () => {
  it('gera por caso e mede a distribuição estrutural contra o spec', async () => {
    const client = new OpenAI({ apiKey: apiKey() })
    const out: unknown[] = []
    const failures: string[] = []
    const check = (cond: boolean, msg: string) => { if (!cond) failures.push(msg) }

    for (const c of CASES) {
      const preReq = c.exam === 'enare' && c.track === 'pre-requisito'
      const nOpt = examOptions(c.exam)
      const quantitative = !preReq && isQuantitativeArea(c.area)
      const spec = examStructuralSpec(c.exam, c.track)
      const { label, topics } = resolveArea(c)

      const completion = await client.chat.completions.create({
        model: MODELS.generation,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: buildExamPrompt(c.exam, label, topics, N, c.track, quantitative) }],
      }, { timeout: 90_000 })
      const raw = completion.choices[0]?.message?.content ?? ''
      const parsed: ExamQuestion[] = parseExam(raw, N, nOpt) ?? []

      // Passe de expansão (mesmo caminho da produção): alonga enunciados curtos.
      let expanded = parsed
      const built = buildExpandPrompt(parsed, c.exam, c.track, quantitative)
      if (built) {
        const ec = await client.chat.completions.create({
          model: MODELS.generation,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: built.prompt }],
        }, { timeout: 90_000 })
        expanded = applyExpansion(parsed, ec.choices[0]?.message?.content ?? '{}')
      }

      const stems = expanded.map((q) => wc(q.prompt))
      const datas = expanded.map((q) => numData(q.prompt))
      const optWords = expanded.flatMap((q) => q.options.map((o) => wc(o.text)))
      const vignette = expanded.length ? expanded.filter((q) => VIGNETTE.test(q.prompt)).length / expanded.length : 0
      const optCountOk = expanded.every((q) => q.options.length === nOpt)
      const accepted = expanded.filter((q) => passesSpec(q, c.exam, quantitative, c.track)).length
      const acceptance = expanded.length ? accepted / expanded.length : 0

      const row = {
        case: c.id, quantitative, nGerado: parsed.length,
        alvoEnunciado: `${spec.stemMinWords}-${spec.stemMaxWords} (~${spec.stemTargetWords})`,
        enuncMediana: median(stems), enuncP10: pct(stems, 10), enuncP90: pct(stems, 90),
        dadosMediana: median(datas), alvoDados: spec.numDataMin,
        altMediana: median(optWords), vinheta: `${Math.round(vignette * 100)}%`,
        altCountOk: optCountOk, aceitacao: `${Math.round(acceptance * 100)}%`,
      }
      out.push(row)
      console.log(`[judge] ${c.id}: enunc med ${row.enuncMediana} (alvo ${row.alvoEnunciado}) · dados ${row.dadosMediana}/${spec.numDataMin} · vinheta ${row.vinheta} · aceitação ${row.aceitacao} · n=${parsed.length}`)

      // Mede TODOS os casos antes de falhar (coleta as violações do blueprint).
      check(parsed.length > 0, `${c.id}: gerou 0 questões`)
      check(optCountOk, `${c.id}: alguma questão com nº de alternativas != ${nOpt}`)
      check(median(stems) >= spec.stemMinWords, `${c.id}: enunciado mediano ${median(stems)} < piso ${spec.stemMinWords}`)
      check(median(datas) >= spec.numDataMin, `${c.id}: dados ${median(datas)} < mínimo ${spec.numDataMin}`)
      if (!quantitative) check(vignette >= 0.75, `${c.id}: vinheta ${Math.round(vignette * 100)}% < 75%`)
      check(acceptance >= 0.5, `${c.id}: aceitação ${Math.round(acceptance * 100)}% < 50%`)
    }

    const outPath = process.env.EVAL_OUT
    if (outPath) { writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8'); console.log(`[judge] resultados em ${outPath}`) }
    if (failures.length) console.log(`[judge] VIOLAÇÕES:\n - ${failures.join('\n - ')}`)
    expect(failures, failures.join(' | ')).toEqual([])
  }, 600_000)
})
