'use client'
import { useEffect, useState } from 'react'
import { relativeTime } from '@/lib/social/time'

type Comment = { id: string; name: string; initials: string; avatarUrl: string | null; body: string; createdAt: string }

export function InlineComments({ postId, onCountChange }: { postId: string; onCountChange?: (n: number) => void }) {
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`)
      if (res.ok) {
        const j = await res.json()
        setComments(j.comments as Comment[])
        onCountChange?.((j.comments as Comment[]).length)
      } else setComments([])
    } catch { setComments([]) }
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    if (busy || !text.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }) })
      if (res.ok) { setText(''); await load() }
    } finally { setBusy(false) }
  }

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      {comments === null ? (
        <p className="text-xs text-muted">Carregando comentários…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted">Seja o primeiro a comentar.</p>
      ) : (
        <ul className={`space-y-2.5 ${comments.length > 5 ? 'max-h-72 overflow-y-auto pr-1' : ''}`}>
          {comments.map(c => (
            <li key={c.id} className="flex gap-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 text-[11px] font-bold text-ink">
                {c.avatarUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" /> : c.initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs"><span className="font-semibold text-ink">{c.name}</span> <span className="text-muted">· {relativeTime(c.createdAt)}</span></p>
                <p className="whitespace-pre-wrap text-sm text-ink">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
          maxLength={1000}
          placeholder="Adicione um comentário…"
          className="flex-1 rounded-full border border-border bg-surface-2/40 px-3.5 py-2 text-sm text-ink outline-none focus:border-primary"
        />
        <button onClick={send} disabled={busy || !text.trim()} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-ink disabled:opacity-50">
          Enviar
        </button>
      </div>
    </div>
  )
}
