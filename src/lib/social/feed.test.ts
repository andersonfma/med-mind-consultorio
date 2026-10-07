import { describe, it, expect } from 'vitest'
import { buildFeedPosts } from './feed'

const prof = { id: 'a', identity_mode: 'real' as const, handle: 'ana', display_name: 'Ana Silva', avatar_url: null, leaderboard_alias: null, full_name: null, is_private: false, bio: null }

describe('buildFeedPosts', () => {
  it('monta FeedPost com identidade e contadores', () => {
    const rows = [{ id: 'p1', author_id: 'a', kind: 'card' as const, consultation_id: 'c1', ranking_snapshot: null, body: 'mandei bem', created_at: '2026-10-06T10:00:00Z', like_count: 3, comment_count: 1, liked_by_me: true }]
    const out = buildFeedPosts(rows, new Map([['a', prof]]), 'me')
    expect(out[0]).toMatchObject({ id: 'p1', kind: 'card', consultationId: 'c1', likeCount: 3, commentCount: 1, likedByMe: true })
    expect(out[0]!.author).toMatchObject({ handle: 'ana', name: 'Ana Silva' })
  })
  it('autor desconhecido vira "Aluno" sem quebrar', () => {
    const rows = [{ id: 'p2', author_id: 'zzz', kind: 'text' as const, consultation_id: null, ranking_snapshot: null, body: 'dúvida', created_at: '2026-10-06T10:00:00Z', like_count: 0, comment_count: 0, liked_by_me: false }]
    const out = buildFeedPosts(rows, new Map(), 'me')
    expect(out[0]!.author.name).toBe('Aluno')
  })
})
