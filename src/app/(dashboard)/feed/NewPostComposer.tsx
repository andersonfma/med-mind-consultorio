'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Mode = 'texto' | 'midia' | 'duvida' | 'quiz' | 'resenha'
const MODES: { key: Mode; label: string }[] = [
  { key: 'texto', label: 'Texto' },
  { key: 'midia', label: 'Foto/Vídeo' },
  { key: 'duvida', label: 'Dúvida' },
  { key: 'quiz', label: 'Quiz' },
  { key: 'resenha', label: 'Resenha' },
]
const KEYS = ['A', 'B', 'C', 'D', 'E']
const inputCls = 'w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-ink outline-none focus:border-primary'

export function NewPostComposer() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('texto')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // texto/dúvida
  const [text, setText] = useState('')
  // mídia (foto/vídeo da biblioteca)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [mediaIsVideo, setMediaIsVideo] = useState(false)
  const [mediaCaption, setMediaCaption] = useState('')
  // quiz
  const [prompt, setPrompt] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [correct, setCorrect] = useState(0)
  const [explanation, setExplanation] = useState('')
  // resenha
  const [rTitle, setRTitle] = useState('')
  const [rAuthors, setRAuthors] = useState('')
  const [rSource, setRSource] = useState('')
  const [rLink, setRLink] = useState('')
  const [rBody, setRBody] = useState('')
  const [coverUrl, setCoverUrl] = useState<string | null>(null)

  function reset() {
    setText(''); setPrompt(''); setOptions(['', '']); setCorrect(0); setExplanation('')
    setRTitle(''); setRAuthors(''); setRSource(''); setRLink(''); setRBody(''); setCoverUrl(null); setMsg(null)
    setMediaUrl(null); setMediaIsVideo(false); setMediaCaption('')
  }

  async function uploadMedia(file: File) {
    setMsg(null)
    if (file.type.startsWith('video/')) {
      const dur = await new Promise<number>(r => { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => r(v.duration); v.onerror = () => r(0); v.src = URL.createObjectURL(file) })
      if (dur > 61) { setMsg('Vídeo de no máximo 1 minuto.'); return }
    }
    const res = await fetch('/api/posts/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentType: file.type }) })
    if (!res.ok) { setMsg('Tipo de arquivo não suportado.'); return }
    const { uploadUrl, publicUrl } = await res.json()
    const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type, 'x-upsert': 'true' }, body: file })
    if (!put.ok) { setMsg('Falha no envio.'); return }
    setMediaUrl(publicUrl); setMediaIsVideo(file.type.startsWith('video/'))
  }

  async function uploadCover(file: File) {
    const res = await fetch('/api/posts/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentType: file.type }) })
    if (!res.ok) { setMsg('Falha ao preparar upload.'); return }
    const { uploadUrl, publicUrl } = await res.json()
    const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type, 'x-upsert': 'true' }, body: file })
    if (!put.ok) { setMsg('Falha ao enviar a capa.'); return }
    setCoverUrl(publicUrl)
  }

  async function publish() {
    if (busy) return
    setBusy(true); setMsg(null)
    try {
      let res: Response
      if (mode === 'texto' || mode === 'duvida') {
        if (!text.trim()) { setMsg('Escreva algo.'); return }
        // a aba "Texto" usa a chave interna 'texto'; a API/banco esperam 'text'
        const kind = mode === 'texto' ? 'text' : 'duvida'
        res = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, body: text }) })
      } else if (mode === 'quiz') {
        const opts = options.map((t, i) => ({ key: KEYS[i], text: t.trim() })).filter(o => o.text)
        if (!prompt.trim()) { setMsg('Escreva o enunciado.'); return }
        if (opts.length < 2) { setMsg('Use ao menos 2 alternativas.'); return }
        if (correct >= opts.length) { setMsg('Marque a alternativa correta.'); return }
        res = await fetch('/api/quizzes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, options: opts, correctKey: KEYS[correct], explanation }) })
      } else if (mode === 'midia') {
        if (!mediaUrl) { setMsg('Escolha uma foto ou vídeo.'); return }
        res = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'media', imageUrl: mediaUrl, body: mediaCaption, meta: { video: mediaIsVideo } }) })
      } else {
        if (!rBody.trim()) { setMsg('Escreva o resumo.'); return }
        res = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'resenha', body: rBody, imageUrl: coverUrl, meta: { title: rTitle, authors: rAuthors, source: rSource, link: rLink } }) })
      }
      if (res.ok) { reset(); setOpen(false); router.refresh() }
      else { const j = await res.json().catch(() => ({})); setMsg(j.error ?? 'Falha ao publicar') }
    } finally { setBusy(false) }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-left text-sm text-muted transition-colors hover:border-primary/40 hover:text-ink">
        Publicar: texto, dúvida, quiz ou resenha…
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="mb-3 flex gap-1.5 overflow-x-auto">
        {MODES.map(m => (
          <button key={m.key} onClick={() => setMode(m.key)} className={`shrink-0 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${mode === m.key ? 'bg-primary text-primary-ink' : 'border border-border text-muted'}`}>
            {m.label}
          </button>
        ))}
      </div>

      {(mode === 'texto' || mode === 'duvida') && (
        <textarea value={text} onChange={e => setText(e.target.value)} maxLength={500} rows={3} autoFocus
          placeholder={mode === 'duvida' ? 'Qual é a sua dúvida? (quem responder primeiro em 30 min ganha MedCoin)' : 'Compartilhe algo com os colegas…'} className={`${inputCls} resize-none`} />
      )}

      {mode === 'midia' && (
        <div className="space-y-2">
          {!mediaUrl ? (
            <label className="block cursor-pointer rounded-lg border border-dashed border-border bg-surface-2/40 px-3 py-6 text-center text-sm text-muted hover:border-primary/40">
              Escolher foto ou vídeo da biblioteca
              <input type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void uploadMedia(f); e.target.value = '' }} />
            </label>
          ) : mediaIsVideo ? (
            <video src={mediaUrl} controls playsInline className="block h-auto w-full max-w-full rounded-lg border border-border" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="" className="block h-auto w-full max-w-full rounded-lg border border-border" />
          )}
          {mediaUrl && <button onClick={() => { setMediaUrl(null); setMediaIsVideo(false) }} className="text-xs font-medium text-muted hover:text-ink">trocar mídia</button>}
          <input value={mediaCaption} onChange={e => setMediaCaption(e.target.value)} maxLength={500} placeholder="Legenda (opcional)" className={inputCls} />
        </div>
      )}

      {mode === 'quiz' && (
        <div className="space-y-2">
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={500} rows={2} placeholder="Enunciado do quiz" className={`${inputCls} resize-none`} />
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <button onClick={() => setCorrect(i)} title="Marcar como correta" className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${correct === i ? 'bg-success text-white' : 'border border-border text-muted'}`}>{KEYS[i]}</button>
              <input value={o} onChange={e => setOptions(prev => prev.map((x, j) => j === i ? e.target.value : x))} maxLength={300} placeholder={`Alternativa ${KEYS[i]}`} className={inputCls} />
              {options.length > 2 && <button onClick={() => { setOptions(prev => prev.filter((_, j) => j !== i)); if (correct >= options.length - 1) setCorrect(0) }} className="shrink-0 text-muted hover:text-danger">×</button>}
            </div>
          ))}
          {options.length < 5 && <button onClick={() => setOptions(prev => [...prev, ''])} className="text-xs font-medium text-primary">+ alternativa</button>}
          <input value={explanation} onChange={e => setExplanation(e.target.value)} maxLength={1000} placeholder="Explicação (aparece após responder)" className={inputCls} />
          <p className="text-[11px] text-muted">Toque na letra para marcar a correta.</p>
        </div>
      )}

      {mode === 'resenha' && (
        <div className="space-y-2">
          <input value={rTitle} onChange={e => setRTitle(e.target.value)} maxLength={200} placeholder="Título do artigo" className={inputCls} />
          <div className="flex gap-2">
            <input value={rAuthors} onChange={e => setRAuthors(e.target.value)} maxLength={200} placeholder="Autores" className={inputCls} />
            <input value={rSource} onChange={e => setRSource(e.target.value)} maxLength={120} placeholder="Fonte (ex.: NEJM)" className={inputCls} />
          </div>
          <input value={rLink} onChange={e => setRLink(e.target.value)} maxLength={500} placeholder="Link / DOI (opcional)" className={inputCls} />
          <label className="block">
            <span className="text-xs font-medium text-muted">Capa (opcional)</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const f = e.target.files?.[0]; if (f) void uploadCover(f) }} className="mt-1 block w-full text-xs text-muted" />
            {coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="" className="mt-2 h-24 w-auto rounded border border-border" />
            )}
          </label>
          <textarea value={rBody} onChange={e => setRBody(e.target.value)} maxLength={500} rows={4} placeholder="Seu resumo do artigo (com suas palavras)" className={`${inputCls} resize-none`} />
          <p className="text-[11px] text-muted">Resuma com suas palavras — não cole trechos do artigo (direito autoral).</p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        {msg && <span className="mr-auto text-xs text-danger">{msg}</span>}
        <button onClick={() => { setOpen(false); reset() }} className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted">Cancelar</button>
        <button onClick={publish} disabled={busy} className="rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-ink disabled:opacity-50">{busy ? 'Publicando…' : 'Publicar'}</button>
      </div>
    </div>
  )
}
