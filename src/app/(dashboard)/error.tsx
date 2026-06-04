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
      <p className="text-red-600 mb-4">Erro ao carregar dados. Tente novamente.</p>
      <button onClick={reset} className="btn btn--primary">
        Tentar novamente
      </button>
    </div>
  )
}
