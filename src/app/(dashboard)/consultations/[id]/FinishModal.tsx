'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { patientDetailRoute } from '@/lib/routes'
import { AB4_AXES, COMM_AXES } from '@/lib/consultations/ab4-labels'
import { DiagnosisFlashcard } from '../../patients/[id]/DiagnosisFlashcard'

type Ab4 = {
  a1: number; a2: number; a3: number | null; a4: number | null
  overall: number; recommendation: string; stage?: 1 | 2
} | null

type Communication = { c1: number; c2: number; c3: number; overall: number; recommendation: string } | null

type FinishResult = { patient_id: string; ab4: Ab4; communication: Communication }

type RevealResult = { true_diagnosis: string; diagnosis_status: string; flashcard: string | null }

type Props = {
  consultationId: string
  clinicalReasoning: string
  onClose: () => void
}

const REVEAL_403: Record<string, string> = {
  'At least 1 consultation required': 'Finalize ao menos 1 consulta para concluir o diagnóstico.',
  'At least 1 approved exam required': 'Peça e aprove ao menos 1 exame para concluir o diagnóstico.',
  'Clinical reasoning required': 'Preencha o pensamento clínico para concluir o diagnóstico.',
}

export function FinishModal({ consultationId, clinicalReasoning, onClose }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<FinishResult | null>(null)
  const [showAxes, setShowAxes] = useState(false)

  // Revelar diagnóstico na mesma tela
  const [revealing, setRevealing] = useState(false)
  const [revealError, setRevealError] = useState<string | null>(null)
  const [reveal, setReveal] = useState<RevealResult | null>(null)

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

  async function concludeDiagnosis() {
    if (!result || revealing) return
    setRevealing(true)
    setRevealError(null)
    try {
      const res = await fetch(`/api/patients/${result.patient_id}/reveal-diagnosis`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setRevealError(res.status === 403
          ? (REVEAL_403[data.error as string] ?? 'Complete as etapas da consulta para concluir o diagnóstico.')
          : (data.error ?? 'Erro ao concluir diagnóstico'))
        return
      }
      setReveal(data as RevealResult)
    } catch {
      setRevealError('Erro de conexão. Tente novamente.')
    } finally {
      setRevealing(false)
    }
  }

  const minScore = result?.ab4
    ? Math.min(...[result.ab4.a1, result.ab4.a2, result.ab4.a3, result.ab4.a4].filter((n): n is number => typeof n === 'number'))
    : null
  const minComm = result?.communication
    ? Math.min(result.communication.c1, result.communication.c2, result.communication.c3)
    : null

  // rótulo do critério mais fraco (para o resumo compacto "a treinar")
  const weakAb4 = result?.ab4
    ? AB4_AXES.find(ax => result.ab4![ax.key] !== null && result.ab4![ax.key] === minScore)?.label
    : null
  const weakComm = result?.communication
    ? COMM_AXES.find(ax => result.communication![ax.key] === minComm)?.label
    : null

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain bg-black/50 p-4">
      <div className="my-auto w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
        {!result ? (
          <>
            <h2 className="font-display text-lg font-bold text-ink mb-2">Encerrar consulta</h2>
            <p className="text-sm text-muted mb-6">
              O pensamento clínico registrado durante a consulta será avaliado. Deseja encerrar?
            </p>
            {error && <p className="text-danger text-sm mb-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={onClose} disabled={loading} className="flex-1 rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface hover:border-border-strong disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={finish} disabled={loading} className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-ink shadow-[var(--shadow-glow-primary)] transition-colors hover:bg-primary-hover disabled:opacity-50">
                {loading ? 'Avaliando...' : 'Encerrar consulta'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-lg font-bold text-ink mb-4">Consulta encerrada</h2>

            {/* Scores compactos lado a lado */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="rounded-xl border border-border bg-surface-2 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Raciocínio</p>
                <p className="font-display text-2xl font-bold text-ink">
                  {result.ab4 ? result.ab4.overall.toFixed(1) : '—'}<span className="text-xs text-muted">/10</span>
                </p>
                {weakAb4 && <p className="mt-0.5 text-[11px] text-muted">a treinar: <span className="text-warning font-medium">{weakAb4}</span></p>}
              </div>
              <div className="rounded-xl border border-border bg-surface-2 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Comunicação</p>
                <p className="font-display text-2xl font-bold text-ink">
                  {result.communication ? result.communication.overall.toFixed(1) : '—'}<span className="text-xs text-muted">/10</span>
                </p>
                {weakComm && <p className="mt-0.5 text-[11px] text-muted">a treinar: <span className="text-warning font-medium">{weakComm}</span></p>}
              </div>
            </div>

            {/* Detalhe por critério — recolhível, para não poluir */}
            {(result.ab4 || result.communication) && (
              <>
                <button
                  onClick={() => setShowAxes(v => !v)}
                  className="mb-3 text-xs font-medium text-primary hover:underline"
                >
                  {showAxes ? 'Ocultar notas por critério' : 'Ver notas por critério'}
                </button>
                {showAxes && (
                  <div className="mb-3 space-y-3">
                    {result.ab4 && (
                      <div className="space-y-1.5">
                        {AB4_AXES.map(ax => {
                          const score = result.ab4![ax.key]
                          const pending = score === null
                          const weak = !pending && score === minScore
                          return (
                            <div key={ax.key} className="flex items-center gap-3">
                              <span className={`w-24 shrink-0 text-xs ${pending ? 'text-muted/50' : 'text-muted'}`}>{ax.label}</span>
                              <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                {!pending && <div className={`h-full rounded-full ${weak ? 'bg-warning' : 'bg-success'}`} style={{ width: `${score * 10}%` }} />}
                              </div>
                              <span className={`w-4 text-right text-xs font-semibold ${weak ? 'text-warning' : 'text-ink'}`}>{pending ? '—' : score}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {result.communication && (
                      <div className="space-y-1.5">
                        {COMM_AXES.map(ax => {
                          const score = result.communication![ax.key]
                          const weak = score === minComm
                          return (
                            <div key={ax.key} className="flex items-center gap-3">
                              <span className="w-24 shrink-0 text-xs text-muted">{ax.label}</span>
                              <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${weak ? 'bg-warning' : 'bg-chart-2'}`} style={{ width: `${score * 10}%` }} />
                              </div>
                              <span className={`w-4 text-right text-xs font-semibold ${weak ? 'text-warning' : 'text-ink'}`}>{score}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Recomendações consolidadas */}
            {(result.ab4?.recommendation || result.communication?.recommendation) && (
              <div className="mb-5 rounded-lg border border-border bg-surface-2 p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Como evoluir</p>
                {result.ab4?.recommendation && (
                  <p className="text-sm text-ink"><span className="font-semibold text-muted">Raciocínio.</span> {result.ab4.recommendation}</p>
                )}
                {result.communication?.recommendation && (
                  <p className="text-sm text-ink"><span className="font-semibold text-muted">Comunicação.</span> {result.communication.recommendation}</p>
                )}
              </div>
            )}

            {/* Diagnóstico — concluir sem sair da tela */}
            {reveal ? (
              <div className="mb-5 space-y-3">
                <div className={`rounded-lg border p-3 ${reveal.diagnosis_status === 'achieved' ? 'border-success/30 bg-success/10' : 'border-warning/30 bg-warning/10'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${reveal.diagnosis_status === 'achieved' ? 'text-success' : 'text-warning'}`}>
                    {reveal.diagnosis_status === 'achieved' ? '✓ Diagnóstico alcançado' : 'Diagnóstico revelado'}
                  </p>
                  <p className="mt-1 text-sm font-medium text-ink">{reveal.true_diagnosis}</p>
                </div>
                <DiagnosisFlashcard raw={reveal.flashcard} />
              </div>
            ) : (
              <div className="mb-5">
                <button
                  onClick={concludeDiagnosis}
                  disabled={revealing}
                  className="w-full rounded-md border border-warning/40 bg-warning/10 px-4 py-2 text-sm font-semibold text-warning transition-colors hover:bg-warning/20 disabled:opacity-50"
                >
                  {revealing ? 'Avaliando...' : 'Concluir diagnóstico'}
                </button>
                {revealError && <p className="mt-1 text-xs text-danger">{revealError}</p>}
                <p className="mt-1 text-xs text-muted">Avaliamos se seu raciocínio bateu com o diagnóstico. Não afeta reputação nem scores.</p>
              </div>
            )}

            <button
              onClick={() => router.push(patientDetailRoute(result.patient_id))}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-ink shadow-[var(--shadow-glow-primary)] transition-colors hover:bg-primary-hover"
            >
              Ver paciente
            </button>
          </>
        )}
      </div>
    </div>
  )
}
