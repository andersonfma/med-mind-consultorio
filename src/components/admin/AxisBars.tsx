// Barras de critério (0–10) para os diagnósticos do painel admin.
export function AxisBars({
  axes,
  fill = 'bg-success',
}: {
  axes: { label: string; value: number | null }[]
  fill?: string
}) {
  // menor valor (não-nulo) para destacar o ponto fraco
  const vals = axes.map((a) => a.value).filter((v): v is number => typeof v === 'number')
  const min = vals.length ? Math.min(...vals) : null

  return (
    <div className="space-y-2.5">
      {axes.map((a) => {
        const weak = a.value != null && a.value === min && vals.length > 1
        return (
          <div key={a.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs font-medium text-ink">{a.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
              {a.value != null && (
                <div
                  className={`h-full rounded-full ${weak ? 'bg-warning' : fill}`}
                  style={{ width: `${a.value * 10}%` }}
                />
              )}
            </div>
            <span
              className={`w-9 text-right text-sm font-semibold tabular-nums ${weak ? 'text-warning' : 'text-ink'}`}
            >
              {a.value != null ? a.value.toFixed(1) : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
