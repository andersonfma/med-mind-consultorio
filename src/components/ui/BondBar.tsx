const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-danger',
  2: 'bg-warning',
  3: 'bg-warning',
  4: 'bg-success',
  5: 'bg-success',
}

export function BondBar({ level }: { level: number }) {
  return (
    <div className="flex gap-1" aria-label={`Vínculo nível ${level} de 5`}>
      {[1, 2, 3, 4, 5].map((bar) => (
        <div
          key={bar}
          className={`h-3 w-6 rounded-sm ${bar <= level ? LEVEL_COLORS[level] : 'bg-surface-2'}`}
        />
      ))}
    </div>
  )
}
