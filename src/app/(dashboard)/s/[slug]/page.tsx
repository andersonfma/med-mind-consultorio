import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE } from '@/lib/routes'
import { getSpaceBySlug, getMembership, listMembers, listSpacePosts, spaceLeaderboard, spaceChallenge } from '@/lib/spaces/queries'
import { JoinButton } from './JoinButton'
import { SpaceComposer } from './SpaceComposer'
import { SpaceAdminPanel } from './SpaceAdminPanel'
import { SpacePostInteractions } from './SpacePostInteractions'

export const dynamic = 'force-dynamic'

function fmt(s: string) { return new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) }

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
  // Membros da liga visíveis aos membros = ativos SEM o dono (staff da plataforma).
  const ligaCount = activeMembers.filter((m) => m.user_id !== space.owner_id).length

  // Space privado só abre para membros ativos / admin.
  const gated = space.visibility === 'private' && !isActive && !isAdmin

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-1 sm:p-2">
      <Link href="/spaces" className="text-xs text-muted hover:text-primary">← Spaces</Link>

      <header className="rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{space.name}</h1>
            <p className="mt-0.5 text-xs text-muted">
              {ligaCount} {ligaCount === 1 ? 'membro' : 'membros'}
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
          Este Space é privado. Peça para entrar para ver as discussões.
        </div>
      ) : (
        <>
          {isActive && <SpaceComposer spaceId={space.id} />}
          <SpaceChallengeSection spaceId={space.id} userId={user.id} ownerId={space.owner_id} />
          <SpaceLeaderboardSection spaceId={space.id} userId={user.id} ownerId={space.owner_id} />
          <SpaceFeed spaceId={space.id} ownerId={space.owner_id} userId={user.id} canInteract={isActive} />
        </>
      )}
    </div>
  )
}

async function SpaceLeaderboardSection({ spaceId, userId, ownerId }: { spaceId: string; userId: string; ownerId: string }) {
  const { top, me } = await spaceLeaderboard(spaceId, userId, ownerId)
  if (top.length === 0) return null
  const medal = (r: number) => (r === 1 ? 'text-warning' : r === 2 ? 'text-muted' : r === 3 ? 'text-chart-2' : 'text-muted')
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-ink">Ranking do Space</h2>
        <span className="text-[11px] text-muted">MedCoins</span>
      </div>
      <ul className="space-y-1.5">
        {top.map((r) => (
          <li key={r.rank} className={`flex items-center justify-between gap-3 rounded-md px-2 py-1 text-sm ${r.isMe ? 'bg-primary/5' : ''}`}>
            <span className="flex items-center gap-2.5 min-w-0">
              <span className={`w-5 shrink-0 text-right font-mono text-xs font-bold tabular-nums ${medal(r.rank)}`}>{r.rank}</span>
              <span className={`truncate ${r.isMe ? 'font-semibold text-primary' : 'text-ink'}`}>{r.name}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">{r.coins}</span>
          </li>
        ))}
      </ul>
      {me && me.rank > top.length && (
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-border px-2 pt-2 text-sm">
          <span className="flex items-center gap-2.5"><span className="w-5 text-right font-mono text-xs font-bold tabular-nums text-primary">{me.rank}</span><span className="font-semibold text-primary">Você</span></span>
          <span className="font-semibold tabular-nums text-ink">{me.coins}</span>
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted">Quem não ativou o apelido no ranking aparece como “Anônimo”. Ative em Ranking.</p>
    </section>
  )
}

async function SpaceChallengeSection({ spaceId, userId, ownerId }: { spaceId: string; userId: string; ownerId: string }) {
  const d = await spaceChallenge(spaceId, ownerId, userId, Date.now())
  const pct = d.possible > 0 ? Math.round((d.spaceCorrect / d.possible) * 100) : 0
  return (
    <section className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Desafio da Semana · a liga competindo</h2>
        <Link href="/desafio" className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-ink hover:opacity-90">Responder</Link>
      </div>
      {!d.active ? (
        <p className="text-xs text-muted">Sem desafio ativo agora. Toque em Responder para ver o Caso da Semana.</p>
      ) : d.participants === 0 ? (
        <p className="text-xs text-muted">Ninguém da liga respondeu esta semana ainda. Seja o primeiro — e puxe o grupo.</p>
      ) : (
        <>
          <div className="mb-3 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tabular-nums text-ink">{d.spaceCorrect}</span>
            <span className="text-sm text-muted">acertos da liga · {d.participants} participando · {pct}% do possível ({d.daysReleased}/{d.weekTotal} dias)</span>
          </div>
          <ul className="space-y-1.5">
            {d.members.map((r) => (
              <li key={r.rank} className={`flex items-center justify-between gap-3 rounded-md px-2 py-1 text-sm ${r.isMe ? 'bg-primary/10' : ''}`}>
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="w-5 shrink-0 text-right font-mono text-xs font-bold tabular-nums text-muted">{r.rank}</span>
                  <span className={`truncate ${r.isMe ? 'font-semibold text-primary' : 'text-ink'}`}>{r.name}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted"><span className="font-semibold text-ink">{r.correct}</span> acertos{r.coins ? ` · ${r.coins > 0 ? '+' : ''}${r.coins} MC` : ''}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

async function SpaceFeed({ spaceId, ownerId, userId, canInteract }: { spaceId: string; ownerId: string; userId: string; canInteract: boolean }) {
  const posts = await listSpacePosts(spaceId, userId)
  if (posts.length === 0) {
    return <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">Nenhuma publicação ainda. Puxe a primeira discussão.</p>
  }
  return (
    <section className="space-y-3">
      {posts.map((p) => (
        <article key={p.id} className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-1 flex items-center gap-2 text-xs text-muted">
            <span className="font-medium text-ink">{p.author_id === ownerId ? 'Admin' : (p.author ?? 'Alguém')}</span>
            {p.author_id === ownerId && <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">admin</span>}
            {p.kind === 'duvida' && <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">dúvida</span>}
            <span>· {fmt(p.created_at)}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-ink">{p.body}</p>
          {canInteract && <SpacePostInteractions postId={p.id} initialReactions={p.reactions} initialMyEmoji={p.myEmoji} initialCommentCount={p.commentCount} />}
        </article>
      ))}
    </section>
  )
}
