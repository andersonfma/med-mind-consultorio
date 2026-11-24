'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Area = { key: string; label: string }
type Row = { area: string; topic: string; n: number }

export function CreateExamForm({ institutionId, areas, specialties }: { institutionId: string; areas: Area[]; specialties: Area[] }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [exam, setExam] = useState<'enare' | 'enamed'>('enare')
  const [track, setTrack] = useState<'acesso-direto' | 'pre-requisito'>('acesso-direto')
  const [mode, setMode] = useState<'random' | 'blueprint'>('random')
  const [total, setTotal] = useState(20)
  const [rows, setRows] = useState<Row[]>([{ area: areas[0].key, topic: '', n: 5 }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const preReq = exam === 'enare' && track === 'pre-requisito'
  const activeAreas = preReq ? specialties : areas
  const blueprintTotal = useMemo(() => rows.reduce((s, r) => s + (Number(r.n) || 0), 0), [rows])

  function resetRows(list: Area[]) { setRows([{ area: list[0].key, topic: '', n: 5 }]) }
  function pickExam(k: 'enare' | 'enamed') {
    setExam(k)
    if (k !== 'enare') { setTrack('acesso-direto'); resetRows(areas) }
  }
  function pickTrack(t: 'acesso-direto' | 'pre-requisito') {
    setTrack(t); resetRows(t === 'pre-requisito' ? specialties : areas)
  }
  function setRow(i: number, patch: Partial<Row>) { setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r))) }
  function addRow() { setRows((rs) => [...rs, { area: activeAreas[0].key, topic: '', n: 3 }]) }
  function delRow(i: number) { setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs)) }

  async function submit() {
    if (busy) return
    setBusy(true); setError(null)
    const spec = mode === 'blueprint'
      ? { rows: rows.filter((r) => r.area && Number(r.n) > 0).map((r) => ({ area: r.area, topic: r.topic.trim() || undefined, n: Number(r.n) })) }
      : { total: Number(total) }
    try {
      const res = await fetch('/api/faculty/exams', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId, title, exam, track, mode, spec }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? 'Erro ao criar a prova'); return }
      router.push(`/faculdade/${institutionId}/provas/${j.id}`)
    } catch { setError('Erro de conexão.') } finally { setBusy(false) }
  }

  const btn = (active: boolean) =>
    `flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-surface text-ink hover:border-border-strong'}`

  return (
    <div className="space-y-5">
      <div>
        <label className="text-sm font-medium text-ink">Título da prova</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
          placeholder="Ex.: Simulado 1 — Clínica Médica"
          className="mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none" />
      </div>

      <div>
        <p className="text-sm font-medium text-ink">Exame</p>
        <div className="mt-2 flex gap-2">
          <button onClick={() => pickExam('enare')} className={btn(exam === 'enare')}>ENARE (5 alt.)</button>
          <button onClick={() => pickExam('enamed')} className={btn(exam === 'enamed')}>ENAMED (4 alt.)</button>
        </div>
      </div>

      {exam === 'enare' && (
        <div>
          <p className="text-sm font-medium text-ink">Trilha</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => pickTrack('acesso-direto')} className={btn(track === 'acesso-direto')}>Acesso direto (R1)</button>
            <button onClick={() => pickTrack('pre-requisito')} className={btn(track === 'pre-requisito')}>Pré-requisito (R3+)</button>
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-ink">Como montar as questões</p>
        <div className="mt-2 flex gap-2">
          <button onClick={() => setMode('random')} className={btn(mode === 'random')}>IA aleatória</button>
          <button onClick={() => setMode('blueprint')} className={btn(mode === 'blueprint')}>Dirigida por temas</button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted">{mode === 'random' ? 'A IA distribui as questões pelas áreas automaticamente.' : 'Você define as áreas/temas e quantas questões de cada.'}</p>
      </div>

      {mode === 'random' ? (
        <div>
          <label className="text-sm font-medium text-ink">Total de questões</label>
          <input type="number" min={1} max={50} value={total} onChange={(e) => setTotal(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className="mt-1.5 w-32 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-ink focus:border-primary focus:outline-none" />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-ink">Áreas e temas</p>
            <span className="text-xs text-muted">Total: <b className="text-ink">{blueprintTotal}</b> questões</span>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <select value={r.area} onChange={(e) => setRow(i, { area: e.target.value })}
                className="w-40 shrink-0 rounded-lg border border-border bg-surface px-2.5 py-2 text-sm text-ink focus:border-primary focus:outline-none">
                {activeAreas.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
              <input value={r.topic} onChange={(e) => setRow(i, { topic: e.target.value })} placeholder="Tema/doença (opcional)"
                className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none" />
              <input type="number" min={1} max={30} value={r.n} onChange={(e) => setRow(i, { n: Math.max(1, Math.min(30, Number(e.target.value) || 1)) })}
                className="w-16 shrink-0 rounded-lg border border-border bg-surface px-2.5 py-2 text-center text-sm text-ink focus:border-primary focus:outline-none" />
              <button onClick={() => delRow(i)} aria-label="Remover" className="shrink-0 rounded-lg px-2 py-2 text-muted hover:text-danger">✕</button>
            </div>
          ))}
          <button onClick={addRow} className="text-sm font-medium text-primary hover:underline">+ Adicionar área/tema</button>
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface-2/40 px-4 py-3 text-xs text-muted">
        A geração roda em segundo plano e pode levar alguns minutos (cada questão é validada e tem o gabarito verificado). Você acompanha o progresso na próxima tela.
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      <button onClick={submit} disabled={busy || (mode === 'blueprint' && blueprintTotal === 0)}
        className="btn-electric w-full rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-60">
        {busy ? 'Criando…' : 'Criar e gerar prova'}
      </button>
    </div>
  )
}
