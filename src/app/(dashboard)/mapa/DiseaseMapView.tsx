'use client'
import type { DiseaseMap, CorrelationItem } from '@/lib/disease-map/schema'

const GOLD = '#E7B23A'

const BRANCHES = [
  { key: 'clinica' as const, title: 'Clínica', color: '#FF6E86',
    icon: 'M11 2v2M5 2v2M5 4H4a2 2 0 0 0-2 2v3a6 6 0 0 0 12 0V6a2 2 0 0 0-2-2h-1M8 15a6 6 0 0 0 12 0v-2' },
  { key: 'diagnostico' as const, title: 'Diagnóstico', color: '#22E0E6',
    icon: 'M9 3h6M10 3v5l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7 15h10' },
  { key: 'tratamento' as const, title: 'Tratamento', color: '#34E5A0',
    icon: 'M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7l-6 6ZM8.5 8.5l7 7' },
]

function Cascade({ chain, color }: { chain: string[]; color: string }) {
  return (
    <div className="mt-1.5 ml-3.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {chain.map((step, i) => {
        const last = i === chain.length - 1
        return (
          <span key={i} className="flex items-center gap-x-1.5">
            <span
              className="rounded-md border px-1.5 py-0.5 text-[11px] leading-tight"
              style={last
                ? { borderColor: color, color, background: 'transparent' }
                : { borderColor: '#2c3f5e', color: '#cfe0f5', background: 'rgba(14,21,38,.6)' }}
            >
              {step}
            </span>
            {!last && <span className="text-[11px] text-muted" aria-hidden>→</span>}
          </span>
        )
      })}
    </div>
  )
}

function Branch({ title, color, icon, items }: { title: string; color: string; icon: string; items: CorrelationItem[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `${color}22`, color }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={icon} /></svg>
        </span>
        <span className="text-[13px] font-extrabold uppercase tracking-wide" style={{ color }}>{title}</span>
      </div>
      <div className="px-3.5 pb-3.5 pt-1">
        {items.map((it, i) => (
          <div key={i} className={`py-2.5 ${i < items.length - 1 ? 'border-b border-dashed border-border' : ''}`}>
            <div className="flex items-center gap-2 text-[13.5px] font-bold leading-tight text-ink">
              <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: color }} />
              {it.label}
            </div>
            <Cascade chain={it.chain} color={color} />
          </div>
        ))}
      </div>
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink">{map.disease}</h2>
          {map.area && <span className="text-xs font-medium text-muted">{map.area}</span>}
        </div>
        <button onClick={share} className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-ink hover:border-primary">Compartilhar</button>
      </div>

      {/* Núcleo fisiopatológico */}
      <div className="mx-auto max-w-2xl rounded-2xl border p-4 text-center" style={{ borderColor: `${GOLD}55`, background: 'linear-gradient(180deg,rgba(231,178,58,.13),rgba(231,178,58,.04))' }}>
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: GOLD }}>Fisiopatogênese · a origem</h3>
        <ul className="mt-2 space-y-1.5">
          {map.core.map((c, i) => (
            <li key={i} className="text-sm leading-snug text-ink"><b>{c.mechanism}</b>{c.detail ? <span className="text-muted"> — {c.detail}</span> : null}</li>
          ))}
        </ul>
      </div>

      {/* conectores núcleo → 3 ramos (só no desktop) */}
      <svg className="hidden h-10 w-full sm:block" viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden>
        <path d="M60 0 C60 22, 20 18, 20 40" fill="none" stroke="var(--border, #223049)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        <path d="M60 0 L60 40" fill="none" stroke="var(--border, #223049)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        <path d="M60 0 C60 22, 100 18, 100 40" fill="none" stroke="var(--border, #223049)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="grid gap-3 sm:grid-cols-3">
        {BRANCHES.map((b) => (
          <Branch key={b.key} title={b.title} color={b.color} icon={b.icon} items={map[b.key]} />
        ))}
      </div>

      {/* Texto mecanístico (secundário) */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Entenda em um parágrafo</h4>
        <p className="mt-1.5 text-sm leading-relaxed text-ink">{map.summary}</p>
      </div>

      <p className="text-center text-[11px] text-muted">Material de estudo — não é conduta clínica.</p>
    </div>
  )
}
