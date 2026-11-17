import { redirect } from 'next/navigation'
import Link from 'next/link'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MedMindMark } from '@/components/layout/MedMindMark'
import { BRAND } from '@/lib/brand'

export const dynamic = 'force-dynamic'

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()
  const { data: spaceRow } = await admin.from('spaces').select('slug, name, description, is_active').eq('invite_token', token).maybeSingle()
  const space = spaceRow as { slug: string; name: string; description: string | null; is_active: boolean } | null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Logado + convite válido: entra na hora e vai para o space.
  if (user && space?.is_active) {
    const db = supabase as unknown as SupabaseClient
    const { data } = await db.rpc('join_space_via_invite', { p_token: token })
    const res = data as { ok?: boolean; slug?: string } | null
    if (res?.ok && res.slug) redirect(`/s/${res.slug}`)
  }

  const next = `/convite/${token}`
  const invalid = !space || !space.is_active

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="flex items-center gap-3">
        <MedMindMark className="h-12 w-12 rounded-xl shadow-[var(--shadow-glow-primary)]" />
        <span className="font-display text-2xl font-bold text-ink">{BRAND.prefix}<span className="text-primary">{BRAND.suffix}</span></span>
      </div>

      {invalid ? (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h1 className="font-display text-xl font-bold text-ink">Convite inválido</h1>
          <p className="mt-2 text-sm text-muted">Este link de convite expirou ou não existe mais. Peça um novo ao administrador da comunidade.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Você foi convidado(a) para</p>
          <h1 className="mt-1.5 font-display text-2xl font-bold text-ink">{space!.name}</h1>
          {space!.description && <p className="mt-2 text-sm text-muted">{space!.description}</p>}
          <p className="mt-4 text-sm text-ink">Crie sua conta (ou entre) para participar — leva um minuto e é grátis.</p>
          <div className="mt-5 flex flex-col gap-2">
            <Link href={`/register?next=${encodeURIComponent(next)}`} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-ink hover:opacity-90">Criar conta e entrar</Link>
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-sm text-muted hover:text-primary">Já tenho conta — entrar</Link>
          </div>
        </div>
      )}
    </main>
  )
}
