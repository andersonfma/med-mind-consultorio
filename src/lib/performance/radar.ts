import { EMPTY_REASONING_RECOMMENDATION } from '@/lib/consultations/ab4'
import { EMPTY_COMMUNICATION_RECOMMENDATION } from '@/lib/consultations/communication'

export interface RadarResult {
  pensamentoClinico: number | null
  comunicacao: number | null
  tecnica: number | null
  n: number
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

export function buildRadarInput(rows: RadarRows): RadarInput {
  const ab4Overalls: number[] = []
  const communicationOveralls: number[] = []
  let n = 0
  for (const c of rows.consultations) {
    if (c.status !== 'finished') continue
    n++
    const a = extractOverall(c.ab4_score, EMPTY_REASONING_RECOMMENDATION)
    if (a !== null) ab4Overalls.push(a)
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
  return { ab4Overalls, communicationOveralls, diagnoses, examDecisions, conductAdequacies, n }
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

  return { pensamentoClinico, comunicacao, tecnica, n: input.n }
}

export function radarFromRows(rows: RadarRows): RadarResult {
  return computeRadar(buildRadarInput(rows))
}
