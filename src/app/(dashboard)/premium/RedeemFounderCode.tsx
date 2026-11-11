'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

const GOLD = '#E7B23A'

const MESSAGES: Record<string, string> = {
  invalid: 'Código inválido. Confira as letras e tente de novo.',
  expired: 'Este código expirou.',
  exhausted: 'As vagas deste código se esgotaram.',
  not_authenticated: 'Entre na sua conta para resgatar.',
  server: 'Erro no servidor. Tente novamente.',
}

export function RedeemFounderCode() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function redeem(e: FormEvent) {
    e.preventDefault()
    const value = code.trim()
    if (busy || !value) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/founder/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: value }),
      })
      const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
      if (data.ok) {
        setDone(true)
        // re-lê is_premium na página (server component)
        setTimeout(() => router.refresh(), 1200)
        return
      }
      setError(MESSAGES[data.error ?? 'server'] ?? MESSAGES.server)
    } catch {
      setError('Erro de conexão.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border px-5 py-4 text-center" style={{ borderColor: `${GOLD}66`, background: 'rgba(231,178,58,.08)' }}>
        <p className="font-display text-lg font-bold" style={{ color: GOLD }}>Premium de fundador ativado! ✦</p>
        <p className="mt-1 text-sm text-muted">Seu acesso Premium está liberado por 1 ano. Bom treino!</p>
      </div>
    )
  }

  return (
    <form onSubmit={redeem} className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
        Tem um código de fundador?
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Ex.: BJ2K29"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={24}
          className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold uppercase tracking-widest text-ink placeholder:font-normal placeholder:tracking-normal placeholder:text-muted focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="rounded-xl px-6 py-3 text-sm font-bold text-[#1a1203] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          style={{ background: 'linear-gradient(140deg,#F5C84B,#E7B23A)' }}
        >
          {busy ? 'Ativando…' : 'Ativar'}
        </button>
      </div>
      <p className="text-xs text-muted">Recebeu um código em um evento ou aula? Digite para liberar seu acesso de fundador.</p>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  )
}
