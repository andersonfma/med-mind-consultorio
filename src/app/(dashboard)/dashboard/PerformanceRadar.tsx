'use client'
import Link from 'next/link'
import type { RadarResult } from '@/lib/performance/radar'

const AXES = [
  { key: 'pensamentoClinico', label: 'Pensamento Clínico', angle: -90 },
  { key: 'tecnica', label: 'Técnica', angle: 30 },
  { key: 'comunicacao', label: 'Comunicação', angle: 150 },
] as const

const SIZE = 300, CENTER = SIZE / 2, R = 108

function point(angleDeg: number, radius: number) {
  const a = (angleDeg * Math.PI) / 180
  return { x: CENTER + radius * Math.cos(a), y: CENTER + radius * Math.sin(a) }
}

export function PerformanceRadar({ result }: { result: RadarResult }) {
  const values = AXES.map(ax => result[ax.key])
  const hasAny = values.some(v => v !== null)

  if (!hasAny || result.n === 0) {
    return (
      <div className="border border-border rounded-lg p-4 bg-surface">
        <h3 className="text-sm font-semibold text-ink mb-2">Radar de performance</h3>
        <p className="text-xs text-muted mb-3">Faça consultas para ver seu radar de performance.</p>
        <Link href="/patients/new" className="text-xs text-primary hover:underline">Adicionar paciente</Link>
      </div>
    )
  }

  const polygon = AXES.map((ax, i) => {
    const p = point(ax.angle, ((values[i] ?? 0) / 10) * R)
    return `${p.x},${p.y}`
  }).join(' ')

  return (
    <div className="border border-border rounded-lg p-4 bg-surface">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-ink">Radar de performance</h3>
        <span className="text-xs text-muted">baseado em {result.n} consulta{result.n === 1 ? '' : 's'}</span>
      </div>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-72 sm:h-80" role="img" aria-label="Radar de performance">
        {[2, 4, 6, 8, 10].map(ring => (
          <polygon key={ring}
            points={AXES.map(ax => { const p = point(ax.angle, (ring / 10) * R); return `${p.x},${p.y}` }).join(' ')}
            className="fill-none stroke-border" strokeWidth="1" />
        ))}
        {AXES.map((ax, i) => {
          const edge = point(ax.angle, R)
          const labelP = point(ax.angle, R + 20)
          const isNull = values[i] === null
          return (
            <g key={ax.key}>
              <line x1={CENTER} y1={CENTER} x2={edge.x} y2={edge.y}
                className="stroke-border" strokeWidth="1" strokeDasharray={isNull ? '3 3' : undefined} />
              <text x={labelP.x} y={labelP.y} textAnchor="middle" dominantBaseline="middle"
                className={isNull ? 'fill-muted opacity-50' : 'fill-muted'} style={{ fontSize: 12 }}>
                {isNull ? `${ax.label} (sem dados)` : `${ax.label} ${values[i]}`}
              </text>
            </g>
          )
        })}
        <polygon points={polygon} className="fill-primary/12 stroke-primary" strokeWidth="2" strokeLinejoin="round" />
        {AXES.map((ax, i) => {
          if (values[i] === null) return null
          const p = point(ax.angle, ((values[i] ?? 0) / 10) * R)
          const dot = ax.key === 'pensamentoClinico' ? 'fill-chart-3' : ax.key === 'tecnica' ? 'fill-chart-1' : 'fill-chart-2'
          return <circle key={ax.key} cx={p.x} cy={p.y} r="4.5" className={dot} />
        })}
      </svg>
      {result.reasoningCoverage && (
        result.reasoningCoverage.reasoned >= result.reasoningCoverage.expected ? (
          <p className="mt-2 text-xs text-success">
            ✓ Raciocínio clínico registrado em todas as {result.reasoningCoverage.expected} consulta{result.reasoningCoverage.expected === 1 ? '' : 's'}.
          </p>
        ) : (
          <p className="mt-2 text-xs text-warning">
            Raciocínio clínico registrado em {result.reasoningCoverage.reasoned} de {result.reasoningCoverage.expected} consulta{result.reasoningCoverage.expected === 1 ? '' : 's'} — preencha o raciocínio ao concluir a consulta para fortalecer este eixo.
          </p>
        )
      )}
    </div>
  )
}
