import 'server-only'
import { openai } from '@/lib/openai/client'
import { MODELS } from '@/lib/openai/models'
import { EXAM_AREAS, PRE_REQ_SPECIALTIES, examOptions, isQuantitativeArea, type ExamType, type ExamTrack } from './blueprint'
import { passesSpec, type ExamQuestion } from './validate'
import { applyExpansion, buildExamPrompt, buildExpandPrompt, parseExam } from './prompt'

export type { ExamQuestion }
export { buildExamPrompt, parseExam }

/**
 * PASSE DE EXPANSÃO: o gerador tende a escrever enunciados na ponta BAIXA do envelope
 * real (ex.: pré-requisito ~70 vs ~120 das provas). Este passe reescreve APENAS os
 * enunciados curtos, enriquecendo a vinheta (antecedentes, exame físico, exames prévios,
 * evolução) até o alvo — SEM ver nem tocar nas alternativas/gabarito e preservando os
 * achados discriminantes e a pergunta final. Qualquer deriva de resposta é pega depois
 * pelo verifyAnswers (que re-resolve a versão expandida). Degrada sem bloquear em falha.
 */
export async function expandStems(qs: ExamQuestion[], exam: ExamType, track: ExamTrack, quantitative: boolean): Promise<ExamQuestion[]> {
  const built = buildExpandPrompt(qs, exam, track, quantitative)
  if (!built) return qs // nenhum enunciado abaixo do alvo
  try {
    const completion = await openai.chat.completions.create({
      model: MODELS.generation,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: built.prompt }],
    }, { timeout: 90_000 })
    return applyExpansion(qs, completion.choices[0]?.message?.content ?? '{}')
  } catch {
    return qs // expansor indisponível → segue com os enunciados originais
  }
}

/**
 * Verificação INDEPENDENTE do gabarito: um 2º modelo resolve cada questão SEM ver a
 * resposta marcada e sinaliza ambiguidade. Mantemos a questão só se a resposta dele
 * bate com o gabarito E ele não a considerou ambígua — assim gabarito errado ou
 * questão "sem discriminante" (ex.: DM1 vs DM2 sem dado que decida) não passa.
 * Em falha do verificador, não bloqueia o simulado (degrada para só-estrutural).
 */
export async function verifyAnswers(qs: ExamQuestion[]): Promise<boolean[]> {
  if (qs.length === 0) return []
  const list = qs.map((q, i) => `Q${i + 1}. ${q.prompt}\n${q.options.map((o) => `${o.key}) ${o.text}`).join('\n')}`).join('\n\n')
  const prompt = [
    'Você é um professor revisor RIGOROSO de provas de residência médica (ENARE/ENAMED).',
    'Resolva CADA questão de forma independente, escolhendo a ÚNICA melhor alternativa segundo as diretrizes atuais.',
    'Marque "ambigua": true se mais de uma alternativa for defensável OU se o enunciado NÃO traz um dado que DISCRIMINE a resposta (ex.: diferenciar dois diagnósticos sem o achado que os separa).',
    'Dê também sua confiança de 0 a 1.',
    '',
    list,
    '',
    'Responda SOMENTE JSON: {"v":[{"i":1,"resposta":"A","ambigua":false,"conf":0.9}]} — uma entrada por questão.',
  ].join('\n')
  try {
    const completion = await openai.chat.completions.create({
      model: MODELS.generation,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }, { timeout: 90_000 })
    const o = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as { v?: Array<{ i: number; resposta: string; ambigua?: boolean; conf?: number }> }
    const v = o.v ?? []
    return qs.map((q, i) => {
      const r = v.find((x) => x.i === i + 1)
      if (!r) return false
      return r.resposta === q.correct_key && !r.ambigua && (r.conf === undefined || r.conf >= 0.6)
    })
  } catch {
    return qs.map(() => true) // verificador indisponível → não bloqueia (fica a validação estrutural)
  }
}

/** Gera um simulado curto, no formato e TRILHA do exame (ENARE acesso direto/pré-requisito, ENAMED).
 *  Sobre-solicita, valida contra o blueprint estrutural da trilha e regenera para completar. */
export async function generateExam(exam: ExamType, areaKey: string, n: number, track: ExamTrack = 'acesso-direto'): Promise<ExamQuestion[] | null> {
  const preReq = exam === 'enare' && track === 'pre-requisito'
  const resolved = preReq
    ? PRE_REQ_SPECIALTIES.find((s) => s.key === areaKey)
    : EXAM_AREAS.find((a) => a.key === areaKey)
  if (!resolved) return null
  const nOpt = examOptions(exam)
  // Pré-requisito é sempre clínico/especialista; só acesso-direto/ENAMED têm áreas quantitativas.
  const quantitative = !preReq && isQuantitativeArea(resolved.key)
  const collected: ExamQuestion[] = []

  for (let attempt = 0; attempt < 3 && collected.length < n; attempt++) {
    const need = n - collected.length
    const req = Math.min(need + 2, n + 2) // buffer para compensar as reprovadas
    const completion = await openai.chat.completions.create({
      model: MODELS.generation,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: buildExamPrompt(exam, resolved.label, resolved.topics, req, track, quantitative) }],
    }, { timeout: 90_000 })
    const raw = completion.choices[0]?.message?.content
    const parsed = (raw ? parseExam(raw, req, nOpt) : null) ?? []
    if (parsed.length === 0) continue
    // Passe de expansão: alonga enunciados curtos até o alvo antes de validar.
    const expanded = await expandStems(parsed, exam, track, quantitative)
    const structural = expanded.filter((q) => passesSpec(q, exam, quantitative, track))
    if (structural.length === 0) continue
    // Verificação independente do gabarito antes de aceitar.
    const ok = await verifyAnswers(structural)
    structural.forEach((q, i) => { if (ok[i] && collected.length < n) collected.push(q) })
  }
  return collected.length ? collected.slice(0, n) : null
}
