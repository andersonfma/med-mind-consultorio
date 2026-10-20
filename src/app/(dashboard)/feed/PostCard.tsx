'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PremiumBadge } from '@/components/social/PremiumBadge'
import { profileRoute, shareCardRoute } from '@/lib/routes'
import { relativeTime } from '@/lib/social/time'
import type { FeedPost } from '@/lib/social/feed'
import { QuizCard } from './QuizCard'
import { ShareButton } from '../ShareButton'
import { InlineComments } from './InlineComments'

/** Só permite http(s) — evita href javascript:/data: (stored XSS) vindo de meta.link. */
function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch { return null }
}

export function PostCard({ post, viewerId }: { post: FeedPost; viewerId: string }) {
  const router = useRouter()
  const [liked, setLiked] = useState(post.likedByMe)
  const [count, setCount] = useState(post.likeCount)
  const [busy, setBusy] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [commentCount, setCommentCount] = useState(post.commentCount)
  const [deleted, setDeleted] = useState(false)
  const isMine = post.author.id === viewerId

  async function remove() {
    if (busy || !confirm('Apagar este post?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' })
      if (res.ok) { setDeleted(true); router.refresh() }
    } finally { setBusy(false) }
  }

  async function toggleLike() {
    if (busy) return
    setBusy(true)
    const next = !liked
    setLiked(next); setCount(c => c + (next ? 1 : -1))
    try {
      await fetch(`/api/posts/${post.id}/like`, { method: next ? 'POST' : 'DELETE' })
    } catch {
      setLiked(!next); setCount(c => c + (next ? -1 : 1))
    } finally { setBusy(false) }
  }

  if (deleted) return null
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <header className="mb-3 flex items-center gap-3">
        <Link href={post.author.handle ? profileRoute(post.author.handle) : '#'} className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-surface-2 text-sm font-bold text-ink">
            {post.author.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={post.author.avatarUrl} alt="" className="h-full w-full object-cover" />
              : post.author.initials}
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold text-ink">{post.author.name}{post.author.isPremium && <PremiumBadge />}</span>
        </Link>
        <span className="ml-auto text-xs text-muted">{relativeTime(post.createdAt)}</span>
        {isMine && <button onClick={remove} disabled={busy} title="Apagar post" className="text-muted transition-colors hover:text-danger" aria-label="Apagar post">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
        </button>}
      </header>

      {post.kind === 'duvida' && (
        <span className="mb-2 inline-block rounded-full bg-warning/15 px-2.5 py-0.5 text-[11px] font-semibold text-warning">Dúvida</span>
      )}

      {post.kind === 'card' && post.consultationId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shareCardRoute(post.consultationId)} alt="Card do resultado" className="mb-3 block h-auto w-full max-w-full rounded-lg border border-border" />
      )}

      {post.kind === 'resenha' && (
        <div className="mb-3">
          {post.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.imageUrl} alt="" className="mb-2 block h-auto w-full max-w-full rounded-lg border border-border" />
          )}
          {post.meta?.title && <p className="text-sm font-semibold text-ink">{post.meta.title}</p>}
          {(post.meta?.authors || post.meta?.source) && (
            <p className="text-xs text-muted">{[post.meta?.authors, post.meta?.source].filter(Boolean).join(' · ')}</p>
          )}
          {safeHttpUrl(post.meta?.link) && <a href={safeHttpUrl(post.meta?.link)!} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">ver artigo</a>}
        </div>
      )}

      {post.kind === 'media' && post.imageUrl && (
        post.meta?.video
          ? <video src={post.imageUrl} controls playsInline className="mb-3 block h-auto w-full max-w-full rounded-lg border border-border" />
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={post.imageUrl} alt="" className="mb-3 block h-auto w-full max-w-full rounded-lg border border-border" />
      )}

      {post.kind === 'quiz' && post.quiz && <QuizCard quiz={post.quiz} />}

      {post.body && <p className="mb-3 whitespace-pre-wrap text-sm text-ink">{post.body}</p>}

      <footer className="flex items-center gap-4 text-sm">
        <button onClick={toggleLike} disabled={busy} className={`font-medium ${liked ? 'text-primary' : 'text-muted hover:text-ink'}`}>
          ♥ {count}
        </button>
        <button onClick={() => setShowComments(v => !v)} className={`font-medium ${showComments ? 'text-primary' : 'text-muted hover:text-ink'}`}>
          💬 {commentCount}
        </button>
        {post.kind === 'card' && post.consultationId && (
          <span className="ml-auto"><ShareButton consultationId={post.consultationId} variant="ghost" label="Compartilhar" /></span>
        )}
      </footer>

      {showComments && <InlineComments postId={post.id} onCountChange={setCommentCount} />}
    </article>
  )
}
