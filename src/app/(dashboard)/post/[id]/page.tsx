import { notFound, redirect } from 'next/navigation'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LOGIN_ROUTE, shareCardRoute } from '@/lib/routes'
import { displayIdentity } from '@/lib/social/identity'
import type { ProfileSocial } from '@/lib/social/types'
import { CommentComposer } from './CommentComposer'
import { ReportMenu } from './ReportMenu'

export const dynamic = 'force-dynamic'

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  const db = supabase as unknown as SupabaseClient

  // RLS garante que só carrega se visível
  const { data: post } = await db.from('posts').select('*').eq('id', id).single()
  const p = post as { id: string; author_id: string; kind: 'card' | 'text'; consultation_id: string | null; body: string | null } | null
  if (!p) notFound()

  const admin = createAdminClient()
  const { data: authorRow } = await admin.from('profiles').select('id, identity_mode, handle, display_name, avatar_url, bio, is_private, leaderboard_alias, full_name').eq('id', p.author_id).single()
  const authorId = displayIdentity(authorRow as ProfileSocial)

  const { data: rawComments } = await db.from('comments').select('id, author_id, body, created_at').eq('post_id', id).is('hidden_at', null).order('created_at', { ascending: true })
  const comments = (rawComments ?? []) as Array<{ id: string; author_id: string; body: string; created_at: string }>
  const commenterIds = [...new Set(comments.map(c => c.author_id))]
  const { data: commenters } = await admin.from('profiles').select('id, identity_mode, handle, display_name, avatar_url, leaderboard_alias, full_name').in('id', commenterIds.length ? commenterIds : ['_'])
  const byId = new Map((commenters as ProfileSocial[] ?? []).map(c => [c.id, c]))

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <article className="rounded-xl border border-border bg-surface p-4">
        <header className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">{authorId.name}</span>
          <ReportMenu targetType="post" targetId={p.id} />
        </header>
        {p.kind === 'card' && p.consultation_id && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shareCardRoute(p.consultation_id)} alt="" className="mb-3 w-full rounded-lg border border-border" />
        )}
        {p.body && <p className="whitespace-pre-wrap text-sm text-ink">{p.body}</p>}
      </article>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">Comentários</h2>
        {comments.map(c => {
          const idc = byId.get(c.author_id)
          const name = idc ? displayIdentity(idc).name : 'Aluno'
          return (
            <div key={c.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-ink">{name}</span>
                <ReportMenu targetType="comment" targetId={c.id} />
              </div>
              <p className="whitespace-pre-wrap text-sm text-ink">{c.body}</p>
            </div>
          )
        })}
        <CommentComposer postId={p.id} />
      </section>
    </div>
  )
}
