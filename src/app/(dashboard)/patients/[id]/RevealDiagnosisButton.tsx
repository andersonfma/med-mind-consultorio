'use client'
import { useState } from 'react'

type Props = {
  patientId: string
  onRevealed: (trueDiagnosis: string, clinicalSummary: string) => void
}

export function RevealDiagnosisButton({ patientId, onRevealed }: Props) {
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
            ? 'É necessário ao menos 2 consultas finalizadas para revelar o diagnóstico.'
            : 'É necessário ao menos 1 exame aprovado para revelar o diagnóstico.')
        } else {
          setError(data.error ?? 'Erro ao revelar diagnóstico')
        }
        return
      }
      onRevealed(data.true_diagnosis, data.clinical_summary)
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
        className="text-sm border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-md px-4 py-2"
      >
        {loading ? 'Revelando...' : 'Revelar diagnóstico'}
      </button>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
