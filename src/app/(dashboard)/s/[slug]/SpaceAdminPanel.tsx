'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Member = { user_id: string; role: string; status: string; name: string | null }

export function SpaceAdminPanel({ spaceId, pending, members, ownerId }: {
  spaceId: string; pending: Member[]; members: Member[]; ownerId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function act(action: string, userId: string, role?: string) {
    if (busy) return
    setBusy(userId + action); setErr(null)
    try {
      const res = await fetch(`/api/spaces/${spaceId}/members`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId, role }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(j.error ?? 'Erro'); return }
      startTransition(() => router.refresh())
    } finally { setBusy(null) }
  }

  const btn = 'rounded-md px-2.5 py-1 text-xs font-semibold disabled:opacity-50'

  return (
    <section className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-4">
      <h2 className="text-sm font-semibold text-ink">Administração</h2>
      {err && <p className="text-xs text-danger">{err}</p>}

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Pedidos pendentes {pending.length > 0 && `(${pending.length})`}</p>
        {pending.length === 0 ? (
          <p className="text-xs text-muted">Nenhum pedido no momento.</p>
        ) : (
          <ul className="space-y-1.5">
            {pending.map((m) => (
              <li key={m.user_id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink">{m.name ?? 'Alguém'}</span>
                <span className="flex gap-1.5">
                  <button onClick={() => act('approve', m.user_id)} disabled={!!busy} className={`${btn} border border-success/40 bg-success/10 text-success`}>Aceitar</button>
                  <button onClick={() => act('remove', m.user_id)} disabled={!!busy} className={`${btn} border border-border text-muted`}>Recusar</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Membros ({members.length})</p>
        <ul className="space-y-1.5">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-ink">
                {m.name ?? 'Alguém'}
                {m.user_id === ownerId && <span className="ml-2 text-[10px] text-muted">dono</span>}
                {m.role === 'admin' && m.user_id !== ownerId && <span className="ml-2 rounded border border-border px-1 py-0.5 text-[10px] text-muted">admin</span>}
              </span>
              {m.user_id !== ownerId && (
                <span className="flex gap-1.5">
                  {m.role !== 'admin' && <button onClick={() => act('role', m.user_id, 'admin')} disabled={!!busy} className={`${btn} border border-border text-muted`} title="Requer Premium">Tornar admin</button>}
                  <button onClick={() => act('remove', m.user_id)} disabled={!!busy} className={`${btn} border border-danger/40 bg-danger/10 text-danger`}>Remover</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
