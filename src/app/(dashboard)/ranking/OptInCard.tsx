'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function OptInCard({
  initialOptin,
  initialAlias,
}: {
  initialOptin: boolean
  initialAlias: string
}) {
  const router = useRouter()
  const [optin, setOptin] = useState(initialOptin)
  const [alias, setAlias] = useState(initialAlias)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function save(nextOptin: boolean, nextAlias: string) {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/profile/leaderboard', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optin: nextOptin, alias: nextAlias }),
      })
      if (!res.ok) throw new Error()
      setMsg('Preferências salvas.')
      router.refresh()
    } catch {
      setMsg('Não foi possível salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">Aparecer no ranking</h2>
          <p className="mt-0.5 text-xs text-muted">
            Com o opt-in desligado você continua pontuando, mas aparece como{' '}
            <span className="font-medium">Anônimo</span> para os demais.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={optin}
          disabled={saving}
          onClick={() => {
            const next = !optin
            setOptin(next)
            void save(next, alias)
          }}
          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            optin ? 'bg-primary' : 'bg-surface-2'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              optin ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {optin && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="text-xs font-medium text-muted">Apelido no ranking (opcional)</span>
            <input
              value={alias}
              onChange={e => setAlias(e.target.value.slice(0, 40))}
              maxLength={40}
              placeholder="Como você quer aparecer"
              className="mt-1 w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(optin, alias)}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar apelido'}
          </button>
        </div>
      )}

      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
    </section>
  )
}
