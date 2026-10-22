'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SPECIALTIES } from '@/lib/patients/specialties'

// Plano grátis: escolher até 2 especialidades (trocáveis). Premium libera todas.
export function FreeSpecialtiesPicker({ isPremium, initial }: { isPremium: boolean; initial: string[] }) {
  const router = useRouter()
  const [sel, setSel] = useState<string[]>(initial)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (isPremium) {
    return (
      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="text-sm font-medium" style={{ color: '#E7B23A' }}>✦ Premium · todas as 9 especialidades liberadas</p>
      </div>
    )
  }

  function toggle(s: string) {
    setSel(cur => {
      if (cur.includes(s)) return cur.filter(x => x !== s)
      if (cur.length >= 2) return cur // máx 2
      return [...cur, s]
    })
  }

  async function save() {
    if (busy) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ free_specialties: sel }),
      })
      if (!res.ok) { setMsg('Não foi possível salvar.'); return }
      setMsg('Especialidades atualizadas.'); router.refresh()
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
      <div>
        <p className="text-sm font-medium text-ink">Especialidades do plano grátis</p>
        <p className="text-xs text-muted">Escolha até 2 ({sel.length}/2). Assine o premium para liberar todas as 9.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {SPECIALTIES.map(s => {
          const on = sel.includes(s)
          const disabled = !on && sel.length >= 2
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              disabled={disabled}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                on ? 'border-primary bg-primary/10 text-primary'
                   : disabled ? 'border-border bg-surface-2 text-muted-2 opacity-50'
                   : 'border-border text-muted hover:border-border-strong hover:text-ink'
              }`}
            >
              {s}
            </button>
          )
        })}
      </div>
      <button onClick={save} disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-ink disabled:opacity-50">
        {busy ? 'Salvando…' : 'Salvar especialidades'}
      </button>
      {msg && <p className="text-xs text-muted">{msg}</p>}
    </div>
  )
}
