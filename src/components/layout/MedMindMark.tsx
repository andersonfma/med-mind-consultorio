// Símbolo da marca Med Mind — coluna/pilar romano que forma um "M", com os
// quadradinhos de dados na base (Manual da Marca v1.0). Versão app-icon:
// quadrado azul profundo arredondado com o símbolo em branco.
// Cores travadas na marca (Deep Navy #0D1E3D), independentes do tema.

export function MedMindMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="Med Mind"
      fill="none"
    >
      <rect width="32" height="32" rx="8" fill="#0D1E3D" />
      <g stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {/* capital da coluna */}
        <line x1="8.5" y1="9" x2="23.5" y2="9" />
        <line x1="10" y1="11.4" x2="22" y2="11.4" />
        {/* fustes externos */}
        <line x1="11.3" y1="12.4" x2="11.3" y2="22.2" />
        <line x1="20.7" y1="12.4" x2="20.7" y2="22.2" />
        {/* M interno (V) */}
        <path d="M12.6 12.4 L16 18.2 L19.4 12.4" />
      </g>
      {/* base com quadrados de dados */}
      <rect x="10.4" y="22.4" width="1.8" height="1.8" rx="0.3" fill="#94A3B8" />
      <rect x="19.8" y="22.4" width="1.8" height="1.8" rx="0.3" fill="#94A3B8" />
    </svg>
  )
}
