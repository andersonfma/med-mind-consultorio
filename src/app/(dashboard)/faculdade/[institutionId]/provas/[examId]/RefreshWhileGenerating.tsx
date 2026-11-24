'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Atualiza a página a cada 5s enquanto a prova está sendo gerada.
export function RefreshWhileGenerating() {
  const router = useRouter()
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 5000)
    return () => clearInterval(t)
  }, [router])
  return (
    <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-warning/30 border-t-warning" aria-hidden />
  )
}
