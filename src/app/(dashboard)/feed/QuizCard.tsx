'use client'
import { useState } from 'react'
import type { QuizView } from '@/lib/social/feed'

type Result = { isCorrect: boolean; correctKey: string; explanation: string | null; networkPct: number }

export function QuizCard({ quiz }: { quiz: QuizView }) {
  const [choice, setChoice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const locked = !!result

  async function submit() {
    if (busy || !choice) return
    setBusy(true)
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}/answer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chosenKey: choice }),
      })
      const j = await res.json()
      if (res.ok) setResult(j as Result)
    } finally { setBusy(false) }
  }

  return (
    <div className="mb-3 rounded-lg border border-border bg-surface-2/40 p-3">
      <p className="mb-2 text-sm font-medium text-ink">{quiz.prompt}</p>
      <div className="space-y-1.5">
        {quiz.options.map(o => {
          const isCorrect = result?.correctKey === o.key
          const isChosen = choice === o.key
          const cls = result
            ? (isCorrect ? 'border-success bg-success/10 text-ink' : isChosen ? 'border-danger bg-danger/10 text-ink' : 'border-border text-muted')
            : (isChosen ? 'border-primary bg-primary/10 text-ink' : 'border-border text-ink hover:border-primary/40')
          return (
            <button key={o.key} disabled={locked} onClick={() => !locked && setChoice(o.key)}
              className={`flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default ${cls}`}>
              <span className="font-semibold">{o.key}</span><span>{o.text}</span>
            </button>
          )
        })}
      </div>
      {!result && (
        <button onClick={submit} disabled={busy || !choice} className="mt-2 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-ink disabled:opacity-50">
          {busy ? 'Enviando…' : 'Responder'}
        </button>
      )}
      {result && (
        <p className="mt-2 text-xs">
          <span className={result.isCorrect ? 'text-success font-medium' : 'text-danger font-medium'}>{result.isCorrect ? 'Acertou!' : 'Errou.'}</span>{' '}
          <span className="text-muted">{result.networkPct}% da rede acertou</span>
          {result.explanation && <span className="mt-1 block rounded-md bg-surface p-2 text-ink"><span className="font-semibold text-muted">Explicação. </span>{result.explanation}</span>}
        </p>
      )}
    </div>
  )
}
