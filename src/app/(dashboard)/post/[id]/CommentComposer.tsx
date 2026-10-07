'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CommentComposer({ postId }: { postId: string }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  async function send() {
    if (busy || !text.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }) })
      if (res.ok) { setText(''); router.refresh() }
    } finally { setBusy(false) }
  }
  return (
    <div className="flex gap-2">
      <input value={text} onChange={e => setText(e.target.value)} maxLength={1000} placeholder="Comentar…" className="flex-1 rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
      <button onClick={send} disabled={busy || !text.trim()} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-ink disabled:opacity-50">Enviar</button>
    </div>
  )
}
