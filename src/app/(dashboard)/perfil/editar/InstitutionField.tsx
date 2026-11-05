'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function InstitutionField({ current }: { current: string | null }) {
  const router = useRouter()
  const [name, setName] = useState<string | null>(current)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function join(unlink = false) {
    if (busy) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/institution/join', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: unlink ? '' : code }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(j.error ?? 'Erro'); return }
      if (unlink) { setName(null); setCode(''); setMsg('Você saiu da turma.') }
      else { setName(j.institution?.name ?? null); setCode(''); setMsg(`Vinculado a ${j.institution?.name}.`) }
      router.refresh()
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-sm font-medium text-ink">Minha faculdade / turma</p>
      {name ? (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-sm text-primary">✓ {name}</span>
          <button onClick={() => join(true)} disabled={busy} className="text-xs text-muted hover:text-danger">Sair</button>
        </div>
      ) : (
        <>
          <p className="mt-0.5 text-xs text-muted">Tem um código de convite da sua turma? Vincule para o coordenador acompanhar.</p>
          <div className="mt-2 flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CÓDIGO"
              className="flex-1 rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
            <button onClick={() => join(false)} disabled={busy || !code.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-ink disabled:opacity-50">
              {busy ? '…' : 'Entrar'}
            </button>
          </div>
        </>
      )}
      {msg && <p className="mt-1.5 text-xs text-muted">{msg}</p>}
    </div>
  )
}
