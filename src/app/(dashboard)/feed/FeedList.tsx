'use client'
import type { FeedPost } from '@/lib/social/feed'
import { PostCard } from './PostCard'

export function FeedList({ posts }: { posts: FeedPost[] }) {
  if (posts.length === 0) {
    return <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-muted">Seu feed está vazio. Siga colegas ou publique um resultado em &quot;Meus resultados&quot;.</p>
  }
  return <div className="space-y-4">{posts.map(p => <PostCard key={p.id} post={p} />)}</div>
}
