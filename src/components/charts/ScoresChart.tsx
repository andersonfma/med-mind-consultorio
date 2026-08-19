import type { ScorePoint } from '@/lib/performance/dashboard-charts'

// Evolução dos scores (AB4 e Comunicação) por consulta finalizada. Dados reais.
export function ScoresChart({ data }: { data: ScorePoint[] }) {
  const ab4 = data.map((d, i) => ({ i, v: d.ab4 })).filter((p) => p.v !== null) as { i: number; v: number }[]
  const comm = data.map((d, i) => ({ i, v: d.comm })).filter((p) => p.v !== null) as { i: number; v: number }[]
  const hasAny = ab4.length > 0 || comm.length > 0

  const W = 260, H = 110, padX = 10, top = 12, bottom = H - 22
  const n = Math.max(1, data.length - 1)
  const x = (i: number) => padX + (i / n) * (W - padX * 2)
  const y = (v: number) => bottom - (v / 10) * (bottom - top)

  const toPoints = (pts: { i: number; v: number }[]) => pts.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')

  return (
    <div className="border border-border rounded-lg p-4 bg-surface">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-ink">Evolução dos scores</h3>
        <div className="flex items-center gap-3 text-[10px] text-muted">
          <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-chart-3" />Raciocínio</span>
          <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-chart-2" />Comunicação</span>
        </div>
      </div>
      {!hasAny ? (
        <p className="text-xs text-muted py-4">Finalize consultas com avaliação para ver a evolução dos scores.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" role="img" aria-label="Evolução dos scores por consulta">
          {[0, 5, 10].map((g) => (
            <g key={g}>
              <line x1={padX} y1={y(g)} x2={W - padX} y2={y(g)} className="stroke-border" strokeWidth="1" opacity={g === 0 ? 1 : 0.5} />
              <text x={padX - 2} y={y(g) + 3} textAnchor="end" className="fill-muted" style={{ fontSize: 8 }}>{g}</text>
            </g>
          ))}
          {comm.length > 1 && <polyline points={toPoints(comm)} className="fill-none stroke-chart-2" strokeWidth="2" strokeLinejoin="round" />}
          {ab4.length > 1 && <polyline points={toPoints(ab4)} className="fill-none stroke-chart-3" strokeWidth="2" strokeLinejoin="round" />}
          {comm.map((p, k) => <circle key={`c${k}`} cx={x(p.i)} cy={y(p.v)} r="2.4" className="fill-chart-2" />)}
          {ab4.map((p, k) => <circle key={`a${k}`} cx={x(p.i)} cy={y(p.v)} r="2.4" className="fill-chart-3" />)}
        </svg>
      )}
    </div>
  )
}
