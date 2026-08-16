import type { Metadata } from 'next'
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

// Direção visual "Ink × Elétrico": Space Grotesk (display) + Inter (corpo) + JetBrains Mono (números/scores).
// As variáveis usam prefixo --ff-* para NÃO colidir com os tokens --font-* do @theme (globals.css).
const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--ff-display' })
const sans = Inter({ subsets: ['latin'], variable: '--ff-sans' })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500'], variable: '--ff-mono' })

export const metadata: Metadata = {
  title: 'Simulador MedMind',
  description: 'Simulador gamificado de consultório clínico',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
