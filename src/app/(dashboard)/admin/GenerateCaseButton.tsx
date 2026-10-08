'use client'
import { useState } from 'react'

export function GenerateCaseButton() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  async function run() {
    if (busy) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/admin/generate-case', { method: 'POST' })
      const j = await res.json().catch(() => ({}))
      if (res.ok) setMsg(j.created ? `Caso criado para ${j.weekStart}.` : `Já existia caso para ${j.weekStart}.`)
      else setMsg(j.error ?? 'Falha ao gerar.')
    } finally { setBusy(false) }
  }
  return (
    <div className="flex items-center gap-3">
      <button onClick={run} disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-ink disabled:opacity-50">
        {busy ? 'Gerando…' : 'Gerar caso desta semana'}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  )
}
