'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="p-8 text-center">
      <p className="text-danger mb-4">Erro ao carregar dados. Tente novamente.</p>
      <button onClick={reset} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-ink shadow-[var(--shadow-glow-primary)] transition-colors hover:bg-primary-hover">
        Tentar novamente
      </button>
    </div>
  )
}
