'use client'
import type { DiseaseMap, CorrelationItem } from '@/lib/disease-map/schema'

const GOLD = '#E7B23A'

function Branch({ title, items }: { title: string; items: CorrelationItem[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h4>
      <ul className="mt-2 space-y-2.5">
        {items.map((it, i) => (
          <li key={i}>
            <p className="text-sm font-medium text-ink">{it.label}</p>
            <p className="mt-0.5 text-xs text-muted"><span className="font-semibold" style={{ color: 'var(--cyan, #22D3EE)' }}>porquê:</span> {it.because}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DiseaseMapView({ map }: { map: DiseaseMap }) {
  async function share() {
    const text = `Mapa da Doença — ${map.disease}\n\n${map.summary}\n\nvia Med Mind`
    try {
      if (navigator.share) await navigator.share({ title: `Mapa — ${map.disease}`, text })
      else await navigator.clipboard.writeText(text)
    } catch { /* cancelado */ }
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink">{map.disease}</h2>
          {map.area && <span className="text-xs font-medium text-muted">{map.area}</span>}
        </div>
        <button onClick={share} className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-ink hover:border-primary">Compartilhar</button>
      </div>

      {/* Núcleo fisiopatológico */}
      <div className="rounded-xl border p-4" style={{ borderColor: `${GOLD}44`, background: 'rgba(231,178,58,.05)' }}>
        <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: GOLD }}>Núcleo fisiopatológico</h3>
        <ul className="mt-2 space-y-1.5">
          {map.core.map((c, i) => (
            <li key={i} className="text-sm text-ink"><b>{c.mechanism}</b>{c.detail ? <span className="text-muted"> — {c.detail}</span> : null}</li>
          ))}
        </ul>
      </div>

      {/* Ramos */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Branch title="Clínica" items={map.clinica} />
        <Branch title="Diagnóstico" items={map.diagnostico} />
        <Branch title="Tratamento" items={map.tratamento} />
      </div>

      {/* Texto mecanístico */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Em resumo</h4>
        <p className="mt-1.5 text-sm leading-relaxed text-ink">{map.summary}</p>
      </div>

      <p className="text-center text-[11px] text-muted">Material de estudo — não é conduta clínica.</p>
    </div>
  )
}
