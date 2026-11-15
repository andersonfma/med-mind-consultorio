'use client'
import { useState } from 'react'

type Busy = null | 'c-test' | 'c-send' | 'o-test' | 'o-send'

export function EmailBroadcast({ totalUsers }: { totalUsers: number }) {
  const [busy, setBusy] = useState<Busy>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [ctaLabel, setCtaLabel] = useState('Responder agora')
  const [ctaUrl, setCtaUrl] = useState('https://app.medmindedu.com.br/desafio')

  async function send(opts: { key: Busy; mode: 'test' | 'broadcast'; custom: boolean }) {
    if (busy) return
    if (opts.custom && (!subject.trim() || !body.trim())) { setMsg('Preencha o assunto e a mensagem.'); return }
    if (opts.mode === 'broadcast' && !confirm(`Enviar para TODOS os usuários (${totalUsers})? Não dá pra desfazer.`)) return
    setBusy(opts.key); setMsg(null)
    try {
      const payload = opts.custom
        ? { mode: opts.mode, subject, body, ctaLabel, ctaUrl }
        : { mode: opts.mode }
      const res = await fetch('/api/admin/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(`Erro: ${j.error ?? res.status}`); return }
      setMsg(opts.mode === 'test'
        ? (j.ok ? 'Teste enviado para você. Confira o inbox.' : `Falha: ${j.error}`)
        : `Enviados: ${j.sent} · falhas: ${j.failed} · pulados (opt-out/sem email): ${j.skipped} de ${j.total}.`)
    } catch {
      setMsg('Erro de conexão.')
    } finally { setBusy(null) }
  }

  const inputCls = 'w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none'

  return (
    <div className="space-y-5">
      {/* Comunicado livre */}
      <div className="space-y-2.5">
        <p className="text-xs text-muted">Escreva um comunicado e dispare para todos (ou teste só pra você). Respeita opt-out e inclui descadastro.</p>
        <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto (ex.: Último dia do Desafio — a conclusão fecha hoje)" maxLength={120} />
        <textarea className={`${inputCls} min-h-[120px] resize-y`} value={body} onChange={(e) => setBody(e.target.value)}
          placeholder={'Mensagem. Uma linha em branco separa parágrafos.\n\nEx.: Hoje encerra o Desafio da Semana. Responda a conclusão do caso e leve seus MedCoins em dobro antes de zerar.'} />
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
            {busy === 'c-send' ? 'Enviando…' : `Enviar para todos (${totalUsers})`}
          </button>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-2 text-xs text-muted">Ou dispare o e-mail de <b className="text-ink">onboarding</b> pronto (como funciona + a aposta).</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => send({ key: 'o-test', mode: 'test', custom: false })} disabled={!!busy}
            className="rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface disabled:opacity-50">
            {busy === 'o-test' ? 'Enviando…' : 'Teste do onboarding'}
          </button>
          <button onClick={() => send({ key: 'o-send', mode: 'broadcast', custom: false })} disabled={!!busy}
            className="rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface disabled:opacity-50">
            {busy === 'o-send' ? 'Enviando…' : 'Onboarding para todos'}
          </button>
        </div>
      </div>

      {msg && <p className="text-xs text-ink">{msg}</p>}
    </div>
  )
}
