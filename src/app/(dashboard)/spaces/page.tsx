import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LOGIN_ROUTE } from '@/lib/routes'
import { listSpaces } from '@/lib/spaces/queries'
import { CreateSpaceForm } from './CreateSpaceForm'

export const dynamic = 'force-dynamic'

export default async function SpacesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)

  const admin = createAdminClient()
  const { data: prof } = await admin.from('profiles').select('is_premium').eq('id', user.id).maybeSingle()
  const isPremium = !!(prof as { is_premium?: boolean } | null)?.is_premium
  const spaces = await listSpaces(user.id)
  const mine = spaces.filter((s) => s.myStatus === 'active')
  const others = spaces.filter((s) => s.myStatus !== 'active')

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-1 sm:p-2">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Comunidades</h1>
          <p className="text-sm text-muted">Tribos de estudo: dúvidas, casos e o desafio, com quem é da sua.</p>
        </div>
        <CreateSpaceForm isPremium={isPremium} />
      </header>

      {mine.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Minhas comunidades</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {mine.map((s) => <SpaceCard key={s.id} s={s} />)}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Descobrir</h2>
        {others.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-5 text-sm text-muted">Nenhuma comunidade para entrar no momento.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {others.map((s) => <SpaceCard key={s.id} s={s} />)}
          </div>
        )}
      </section>
    </div>
  )
}

function SpaceCard({ s }: { s: { slug: string; name: string; description: string | null; members: number; myStatus: string | null; visibility: string } }) {
  return (
    <Link href={`/s/${s.slug}`} className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-ink">{s.name}</p>
        {s.myStatus === 'pending' && <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">pedido enviado</span>}
        {s.myStatus === 'active' && <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">membro</span>}
        {s.visibility === 'private' && !s.myStatus && <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">privada</span>}
      </div>
      {s.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{s.description}</p>}
      <p className="mt-2 text-[11px] text-muted">{s.members} {s.members === 1 ? 'membro' : 'membros'}</p>
    </Link>
  )
}
