// Vínculo com o paciente (1–5). Rampa própria, vívida e legível nos dois temas
// (barras são só blocos de cor, sem texto): rosa → coral → âmbar → menta → ciano.
// Evita o "marrom" que saía do token warning no modo claro.
const LEVEL_COLORS: Record<number, string> = {
  1: '#FF5470',
  2: '#FF8A5C',
  3: '#FFC24D',
  4: '#34E5A0',
  5: '#22E0E6',
}

export function BondBar({ level }: { level: number }) {
  const color = LEVEL_COLORS[level] ?? '#FF5470'
  return (
    <div className="flex gap-1.5" aria-label={`Vínculo nível ${level} de 5`}>
      {[1, 2, 3, 4, 5].map((bar) => {
        const filled = bar <= level
        return (
          <div
            key={bar}
            className={`h-2.5 w-7 rounded-full ${filled ? '' : 'bg-surface-2'}`}
            style={filled ? { backgroundColor: color, boxShadow: `0 0 10px -3px ${color}` } : undefined}
          />
        )
      })}
    </div>
  )
}
