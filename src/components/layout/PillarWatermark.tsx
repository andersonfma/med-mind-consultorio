// Marca d'água decorativa — pilares romanos estilizados (line-art), ecoando o
// símbolo da coluna do logo Med Mind. Fica no fundo, MUITO discreto
// (baixa opacidade, ciano da paleta), sem interferir na leitura.
// Não-interativo e invisível para leitores de tela.

// Uma coluna estilizada: capitel, fuste com caneluras e base.
function Column({ x, top, base, w }: { x: number; top: number; base: number; w: number }) {
  const half = w / 2
  const cap = half + 6      // capitel/base um pouco mais largos que o fuste
  const flute = w / 4
  return (
    <g>
      {/* capitel */}
      <line x1={x - cap} y1={top} x2={x + cap} y2={top} />
      <line x1={x - half} y1={top + 8} x2={x + half} y2={top + 8} />
      {/* fuste + caneluras */}
      <line x1={x - half} y1={top + 8} x2={x - half} y2={base - 8} />
      <line x1={x + half} y1={top + 8} x2={x + half} y2={base - 8} />
      <line x1={x - flute} y1={top + 14} x2={x - flute} y2={base - 14} />
      <line x1={x} y1={top + 14} x2={x} y2={base - 14} />
      <line x1={x + flute} y1={top + 14} x2={x + flute} y2={base - 14} />
      {/* base */}
      <line x1={x - half} y1={base - 8} x2={x + half} y2={base - 8} />
      <line x1={x - cap} y1={base} x2={x + cap} y2={base} />
    </g>
  )
}

export function PillarWatermark({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-[0.05] ${className}`}
    >
      <svg
        viewBox="0 0 1200 600"
        preserveAspectRatio="xMidYMax slice"
        className="h-full w-full stroke-primary"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <Column x={150} top={90} base={560} w={70} />
        <Column x={380} top={150} base={560} w={54} />
        <Column x={640} top={60} base={560} w={82} />
        <Column x={900} top={140} base={560} w={58} />
        <Column x={1090} top={110} base={560} w={66} />
      </svg>
    </div>
  )
}
