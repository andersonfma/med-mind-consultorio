export type CorrelationItem = { label: string; chain: string[] }
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

// Cada item é um achado/conduta (label) + a CASCATA de passos mecanísticos que leva
// a ele (chain, ordenada). A chain é a correlação — sem ela o item é rejeitado.
function cleanItems(v: unknown): CorrelationItem[] | null {
  if (!Array.isArray(v) || v.length === 0) return null
  const items = v
    .filter((i): i is CorrelationItem => !!i && typeof i.label === 'string' && i.label.trim() !== '' && Array.isArray(i.chain))
    .map((i) => ({
      label: i.label.trim(),
      chain: i.chain.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map((s) => s.trim()),
    }))
    .filter((i) => i.chain.length >= 1)
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
