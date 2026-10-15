'use client'
import { useState } from 'react'

export function AddToStoryButton({ consultationId }: { consultationId: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  async function add() {
    if (state !== 'idle') return
    setState('busy')
    const res = await fetch('/api/stories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'card', consultationId }) })
    setState(res.ok ? 'done' : 'idle')
  }
  return (
    <button onClick={add} disabled={state !== 'idle'} className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-ink disabled:opacity-60">
      {state === 'done' ? 'Adicionado ao story ✓' : state === 'busy' ? 'Adicionando…' : 'Adicionar ao story (24h)'}
    </button>
  )
}
