export type Anamnesis = {
  hda: string
  hpp: string
  ad: string
  social: string
  familiar: string
}

const EMPTY_ANAMNESIS: Anamnesis = { hda: '', hpp: '', ad: '', social: '', familiar: '' }

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export function parseAnamnesisResponse(raw: string): Anamnesis {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      hda:      str(parsed.hda),
      hpp:      str(parsed.hpp),
      ad:       str(parsed.ad),
      social:   str(parsed.social),
      familiar: str(parsed.familiar),
    }
  } catch {
    return { ...EMPTY_ANAMNESIS }
  }
}

export type PhysicalExam = {
  antropometria: string
  inspecao_geral: string
  sinais_vitais: string
  aparelho_respiratorio: string
  aparelho_cardiovascular: string
  abdome: string
  membros_inferiores: string
  sistemas_adicionais: Record<string, string>
}

const EMPTY_PHYSICAL_EXAM: PhysicalExam = {
  antropometria: '',
  inspecao_geral: '',
  sinais_vitais: '',
  aparelho_respiratorio: '',
  aparelho_cardiovascular: '',
  abdome: '',
  membros_inferiores: '',
  sistemas_adicionais: {},
}

export function parsePhysicalExamResponse(raw: string): PhysicalExam {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const sistemas = parsed.sistemas_adicionais
    const sistemasObj: Record<string, string> = {}
    if (sistemas && typeof sistemas === 'object' && !Array.isArray(sistemas)) {
      for (const [k, v] of Object.entries(sistemas)) {
        if (typeof v === 'string') sistemasObj[k] = v
      }
    }
    return {
      antropometria:         str(parsed.antropometria),
      inspecao_geral:        str(parsed.inspecao_geral),
      sinais_vitais:         str(parsed.sinais_vitais),
      aparelho_respiratorio: str(parsed.aparelho_respiratorio),
      aparelho_cardiovascular: str(parsed.aparelho_cardiovascular),
      abdome:                str(parsed.abdome),
      membros_inferiores:    str(parsed.membros_inferiores),
      sistemas_adicionais:   sistemasObj,
    }
  } catch {
    return { ...EMPTY_PHYSICAL_EXAM, sistemas_adicionais: {} }
  }
}

const PHYSICAL_EXAM_LABELS: Record<string, string> = {
  antropometria: 'Antropometria',
  inspecao_geral: 'Inspeção geral',
  sinais_vitais: 'Sinais vitais',
  aparelho_respiratorio: 'Aparelho respiratório',
  aparelho_cardiovascular: 'Aparelho cardiovascular',
  abdome: 'Abdome',
  membros_inferiores: 'Membros inferiores',
}

export function formatPhysicalExamSummary(
  exam: Record<string, unknown> | null | undefined
): string {
  if (!exam || typeof exam !== 'object') return ''
  const lines: string[] = []
  for (const [key, label] of Object.entries(PHYSICAL_EXAM_LABELS)) {
    const v = exam[key]
    if (typeof v === 'string' && v.trim()) lines.push(`${label}: ${v.trim()}`)
  }
  const sistemas = exam.sistemas_adicionais
  if (sistemas && typeof sistemas === 'object' && !Array.isArray(sistemas)) {
    for (const [k, v] of Object.entries(sistemas as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) lines.push(`${k}: ${v.trim()}`)
    }
  }
  return lines.join('\n')
}
