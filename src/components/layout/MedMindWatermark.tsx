// Marca d'água — a MESMA logo (app-icon: quadrado + símbolo) aplicada grande e
// transparente no fundo da página, com degradê vertical. A cor segue o token
// --color-primary (ciano no Noturno, teal no Diurno). Decorativa: aria-hidden +
// pointer-events-none.

export function MedMindWatermark({
  className = '',
  opacity = 0.1,
}: {
  className?: string
  opacity?: number
}) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        style={{ opacity }}
        className="absolute left-1/2 top-[42%] h-auto w-[clamp(180px,22vw,340px)] -translate-x-1/2 -translate-y-1/2"
      >
        <defs>
          <linearGradient id="mm-watermark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--color-primary)" stopOpacity="1" />
            <stop offset="0.62" stopColor="var(--color-primary)" stopOpacity="0.6" />
            <stop offset="1" stopColor="var(--color-primary)" stopOpacity="0.12" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="url(#mm-watermark)" />
        <g
          stroke="var(--color-primary-ink)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.85"
        >
          <line x1="7.5" y1="8.5" x2="24.5" y2="8.5" />
          <line x1="9.3" y1="11.2" x2="22.7" y2="11.2" />
          <line x1="10.8" y1="12.4" x2="10.8" y2="22.6" />
          <line x1="21.2" y1="12.4" x2="21.2" y2="22.6" />
          <path d="M12.2 12.4 L16 18.8 L19.8 12.4" />
        </g>
        <rect x="9.6" y="22.6" width="2.4" height="2.4" rx="0.4" fill="var(--color-primary-ink)" opacity="0.85" />
        <rect x="20" y="22.6" width="2.4" height="2.4" rx="0.4" fill="var(--color-primary-ink)" opacity="0.85" />
      </svg>
    </div>
  )
}
