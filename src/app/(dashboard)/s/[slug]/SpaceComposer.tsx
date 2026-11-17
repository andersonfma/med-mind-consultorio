'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function SpaceComposer({ spaceId }: { spaceId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [kind, setKind] = useState<'text' | 'duvida'>('text')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function publish() {
    if (busy || !body.trim()) return
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, body, spaceId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(j.error ?? 'Erro'); return }
      setBody('')
      startTransition(() => router.refresh())
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-2.5">
      <div className="flex gap-2">
        {(['text', 'duvida'] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${kind === k ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted'}`}>
            {k === 'text' ? 'Post' : 'Dúvida'}
          </button>
        ))}
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={500}
        placeholder={kind === 'duvida' ? 'Qual é a sua dúvida?' : 'Compartilhe algo com a comunidade…'}
        className="min-h-[80px] w-full resize-y rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
      <div className="flex items-center justify-between">
        {err ? <p className="text-xs text-danger">{err}</p> : <span className="text-[11px] text-muted">{body.length}/500</span>}
        <button onClick={publish} disabled={busy || pending || !body.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-ink disabled:opacity-50">
          {busy ? 'Publicando…' : 'Publicar'}
        </button>
      </div>
    </div>
  )
}
