'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { postRoute, profileRoute, shareCardRoute } from '@/lib/routes'
import { relativeTime } from '@/lib/social/time'
import type { FeedPost } from '@/lib/social/feed'
import { QuizCard } from './QuizCard'
import { ShareButton } from '../ShareButton'

/** Só permite http(s) — evita href javascript:/data: (stored XSS) vindo de meta.link. */
function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch { return null }
}

export function PostCard({ post }: { post: FeedPost }) {
  const router = useRouter()
  const [liked, setLiked] = useState(post.likedByMe)
  const [count, setCount] = useState(post.likeCount)
  const [busy, setBusy] = useState(false)

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
          <span className="text-sm font-semibold text-ink">{post.author.name}</span>
        </Link>
        <span className="ml-auto text-xs text-muted">{relativeTime(post.createdAt)}</span>
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

      {post.kind === 'quiz' && post.quiz && <QuizCard quiz={post.quiz} />}

      {post.body && <p className="mb-3 whitespace-pre-wrap text-sm text-ink">{post.body}</p>}

      <footer className="flex items-center gap-4 text-sm">
        <button onClick={toggleLike} disabled={busy} className={`font-medium ${liked ? 'text-primary' : 'text-muted hover:text-ink'}`}>
          ♥ {count}
        </button>
        <button onClick={() => router.push(postRoute(post.id))} className="font-medium text-muted hover:text-ink">
          💬 {post.commentCount}
        </button>
        {post.kind === 'card' && post.consultationId && (
          <span className="ml-auto"><ShareButton consultationId={post.consultationId} variant="ghost" label="Compartilhar" /></span>
        )}
      </footer>
    </article>
  )
}
