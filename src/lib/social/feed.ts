import { displayIdentity } from './identity'
import type { ProfileSocial } from './types'

export type FeedPost = {
  id: string
  author: { id: string; handle: string | null; name: string; initials: string; avatarUrl: string | null }
  kind: 'card' | 'text'
  consultationId: string | null
  rankingSnapshot: unknown
  body: string | null
  createdAt: string
  likeCount: number
  commentCount: number
  likedByMe: boolean
}

type Row = {
  id: string; author_id: string; kind: 'card' | 'text'
  consultation_id: string | null; ranking_snapshot: unknown; body: string | null
  created_at: string; like_count: number; comment_count: number; liked_by_me: boolean
}

export function buildFeedPosts(rows: Row[], profilesById: Map<string, ProfileSocial>, _viewerId: string): FeedPost[] {
  return rows.map(r => {
    const p = profilesById.get(r.author_id)
    const id = p
      ? displayIdentity(p)
      : { name: 'Aluno', avatarUrl: null, initials: 'A' }
    return {
      id: r.id,
      author: { id: r.author_id, handle: p?.handle ?? null, name: id.name, initials: id.initials, avatarUrl: id.avatarUrl },
      kind: r.kind,
      consultationId: r.consultation_id,
      rankingSnapshot: r.ranking_snapshot,
      body: r.body,
      createdAt: r.created_at,
      likeCount: r.like_count ?? 0,
      commentCount: r.comment_count ?? 0,
      likedByMe: !!r.liked_by_me,
    }
  })
}
