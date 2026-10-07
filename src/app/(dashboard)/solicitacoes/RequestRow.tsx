'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RequestRow({ followerId, name }: { followerId: string; name: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [gone, setGone] = useState(false)
  async function respond(accept: boolean) {
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/follow/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ followerId, accept }) })
      setGone(true)
      router.refresh()
    } finally { setBusy(false) }
  }
  if (gone) return null
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
      <span className="text-sm text-ink">{name}</span>
      <div className="flex gap-2">
        <button onClick={() => respond(true)} disabled={busy} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-ink disabled:opacity-50">Aceitar</button>
        <button onClick={() => respond(false)} disabled={busy} className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs text-muted disabled:opacity-50">Recusar</button>
      </div>
    </div>
  )
}
