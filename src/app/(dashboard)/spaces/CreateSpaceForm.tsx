'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CreateSpaceForm({ isPremium }: { isPremium: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [desc, setDesc] = useState('')
  const [policy, setPolicy] = useState<'request' | 'open' | 'invite'>('request')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const input = 'w-full rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-ink outline-none focus:border-primary'
  const autoSlug = (v: string) => v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

  if (!isPremium) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        Criar um Space é um recurso <span className="font-semibold text-ink">Premium</span>. Participar é sempre grátis.
      </div>
    )
  }

  async function create() {
    if (busy) return
    if (!name.trim() || !slug.trim()) { setMsg('Preencha nome e identificador.'); return }
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/spaces', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, description: desc, joinPolicy: policy, visibility }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(j.error ?? 'Erro'); return }
      router.push(`/s/${j.slug}`)
    } finally { setBusy(false) }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-ink hover:opacity-90">
        Criar Space
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-2.5">
      <p className="text-sm font-semibold text-ink">Novo Space</p>
      <input className={input} value={name} placeholder="Nome (ex.: Hepatoliga Unirio)" maxLength={80}
        onChange={(e) => { setName(e.target.value); if (!slug) setSlug(autoSlug(e.target.value)) }} />
      <div className="flex items-center gap-2 text-sm text-muted">
        <span>/s/</span>
        <input className={input} value={slug} placeholder="identificador" maxLength={48}
          onChange={(e) => setSlug(autoSlug(e.target.value))} />
      </div>
      <textarea className={`${input} min-h-[60px] resize-y`} value={desc} placeholder="Do que é o Space?" maxLength={300}
        onChange={(e) => setDesc(e.target.value)} />
      <div className="flex flex-wrap gap-3 text-xs">
        <label className="flex items-center gap-1.5 text-muted">Entrada:
          <select className="rounded border border-border bg-surface-2/40 px-2 py-1 text-ink" value={policy} onChange={(e) => setPolicy(e.target.value as typeof policy)}>
            <option value="request">Pedido → aceite</option>
            <option value="open">Aberta</option>
            <option value="invite">Só convite</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-muted">Visibilidade:
          <select className="rounded border border-border bg-surface-2/40 px-2 py-1 text-ink" value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)}>
            <option value="public">Pública</option>
            <option value="private">Privada</option>
          </select>
        </label>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={create} disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-ink disabled:opacity-50">{busy ? 'Criando…' : 'Criar'}</button>
        <button onClick={() => setOpen(false)} disabled={busy} className="rounded-md border border-border px-4 py-2 text-sm text-muted">Cancelar</button>
      </div>
      {msg && <p className="text-xs text-danger">{msg}</p>}
    </div>
  )
}
