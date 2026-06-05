'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { consultationRoute } from '@/lib/routes'

export function StartConsultationButton({ patientId }: { patientId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patientId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro'); return }
      router.push(consultationRoute(data.id))
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button onClick={start} disabled={loading} className="btn btn--primary">
        {loading ? 'Abrindo...' : 'Iniciar atendimento'}
      </button>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </>
  )
}
