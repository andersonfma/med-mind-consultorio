'use client'
import { useState } from 'react'
import { publicCardRoute } from '@/lib/routes'

const SHARE_TEXT = 'Treinei meu raciocínio clínico no Med Mind — o simulador e a rede social dos estudantes de medicina 🧠'

/** Compartilha o LINK PÚBLICO do card (leva quem recebe ao cadastro). Web Share + fallback copiar. */
export function ShareButton({ consultationId, variant = 'solid', label = 'Compartilhar' }: { consultationId: string; variant?: 'solid' | 'ghost'; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function share() {
    const url = `${window.location.origin}${publicCardRoute(consultationId)}`
    const nav = navigator as Navigator & { share?: (d: unknown) => Promise<void> }
    if (nav.share) {
      try { await nav.share({ title: 'Med Mind', text: SHARE_TEXT, url }); return } catch { /* cancelou ou falhou → fallback */ }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch {
      window.open(url, '_blank', 'noopener')
    }
  }

  const cls = variant === 'solid'
    ? 'flex w-full items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10'
    : 'inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-primary'

  return (
    <button onClick={share} className={cls}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
        <line x1="8.6" y1="10.5" x2="15.4" y2="6.5" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
      </svg>
      {copied ? 'Link copiado!' : label}
    </button>
  )
}
