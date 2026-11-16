'use client'
import { useMemo, useState } from 'react'

type Busy = null | 'c-test' | 'c-send' | 'o-test' | 'o-send'
type AudiencePeriodo = { periodo: string; count: number }
type InstitutionAudience = { id: string; name: string; total: number; periodos: AudiencePeriodo[] }

export function EmailBroadcast({ totalUsers, audiences = [] }: { totalUsers: number; audiences?: InstitutionAudience[] }) {
  const [busy, setBusy] = useState<Busy>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [ctaLabel, setCtaLabel] = useState('Responder agora')
  const [ctaUrl, setCtaUrl] = useState('https://app.medmindedu.com.br/desafio')

  // Público-alvo: '' = todos; senão, uma instituição (e períodos opcionais).
  const [institutionId, setInstitutionId] = useState('')
  const [periodos, setPeriodos] = useState<string[]>([])
  const inst = audiences.find((a) => a.id === institutionId) ?? null

  const audienceCount = useMemo(() => {
    if (!inst) return totalUsers
    if (periodos.length === 0) return inst.total
    return inst.periodos.filter((p) => periodos.includes(p.periodo)).reduce((s, p) => s + p.count, 0)
  }, [inst, periodos, totalUsers])

  const audienceLabel = inst
    ? `${inst.name}${periodos.length ? ` · ${periodos.join(', ')}` : ''} (${audienceCount})`
    : `todos os alunos (${totalUsers})`

  function pickInstitution(id: string) { setInstitutionId(id); setPeriodos([]) }
  function togglePeriodo(p: string) { setPeriodos((cur) => cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]) }

  async function send(opts: { key: Busy; mode: 'test' | 'broadcast'; custom: boolean }) {
    if (busy) return
    if (opts.custom && (!subject.trim() || !body.trim())) { setMsg('Preencha o assunto e a mensagem.'); return }
    if (opts.mode === 'broadcast') {
      if (audienceCount === 0) { setMsg('O público selecionado está vazio.'); return }
      if (!confirm(`Enviar para ${audienceLabel}? Não dá pra desfazer.`)) return
    }
    setBusy(opts.key); setMsg(null)
    try {
      const seg = institutionId ? { institutionId, periodos } : {}
      const payload = opts.custom
        ? { mode: opts.mode, subject, body, ctaLabel, ctaUrl, ...(opts.mode === 'broadcast' ? seg : {}) }
        : { mode: opts.mode, ...(opts.mode === 'broadcast' ? seg : {}) }
      const res = await fetch('/api/admin/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(`Erro: ${j.error ?? res.status}`); return }
      setMsg(opts.mode === 'test'
        ? (j.ok ? 'Teste enviado para você. Confira o inbox.' : `Falha: ${j.error}`)
        : `Enviados: ${j.sent} · falhas: ${j.failed} · pulados (opt-out/sem email/fora do grupo): ${j.skipped} de ${j.total}.${j.segment ? ` Grupo: ${j.segment}.` : ''}`)
    } catch {
      setMsg('Erro de conexão.')
    } finally { setBusy(null) }
  }

  const inputCls = 'w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none'

  return (
    <div className="space-y-5">
      {/* Público-alvo */}
      <div className="rounded-lg border border-border bg-surface-2/40 p-3 space-y-2.5">
        <p className="text-xs font-semibold text-ink">Público</p>
        <select className={inputCls} value={institutionId} onChange={(e) => pickInstitution(e.target.value)}>
          <option value="">Todos os alunos ({totalUsers})</option>
          {audiences.map((a) => (
            <option key={a.id} value={a.id}>{a.name} ({a.total})</option>
          ))}
        </select>
        {inst && inst.periodos.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] text-muted">Períodos (nenhum marcado = turma inteira):</p>
            <div className="flex flex-wrap gap-1.5">
              {inst.periodos.map((p) => {
                const on = periodos.includes(p.periodo)
                return (
                  <button key={p.periodo} type="button" onClick={() => togglePeriodo(p.periodo)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted hover:border-primary'}`}>
                    {p.periodo} <span className="opacity-60">· {p.count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <p className="text-[11px] text-muted">Vai enviar para <span className="font-semibold text-ink">{audienceLabel}</span>. Respeita opt-out e inclui descadastro.</p>
      </div>

      {/* Comunicado livre */}
      <div className="space-y-2.5">
        <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto (ex.: Começou o Desafio da Semana)" maxLength={120} />
        <textarea className={`${inputCls} min-h-[120px] resize-y`} value={body} onChange={(e) => setBody(e.target.value)}
          placeholder={'Mensagem. Uma linha em branco separa parágrafos.'} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className={inputCls} value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Texto do botão (opcional)" maxLength={40} />
          <input className={inputCls} value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="Link do botão (opcional)" />
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button onClick={() => send({ key: 'c-test', mode: 'test', custom: true })} disabled={!!busy}
            className="rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface disabled:opacity-50">
            {busy === 'c-test' ? 'Enviando…' : 'Enviar teste pra mim'}
          </button>
          <button onClick={() => send({ key: 'c-send', mode: 'broadcast', custom: true })} disabled={!!busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-ink shadow-[var(--shadow-glow-primary)] transition-colors hover:bg-primary-hover disabled:opacity-50">
            {busy === 'c-send' ? 'Enviando…' : `Enviar para ${audienceCount}`}
          </button>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-2 text-xs text-muted">Ou dispare o e-mail de <b className="text-ink">onboarding</b> pronto (respeita o público selecionado acima).</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => send({ key: 'o-test', mode: 'test', custom: false })} disabled={!!busy}
            className="rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface disabled:opacity-50">
            {busy === 'o-test' ? 'Enviando…' : 'Teste do onboarding'}
          </button>
          <button onClick={() => send({ key: 'o-send', mode: 'broadcast', custom: false })} disabled={!!busy}
            className="rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface disabled:opacity-50">
            {busy === 'o-send' ? 'Enviando…' : `Onboarding para ${audienceCount}`}
          </button>
        </div>
      </div>

      {msg && <p className="text-xs text-ink">{msg}</p>}
    </div>
  )
}
