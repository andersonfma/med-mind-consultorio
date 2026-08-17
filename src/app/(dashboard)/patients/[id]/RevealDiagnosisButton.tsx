'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  patientId: string
}

export function RevealDiagnosisButton({ patientId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reveal() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/patients/${patientId}/reveal-diagnosis`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403) {
          setError(data.error === 'At least 2 consultations required'
            ? 'É necessário ao menos 2 consultas finalizadas para concluir o diagnóstico.'
            : 'É necessário ao menos 1 exame aprovado para concluir o diagnóstico.')
        } else {
          setError(data.error ?? 'Erro ao concluir diagnóstico')
        }
        return
      }
      // Page will show updated status on next navigation
      router.refresh()
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={reveal}
        disabled={loading}
        className="text-sm border border-warning/40 text-warning bg-warning/10 hover:bg-warning/20 rounded-md px-4 py-2 transition-colors disabled:opacity-50"
      >
        {loading ? 'Avaliando...' : 'Concluir diagnóstico'}
      </button>
      {error && <p className="text-danger text-xs mt-1">{error}</p>}
    </div>
  )
}
