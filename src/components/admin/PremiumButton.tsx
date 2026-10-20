'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function PremiumButton({ userId, premium }: { userId: string; premium: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (busy || pending) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: premium ? 'unpremium' : 'premium' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Erro'); return }
      startTransition(() => router.refresh())
    } catch {
      setError('Erro de conexão')
    } finally {
      setBusy(false)
    }
  }

  const tone = premium
    ? 'border border-border bg-surface-2 text-ink hover:bg-surface'
    : 'border border-[#E7B23A]/50 bg-[#E7B23A]/10 text-[#E7B23A] hover:bg-[#E7B23A]/20'

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button onClick={toggle} disabled={busy || pending} className={`rounded-md px-4 py-2 text-sm font-semibold ${tone} transition-colors disabled:opacity-50`}>
        {busy || pending ? '…' : premium ? 'Remover premium' : 'Tornar premium'}
      </button>
      {error && <span className="text-[10px] text-danger">{error}</span>}
    </span>
  )
}
