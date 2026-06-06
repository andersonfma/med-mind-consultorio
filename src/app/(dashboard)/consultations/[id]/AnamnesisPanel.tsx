'use client'
import { useState } from 'react'
import type { Anamnesis } from '@/lib/consultations/parse'

type Props = {
  consultationId: string
  initialAnamnesis: Anamnesis
}

const LABELS: Record<keyof Anamnesis, string> = {
  hda:      'HDA — História da Doença Atual',
  hpp:      'HPP — História Patológica Pregressa',
  ad:       'AD — Anamnese Dirigida',
  social:   'História Social',
  familiar: 'História Familiar',
}

export function AnamnesisPanel({ consultationId, initialAnamnesis }: Props) {
  const [anamnesis, setAnamnesis] = useState<Anamnesis>(initialAnamnesis)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function updateAnamnesis() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/consultations/${consultationId}/anamnesis`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao atualizar'); return }
      setAnamnesis(data as Anamnesis)
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-3">
      {(Object.keys(LABELS) as (keyof Anamnesis)[]).map(field => (
        <div key={field}>
          <p className="text-xs font-semibold text-gray-500 mb-1">{LABELS[field]}</p>
          <p className="text-sm text-gray-700 min-h-[1.5rem]">
            {anamnesis[field] || <span className="text-gray-300 italic">—</span>}
          </p>
        </div>
      ))}
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button
        onClick={updateAnamnesis}
        disabled={loading}
        className="w-full text-sm border border-gray-300 rounded-md py-1.5 hover:bg-gray-50 text-gray-600"
      >
        {loading ? 'Analisando...' : '↺ Atualizar anamnese'}
      </button>
    </div>
  )
}
