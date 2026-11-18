'use client'
import { useState } from 'react'
import { REACTION_EMOJIS } from '@/lib/social/reactions'
import { InlineComments } from '../../feed/InlineComments'

export function SpacePostInteractions({ postId, initialReactions, initialMyEmoji, initialCommentCount }: {
  postId: string; initialReactions: Record<string, number>; initialMyEmoji: string | null; initialCommentCount: number
}) {
  const [counts, setCounts] = useState<Record<string, number>>(initialReactions)
  const [mine, setMine] = useState<string | null>(initialMyEmoji)
  const [showComments, setShowComments] = useState(false)
  const [commentCount, setCommentCount] = useState(initialCommentCount)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function react(emoji: string) {
    if (busy) return
    setBusy(true); setOpen(false)
    const prev = mine
    // otimista
    const next = { ...counts }
    if (prev) next[prev] = Math.max(0, (next[prev] ?? 1) - 1)
    if (prev === emoji) { setMine(null); setCounts(next) }
    else { next[emoji] = (next[emoji] ?? 0) + 1; setMine(emoji); setCounts(next) }
    try {
      if (prev === emoji) await fetch(`/api/posts/${postId}/like`, { method: 'DELETE' })
      else await fetch(`/api/posts/${postId}/like`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }) })
    } catch { /* mantém otimista */ } finally { setBusy(false) }
  }

  const shown = REACTION_EMOJIS.filter((e) => (counts[e] ?? 0) > 0)
  const totalReacts = Object.values(counts).reduce((s, n) => s + n, 0)

  return (
    <div className="mt-2 border-t border-border/60 pt-2">
      <div className="flex items-center gap-3 text-sm">
        <div className="relative">
          <button onClick={() => setOpen((v) => !v)} className={`rounded-full px-2 py-1 text-xs font-medium ${mine ? 'bg-primary/10 text-primary' : 'text-muted hover:text-ink'}`}>
            {mine ? `${mine} Reagiu` : 'Reagir'}
          </button>
          {open && (
            <div className="absolute bottom-9 left-0 z-10 flex gap-1 rounded-full border border-border bg-surface px-2 py-1 shadow-[var(--shadow-card)]">
              {REACTION_EMOJIS.map((e) => (
                <button key={e} onClick={() => react(e)} disabled={busy} className={`rounded-full px-1 text-lg transition-transform hover:scale-125 ${mine === e ? 'opacity-100' : 'opacity-80'}`}>{e}</button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setShowComments((v) => !v)} className={`text-xs font-medium ${showComments ? 'text-primary' : 'text-muted hover:text-ink'}`}>
          Comentar{commentCount > 0 ? ` · ${commentCount}` : ''}
        </button>
        {shown.length > 0 && (
          <span className="ml-auto flex items-center gap-0.5 text-xs text-muted">
            {shown.map((e) => <span key={e}>{e}</span>)}
            <span className="ml-1 tabular-nums">{totalReacts}</span>
          </span>
        )}
      </div>
      {showComments && <InlineComments postId={postId} onCountChange={setCommentCount} />}
    </div>
  )
}
