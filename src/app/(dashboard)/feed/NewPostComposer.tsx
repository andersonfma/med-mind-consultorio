'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function NewPostComposer() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function publish() {
    if (busy || !text.trim()) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'text', body: text }) })
      if (res.ok) { setText(''); setOpen(false); router.refresh() }
      else { const j = await res.json(); setMsg(j.error ?? 'Falha ao publicar') }
    } finally { setBusy(false) }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-left text-sm text-muted transition-colors hover:border-primary/40 hover:text-ink"
      >
        Escrever um post ou tirar uma dúvida…
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        maxLength={500}
        rows={3}
        autoFocus
        placeholder="Compartilhe algo ou pergunte aos colegas…"
        className="w-full resize-none rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-ink outline-none focus:border-primary"
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        {msg && <span className="mr-auto text-xs text-danger">{msg}</span>}
        <button onClick={() => { setOpen(false); setText('') }} className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted">Cancelar</button>
        <button onClick={publish} disabled={busy || !text.trim()} className="rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-ink disabled:opacity-50">{busy ? 'Publicando…' : 'Publicar'}</button>
      </div>
    </div>
  )
}
