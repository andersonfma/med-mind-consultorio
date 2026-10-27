'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Opt = { key: string; text: string }
type Props = {
  quizId: string
  prompt: string
  options: Opt[]
  answerable: boolean
  answered: { chosenKey: string; isCorrect: boolean } | null
  reveal: { correctKey: string; explanation: string | null } | null
  balance: number
  isConclusion: boolean
}

type Result = { isCorrect: boolean; correctKey: string; explanation: string | null; networkPct: number; delta: number; newBalance: number; streak: number }

const STAKE_TIERS = [0, 10, 25, 50]

export function ChallengeQuiz({ quizId, prompt, options, answerable, answered, reveal, balance, isConclusion }: Props) {
  const router = useRouter()
  const [choice, setChoice] = useState<string | null>(null)
  const [stake, setStake] = useState(0)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  // chave correta a destacar: do reveal (dias passados/respondidos) ou do result (acabou de responder)
  const correctKey = reveal?.correctKey ?? result?.correctKey ?? null
  const chosenKey = answered?.chosenKey ?? choice
  const explanation = reveal?.explanation ?? result?.explanation ?? null
  const locked = !answerable || !!result

  async function submit() {
    if (busy || !choice) return
    setBusy(true)
    try {
      const res = await fetch(`/api/challenge/${quizId}/answer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chosenKey: choice, stake }),
      })
      const j = await res.json()
      if (res.ok) { setResult(j as Result); router.refresh() }
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-3">
      <p className="mb-2 text-sm font-medium text-ink">{prompt}</p>
      <div className="space-y-1.5">
        {options.map(o => {
          const isCorrect = correctKey === o.key
          const isChosen = chosenKey === o.key
          const show = !!reveal || !!result || !!answered
          const cls = show
            ? (isCorrect ? 'border-success bg-success/10 text-ink' : isChosen ? 'border-danger bg-danger/10 text-ink' : 'border-border text-muted')
            : (isChosen ? 'border-primary bg-primary/10 text-ink' : 'border-border text-ink hover:border-primary/40')
          return (
            <button
              key={o.key}
              disabled={locked}
              onClick={() => !locked && setChoice(o.key)}
              className={`flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default ${cls}`}
            >
              <span className="font-semibold">{o.key}</span><span>{o.text}</span>
            </button>
          )
        })}
      </div>

      {answerable && !result && (
        <div className="mt-3 space-y-2">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-ink">💰 Aposte seus MedCoins <span className="font-normal text-muted">(opcional)</span></span>
              <span className="text-[11px] text-muted">Saldo: <b className="text-ink tabular-nums">{balance} MC</b></span>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              Acertou, ganha o que apostou; errou, perde. {isConclusion && <b className="text-primary">Hoje (conclusão) o acerto paga em DOBRO.</b>}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {STAKE_TIERS.map(t => {
                const affordable = t <= 10 || t <= balance
                return (
                  <button
                    key={t}
                    disabled={!affordable}
                    onClick={() => setStake(t)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${stake === t ? 'bg-primary text-primary-ink shadow-[var(--shadow-glow-primary)]' : 'border border-border text-muted hover:border-primary/40 hover:text-ink'}`}
                  >
                    {t === 0 ? 'Sem aposta' : `${t} MC`}
                  </button>
                )
              })}
            </div>
          </div>
          <button
            onClick={submit}
            disabled={busy || !choice}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-ink shadow-[var(--shadow-glow-primary)] disabled:opacity-50"
          >
            {busy ? 'Enviando…' : !choice ? 'Escolha uma alternativa' : stake > 0 ? `Responder · apostando ${stake} MC` : 'Responder sem apostar'}
          </button>
        </div>
      )}

      {result && (
        <p className="mt-2 text-xs font-medium">
          <span className={result.isCorrect ? 'text-success' : 'text-danger'}>{result.isCorrect ? 'Acertou!' : 'Errou.'}</span>{' '}
          <span className={result.delta >= 0 ? 'text-success' : 'text-danger'}>{result.delta >= 0 ? `+${result.delta}` : result.delta} MC</span>{' '}
          <span className="text-muted">· saldo {result.newBalance} · 🔥 {result.streak} · {result.networkPct}% da rede acertou</span>
        </p>
      )}

      {explanation && (reveal || result) && (
        <p className="mt-2 rounded-md bg-surface p-2 text-xs text-ink"><span className="font-semibold text-muted">Explicação. </span>{explanation}</p>
      )}
    </div>
  )
}
