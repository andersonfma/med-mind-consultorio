export type Ab4Axis = 'a1' | 'a2' | 'a3' | 'a4'

export interface Ab4Result {
  a1: number
  a2: number
  a3: number
  a4: number
  overall: number
  recommendation: string
}

const AXES: Ab4Axis[] = ['a1', 'a2', 'a3', 'a4']

/**
 * Valida e normaliza a saída crua do juiz AB4.
 * Retorna null em qualquer invalidez (JSON quebrado, eixo faltando/não-numérico,
 * recomendação vazia) — o chamador trata como "avaliação indisponível".
 */
export function parseAb4Response(raw: string): Ab4Result | null {
  let obj: Record<string, unknown>
  try { obj = JSON.parse(raw) as Record<string, unknown> }
  catch { return null }

  const scores: Record<Ab4Axis, number> = { a1: 0, a2: 0, a3: 0, a4: 0 }
  for (const ax of AXES) {
    const v = obj[ax]
    if (typeof v !== 'number' || Number.isNaN(v)) return null
    scores[ax] = Math.max(0, Math.min(10, Math.round(v)))
  }

  const recommendation = typeof obj.recommendation === 'string' ? obj.recommendation.trim() : ''
  if (!recommendation) return null

  const overall = Math.round(((scores.a1 + scores.a2 + scores.a3 + scores.a4) / 4) * 10) / 10

  return { a1: scores.a1, a2: scores.a2, a3: scores.a3, a4: scores.a4, overall, recommendation }
}
