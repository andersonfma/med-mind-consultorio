'use client'
import Link from 'next/link'
import type { RadarResult } from '@/lib/performance/radar'

const AXES = [
  { key: 'pensamentoClinico', label: 'Pensamento Clínico', angle: -90 },
  { key: 'tecnica', label: 'Técnica', angle: 30 },
  { key: 'comunicacao', label: 'Comunicação', angle: 150 },
] as const

const SIZE = 220, CENTER = SIZE / 2, R = 78

function point(angleDeg: number, radius: number) {
  const a = (angleDeg * Math.PI) / 180
  return { x: CENTER + radius * Math.cos(a), y: CENTER + radius * Math.sin(a) }
}

export function PerformanceRadar({ result }: { result: RadarResult }) {
  const values = AXES.map(ax => result[ax.key])
  const hasAny = values.some(v => v !== null)

  if (!hasAny || result.n === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Radar de performance</h3>
        <p className="text-xs text-gray-400 mb-3">Faça consultas para ver seu radar de performance.</p>
        <Link href="/patients/new" className="text-xs text-blue-600 hover:underline">Adicionar paciente</Link>
      </div>
    )
  }

  const polygon = AXES.map((ax, i) => {
    const p = point(ax.angle, ((values[i] ?? 0) / 10) * R)
    return `${p.x},${p.y}`
  }).join(' ')

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Radar de performance</h3>
        <span className="text-xs text-gray-400">baseado em {result.n} consulta{result.n === 1 ? '' : 's'}</span>
      </div>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-56" role="img" aria-label="Radar de performance">
        {[2, 4, 6, 8, 10].map(ring => (
          <polygon key={ring}
            points={AXES.map(ax => { const p = point(ax.angle, (ring / 10) * R); return `${p.x},${p.y}` }).join(' ')}
            fill="none" stroke="#e5e7eb" strokeWidth="1" />
        ))}
        {AXES.map((ax, i) => {
          const edge = point(ax.angle, R)
          const labelP = point(ax.angle, R + 20)
          const isNull = values[i] === null
          return (
            <g key={ax.key}>
              <line x1={CENTER} y1={CENTER} x2={edge.x} y2={edge.y}
                stroke="#e5e7eb" strokeWidth="1" strokeDasharray={isNull ? '3 3' : undefined} />
              <text x={labelP.x} y={labelP.y} textAnchor="middle" dominantBaseline="middle"
                fill={isNull ? '#d1d5db' : '#4b5563'} style={{ fontSize: 9 }}>
                {isNull ? `${ax.label} (sem dados)` : `${ax.label} ${values[i]}`}
              </text>
            </g>
          )
        })}
        <polygon points={polygon} fill="rgba(37,99,235,0.15)" stroke="#2563eb" strokeWidth="2" />
      </svg>
      {result.reasoningCoverage && (
        result.reasoningCoverage.reasoned >= result.reasoningCoverage.expected ? (
          <p className="mt-2 text-xs text-emerald-600">
            ✓ Raciocínio clínico registrado em todas as {result.reasoningCoverage.expected} consulta{result.reasoningCoverage.expected === 1 ? '' : 's'}.
          </p>
        ) : (
          <p className="mt-2 text-xs text-amber-600">
            Raciocínio clínico registrado em {result.reasoningCoverage.reasoned} de {result.reasoningCoverage.expected} consulta{result.reasoningCoverage.expected === 1 ? '' : 's'} — preencha o raciocínio ao concluir a consulta para fortalecer este eixo.
          </p>
        )
      )}
    </div>
  )
}
