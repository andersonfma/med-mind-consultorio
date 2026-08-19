import type { VolumeBucket } from '@/lib/performance/dashboard-charts'

// Consultas finalizadas por semana (últimas 8). Dados reais, determinístico.
export function VolumeChart({ data, total }: { data: VolumeBucket[]; total: number }) {
  const W = 260, H = 96, pad = 10, baseline = H - 18
  const max = Math.max(1, ...data.map((d) => d.count))
  const n = data.length
  const slot = (W - pad * 2) / n
  const bw = Math.min(22, slot * 0.6)

  return (
    <div className="border border-border rounded-lg p-4 bg-surface">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-ink">Volume de atendimentos</h3>
        <span className="text-xs text-muted">{total} consulta{total === 1 ? '' : 's'}</span>
      </div>
      {total === 0 ? (
        <p className="text-xs text-muted py-4">Finalize consultas para ver o volume por semana.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" role="img" aria-label="Consultas por semana">
          <line x1={pad} y1={baseline} x2={W - pad} y2={baseline} className="stroke-border" strokeWidth="1" />
          {data.map((d, i) => {
            const x = pad + slot * i + (slot - bw) / 2
            const h = (d.count / max) * (baseline - 14)
            const y = baseline - h
            return (
              <g key={i}>
                {d.count > 0 && (
                  <rect x={x} y={y} width={bw} height={h} rx="2" className="fill-primary" opacity="0.85" />
                )}
                {d.count > 0 && (
                  <text x={x + bw / 2} y={y - 3} textAnchor="middle" className="fill-muted" style={{ fontSize: 9 }}>
                    {d.count}
                  </text>
                )}
                {(i % 2 === 0 || i === n - 1) && (
                  <text x={x + bw / 2} y={H - 5} textAnchor="middle" className="fill-muted" style={{ fontSize: 8 }}>
                    {d.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
