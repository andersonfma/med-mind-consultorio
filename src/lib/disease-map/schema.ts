export type CorrelationItem = { label: string; because: string }
export type CoreMechanism = { mechanism: string; detail: string }
export type DiseaseMap = {
  disease: string
  area: string
  core: CoreMechanism[]
  clinica: CorrelationItem[]
  diagnostico: CorrelationItem[]
  tratamento: CorrelationItem[]
  summary: string
}

function cleanItems(v: unknown): CorrelationItem[] | null {
  if (!Array.isArray(v) || v.length === 0) return null
  const items = v
    .filter((i): i is CorrelationItem =>
      !!i && typeof i.label === 'string' && i.label.trim() !== ''
      && typeof i.because === 'string' && i.because.trim() !== '')
    .map((i) => ({ label: i.label.trim(), because: i.because.trim() }))
  return items.length ? items : null
}

export function parseDiseaseMap(raw: string): DiseaseMap | { outOfScope: true } | null {
  let o: Record<string, unknown>
  try { o = JSON.parse(raw) } catch { return null }
  if (o && (o as { error?: string }).error === 'out_of_scope') return { outOfScope: true }

  const core = Array.isArray(o.core)
    ? (o.core as CoreMechanism[])
        .filter((c) => c && typeof c.mechanism === 'string' && c.mechanism.trim() !== '')
        .map((c) => ({ mechanism: c.mechanism.trim(), detail: typeof c.detail === 'string' ? c.detail.trim() : '' }))
        .slice(0, 3)
    : []
  const clinica = cleanItems(o.clinica)
  const diagnostico = cleanItems(o.diagnostico)
  const tratamento = cleanItems(o.tratamento)
  const disease = typeof o.disease === 'string' ? o.disease.trim() : ''
  const summary = typeof o.summary === 'string' ? o.summary.trim() : ''
  const area = typeof o.area === 'string' ? o.area.trim() : ''

  if (!disease || !summary || core.length === 0 || !clinica || !diagnostico || !tratamento) return null
  return { disease, area, core, clinica, diagnostico, tratamento, summary }
}
