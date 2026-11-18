'use client'
import { useEffect } from 'react'

// Redireciona o HUMANO (JS roda). O scraper do WhatsApp NÃO roda JS, então fica
// na página 200 e lê o card de Open Graph (logo). Quem está sem JS usa o botão.
export function RedirectClient({ to }: { to: string }) {
  useEffect(() => { window.location.replace(to) }, [to])
  return null
}
