'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BRAND } from '@/lib/brand'

type Member = { user_id: string; role: string; status: string; name: string | null }

export function SpaceAdminPanel({ spaceId, pending, members, ownerId, spaceName, initialInviteToken }: {
  spaceId: string; pending: Member[]; members: Member[]; ownerId: string; spaceName: string; initialInviteToken: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // Convites
  const [token, setToken] = useState<string | null>(initialInviteToken)
  const [copied, setCopied] = useState(false)
  const [emails, setEmails] = useState('')
  const [inviteMsg, setInviteMsg] = useState<string | null>(null)
  const link = token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/convite/${token}` : null
  const waText = link ? `Entre no Space ${spaceName} no ${BRAND.name}: ${link}` : ''
  const waUrl = `https://wa.me/?text=${encodeURIComponent(waText)}`

  async function invite(action: 'link' | 'emails' | 'regen') {
    if (busy) return
    setBusy('invite-' + action); setInviteMsg(null)
    try {
      const body = action === 'emails'
        ? { action: 'emails', emails: emails.split(/[\s,;]+/).filter(Boolean) }
        : { action: 'link', regenerate: action === 'regen' }
      const res = await fetch(`/api/spaces/${spaceId}/invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setInviteMsg(j.error ?? 'Erro'); return }
      if (j.token) setToken(j.token)
      if (action === 'emails') { setInviteMsg(`Convites enviados: ${j.sent}${j.failed ? ` · falhas: ${j.failed}` : ''}.`); setEmails('') }
    } finally { setBusy(null) }
  }

  function copyLink() {
    if (!link) return
    navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }

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

      {/* Convites */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Convidar</p>
        {!link ? (
          <button onClick={() => invite('link')} disabled={!!busy} className={`${btn} border border-primary/40 bg-primary/10 text-primary`}>
            {busy === 'invite-link' ? 'Gerando…' : 'Gerar link de convite'}
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input readOnly value={link} onFocus={(e) => e.currentTarget.select()}
                className="flex-1 rounded-md border border-border bg-surface-2/40 px-2.5 py-1.5 text-xs text-ink outline-none" />
              <button onClick={copyLink} className={`${btn} border border-border text-muted shrink-0`}>{copied ? 'Copiado' : 'Copiar'}</button>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={waUrl} target="_blank" rel="noopener noreferrer" className={`${btn} border border-success/40 bg-success/10 text-success`}>Compartilhar no WhatsApp</a>
              <button onClick={() => invite('regen')} disabled={!!busy} className={`${btn} border border-border text-muted`}>{busy === 'invite-regen' ? '…' : 'Gerar novo link'}</button>
            </div>
            <p className="text-[11px] text-muted">Quem abrir o link entra direto — e, se ainda não tiver conta, é levado ao cadastro e cai já dentro do Space.</p>
            <div className="pt-1">
              <p className="mb-1 text-[11px] text-muted">Convidar por e-mail (um por linha ou separados por vírgula):</p>
              <textarea value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="especialista@exemplo.com"
                className="min-h-[56px] w-full resize-y rounded-md border border-border bg-surface-2/40 px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary" />
              <div className="mt-1.5 flex items-center justify-between gap-2">
                {inviteMsg ? <p className="text-xs text-ink">{inviteMsg}</p> : <span />}
                <button onClick={() => invite('emails')} disabled={!!busy || !emails.trim()} className={`${btn} bg-primary text-primary-ink disabled:opacity-50`}>
                  {busy === 'invite-emails' ? 'Enviando…' : 'Enviar convites'}
                </button>
              </div>
            </div>
          </div>
        )}
        {inviteMsg && !link && <p className="mt-1 text-xs text-danger">{inviteMsg}</p>}
      </div>

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
