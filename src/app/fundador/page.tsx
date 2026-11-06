import type { Metadata } from 'next'
import Link from 'next/link'
import { MedMindMark } from '@/components/layout/MedMindMark'

// Destino do card de link da campanha de fundadores (WhatsApp e redes).
// Precisa responder 200 com as tags do card: um redirect no servidor faria o
// scraper ler as tags de /register. Quem abre no navegador segue na hora pelo
// script abaixo, que scrapers não executam; o botão cobre quem está sem JavaScript.
// A imagem do card é o arquivo opengraph-image.jpg desta pasta.

const TITLE = 'Seja um dos fundadores da comunidade médica do Brasil'
const DESCRIPTION = 'Complete 5 consultas e participe do desafio da semana em 5 dias. Grátis para começar.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: 'Med Mind', locale: 'pt_BR', type: 'website' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
}

export default function FundadorPage() {
  return (
    <main className="min-h-screen bg-background">
      <script dangerouslySetInnerHTML={{ __html: "location.replace('/register')" }} />
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-5 py-10 text-center">
        <div className="flex items-center gap-3">
          <MedMindMark className="h-12 w-12 rounded-xl shadow-[var(--shadow-glow-primary)]" />
          <span className="font-display text-2xl font-bold tracking-tight text-ink">Med<span className="text-primary">Mind</span></span>
        </div>

        <h1 className="font-display text-2xl font-bold text-ink text-balance">
          Os 50 primeiros usuários ativos ganham 1 ano de Premium grátis.
        </h1>

        <Link href="/register" className="w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-ink shadow-[var(--shadow-glow-primary)] transition-colors hover:bg-primary-hover">
          Garantir minha vaga
        </Link>
      </div>
    </main>
  )
}
