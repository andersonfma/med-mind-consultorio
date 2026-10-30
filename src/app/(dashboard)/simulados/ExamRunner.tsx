'use client'
import { useState } from 'react'

type Q = { prompt: string; options: { key: string; text: string }[]; correct_key: string; explanation: string; topic: string }
type Area = { key: string; label: string }

export function ExamRunner({ areas }: { areas: Area[] }) {
  const [area, setArea] = useState<string>(areas[0]?.key ?? 'clinica')
  const [step, setStep] = useState<'pick' | 'run' | 'done'>('pick')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qs, setQs] = useState<Q[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})

  async function generate() {
    if (loading) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/exam/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.message ?? j.error ?? 'Erro ao gerar'); return }
      setQs(j.questions as Q[]); setAnswers({}); setStep('run')
      window.scrollTo({ top: 0 })
    } catch { setError('Erro de conexão.') } finally { setLoading(false) }
  }

  const score = qs.reduce((n, q, i) => n + (answers[i] === q.correct_key ? 1 : 0), 0)
  const answeredAll = qs.every((_, i) => answers[i])

  if (step === 'pick') {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-ink">Escolha a área</p>
          <p className="text-xs text-muted">10 questões originais nos moldes do ENARE/ENAMED, com gabarito comentado.</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {areas.map((a) => (
            <button key={a.key} onClick={() => setArea(a.key)}
              className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${area === a.key ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-surface text-ink hover:border-border-strong'}`}>
              {a.label}
            </button>
          ))}
        </div>
        <button onClick={generate} disabled={loading}
          className="btn-electric w-full rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-60">
          {loading ? 'Gerando simulado…' : 'Gerar simulado →'}
        </button>
        {loading && <p className="text-center text-xs text-muted">A IA está montando 10 questões — pode levar alguns segundos.</p>}
        {error && <p className="text-center text-sm text-danger">{error}</p>}
      </div>
    )
  }

  const showResult = step === 'done'
  return (
    <div className="space-y-5">
      {showResult && (
        <div className="rounded-2xl border p-5 text-center" style={{ borderColor: 'rgba(34,224,230,.3)', background: 'rgba(34,224,230,.06)' }}>
          <p className="font-display text-3xl font-bold text-ink">{score}<span className="text-lg text-muted">/{qs.length}</span></p>
          <p className="mt-1 text-sm text-muted">{Math.round((score / qs.length) * 100)}% de acerto · {areas.find(a => a.key === area)?.label}</p>
        </div>
      )}

      {qs.map((q, i) => {
        const chosen = answers[i]
        return (
          <div key={i} className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted">Questão {i + 1}{showResult ? ` · ${q.topic}` : ''}</span>
            </div>
            <p className="mb-3 whitespace-pre-wrap text-sm text-ink">{q.prompt}</p>
            <div className="space-y-1.5">
              {q.options.map((o) => {
                const isChosen = chosen === o.key
                const isCorrect = o.key === q.correct_key
                let cls = 'border-border text-ink hover:border-primary/40'
                if (showResult) {
                  if (isCorrect) cls = 'border-success bg-success/10 text-ink'
                  else if (isChosen) cls = 'border-danger bg-danger/10 text-ink'
                  else cls = 'border-border text-muted'
                } else if (isChosen) cls = 'border-primary bg-primary/10 text-ink'
                return (
                  <button key={o.key} disabled={showResult}
                    onClick={() => setAnswers((a) => ({ ...a, [i]: o.key }))}
                    className={`flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default ${cls}`}>
                    <span className="font-semibold">{o.key}</span><span>{o.text}</span>
                  </button>
                )
              })}
            </div>
            {showResult && (
              <p className="mt-2 rounded-md bg-surface-2/50 p-2 text-xs text-ink">
                <span className="font-semibold text-muted">Gabarito ({q.correct_key}). </span>{q.explanation}
              </p>
            )}
          </div>
        )
      })}

      {!showResult ? (
        <button onClick={() => { setStep('done'); window.scrollTo({ top: 0 }) }} disabled={!answeredAll}
          className="btn-electric w-full rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-50">
          {answeredAll ? 'Corrigir simulado' : `Responda todas (${Object.keys(answers).length}/${qs.length})`}
        </button>
      ) : (
        <button onClick={() => { setStep('pick'); setQs([]) }}
          className="w-full rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold text-ink hover:border-border-strong">
          Novo simulado
        </button>
      )}
    </div>
  )
}
