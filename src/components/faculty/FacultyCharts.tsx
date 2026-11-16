// Gráficos do painel de faculdade. SVG puro, theme-aware (usa currentColor e
// tokens de cor via classes utilitárias para os tons das faixas).

const TONE_VAR: Record<string, string> = {
  danger: 'var(--color-danger)',
  warning: 'var(--color-warning)',
  'chart-2': 'var(--color-chart-2)',
  success: 'var(--color-success)',
  primary: 'var(--color-primary)',
}

/** Medidor 0–100 com zonas de faixa coloridas e marcador do benchmark nacional. */
export function IndexGauge({ value, bands, benchmark }: {
  value: number | null
  bands: Array<{ min: number; tone: string; label: string }>
  benchmark?: number | null // 0–100: posição da média nacional-proxy
}) {
  const W = 320, H = 54, pad = 8, trackW = W - pad * 2, y = 30
  const x = (v: number) => pad + (Math.max(0, Math.min(100, v)) / 100) * trackW
  // Segmentos entre os mins das faixas.
  const segs = bands.map((b, i) => ({ from: b.min, to: bands[i + 1]?.min ?? 100, tone: b.tone }))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Índice de formação ${value ?? 'sem dados'} de 100`} className="w-full">
      {segs.map((s, i) => (
        <rect key={i} x={x(s.from)} y={y} width={x(s.to) - x(s.from)} height={10}
          fill={TONE_VAR[s.tone] ?? 'currentColor'} opacity={0.35} rx={0} />
      ))}
      {/* escala */}
      {[0, 40, 60, 80, 100].map((t) => (
        <text key={t} x={x(t)} y={52} fontSize={8} textAnchor="middle" fill="currentColor" opacity={0.5}>{t}</text>
      ))}
      {/* benchmark nacional */}
      {benchmark != null && (
        <g>
          <line x1={x(benchmark)} x2={x(benchmark)} y1={y - 5} y2={y + 15} stroke="currentColor" strokeWidth={1} strokeDasharray="2 2" opacity={0.7} />
          <text x={x(benchmark)} y={y - 8} fontSize={7.5} textAnchor="middle" fill="currentColor" opacity={0.7}>Brasil</text>
        </g>
      )}
      {/* valor da turma */}
      {value != null && (
        <g>
          <circle cx={x(value)} cy={y + 5} r={6} fill="var(--color-primary)" />
          <text x={x(value)} y={y + 9} fontSize={7} textAnchor="middle" fill="var(--color-primary-ink)" fontWeight={700}>{value}</text>
        </g>
      )}
    </svg>
  )
}

/** Linha de evolução mensal (0–10 para AB4). */
export function TrendLine({ points }: { points: Array<{ periodKey: string; avg: number }> }) {
  if (points.length === 0) return <p className="text-xs text-muted">Sem histórico suficiente ainda.</p>
  const W = 320, H = 90, pad = 22
  const xs = (i: number) => pad + (points.length === 1 ? 0.5 : i / (points.length - 1)) * (W - pad * 2)
  const maxV = 10
  const ys = (v: number) => H - pad - (v / maxV) * (H - pad * 2)
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xs(i).toFixed(1)} ${ys(p.avg).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evolução mensal do raciocínio clínico" className="w-full">
      {[0, 5, 10].map((g) => (
        <g key={g}>
          <line x1={pad} x2={W - pad} y1={ys(g)} y2={ys(g)} stroke="currentColor" opacity={0.12} />
          <text x={2} y={ys(g) + 3} fontSize={8} fill="currentColor" opacity={0.5}>{g}</text>
        </g>
      ))}
      <path d={d} fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={p.periodKey}>
          <circle cx={xs(i)} cy={ys(p.avg)} r={3} fill="var(--color-primary)" />
          <text x={xs(i)} y={H - 6} fontSize={7.5} textAnchor="middle" fill="currentColor" opacity={0.6}>{p.periodKey.slice(2)}</text>
        </g>
      ))}
    </svg>
  )
}

/** Barras por dia da semana (janela de estudo). */
export function WeekdayBars({ byWeekday }: { byWeekday: number[] }) {
  const labels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
  const max = Math.max(1, ...byWeekday)
  return (
    <div className="flex items-end gap-1.5" style={{ height: 64 }}>
      {byWeekday.map((n, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end">
            <div className="w-full rounded-t bg-chart-2" style={{ height: `${Math.round((n / max) * 100)}%`, minHeight: n > 0 ? 3 : 0 }} />
          </div>
          <span className="text-[10px] text-muted">{labels[i]}</span>
        </div>
      ))}
    </div>
  )
}
