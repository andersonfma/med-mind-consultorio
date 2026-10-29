import 'server-only'
import { openai } from '@/lib/openai/client'
import { MODELS } from '@/lib/openai/models'
import { EXAM_AREAS, type ExamAreaKey } from './blueprint'

export type ExamQuestion = {
  prompt: string
  options: { key: string; text: string }[]
  correct_key: string
  explanation: string
  topic: string
}

export function buildExamPrompt(areaLabel: string, topics: string, n: number): string {
  return [
    'Você é um elaborador de questões para a prova de residência médica (ENARE) e para o ENAMED.',
    `Gere ${n} questões ORIGINAIS de "${areaLabel}", NOS MOLDES dessas provas.`,
    'NUNCA copie questões reais de nenhuma prova — crie casos e enunciados inéditos.',
    `Temas de alto rendimento a cobrir (varie bem entre eles, sem repetir tema): ${topics}.`,
    'Formato de cada questão: vinheta clínica curta e realista + pergunta objetiva, exatamente 5 alternativas (keys A..E), UMA correta (single best answer).',
    'DIFICULDADE: nível de prova de residência — exige raciocínio clínico, não reconhecimento imediato. Sem pergunta óbvia nem alternativa de preenchimento.',
    'DISTRATORES (CRÍTICO): pelo menos 2 alternativas erradas MAS muito plausíveis — o diferencial clássico, a conduta "quase certa" que falha num detalhe, a armadilha frequente de prova. A correta NÃO pode ser a única séria; a diferença deve estar num detalhe fino (um achado discriminante, um valor, uma contraindicação).',
    'EXPLICAÇÃO: diga por que a correta é certa E por que os 2 principais distratores enganam (o que os descarta).',
    'Cada questão traz um "topic": o tema específico em 2-4 palavras.',
    'Responda SOMENTE um JSON válido: {"questions":[{"prompt":"...","options":[{"key":"A","text":"..."}],"correct_key":"A","explanation":"...","topic":"..."}]}',
  ].join('\n')
}

export function parseExam(raw: string, n: number): ExamQuestion[] | null {
  try {
    const o = JSON.parse(raw) as { questions?: ExamQuestion[] }
    const qs = o.questions
    if (!Array.isArray(qs) || qs.length === 0) return null
    const clean = qs.filter(
      (q) => q?.prompt && Array.isArray(q.options) && q.options.length >= 4 && q.options.length <= 5
        && q.options.some((op) => op.key === q.correct_key) && typeof q.explanation === 'string' && q.explanation,
    )
    return clean.length ? clean.slice(0, n) : null
  } catch {
    return null
  }
}

/** Gera um simulado curto por área (questões originais nos moldes do ENARE/ENAMED). */
export async function generateExam(areaKey: ExamAreaKey, n: number): Promise<ExamQuestion[] | null> {
  const area = EXAM_AREAS.find((a) => a.key === areaKey)
  if (!area) return null
  const completion = await openai.chat.completions.create({
    model: MODELS.generation,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: buildExamPrompt(area.label, area.topics, n) }],
  }, { timeout: 90_000 })
  const raw = completion.choices[0]?.message?.content
  return raw ? parseExam(raw, n) : null
}
