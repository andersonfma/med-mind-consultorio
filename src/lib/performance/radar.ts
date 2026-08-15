import { EMPTY_REASONING_RECOMMENDATION } from '@/lib/consultations/ab4'
import { EMPTY_COMMUNICATION_RECOMMENDATION } from '@/lib/consultations/communication'

export interface RadarResult {
  pensamentoClinico: number | null
  comunicacao: number | null
  tecnica: number | null
  n: number
  // Cobertura do raciocínio clínico: quantas consultas em que o raciocínio ERA
  // esperado (exclui seguimentos) o aluno de fato preencheu. `null` quando nenhuma
  // consulta esperava raciocínio. Estimula o preenchimento SEM sujar a média do eixo
  // com zeros — deixar em branco custa cobertura, não qualidade.
  reasoningCoverage: { reasoned: number; expected: number } | null
}

// Linhas cruas (só os campos usados) — espelham o schema.
export interface RawConsultationRow { ab4_score: unknown; communication_score: unknown; status: string }
export interface RawPatientRow { diagnosis_status: string }
export interface RawExamRow { status: string }
export interface RawPrescriptionRow { adequacy: string | null }

export interface RadarRows {
  consultations: RawConsultationRow[]
  patients: RawPatientRow[]
  exams: RawExamRow[]
  prescriptions: RawPrescriptionRow[]
}

export interface RadarInput {
  ab4Overalls: number[]
  communicationOveralls: number[]
  diagnoses: Array<'achieved' | 'revealed'>
  examDecisions: Array<'approved' | 'rejected'>
  conductAdequacies: Array<'adequada' | 'parcial' | 'inadequada'>
  // Nº de consultas finished em que o raciocínio era esperado (raciocinado + em branco).
  // Seguimentos (ab4_score null) NÃO entram. Denominador da cobertura.
  reasoningExpected: number
  n: number
}

const clamp = (v: number) => Math.max(0, Math.min(10, v))
const round1 = (v: number) => Math.round(v * 10) / 10
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

// Extrai `overall` de um score JSONB, tratando o resultado "vazio" (detectado pela
// sentinela de recomendação) como NÃO MEDIDO (null) — nunca como 0.
function extractOverall(score: unknown, emptyRecommendation: string): number | null {
  if (!score || typeof score !== 'object') return null
  const obj = score as Record<string, unknown>
  if (obj.recommendation === emptyRecommendation) return null
  const overall = obj.overall
  return typeof overall === 'number' && !Number.isNaN(overall) ? clamp(overall) : null
}

// Classifica o AB4 de uma consulta para a cobertura do raciocínio:
// - 'reasoned': raciocinou (score válido) → conta na média e na cobertura;
// - 'skipped': raciocínio esperado mas em branco (sentinela) → conta só na cobertura;
// - 'not-expected': seguimento / sem AB4 (score null) → não conta em nada.
type Ab4Classification = { kind: 'reasoned'; value: number } | { kind: 'skipped' } | { kind: 'not-expected' }
function classifyAb4(score: unknown): Ab4Classification {
  if (!score || typeof score !== 'object') return { kind: 'not-expected' }
  const obj = score as Record<string, unknown>
  if (obj.recommendation === EMPTY_REASONING_RECOMMENDATION) return { kind: 'skipped' }
  const overall = obj.overall
  if (typeof overall === 'number' && !Number.isNaN(overall)) return { kind: 'reasoned', value: clamp(overall) }
  return { kind: 'not-expected' }
}

export function buildRadarInput(rows: RadarRows): RadarInput {
  const ab4Overalls: number[] = []
  const communicationOveralls: number[] = []
  let reasoningExpected = 0
  let n = 0
  for (const c of rows.consultations) {
    if (c.status !== 'finished') continue
    n++
    const ab4 = classifyAb4(c.ab4_score)
    if (ab4.kind === 'reasoned') { ab4Overalls.push(ab4.value); reasoningExpected++ }
    else if (ab4.kind === 'skipped') { reasoningExpected++ }
    const k = extractOverall(c.communication_score, EMPTY_COMMUNICATION_RECOMMENDATION)
    if (k !== null) communicationOveralls.push(k)
  }
  const diagnoses = rows.patients
    .map(p => p.diagnosis_status)
    .filter((s): s is 'achieved' | 'revealed' => s === 'achieved' || s === 'revealed')
  const examDecisions = rows.exams
    .map(e => e.status)
    .filter((s): s is 'approved' | 'rejected' => s === 'approved' || s === 'rejected')
  const conductAdequacies = rows.prescriptions
    .map(p => p.adequacy)
    .filter((s): s is 'adequada' | 'parcial' | 'inadequada' =>
      s === 'adequada' || s === 'parcial' || s === 'inadequada')
  return { ab4Overalls, communicationOveralls, diagnoses, examDecisions, conductAdequacies, reasoningExpected, n }
}

const ADEQUACY_SCORE: Record<'adequada' | 'parcial' | 'inadequada', number> = {
  adequada: 10, parcial: 5, inadequada: 0,
}

export function computeRadar(input: RadarInput): RadarResult {
  const pensamentoClinico = input.ab4Overalls.length ? round1(mean(input.ab4Overalls)) : null
  const comunicacao = input.communicationOveralls.length ? round1(mean(input.communicationOveralls)) : null

  const tecnicaParts: number[] = []
  if (input.diagnoses.length)
    tecnicaParts.push(10 * input.diagnoses.filter(d => d === 'achieved').length / input.diagnoses.length)
  if (input.examDecisions.length)
    tecnicaParts.push(10 * input.examDecisions.filter(e => e === 'approved').length / input.examDecisions.length)
  if (input.conductAdequacies.length)
    tecnicaParts.push(mean(input.conductAdequacies.map(a => ADEQUACY_SCORE[a])))
  const tecnica = tecnicaParts.length ? round1(mean(tecnicaParts)) : null

  const reasoningCoverage = input.reasoningExpected > 0
    ? { reasoned: input.ab4Overalls.length, expected: input.reasoningExpected }
    : null

  return { pensamentoClinico, comunicacao, tecnica, n: input.n, reasoningCoverage }
}

export function radarFromRows(rows: RadarRows): RadarResult {
  return computeRadar(buildRadarInput(rows))
}
