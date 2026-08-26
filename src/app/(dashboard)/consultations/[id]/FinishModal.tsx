'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { patientDetailRoute } from '@/lib/routes'
import { AB4_AXES, COMM_AXES } from '@/lib/consultations/ab4-labels'

type Ab4 = {
  a1: number; a2: number; a3: number | null; a4: number | null
  overall: number; recommendation: string; stage?: 1 | 2
} | null

type Communication = { c1: number; c2: number; c3: number; overall: number; recommendation: string } | null

type FinishResult = { patient_id: string; ab4: Ab4; communication: Communication }

type Props = {
  consultationId: string
  clinicalReasoning: string
  onClose: () => void
}

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

  // menor nota entre os eixos avaliados (ignora eixos pendentes/null), para destaque
  const minScore = result?.ab4
    ? Math.min(...[result.ab4.a1, result.ab4.a2, result.ab4.a3, result.ab4.a4]
        .filter((n): n is number => typeof n === 'number'))
    : null

  const minComm = result?.communication
    ? Math.min(result.communication.c1, result.communication.c2, result.communication.c3)
    : null

  return (
    // Container rolável: no mobile o conteúdo pode passar da altura da tela;
    // `my-auto` centraliza quando cabe e permite rolar até o botão quando não cabe.
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
            <h2 className="font-display text-lg font-bold text-ink mb-1">Consulta encerrada</h2>
            <p className="text-sm text-muted mb-5">
              Veja os resultados dos exames na próxima consulta. Quando terminar de raciocinar, conclua o diagnóstico na página do paciente.
            </p>

            {result.ab4 ? (
              <div className="mb-5">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-sm font-semibold text-ink">Raciocínio clínico</span>
                  <span className="font-display text-2xl font-bold text-ink">{result.ab4.overall.toFixed(1)}<span className="text-sm text-muted">/10</span></span>
                </div>
                {result.ab4.stage === 1 && (
                  <p className="text-xs text-muted mb-3">
                    Primeira consulta: avaliamos a abertura do raciocínio. O diferencial e o fechamento entram na próxima consulta, com os resultados dos exames.
                  </p>
                )}

                <div className="space-y-2.5">
                  {AB4_AXES.map(ax => {
                    const score = result.ab4![ax.key]
                    const pending = score === null
                    const weak = !pending && score === minScore
                    return (
                      <div key={ax.key} className="flex items-center gap-3">
                        <span className={`w-24 shrink-0 text-xs font-medium ${pending ? 'text-muted/50' : 'text-ink'}`}>{ax.label}</span>
                        <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
                          {!pending && (
                            <div className={`h-full rounded-full ${weak ? 'bg-warning' : 'bg-success'}`} style={{ width: `${score * 10}%` }} />
                          )}
                        </div>
                        {pending
                          ? <span className="text-[10px] text-muted shrink-0">próxima consulta</span>
                          : <span className={`w-5 text-right text-sm font-semibold ${weak ? 'text-warning' : 'text-ink'}`}>{score}</span>}
                      </div>
                    )
                  })}
                </div>

                <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3">
                  <p className="text-xs font-semibold text-muted mb-1">Recomendação</p>
                  <p className="text-sm text-ink">{result.ab4.recommendation}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted mb-5">Avaliação do raciocínio indisponível desta vez.</p>
            )}

            {result.communication && (
              <div className="mb-5">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-sm font-semibold text-ink">Comunicação</span>
                  <span className="font-display text-2xl font-bold text-ink">{result.communication.overall.toFixed(1)}<span className="text-sm text-muted">/10</span></span>
                </div>
                <div className="space-y-2.5">
                  {COMM_AXES.map(ax => {
                    const score = result.communication![ax.key]
                    const weak = score === minComm
                    return (
                      <div key={ax.key} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 text-xs font-medium text-ink">{ax.label}</span>
                        <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${weak ? 'bg-warning' : 'bg-chart-2'}`} style={{ width: `${score * 10}%` }} />
                        </div>
                        <span className={`w-5 text-right text-sm font-semibold ${weak ? 'text-warning' : 'text-ink'}`}>{score}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3">
                  <p className="text-xs font-semibold text-muted mb-1">Comunicação — recomendação</p>
                  <p className="text-sm text-ink">{result.communication.recommendation}</p>
                </div>
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
