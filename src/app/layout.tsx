import type { Metadata } from 'next'
import { Montserrat, Inter } from 'next/font/google'
import './globals.css'

// Manual da Marca Med Mind: Montserrat (wordmark e títulos, Medium/SemiBold) + Inter (interface e textos).
// As variáveis usam prefixo --ff-* para NÃO colidir com os tokens --font-* do @theme (globals.css).
const display = Montserrat({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--ff-display' })
const sans = Inter({ subsets: ['latin'], variable: '--ff-sans' })

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
    <html lang="pt-BR" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
