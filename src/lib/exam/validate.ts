import { examStructuralSpec, type ExamType } from './blueprint'

// Tipo da questão gerada (sem dependências de servidor — testável isoladamente).
export type ExamQuestion = {
  prompt: string
  options: { key: string; text: string }[]
  correct_key: string
  explanation: string
  topic: string
}

const wc = (s: string): number => (s.match(/\p{L}+/gu) ?? []).length
const numData = (s: string): number => (s.match(/\d[\d.,]*/g) ?? []).length
const VIGNETTE = /\b(anos|meses|paciente|mulher|homem|lactente|rec[eé]m[- ]nascido|crian[çc]a|gestante|menina|menino|idade)\b/i

/** Valida uma questão contra o blueprint estrutural (reprova questão curta / sem vinheta / sem dados). */
export function passesSpec(q: ExamQuestion, exam: ExamType, gerais: boolean): boolean {
  const spec = examStructuralSpec(exam)
  if (wc(q.prompt) < spec.stemMinWords) return false
  if (numData(q.prompt) < spec.numDataMin) return false
  if (!gerais && !VIGNETTE.test(q.prompt)) return false
  const ow = q.options.map((o) => wc(o.text))
  if (ow.some((w) => w < spec.optMinWords)) return false
  // homogeneidade: a maior alternativa não pode destoar demais (correta "longa demais" denuncia o gabarito)
  const max = Math.max(...ow), min = Math.max(1, Math.min(...ow))
  if (max > min * 3.2) return false
  return true
}
