export type Viewer = { viewerId: string }
export type PostAuthorCtx = {
  authorId: string
  isPrivate: boolean
  hidden: boolean
  follow: 'none' | 'pending' | 'accepted'
  blocked: boolean
}

/** Espelha a policy posts_select + social_can_see_author. A RLS é a verdade; isto é testável. */
export function canSeePost(v: Viewer, c: PostAuthorCtx): boolean {
  if (c.hidden) return false
  if (v.viewerId === c.authorId) return true
  if (c.blocked) return false
  if (!c.isPrivate) return true
  return c.follow === 'accepted'
}
