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
