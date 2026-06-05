'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { patientDetailRoute } from '@/lib/routes'

type Props = {
  consultationId: string
  onClose: () => void
}

export function FinishModal({ consultationId, onClose }: Props) {
  const router = useRouter()
  const [diagnosis, setDiagnosis] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function finish() {
    if (!diagnosis.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/consultations/${consultationId}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnosis: diagnosis.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao finalizar'); return }
      router.push(patientDetailRoute(data.patient_id))
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Finalizar consulta</h2>
        <p className="text-sm text-gray-500 mb-4">Registre o diagnóstico principal desta consulta.</p>
        <textarea
          value={diagnosis}
          onChange={e => setDiagnosis(e.target.value)}
          placeholder="Ex: Síndrome coronariana aguda — IAM sem supra"
          rows={3}
          className="w-full border border-gray-300 rounded-md p-3 text-sm mb-4"
          autoFocus
        />
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 btn btn--secondary">
            Cancelar
          </button>
          <button
            onClick={finish}
            disabled={!diagnosis.trim() || loading}
            className="flex-1 btn btn--primary"
          >
            {loading ? 'Finalizando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
