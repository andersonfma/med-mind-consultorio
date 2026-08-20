'use client'
import { useState, useEffect } from 'react'
import type { Anamnesis } from '@/lib/consultations/parse'

type Props = {
  consultationId: string
  initialAnamnesis: Anamnesis
  onStatus?: (hasContent: boolean) => void
}

const LABELS: Record<keyof Anamnesis, string> = {
  hda:      'HDA — História da Doença Atual',
  hpp:      'HPP — História Patológica Pregressa',
  ad:       'AD — Anamnese Dirigida',
  social:   'História Social',
  familiar: 'História Familiar',
}

export function AnamnesisPanel({ consultationId, initialAnamnesis, onStatus }: Props) {
  const [anamnesis, setAnamnesis] = useState<Anamnesis>(initialAnamnesis)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onStatus?.(Object.values(anamnesis).some((v) => v && v.trim()))
  }, [anamnesis, onStatus])

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
          <p className="text-xs font-semibold text-muted mb-1">{LABELS[field]}</p>
          <p className="text-sm text-ink min-h-[1.5rem]">
            {anamnesis[field] || <span className="text-muted/50 italic">—</span>}
          </p>
        </div>
      ))}
      {error && <p className="text-danger text-xs">{error}</p>}
      <button
        onClick={updateAnamnesis}
        disabled={loading}
        className="w-full text-sm border border-border bg-surface-2 rounded-md py-1.5 hover:bg-surface hover:border-border-strong text-muted transition-colors disabled:opacity-50"
      >
        {loading ? 'Analisando...' : '↺ Atualizar anamnese'}
      </button>
    </div>
  )
}
