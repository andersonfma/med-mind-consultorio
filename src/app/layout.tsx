import type { Metadata } from 'next'
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

// Direção visual "Ink × Elétrico": Space Grotesk (display) + Inter (corpo) + JetBrains Mono (números/scores).
// As variáveis usam prefixo --ff-* para NÃO colidir com os tokens --font-* do @theme (globals.css).
const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--ff-display' })
const sans = Inter({ subsets: ['latin'], variable: '--ff-sans' })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500'], variable: '--ff-mono' })

export const metadata: Metadata = {
  metadataBase: new URL('https://app.medmindedu.com.br'),
  title: { default: 'Med Mind — Simulador clínico', template: '%s · Med Mind' },
  description:
    'Treine o raciocínio clínico com pacientes virtuais e avaliação por IA — antes do paciente real.',
  openGraph: {
    title: 'Med Mind — Simulador clínico',
    description:
      'Treine o raciocínio clínico com pacientes virtuais e avaliação por IA — antes do paciente real.',
    siteName: 'Med Mind',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <head>
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
