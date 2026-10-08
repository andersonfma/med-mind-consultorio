import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { shareCardRoute } from '@/lib/routes'
import { MedMindMark } from '@/components/layout/MedMindMark'

export const dynamic = 'force-dynamic'

const HEADLINE = 'Med Mind: treine e conecte-se.'
const SUBTEXT = 'O simulador clínico e a rede social dos estudantes de medicina do Brasil.'

async function findFinished(consultationId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin.from('consultations').select('id, status').eq('id', consultationId).maybeSingle()
  const row = data as { id?: string; status?: string } | null
  return !!row?.id && row.status === 'finished'
}

export async function generateMetadata({ params }: { params: Promise<{ consultationId: string }> }): Promise<Metadata> {
  const { consultationId } = await params
  const img = shareCardRoute(consultationId)
  return {
    title: HEADLINE,
    description: SUBTEXT,
    openGraph: { title: HEADLINE, description: SUBTEXT, images: [{ url: img, width: 1200, height: 630 }], type: 'website' },
    twitter: { card: 'summary_large_image', title: HEADLINE, description: SUBTEXT, images: [img] },
  }
}

export default async function PublicCardPage({ params }: { params: Promise<{ consultationId: string }> }) {
  const { consultationId } = await params
  if (!(await findFinished(consultationId))) notFound()

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-5 py-10 text-center">
        <Link href="/" className="flex items-center gap-3">
          <MedMindMark className="h-12 w-12 rounded-xl shadow-[var(--shadow-glow-primary)]" />
          <span className="font-display text-2xl font-bold tracking-tight text-ink">Med<span className="text-primary">Mind</span></span>
        </Link>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shareCardRoute(consultationId)} alt="Resultado no Med Mind" className="block h-auto w-full max-w-full rounded-xl border border-border shadow-[var(--shadow-card)]" />

        <div>
          <h1 className="font-display text-2xl font-bold text-ink text-balance">{HEADLINE}</h1>
          <p className="mt-2 text-sm text-muted text-balance">{SUBTEXT}</p>
        </div>

        <div className="flex w-full flex-col gap-2">
          <Link href="/register" className="w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-ink shadow-[var(--shadow-glow-primary)] transition-colors hover:bg-primary-hover">
            Criar conta grátis
          </Link>
          <Link href="/login" className="text-xs font-medium text-muted transition-colors hover:text-ink">
            Já tenho conta
          </Link>
        </div>
      </div>
    </main>
  )
}
