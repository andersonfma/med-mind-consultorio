'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export type FounderCode = {
  code: string
  label: string | null
  active: boolean
  uses: number
  max_uses: number | null
  grant_days: number
  redeemed: number // resgates reais (founder_redemptions)
}

export function FounderCodesPanel({ codes }: { codes: FounderCode[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggle(code: string, active: boolean) {
    if (busy) return
    setBusy(code); setError(null)
    try {
      const res = await fetch('/api/admin/founder-codes', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, active: !active }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? 'Erro'); return }
      startTransition(() => router.refresh())
    } catch {
      setError('Erro de conexão')
    } finally { setBusy(null) }
  }

  if (codes.length === 0) return <p className="text-xs text-muted">Nenhum cupom de fundador cadastrado.</p>

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-3 py-2 font-medium">Cupom</th>
              <th className="px-3 py-2 font-medium">Origem</th>
              <th className="px-3 py-2 text-right font-medium">Usos</th>
              <th className="px-3 py-2 text-right font-medium">Validade</th>
              <th className="px-3 py-2 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.code} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2.5 font-mono text-xs font-semibold text-primary">{c.code}</td>
                <td className="px-3 py-2.5 text-xs text-muted">{c.label ?? '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                  {c.redeemed}{c.max_uses != null ? <span className="text-muted">/{c.max_uses}</span> : <span className="text-muted"> / ∞</span>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted">{c.grant_days}d</td>
                <td className="px-3 py-2.5 text-right">
                  <button onClick={() => toggle(c.code, c.active)} disabled={busy === c.code || pending}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${c.active ? 'border border-success/40 bg-success/10 text-success hover:bg-success/20' : 'border border-border bg-surface-2 text-muted hover:bg-surface'}`}>
                    {busy === c.code ? '…' : c.active ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted">Clique no status para alternar. Desativar bloqueia novos resgates — quem já resgatou mantém o Premium até vencer.</p>
    </div>
  )
}
