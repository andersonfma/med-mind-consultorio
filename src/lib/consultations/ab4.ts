export type Ab4Axis = 'a1' | 'a2' | 'a3' | 'a4'

/**
 * Etapa da avaliação AB4:
 * - 1 (primeira consulta): só A1 (Poética) e A2 (Retórica). A3/A4 dependem da
 *   interpretação de resultados de exame, que só são revelados na consulta seguinte → ficam null.
 * - 2 (segunda consulta em diante): avaliação completa A1-A4.
 */
export type Ab4Stage = 1 | 2

export interface Ab4Result {
  a1: number
  a2: number
  a3: number | null
  a4: number | null
  overall: number
  recommendation: string
  stage: Ab4Stage
}

/** Recomendação fixa quando o aluno não registra nenhum pensamento clínico. */
export const EMPTY_REASONING_RECOMMENDATION =
  'Você não registrou nenhum pensamento clínico nesta consulta. O Score AB4 avalia o seu raciocínio, que precisa estar registrado no campo Pensamento Clínico — sem ele, não há o que avaliar e a pontuação é zero. Da próxima vez, registre suas hipóteses, como você as priorizou e a justificativa da sua conclusão.'

/**
 * Score zerado para quando não há pensamento clínico registrado.
 * AB4 mede o PROCESSO de raciocínio; sem raciocínio registrado, não há base para nota.
 */
export function emptyReasoningResult(stage: Ab4Stage = 2): Ab4Result {
  return {
    a1: 0, a2: 0,
    a3: stage === 1 ? null : 0,
    a4: stage === 1 ? null : 0,
    overall: 0,
    recommendation: EMPTY_REASONING_RECOMMENDATION,
    stage,
  }
}

/**
 * Valida e normaliza a saída crua do juiz AB4.
 * Na etapa 1, exige apenas a1/a2 (a3/a4 = null). Na etapa 2, exige os 4 eixos.
 * Retorna null em qualquer invalidez (JSON quebrado, eixo faltando/não-numérico,
 * recomendação vazia) — o chamador trata como "avaliação indisponível".
 */
export function parseAb4Response(raw: string, stage: Ab4Stage = 2): Ab4Result | null {
  let obj: Record<string, unknown>
  try { obj = JSON.parse(raw) as Record<string, unknown> }
  catch { return null }

  const required: Ab4Axis[] = stage === 1 ? ['a1', 'a2'] : ['a1', 'a2', 'a3', 'a4']
  const scores: Record<Ab4Axis, number> = { a1: 0, a2: 0, a3: 0, a4: 0 }
  for (const ax of required) {
    const v = obj[ax]
    if (typeof v !== 'number' || Number.isNaN(v)) return null
    scores[ax] = Math.max(0, Math.min(10, Math.round(v)))
  }

  const recommendation = typeof obj.recommendation === 'string' ? obj.recommendation.trim() : ''
  if (!recommendation) return null

  const present = required.map(ax => scores[ax])
  const overall = Math.round((present.reduce((s, n) => s + n, 0) / present.length) * 10) / 10

  return {
    a1: scores.a1,
    a2: scores.a2,
    a3: stage === 1 ? null : scores.a3,
    a4: stage === 1 ? null : scores.a4,
    overall,
    recommendation,
    stage,
  }
}
