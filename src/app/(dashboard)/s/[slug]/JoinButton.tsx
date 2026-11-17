'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function JoinButton({ spaceId, status, joinPolicy }: { spaceId: string; status: string | null; joinPolicy: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (status === 'pending') {
    return <span className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">Pedido enviado</span>
  }
  if (status === 'banned') {
    return <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">Sem acesso</span>
  }
  if (joinPolicy === 'invite') {
    return <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">Só por convite</span>
  }

  async function join() {
    if (busy) return
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`/api/spaces/${spaceId}/join`, { method: 'POST' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(j.error ?? 'Erro'); return }
      startTransition(() => router.refresh())
    } finally { setBusy(false) }
  }

  return (
    <div className="text-right">
      <button onClick={join} disabled={busy || pending}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-ink hover:opacity-90 disabled:opacity-50">
        {busy ? '…' : joinPolicy === 'open' ? 'Entrar' : 'Pedir para entrar'}
      </button>
      {err && <p className="mt-1 text-xs text-danger">{err}</p>}
    </div>
  )
}
