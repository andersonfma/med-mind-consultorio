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
      {/*
        Símbolo desenhado com FORMAS PREENCHIDAS (não traços): formas cheias da
        mesma cor se fundem sem halo/sombra nas junções — o V do M encosta no
        ábaco e vira um bloco único.
      */}
      <g className="fill-primary-ink" shapeRendering="geometricPrecision">
        {/* capital (barra superior) */}
        <rect x="6.6" y="7.6" width="18.8" height="1.9" rx="0.95" />
        {/* ábaco (liga o topo das colunas) */}
        <rect x="9" y="10.4" width="14" height="1.7" rx="0.85" />
        {/* colunas */}
        <rect x="10.2" y="11.2" width="2" height="12" rx="0.5" />
        <rect x="19.8" y="11.2" width="2" height="12" rx="0.5" />
        {/* V do M — funde no ábaco (topo em y≈11.3) */}
        <path d="M10.2 11.3 L16 19.1 L21.8 11.3 L20 11.3 L16 17.3 L12 11.3 Z" />
        {/* pés/base sob cada coluna */}
        <rect x="9.4" y="22.6" width="3.6" height="2.2" rx="0.5" />
        <rect x="19" y="22.6" width="3.6" height="2.2" rx="0.5" />
      </g>
    </svg>
  )
}
