// Símbolo da marca Med Mind — coluna/pilar romano que forma um "M", com os
// quadradinhos de dados na base (Manual da Marca). A FORMA vem do manual;
// as CORES seguem a nossa paleta "Ink × Elétrico" (app-icon ciano com o
// símbolo em grafite), via utilitários Tailwind ligados aos tokens do @theme.

export function MedMindMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="Med Mind"
      fill="none"
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <g
        className="stroke-primary-ink"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        shapeRendering="geometricPrecision"
      >
        {/* capital da coluna */}
        <line x1="7.5" y1="8.4" x2="24.5" y2="8.4" />
        <line x1="9" y1="11.1" x2="23" y2="11.1" />
        {/* fustes externos (do ábaco à base) */}
        <line x1="11" y1="11.1" x2="11" y2="22.6" />
        <line x1="21" y1="11.1" x2="21" y2="22.6" />
        {/* M: o V liga o topo das duas colunas a um vale central */}
        <path d="M11 11.1 L16 18 L21 11.1" />
      </g>
      {/* base — pés/quadrados de dados sob cada coluna */}
      <rect x="9.8" y="22.6" width="2.4" height="2.4" rx="0.4" className="fill-primary-ink" />
      <rect x="19.8" y="22.6" width="2.4" height="2.4" rx="0.4" className="fill-primary-ink" />
    </svg>
  )
}
