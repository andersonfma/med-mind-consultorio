'use client'
import { useState } from 'react'

export function PremiumInterestButton({ registered }: { registered: boolean }) {
  const [done, setDone] = useState(registered)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function register() {
    if (busy || done) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/premium/interest', { method: 'POST' })
      if (!res.ok) { setError('Não foi possível registrar. Tente de novo.'); return }
      setDone(true)
    } catch {
      setError('Erro de conexão.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border px-5 py-4 text-center" style={{ borderColor: '#E7B23A66', background: 'rgba(231,178,58,.08)' }}>
        <p className="font-display text-lg font-bold" style={{ color: '#E7B23A' }}>Recebemos seu interesse! 🎉</p>
        <p className="mt-1 text-sm text-muted">Vamos te avisar assim que o Premium estiver disponível para assinatura.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={register}
        disabled={busy}
        className="w-full rounded-xl px-6 py-3.5 text-base font-bold text-[#1a1203] shadow-lg transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        style={{ background: 'linear-gradient(140deg,#F5C84B,#E7B23A)' }}
      >
        {busy ? 'Registrando…' : 'Tenho interesse no Premium ✦'}
      </button>
      <p className="text-center text-xs text-muted">Sem cobrança agora — só queremos saber quem quer. Avisamos quando abrir.</p>
      {error && <p className="text-center text-xs text-danger">{error}</p>}
    </div>
  )
}
