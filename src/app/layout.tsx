import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { BRAND } from '@/lib/brand'

// Direção visual "Ink × Elétrico": Space Grotesk (display) + Inter (corpo) + JetBrains Mono (números/scores).
// As variáveis usam prefixo --ff-* para NÃO colidir com os tokens --font-* do @theme (globals.css).
const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--ff-display' })
const sans = Inter({ subsets: ['latin'], variable: '--ff-sans' })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500'], variable: '--ff-mono' })

export const metadata: Metadata = {
  metadataBase: new URL('https://app.medmindedu.com.br'),
  title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description:
    'Treine o raciocínio clínico com pacientes virtuais e avaliação por IA — antes do paciente real.',
  openGraph: {
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description:
      'Treine o raciocínio clínico com pacientes virtuais e avaliação por IA — antes do paciente real.',
    siteName: BRAND.name,
    locale: 'pt_BR',
    type: 'website',
    // JPG estático (sem alpha, com width/height/type): o WhatsApp recusava a PNG
    // dinâmica. Usado em toda a app, inclusive nas páginas de destino do redirect.
    images: [{ url: '/og-ativar.jpg', width: 1200, height: 630, type: 'image/jpeg', alt: `${BRAND.name} — treine o raciocínio clínico` }],
  },
  twitter: { card: 'summary_large_image', images: ['/og-ativar.jpg'] },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: BRAND.name },
}

export const viewport: Viewport = {
  themeColor: '#070B14',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Aplica o tema salvo antes da pintura, evitando flash. Padrão: Noturno. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
