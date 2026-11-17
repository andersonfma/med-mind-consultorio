import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE } from '@/lib/routes'
import { getSpaceBySlug, getMembership, listMembers, listSpacePosts } from '@/lib/spaces/queries'
import { JoinButton } from './JoinButton'
import { SpaceComposer } from './SpaceComposer'
import { SpaceAdminPanel } from './SpaceAdminPanel'

export const dynamic = 'force-dynamic'

function fmt(s: string) { return new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) }

export default async function SpacePage({ params }: { params: Promise<{ slug: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  const { slug } = await params

  const space = await getSpaceBySlug(slug)
  if (!space || !space.is_active) notFound()

  const membership = await getMembership(space.id, user.id)
  const isActive = membership?.status === 'active'
  const isAdmin = space.owner_id === user.id || (membership?.role === 'admin' && isActive)

  const members = await listMembers(space.id)
  const activeMembers = members.filter((m) => m.status === 'active')
  const pending = members.filter((m) => m.status === 'pending')

  // Space privado só abre para membros ativos / admin.
  const gated = space.visibility === 'private' && !isActive && !isAdmin

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-1 sm:p-2">
      <Link href="/spaces" className="text-xs text-muted hover:text-primary">← Comunidades</Link>

      <header className="rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{space.name}</h1>
            <p className="mt-0.5 text-xs text-muted">
              {activeMembers.length} {activeMembers.length === 1 ? 'membro' : 'membros'}
              {space.visibility === 'private' ? ' · privada' : ''}
              {space.join_policy === 'request' ? ' · entra por aceite' : space.join_policy === 'invite' ? ' · só convite' : ' · aberta'}
            </p>
          </div>
          {!isActive && <JoinButton spaceId={space.id} status={membership?.status ?? null} joinPolicy={space.join_policy} />}
          {isActive && <span className="rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">{isAdmin ? 'admin' : 'membro'}</span>}
        </div>
        {space.description && <p className="mt-3 text-sm text-muted">{space.description}</p>}
      </header>

      {isAdmin && (
        <SpaceAdminPanel spaceId={space.id} pending={pending} members={activeMembers} ownerId={space.owner_id} spaceName={space.name} initialInviteToken={space.invite_token} />
      )}

      {gated ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
          Esta comunidade é privada. Peça para entrar para ver as discussões.
        </div>
      ) : (
        <>
          {isActive && <SpaceComposer spaceId={space.id} />}
          <SpaceFeed spaceId={space.id} />
        </>
      )}
    </div>
  )
}

async function SpaceFeed({ spaceId }: { spaceId: string }) {
  const posts = await listSpacePosts(spaceId)
  if (posts.length === 0) {
    return <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">Nenhuma publicação ainda. Puxe a primeira discussão.</p>
  }
  return (
    <section className="space-y-3">
      {posts.map((p) => (
        <article key={p.id} className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-1 flex items-center gap-2 text-xs text-muted">
            <span className="font-medium text-ink">{p.author ?? 'Alguém'}</span>
            {p.kind === 'duvida' && <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">dúvida</span>}
            <span>· {fmt(p.created_at)}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-ink">{p.body}</p>
        </article>
      ))}
    </section>
  )
}
