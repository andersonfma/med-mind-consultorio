import 'server-only'
import { openai } from '@/lib/openai/client'
import { MODELS } from '@/lib/openai/models'
import { EXAM_AREAS, examOptions, type ExamAreaKey, type ExamType } from './blueprint'

export type ExamQuestion = {
  prompt: string
  options: { key: string; text: string }[]
  correct_key: string
  explanation: string
  topic: string
}

const KEYS = ['A', 'B', 'C', 'D', 'E']

export function buildExamPrompt(exam: ExamType, areaLabel: string, topics: string, n: number): string {
  const nOpt = examOptions(exam)
  const keys = KEYS.slice(0, nOpt).join('..')
  const examDesc = exam === 'enamed'
    ? 'ENAMED (Exame Nacional de Avaliação da Formação Médica, INEP) — alinhado às Diretrizes Curriculares e às competências para o exercício profissional'
    : 'ENARE (Exame Nacional de Residência) — nível de prova de residência médica'
  const gerais = areaLabel === 'Competências Gerais'

  return [
    `Você é um elaborador de questões para o ${examDesc}.`,
    `Gere ${n} questões ORIGINAIS de "${areaLabel}", NOS MOLDES dessa prova. NUNCA copie questões reais — crie casos inéditos.`,
    `Temas de alto rendimento (ORDENADOS por incidência — priorize os primeiros, varie bem, não repita tema): ${topics}.`,
    '',
    'ESTILO (fiel à prova real):',
    gerais
      ? '- Enunciado contextualizado (situação clínica, dilema ético, cenário de gestão/SUS, ou um estudo/tabela para leitura crítica), seguido de pergunta objetiva ao final.'
      : '- Cada questão é uma VINHETA CLÍNICA completa: idade e sexo, queixa + HDA, antecedentes relevantes, achados de exame físico e, quando pertinente, EXAMES COMPLEMENTARES COM VALORES (laboratório, ECG, imagem descrita). Termine com uma pergunta objetiva ("qual o diagnóstico mais provável?", "qual a conduta?", "qual o próximo passo?").',
    '- Vinheta de porte médio a longo (4 a 10 linhas) — não faça pergunta "seca" de decoreba.',
    '- Questões INDEPENDENTES entre si (nenhuma depende de outra).',
    `- Exatamente ${nOpt} alternativas (keys ${keys}), UMA correta (single best answer). Alternativas homogêneas em tamanho — a correta NÃO pode se destacar por ser a mais longa/completa.`,
    '',
    'DIFICULDADE: nível de prova de residência — exige raciocínio clínico, não reconhecimento imediato. Proibido pergunta óbvia ou alternativa absurda/de preenchimento.',
    `DISTRATORES (CRÍTICO): pelo menos 2 das ${nOpt} alternativas devem ser ERRADAS MAS MUITO PLAUSÍVEIS — o diferencial clássico mais provável, a conduta "quase certa" que falha num detalhe, ou a armadilha frequente de prova. A diferença entre a correta e os melhores distratores deve estar num DETALHE FINO do caso (um achado discriminante, um valor, uma contraindicação).`,
    'EXPLICAÇÃO: por que a correta é certa E por que os 2 principais distratores enganam (o que os descarta).',
    'Cada questão traz um "topic" (o tema específico em 2-4 palavras).',
    '',
    `Responda SOMENTE um JSON válido: {"questions":[{"prompt":"...","options":[{"key":"A","text":"..."}],"correct_key":"A","explanation":"...","topic":"..."}]} — com exatamente ${nOpt} options por questão.`,
  ].join('\n')
}

export function parseExam(raw: string, n: number, nOpt: number): ExamQuestion[] | null {
  try {
    const o = JSON.parse(raw) as { questions?: ExamQuestion[] }
    const qs = o.questions
    if (!Array.isArray(qs) || qs.length === 0) return null
    const clean = qs.filter(
      (q) => q?.prompt && Array.isArray(q.options) && q.options.length === nOpt
        && q.options.some((op) => op.key === q.correct_key) && typeof q.explanation === 'string' && q.explanation,
    )
    return clean.length ? clean.slice(0, n) : null
  } catch {
    return null
  }
}

/** Gera um simulado curto por área, no formato do exame escolhido (ENARE 5 alt / ENAMED 4 alt). */
export async function generateExam(exam: ExamType, areaKey: ExamAreaKey, n: number): Promise<ExamQuestion[] | null> {
  const area = EXAM_AREAS.find((a) => a.key === areaKey)
  if (!area) return null
  const nOpt = examOptions(exam)
  const completion = await openai.chat.completions.create({
    model: MODELS.generation,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: buildExamPrompt(exam, area.label, area.topics, n) }],
  }, { timeout: 90_000 })
  const raw = completion.choices[0]?.message?.content
  return raw ? parseExam(raw, n, nOpt) : null
}
