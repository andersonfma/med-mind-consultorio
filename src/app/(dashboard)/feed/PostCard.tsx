'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { postRoute, profileRoute, shareCardRoute } from '@/lib/routes'
import { relativeTime } from '@/lib/social/time'
import type { FeedPost } from '@/lib/social/feed'

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

      {post.kind === 'card' && post.consultationId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shareCardRoute(post.consultationId)} alt="Card do resultado" className="mb-3 block h-auto w-full max-w-full rounded-lg border border-border" />
      )}
      {post.body && <p className="mb-3 whitespace-pre-wrap text-sm text-ink">{post.body}</p>}

      <footer className="flex items-center gap-4 text-sm">
        <button onClick={toggleLike} disabled={busy} className={`font-medium ${liked ? 'text-primary' : 'text-muted hover:text-ink'}`}>
          ♥ {count}
        </button>
        <button onClick={() => router.push(postRoute(post.id))} className="font-medium text-muted hover:text-ink">
          💬 {post.commentCount}
        </button>
      </footer>
    </article>
  )
}
