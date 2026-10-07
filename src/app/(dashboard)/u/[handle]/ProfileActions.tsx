'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ProfileActions({ blockedId }: { blockedId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  async function block() {
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/blocks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blockedId }) })
      setBlocked(true)
      router.refresh()
    } finally { setBusy(false) }
  }
  return (
    <button onClick={block} disabled={busy || blocked} title="Bloquear" className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs text-muted hover:text-danger disabled:opacity-50">
      {blocked ? 'bloqueado' : '⋯'}
    </button>
  )
}
