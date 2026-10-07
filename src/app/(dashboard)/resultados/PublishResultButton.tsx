'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { postRoute } from '@/lib/routes'

export function PublishResultButton({ consultationId }: { consultationId: string }) {
  const router = useRouter()
  const [caption, setCaption] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function publish() {
    if (busy) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'card', consultationId, body: caption }) })
      const j = await res.json()
      if (res.ok) { router.push(postRoute(j.id)) } else { setMsg(j.error ?? 'Falha ao publicar') }
    } finally { setBusy(false) }
  }

  if (!open) return <button onClick={() => setOpen(true)} className="w-full rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary">Publicar no feed</button>
  return (
    <div className="space-y-2">
      <input value={caption} onChange={e => setCaption(e.target.value)} maxLength={500} placeholder="Legenda (opcional)" className="w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
      <button onClick={publish} disabled={busy} className="w-full rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-ink disabled:opacity-50">{busy ? 'Publicando…' : 'Confirmar publicação'}</button>
      {msg && <p className="text-xs text-danger">{msg}</p>}
    </div>
  )
}
