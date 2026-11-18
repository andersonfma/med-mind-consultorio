import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { MedMindMark } from '@/components/layout/MedMindMark'
import { BRAND } from '@/lib/brand'
import { RedirectClient } from './RedirectClient'

export const dynamic = 'force-dynamic'

const TITLE = `Seu acesso Premium no ${BRAND.name}`
const DESCRIPTION = 'Consultas e especialidades ilimitadas, simulados ENARE/ENAMED e a rede dos estudantes de medicina. Ative seu acesso de fundador.'

// Responde 200 com as tags do card (a logo aparece no WhatsApp). O humano é
// redirecionado por JS; o scraper fica e lê o Open Graph. Botão cobre no-JS.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: BRAND.name, locale: 'pt_BR', type: 'website', images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
}

export default async function AtivarPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const c = encodeURIComponent((code || '').trim().toUpperCase().slice(0, 24))
  const dest = `/premium?code=${c}`

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const target = user ? dest : `/register?next=${encodeURIComponent(dest)}`

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <RedirectClient to={target} />
      <div className="flex items-center gap-3">
        <MedMindMark className="h-14 w-14 rounded-xl shadow-[var(--shadow-glow-primary)]" />
        <span className="font-display text-2xl font-bold text-ink">{BRAND.prefix}<span className="text-primary">{BRAND.suffix}</span></span>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Convite Premium de fundador</p>
        <h1 className="mt-1.5 font-display text-2xl font-bold text-ink">{TITLE}</h1>
        <p className="mt-2 text-sm text-muted">{DESCRIPTION}</p>
        <Link href={target} replace className="mt-5 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-ink hover:opacity-90">
          Ativar meu Premium
        </Link>
      </div>
    </main>
  )
}
