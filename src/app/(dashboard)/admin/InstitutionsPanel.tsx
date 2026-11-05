'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Inst = { id: string; name: string; code: string; students: number }

export function InstitutionsPanel({ institutions }: { institutions: Inst[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function create() {
    if (busy || !name.trim()) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/admin/institutions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(j.error ?? 'Erro'); return }
      setName(''); setMsg(`Criada: ${j.institution?.name} · código ${j.institution?.invite_code}`); router.refresh()
    } finally { setBusy(false) }
  }

  function copy(code: string) {
    navigator.clipboard?.writeText(code).then(() => setMsg(`Código ${code} copiado.`)).catch(() => {})
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da faculdade / turma"
          className="flex-1 rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
        <button onClick={create} disabled={busy || !name.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-ink disabled:opacity-50">
          {busy ? '…' : 'Criar'}
        </button>
      </div>
      {msg && <p className="text-xs text-muted">{msg}</p>}

      {institutions.length === 0 ? (
        <p className="text-xs text-muted">Nenhuma instituição ainda. Crie uma e envie o código para a turma.</p>
      ) : (
        <ul className="divide-y divide-border">
          {institutions.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{i.name}</p>
                <p className="text-xs text-muted">{i.students} aluno{i.students === 1 ? '' : 's'} vinculado{i.students === 1 ? '' : 's'}</p>
              </div>
              <button onClick={() => copy(i.code)}
                className="shrink-0 rounded-md border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs font-semibold tracking-wider text-primary hover:border-primary/40"
                title="Copiar código de convite">
                {i.code} ⧉
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
