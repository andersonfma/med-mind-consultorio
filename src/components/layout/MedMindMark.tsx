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
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        shapeRendering="geometricPrecision"
      >
        {/* capital da coluna */}
        <line x1="7.5" y1="8.5" x2="24.5" y2="8.5" />
        <line x1="9.3" y1="11.2" x2="22.7" y2="11.2" />
        {/* fustes externos — conectam limpo no ábaco (11.2), sem cap sobreposto */}
        <line x1="10.8" y1="11.2" x2="10.8" y2="22.6" />
        <line x1="21.2" y1="11.2" x2="21.2" y2="22.6" />
        {/* M interno (V) — pontas abaixo do ábaco, sem tocar as outras linhas */}
        <path d="M12.4 12.9 L16 18.6 L19.6 12.9" />
      </g>
      {/* base com quadrados de dados */}
      <rect x="9.6" y="22.6" width="2.4" height="2.4" rx="0.4" className="fill-primary-ink" />
      <rect x="20" y="22.6" width="2.4" height="2.4" rx="0.4" className="fill-primary-ink" />
    </svg>
  )
}
