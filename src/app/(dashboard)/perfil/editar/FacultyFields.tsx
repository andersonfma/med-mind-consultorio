'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FACULTIES } from '@/lib/faculties'

type Init = { user_type: 'student' | 'doctor' | null; faculty: string | null; faculty_period: string | null }

export function FacultyFields({ initial }: { initial: Init }) {
  const router = useRouter()
  const [userType, setUserType] = useState<'student' | 'doctor'>(initial.user_type ?? 'student')
  const [faculty, setFaculty] = useState(initial.faculty ?? '')
  const [period, setPeriod] = useState(initial.faculty_period ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const input = 'mt-1 w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-ink outline-none focus:border-primary'

  async function save() {
    if (busy) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_type: userType, faculty, faculty_period: period }),
      })
      setMsg(res.ok ? 'Salvo.' : 'Não foi possível salvar.')
      if (res.ok) router.refresh()
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3 space-y-2.5">
      <p className="text-sm font-medium text-ink">Formação</p>
      <div className="flex gap-2">
        {(['student', 'doctor'] as const).map((t) => (
          <button key={t} onClick={() => setUserType(t)}
            className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold ${userType === t ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted'}`}>
            {t === 'student' ? 'Estudante' : 'Médico(a)'}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="text-xs font-medium text-muted">{userType === 'doctor' ? 'Onde se formou' : 'Faculdade'}</span>
        <input list="faculties-edit" value={faculty} onChange={(e) => setFaculty(e.target.value)} autoComplete="off" placeholder="Comece a digitar…" className={input} />
        <datalist id="faculties-edit">{FACULTIES.map((f) => <option key={f} value={f} />)}</datalist>
      </label>
      <label className="block">
        <span className="text-xs font-medium text-muted">{userType === 'doctor' ? 'Ano de formação' : 'Período / ano'}</span>
        <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder={userType === 'doctor' ? 'ex.: 2020' : 'ex.: 5º período'} className={input} />
      </label>
      <button onClick={save} disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-ink disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar formação'}</button>
      {msg && <p className="text-xs text-muted">{msg}</p>}
    </div>
  )
}
