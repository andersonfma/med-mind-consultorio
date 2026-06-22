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

/** Notas de A1/A2 herdadas da PRIMEIRA consulta (poética/retórica avaliadas lá). */
export interface CarriedA1A2 { a1: number; a2: number }

const clamp = (v: number) => Math.max(0, Math.min(10, Math.round(v)))
const round1 = (v: number) => Math.round(v * 10) / 10

/**
 * Score zerado para quando não há pensamento clínico registrado.
 * Na etapa 2 com notas herdadas, A1/A2 da 1ª consulta são preservadas (o aluno
 * fez a abertura do raciocínio antes); apenas A3/A4 desta consulta zeram.
 */
export function emptyReasoningResult(stage: Ab4Stage = 2, carried?: CarriedA1A2 | null): Ab4Result {
  if (stage === 2 && carried) {
    const a1 = clamp(carried.a1), a2 = clamp(carried.a2)
    return { a1, a2, a3: 0, a4: 0, overall: round1((a1 + a2) / 4), recommendation: EMPTY_REASONING_RECOMMENDATION, stage: 2 }
  }
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
 * - Etapa 1: exige a1/a2 (a3/a4 = null).
 * - Etapa 2 COM notas herdadas (carried): exige só a3/a4; a1/a2 vêm da 1ª consulta.
 * - Etapa 2 SEM herdadas (fallback): exige os 4 eixos.
 * Retorna null em qualquer invalidez — o chamador trata como "avaliação indisponível".
 */
export function parseAb4Response(raw: string, stage: Ab4Stage = 2, carried?: CarriedA1A2 | null): Ab4Result | null {
  let obj: Record<string, unknown>
  try { obj = JSON.parse(raw) as Record<string, unknown> }
  catch { return null }

  const num = (k: Ab4Axis): number | null => {
    const v = obj[k]
    return typeof v === 'number' && !Number.isNaN(v) ? clamp(v) : null
  }

  const recommendation = typeof obj.recommendation === 'string' ? obj.recommendation.trim() : ''
  if (!recommendation) return null

  if (stage === 1) {
    const a1 = num('a1'), a2 = num('a2')
    if (a1 === null || a2 === null) return null
    return { a1, a2, a3: null, a4: null, overall: round1((a1 + a2) / 2), recommendation, stage: 1 }
  }

  if (carried) {
    const a3 = num('a3'), a4 = num('a4')
    if (a3 === null || a4 === null) return null
    const a1 = clamp(carried.a1), a2 = clamp(carried.a2)
    return { a1, a2, a3, a4, overall: round1((a1 + a2 + a3 + a4) / 4), recommendation, stage: 2 }
  }

  const a1 = num('a1'), a2 = num('a2'), a3 = num('a3'), a4 = num('a4')
  if (a1 === null || a2 === null || a3 === null || a4 === null) return null
  return { a1, a2, a3, a4, overall: round1((a1 + a2 + a3 + a4) / 4), recommendation, stage: 2 }
}
