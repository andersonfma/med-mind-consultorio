const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-yellow-400',
  4: 'bg-green-400',
  5: 'bg-green-700',
}

export function BondBar({ level }: { level: number }) {
  return (
    <div className="flex gap-1" aria-label={`Vínculo nível ${level} de 5`}>
      {[1, 2, 3, 4, 5].map((bar) => (
        <div
          key={bar}
          className={`h-3 w-6 rounded-sm ${bar <= level ? LEVEL_COLORS[level] : 'bg-gray-200'}`}
        />
      ))}
    </div>
  )
}
