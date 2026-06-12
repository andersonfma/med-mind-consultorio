'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { patientDetailRoute } from '@/lib/routes'

type Ab4 = {
  a1: number; a2: number; a3: number; a4: number
  overall: number; recommendation: string
} | null

type FinishResult = { patient_id: string; diagnosis_achieved: boolean; ab4: Ab4 }

type Props = {
  consultationId: string
  clinicalReasoning: string
  onClose: () => void
}

const AXES: { key: 'a1' | 'a2' | 'a3' | 'a4'; label: string; sub: string }[] = [
  { key: 'a1', label: 'A1 Poético', sub: 'Possibilidades' },
  { key: 'a2', label: 'A2 Retórico', sub: 'Plausibilidade' },
  { key: 'a3', label: 'A3 Dialético', sub: 'Confrontação' },
  { key: 'a4', label: 'A4 Analítico', sub: 'Demonstração' },
]

export function FinishModal({ consultationId, clinicalReasoning, onClose }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<FinishResult | null>(null)

  async function finish() {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/consultations/${consultationId}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinical_reasoning: clinicalReasoning }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao finalizar'); return }
      setResult(data as FinishResult)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // menor nota entre os eixos, para destaque
  const minScore = result?.ab4
    ? Math.min(result.ab4.a1, result.ab4.a2, result.ab4.a3, result.ab4.a4)
    : null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        {!result ? (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Encerrar consulta</h2>
            <p className="text-sm text-gray-500 mb-6">
              O pensamento clínico registrado durante a consulta será avaliado. Deseja encerrar?
            </p>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={onClose} disabled={loading} className="flex-1 btn btn--secondary">
                Cancelar
              </button>
              <button onClick={finish} disabled={loading} className="flex-1 btn btn--primary">
                {loading ? 'Avaliando...' : 'Encerrar consulta'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Consulta encerrada</h2>
            <p className="text-sm text-gray-500 mb-4">
              Diagnóstico: {result.diagnosis_achieved ? 'alcançado ✓' : 'não alcançado'}
            </p>

            {result.ab4 ? (
              <>
                <div className="flex items-baseline justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-700">Score AB4 — raciocínio clínico</span>
                  <span className="text-2xl font-bold text-gray-900">{result.ab4.overall.toFixed(1)}<span className="text-sm text-gray-400">/10</span></span>
                </div>

                <div className="space-y-2 mb-4">
                  {AXES.map(ax => {
                    const score = result.ab4![ax.key]
                    const weak = score === minScore
                    return (
                      <div key={ax.key} className="flex items-center gap-2">
                        <div className="w-28 shrink-0">
                          <span className="text-xs font-medium text-gray-700">{ax.label}</span>
                          <span className="block text-[10px] text-gray-400">{ax.sub}</span>
                        </div>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${weak ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${score * 10}%` }}
                          />
                        </div>
                        <span className={`w-5 text-right text-sm font-semibold ${weak ? 'text-amber-600' : 'text-gray-700'}`}>{score}</span>
                      </div>
                    )
                  })}
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 mb-5">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Recomendação</p>
                  <p className="text-sm text-gray-700">{result.ab4.recommendation}</p>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 mb-5">Avaliação AB4 indisponível desta vez.</p>
            )}

            <button
              onClick={() => router.push(patientDetailRoute(result.patient_id))}
              className="w-full btn btn--primary"
            >
              Ver paciente
            </button>
          </>
        )}
      </div>
    </div>
  )
}
