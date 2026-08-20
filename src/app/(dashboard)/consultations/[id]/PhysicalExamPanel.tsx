'use client'
import { useState, useEffect } from 'react'
import type { PhysicalExam } from '@/lib/consultations/parse'

type Props = {
  consultationId: string
  initialExam: PhysicalExam
  onStatus?: (hasContent: boolean) => void
}

const BASE_LABELS: Record<keyof Omit<PhysicalExam, 'sistemas_adicionais'>, string> = {
  antropometria:           'Antropometria',
  inspecao_geral:          'Inspeção Geral',
  sinais_vitais:           'Sinais Vitais',
  aparelho_respiratorio:   'Ap. Respiratório',
  aparelho_cardiovascular: 'Ap. Cardiovascular',
  abdome:                  'Abdome',
  membros_inferiores:      'Membros Inferiores',
}

export function PhysicalExamPanel({ consultationId, initialExam, onStatus }: Props) {
  const [exam, setExam] = useState<PhysicalExam>(initialExam)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const has =
      (Object.keys(BASE_LABELS) as (keyof typeof BASE_LABELS)[]).some((k) => exam[k]) ||
      Object.keys(exam.sistemas_adicionais).length > 0
    onStatus?.(has)
  }, [exam, onStatus])

  async function generateExam() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/consultations/${consultationId}/physical-exam`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao gerar exame'); return }
      setExam(data as PhysicalExam)
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  // O exame físico é gerado UMA vez por consulta — sem regerar (achados não devem mudar a cada clique)
  const hasContent =
    (Object.keys(BASE_LABELS) as (keyof typeof BASE_LABELS)[]).some(k => exam[k]) ||
    Object.keys(exam.sistemas_adicionais).length > 0

  return (
    <div className="p-4 space-y-3">
      {(Object.keys(BASE_LABELS) as (keyof typeof BASE_LABELS)[]).map(field => (
        <div key={field}>
          <p className="text-xs font-semibold text-muted mb-1">{BASE_LABELS[field]}</p>
          <p className="text-sm text-ink min-h-[1.25rem]">
            {exam[field] || <span className="text-muted/50 italic">—</span>}
          </p>
        </div>
      ))}

      {Object.keys(exam.sistemas_adicionais).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted mb-1">Sistemas Adicionais</p>
          {Object.entries(exam.sistemas_adicionais).map(([sistema, achados]) => (
            <div key={sistema} className="mb-1">
              <span className="text-xs font-medium text-muted capitalize">{sistema}: </span>
              <span className="text-sm text-ink">{achados}</span>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-danger text-xs">{error}</p>}

      {!hasContent && (
        <button
          onClick={generateExam}
          disabled={loading}
          className="w-full text-sm border border-border bg-surface-2 rounded-md py-1.5 hover:bg-surface hover:border-border-strong text-muted transition-colors disabled:opacity-50"
        >
          {loading ? 'Gerando...' : '⊕ Gerar exame físico'}
        </button>
      )}
    </div>
  )
}
