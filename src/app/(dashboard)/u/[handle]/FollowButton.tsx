'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function FollowButton({ followeeId, initialState, isPrivate }: { followeeId: string; initialState: 'none' | 'pending' | 'accepted'; isPrivate: boolean }) {
  const router = useRouter()
  const [state, setState] = useState(initialState)
  const [busy, setBusy] = useState(false)

  async function act() {
    if (busy) return
    setBusy(true)
    try {
      if (state === 'none') {
        const res = await fetch('/api/follow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ followeeId }) })
        const j = await res.json(); if (res.ok) setState(j.status)
      } else {
        await fetch('/api/follow', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ followeeId }) })
        setState('none')
      }
      router.refresh()
    } finally { setBusy(false) }
  }

  const label = state === 'accepted' ? 'Seguindo' : state === 'pending' ? 'Solicitado' : (isPrivate ? 'Solicitar' : 'Seguir')
  return (
    <button onClick={act} disabled={busy} className={`rounded-md px-4 py-1.5 text-xs font-semibold ${state === 'none' ? 'bg-primary text-primary-ink' : 'border border-border bg-surface-2 text-ink'}`}>
      {label}
    </button>
  )
}
