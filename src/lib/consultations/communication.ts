export interface CommunicationResult {
  c1: number
  c2: number
  c3: number
  overall: number
  recommendation: string
}

/** Recomendação fixa quando o aluno mal conversou (sem fala do médico no chat). */
export const EMPTY_COMMUNICATION_RECOMMENDATION =
  'Você quase não conversou com o paciente nesta consulta, então não há diálogo suficiente para avaliar sua comunicação. Da próxima vez, conduza a entrevista: cumprimente, pergunte de forma clara e em linguagem acessível, e demonstre escuta.'

const clamp = (v: number) => Math.max(0, Math.min(10, Math.round(v)))
const round1 = (v: number) => Math.round(v * 10) / 10

export function emptyCommunicationResult(): CommunicationResult {
  return { c1: 0, c2: 0, c3: 0, overall: 0, recommendation: EMPTY_COMMUNICATION_RECOMMENDATION }
}

/**
 * Valida e normaliza a saída crua do juiz de comunicação. Exige c1/c2/c3 numéricos
 * e recommendation não vazia; caso contrário retorna null ("avaliação indisponível").
 */
export function parseCommunicationResponse(raw: string): CommunicationResult | null {
  let obj: Record<string, unknown>
  try { obj = JSON.parse(raw) as Record<string, unknown> }
  catch { return null }

  const num = (k: string): number | null => {
    const v = obj[k]
    return typeof v === 'number' && !Number.isNaN(v) ? clamp(v) : null
  }
  const c1 = num('c1'), c2 = num('c2'), c3 = num('c3')
  const recommendation = typeof obj.recommendation === 'string' ? obj.recommendation.trim() : ''
  if (c1 === null || c2 === null || c3 === null || !recommendation) return null

  return { c1, c2, c3, overall: round1((c1 + c2 + c3) / 3), recommendation }
}
