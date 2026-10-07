'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Init = { identity_mode: 'real' | 'alias'; handle: string; display_name: string; bio: string; is_private: boolean; avatar_url: string | null }

export function EditProfileForm({ initial }: { initial: Init }) {
  const router = useRouter()
  const [f, setF] = useState(initial)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function uploadAvatar(file: File) {
    const res = await fetch('/api/profile/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentType: file.type }) })
    if (!res.ok) { setMsg('Falha ao preparar upload da foto.'); return }
    const { uploadUrl, publicUrl } = await res.json()
    const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
    if (!put.ok) { setMsg('Falha ao enviar a foto.'); return }
    setF(s => ({ ...s, avatar_url: publicUrl }))
  }

  async function save() {
    if (busy) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity_mode: f.identity_mode, handle: f.handle, display_name: f.display_name, bio: f.bio, is_private: f.is_private }) })
      if (res.status === 409) { setMsg('Esse @handle já está em uso.'); return }
      if (res.status === 422) { setMsg('Handle inválido (3-30, só letras minúsculas, números, _ e .).'); return }
      if (!res.ok) { setMsg('Não foi possível salvar.'); return }
      setMsg('Perfil salvo.'); router.refresh()
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['alias', 'real'] as const).map(m => (
          <button key={m} onClick={() => setF(s => ({ ...s, identity_mode: m }))} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${f.identity_mode === m ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted'}`}>
            {m === 'alias' ? 'Apelido (privado)' : 'Nome + foto'}
          </button>
        ))}
      </div>

      {f.identity_mode === 'real' && (
        <>
          <label className="block">
            <span className="text-xs font-medium text-muted">Nome exibido</span>
            <input value={f.display_name} onChange={e => setF(s => ({ ...s, display_name: e.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted">Foto</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const file = e.target.files?.[0]; if (file) void uploadAvatar(file) }} className="mt-1 block w-full text-xs text-muted" />
            {f.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.avatar_url} alt="" className="mt-2 h-16 w-16 rounded-full object-cover" />
            )}
          </label>
        </>
      )}

      <label className="block">
        <span className="text-xs font-medium text-muted">@handle (link do seu perfil)</span>
        <input value={f.handle} onChange={e => setF(s => ({ ...s, handle: e.target.value.toLowerCase() }))} maxLength={30} className="mt-1 w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-muted">Bio</span>
        <textarea value={f.bio} onChange={e => setF(s => ({ ...s, bio: e.target.value }))} maxLength={280} rows={3} className="mt-1 w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
      </label>
      <label className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
        <span className="text-sm text-ink">Perfil privado (aprovo quem me segue)</span>
        <input type="checkbox" checked={f.is_private} onChange={e => setF(s => ({ ...s, is_private: e.target.checked }))} />
      </label>

      <button onClick={save} disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-ink disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar'}</button>
      {msg && <p className="text-xs text-muted">{msg}</p>}
    </div>
  )
}
