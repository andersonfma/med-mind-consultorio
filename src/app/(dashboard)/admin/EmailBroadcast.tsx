'use client'
import { useState } from 'react'

export function EmailBroadcast({ totalUsers }: { totalUsers: number }) {
  const [busy, setBusy] = useState<null | 'test' | 'broadcast'>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function run(mode: 'test' | 'broadcast') {
    if (busy) return
    if (mode === 'broadcast' && !confirm(`Enviar o email explicativo para TODOS os usuários (${totalUsers})? Não dá pra desfazer.`)) return
    setBusy(mode); setMsg(null)
    try {
      const res = await fetch('/api/admin/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(`Erro: ${j.error ?? res.status}`); return }
      setMsg(mode === 'test'
        ? (j.ok ? 'Email de teste enviado para você. Confira seu inbox.' : `Falha: ${j.error}`)
        : `Enviados: ${j.sent} · falhas: ${j.failed} · pulados (opt-out/sem email): ${j.skipped} de ${j.total}.`)
    } catch {
      setMsg('Erro de conexão.')
    } finally { setBusy(null) }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">Email explicativo (como funciona + a aposta). Envie um teste pra você primeiro; depois dispare para todos. Respeita opt-out.</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => run('test')} disabled={!!busy}
          className="rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface disabled:opacity-50">
          {busy === 'test' ? 'Enviando…' : 'Enviar teste pra mim'}
        </button>
        <button onClick={() => run('broadcast')} disabled={!!busy}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-ink shadow-[var(--shadow-glow-primary)] transition-colors hover:bg-primary-hover disabled:opacity-50">
          {busy === 'broadcast' ? 'Enviando…' : `Enviar para todos (${totalUsers})`}
        </button>
      </div>
      {msg && <p className="text-xs text-ink">{msg}</p>}
    </div>
  )
}
