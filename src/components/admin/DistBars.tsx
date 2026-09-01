// Barras de distribuição (contagem + %) para os indicadores pedagógicos.
export function DistBars({
  items,
}: {
  items: { label: string; count: number; pctv: number; tone: string }[]
}) {
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-xs font-medium text-ink">{it.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className={`h-full rounded-full ${it.tone}`} style={{ width: `${it.pctv}%` }} />
          </div>
          <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted">
            {it.count} · {it.pctv}%
          </span>
        </div>
      ))}
    </div>
  )
}
