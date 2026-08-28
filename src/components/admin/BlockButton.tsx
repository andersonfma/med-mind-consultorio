'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function BlockButton({
  userId,
  blocked,
  variant = 'sm',
}: {
  userId: string
  blocked: boolean
  variant?: 'sm' | 'md'
}) {
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
        body: JSON.stringify({ action: blocked ? 'unblock' : 'block' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Erro')
        return
      }
      startTransition(() => router.refresh())
    } catch {
      setError('Erro de conexão')
    } finally {
      setBusy(false)
    }
  }

  const base =
    variant === 'md'
      ? 'rounded-md px-4 py-2 text-sm font-semibold'
      : 'rounded-md px-2.5 py-1 text-xs font-semibold'
  const tone = blocked
    ? 'border border-border bg-surface-2 text-ink hover:bg-surface'
    : 'border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20'

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button onClick={toggle} disabled={busy || pending} className={`${base} ${tone} transition-colors disabled:opacity-50`}>
        {busy || pending ? '…' : blocked ? 'Desbloquear' : 'Bloquear'}
      </button>
      {error && <span className="text-[10px] text-danger">{error}</span>}
    </span>
  )
}
