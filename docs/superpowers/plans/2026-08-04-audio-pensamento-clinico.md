# Áudio — ditado por voz no Pensamento Clínico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o aluno dite o pensamento clínico por voz (STT server-side via OpenAI), anexando o texto transcrito ao campo, sem nunca substituir a digitação.

**Architecture:** Rota `POST /api/transcribe` grava→transcreve via OpenAI. No cliente, um helper puro `transcribeBlob` faz o upload; o hook `useVoiceDictation` orquestra `MediaRecorder` (toggle, auto-stop, erros); `<MicButton>` é a UI que consome o hook; `ClinicalReasoningField` pluga o botão e anexa o texto com `appendTranscript`.

**Tech Stack:** Next.js 16 (App Router), OpenAI SDK (`gpt-4o-transcribe`), MediaRecorder/getUserMedia (browser), Vitest + @testing-library/react (jsdom), TypeScript.

## Global Constraints

- `openai` é NAMED export: `import { openai } from '@/lib/openai/client'`. O client tem `import 'server-only'` → testes de rota precisam de `vi.mock('server-only', () => ({}))`.
- Voz é **OPCIONAL e ADITIVA**: o campo funciona 100% só digitando; o microfone nunca é obrigatório; a permissão de mic só é pedida **quando o aluno clica** (nunca no load/render).
- Sem suporte a `MediaRecorder`/`getUserMedia` → o botão não aparece; o campo segue normal.
- Modelo de transcrição via `MODELS.transcription` (fonte única em `src/lib/openai/models.ts`), `language: 'pt'`, timeout 25 s. Fallback trivial `'whisper-1'` se `gpt-4o-transcribe` der 404.
- Guardas: cap de **120 000 ms** por clipe (auto-stop); limite de **5 000 000 bytes** no upload (413).
- Áudio **não é persistido** — só o texto transcrito entra em `clinical_reasoning`.
- Best-effort: qualquer falha (permissão, rede, transcrição) volta o botão a `idle` com mensagem curta e **preserva o texto já digitado**.
- tsc deve ficar limpo exceto erros pré-existentes de `validator.ts`: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio.
- Sem migration, sem env nova (usa `OPENAI_API_KEY` já presente).

---

## File Structure

- `src/lib/openai/models.ts` — **Modify**: `MODELS.transcription`.
- `src/app/api/transcribe/route.ts` — **Create**: rota de transcrição. + `route.test.ts`.
- `src/lib/audio/transcribe-client.ts` — **Create**: `transcribeBlob` (upload) + `appendTranscript` (pura). + `transcribe-client.test.ts`.
- `src/lib/audio/useVoiceDictation.ts` — **Create**: hook + `isDictationSupported`. + `useVoiceDictation.test.ts`.
- `src/app/(dashboard)/consultations/[id]/MicButton.tsx` — **Create**: UI do botão.
- `src/app/(dashboard)/consultations/[id]/ClinicalReasoningField.tsx` — **Modify**: header ganha `<MicButton>`; anexa via `appendTranscript`. + `ClinicalReasoningField.test.tsx` (**Create**).

---

## Task 1: Rota `POST /api/transcribe` + modelo de transcrição

**Files:**
- Modify: `src/lib/openai/models.ts`
- Create: `src/app/api/transcribe/route.ts`
- Test: `src/app/api/transcribe/route.test.ts`

**Interfaces:**
- Produces: `POST /api/transcribe` — multipart com campo `file` (Blob de áudio) → `200 { text: string }`. Erros: `401` sem auth, `400` sem file/form inválido, `413` acima de 5 MB, `500` falha da OpenAI. `MODELS.transcription: 'gpt-4o-transcribe'`.

- [ ] **Step 1: Adicionar o modelo**

Em `src/lib/openai/models.ts`, dentro do objeto `MODELS` (após a linha `utility: 'gpt-4.1-mini',`):

```ts
  /** Transcrição de voz (ditado). gpt-4o-transcribe: melhor que whisper-1 em PT médico. Fallback: 'whisper-1'. */
  transcription: 'gpt-4o-transcribe',
```

- [ ] **Step 2: Escrever o teste que falha**

Create `src/app/api/transcribe/route.test.ts`:

```ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { mockCreate, mockGetUser } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockGetUser: vi.fn(),
}))

vi.mock('@/lib/openai/client', () => ({
  openai: { audio: { transcriptions: { create: mockCreate } } },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
}))

import { NextRequest } from 'next/server'
import { POST } from './route'

function reqWithFile(bytes = 10, name = 'audio.webm') {
  const form = new FormData()
  form.append('file', new File([new Uint8Array(bytes)], name, { type: 'audio/webm' }))
  return new NextRequest('http://localhost/api/transcribe', { method: 'POST', body: form })
}

describe('POST /api/transcribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null })
    mockCreate.mockResolvedValue({ text: '  texto transcrito  ' })
  })

  it('401 sem auth', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(reqWithFile())
    expect(res.status).toBe(401)
  })

  it('transcreve e retorna o texto (trim)', async () => {
    const res = await POST(reqWithFile())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: 'texto transcrito' })
    expect(mockCreate).toHaveBeenCalledOnce()
    const arg = mockCreate.mock.calls[0][0]
    expect(arg.model).toBe('gpt-4o-transcribe')
    expect(arg.language).toBe('pt')
  })

  it('400 quando não há file', async () => {
    const res = await POST(new NextRequest('http://localhost/api/transcribe', {
      method: 'POST', body: new FormData(),
    }))
    expect(res.status).toBe(400)
  })

  it('413 quando o áudio excede 5 MB', async () => {
    const res = await POST(reqWithFile(5_000_001))
    expect(res.status).toBe(413)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('500 quando a OpenAI falha (best-effort)', async () => {
    mockCreate.mockRejectedValue(new Error('boom'))
    const res = await POST(reqWithFile())
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/app/api/transcribe/route.test.ts`
Expected: FAIL — módulo `./route` não existe.

- [ ] **Step 4: Implementar a rota**

Create `src/app/api/transcribe/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { MODELS } from '@/lib/openai/models'

const MAX_BYTES = 5_000_000

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let form: FormData
  try { form = await request.formData() }
  catch { return NextResponse.json({ error: 'Invalid form data' }, { status: 400 }) }

  const file = form.get('file')
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'file required' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Áudio muito longo' }, { status: 413 })

  try {
    const result = await openai.audio.transcriptions.create({
      file: file as File,
      model: MODELS.transcription,
      language: 'pt',
    }, { timeout: 25_000 })
    return NextResponse.json({ text: (result.text ?? '').trim() }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Rodar e ver passar + tsc**

Run: `npx vitest run src/app/api/transcribe/route.test.ts` → PASS (5/5).
Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio.

- [ ] **Step 6: Commit**

```bash
git add src/lib/openai/models.ts "src/app/api/transcribe/route.ts" "src/app/api/transcribe/route.test.ts"
git commit -m "feat(audio): rota /api/transcribe (OpenAI STT) + MODELS.transcription"
```

---

## Task 2: Utilitários do cliente — `transcribeBlob` e `appendTranscript`

**Files:**
- Create: `src/lib/audio/transcribe-client.ts`
- Test: `src/lib/audio/transcribe-client.test.ts`

**Interfaces:**
- Produces:
  - `transcribeBlob(blob: Blob): Promise<string>` — POST multipart para `/api/transcribe`; retorna o texto; lança em não-2xx.
  - `appendTranscript(current: string, text: string): string` — anexa `text` ao `current` com um espaço; texto vazio não muda nada.

- [ ] **Step 1: Escrever os testes que falham**

Create `src/lib/audio/transcribe-client.test.ts`:

```ts
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { transcribeBlob, appendTranscript } from './transcribe-client'

describe('appendTranscript', () => {
  it('anexa com um espaço quando já há texto', () => {
    expect(appendTranscript('Paciente estável', 'sem queixas')).toBe('Paciente estável sem queixas')
  })
  it('usa só o texto novo quando o atual está vazio', () => {
    expect(appendTranscript('', 'primeira frase')).toBe('primeira frase')
    expect(appendTranscript('   ', 'x')).toBe('x')
  })
  it('texto novo vazio não altera o atual', () => {
    expect(appendTranscript('abc', '   ')).toBe('abc')
  })
})

describe('transcribeBlob', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  afterEach(() => { vi.restoreAllMocks() })

  it('faz POST para /api/transcribe e devolve o texto', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ text: 'raciocínio ditado' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const out = await transcribeBlob(new Blob(['x'], { type: 'audio/webm' }))
    expect(out).toBe('raciocínio ditado')
    expect(fetchMock).toHaveBeenCalledWith('/api/transcribe', expect.objectContaining({ method: 'POST' }))
  })

  it('lança quando a resposta não é ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }))
    await expect(transcribeBlob(new Blob(['x']))).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/audio/transcribe-client.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Create `src/lib/audio/transcribe-client.ts`:

```ts
/** Envia o áudio para a rota de transcrição e devolve o texto. Lança em falha. */
export async function transcribeBlob(blob: Blob): Promise<string> {
  const form = new FormData()
  form.append('file', blob, 'audio.webm')
  const res = await fetch('/api/transcribe', { method: 'POST', body: form })
  if (!res.ok) throw new Error(`transcription failed: ${res.status}`)
  const data = (await res.json()) as { text?: string }
  return (data.text ?? '').trim()
}

/** Anexa o texto transcrito ao conteúdo atual do campo, separando por um espaço. */
export function appendTranscript(current: string, text: string): string {
  const t = text.trim()
  if (!t) return current
  return current.trim() ? `${current.trim()} ${t}` : t
}
```

- [ ] **Step 4: Rodar e ver passar + tsc**

Run: `npx vitest run src/lib/audio/transcribe-client.test.ts` → PASS.
Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio/transcribe-client.ts src/lib/audio/transcribe-client.test.ts
git commit -m "feat(audio): transcribeBlob (upload) e appendTranscript (anexa ao campo)"
```

---

## Task 3: Hook `useVoiceDictation` + `isDictationSupported`

**Files:**
- Create: `src/lib/audio/useVoiceDictation.ts`
- Test: `src/lib/audio/useVoiceDictation.test.ts`

**Interfaces:**
- Consumes: `transcribeBlob` de `./transcribe-client`.
- Produces:
  - `isDictationSupported(): boolean`
  - `useVoiceDictation(onTranscript: (text: string) => void): { state: 'idle'|'recording'|'transcribing'; error: string | null; start: () => Promise<void>; stop: () => void }`

- [ ] **Step 1: Escrever os testes que falham**

Create `src/lib/audio/useVoiceDictation.test.ts`:

```ts
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const { mockTranscribe } = vi.hoisted(() => ({ mockTranscribe: vi.fn() }))
vi.mock('./transcribe-client', () => ({
  transcribeBlob: mockTranscribe,
  appendTranscript: (c: string, t: string) => (c ? `${c} ${t}` : t),
}))

import { useVoiceDictation, isDictationSupported } from './useVoiceDictation'

// --- Mock MediaRecorder ---
class MockMediaRecorder {
  static instances: MockMediaRecorder[] = []
  static isTypeSupported() { return true }
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  state = 'inactive'
  constructor(public stream: unknown) { MockMediaRecorder.instances.push(this) }
  start() { this.state = 'recording' }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['x'], { type: 'audio/webm' }) })
    this.onstop?.()
  }
}

const track = { stop: vi.fn() }
const stream = { getTracks: () => [track] }

beforeEach(() => {
  vi.clearAllMocks()
  MockMediaRecorder.instances = []
  mockTranscribe.mockResolvedValue('texto ditado')
  vi.stubGlobal('MediaRecorder', MockMediaRecorder as unknown as typeof MediaRecorder)
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } })
})
afterEach(() => { vi.unstubAllGlobals() })

describe('isDictationSupported', () => {
  it('true quando MediaRecorder e getUserMedia existem', () => {
    expect(isDictationSupported()).toBe(true)
  })
  it('false quando MediaRecorder não existe', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    expect(isDictationSupported()).toBe(false)
  })
})

describe('useVoiceDictation', () => {
  it('start() coloca em recording e pede o microfone', async () => {
    const onT = vi.fn()
    const { result } = renderHook(() => useVoiceDictation(onT))
    await act(async () => { await result.current.start() })
    expect(result.current.state).toBe('recording')
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled()
  })

  it('stop() transcreve, chama onTranscript e volta a idle', async () => {
    const onT = vi.fn()
    const { result } = renderHook(() => useVoiceDictation(onT))
    await act(async () => { await result.current.start() })
    await act(async () => { result.current.stop() })
    await waitFor(() => expect(result.current.state).toBe('idle'))
    expect(mockTranscribe).toHaveBeenCalledOnce()
    expect(onT).toHaveBeenCalledWith('texto ditado')
    expect(track.stop).toHaveBeenCalled() // libera o microfone
  })

  it('permissão negada → erro e idle, sem transcrever', async () => {
    ;(navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('denied'))
    const onT = vi.fn()
    const { result } = renderHook(() => useVoiceDictation(onT))
    await act(async () => { await result.current.start() })
    expect(result.current.state).toBe('idle')
    expect(result.current.error).toMatch(/microfone/i)
    expect(mockTranscribe).not.toHaveBeenCalled()
  })

  it('falha na transcrição → erro e idle, sem chamar onTranscript', async () => {
    mockTranscribe.mockRejectedValue(new Error('boom'))
    const onT = vi.fn()
    const { result } = renderHook(() => useVoiceDictation(onT))
    await act(async () => { await result.current.start() })
    await act(async () => { result.current.stop() })
    await waitFor(() => expect(result.current.state).toBe('idle'))
    expect(result.current.error).toMatch(/transcrever/i)
    expect(onT).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/audio/useVoiceDictation.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar o hook**

Create `src/lib/audio/useVoiceDictation.ts`:

```ts
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { transcribeBlob } from './transcribe-client'

export type DictationState = 'idle' | 'recording' | 'transcribing'

const MAX_MS = 120_000
const MIME = 'audio/webm;codecs=opus'

export function isDictationSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof MediaRecorder !== 'undefined'
    && !!navigator?.mediaDevices?.getUserMedia
}

export function useVoiceDictation(onTranscript: (text: string) => void) {
  const [state, setState] = useState<DictationState>('idle')
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }, [])

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
  }, [])

  const start = useCallback(async () => {
    setError(null)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('Permissão de microfone negada')
      setState('idle')
      return
    }
    streamRef.current = stream
    chunksRef.current = []
    const supported = typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(MIME)
    const recorder = new MediaRecorder(stream, supported ? { mimeType: MIME } : undefined)
    recorderRef.current = recorder
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = async () => {
      cleanup()
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      if (blob.size === 0) { setState('idle'); return }
      setState('transcribing')
      try {
        const text = await transcribeBlob(blob)
        if (text) onTranscript(text)
        setState('idle')
      } catch {
        setError('Não consegui transcrever, tente de novo')
        setState('idle')
      }
    }
    recorder.start()
    setState('recording')
    timerRef.current = setTimeout(() => stop(), MAX_MS)
  }, [cleanup, onTranscript, stop])

  useEffect(() => cleanup, [cleanup])

  return { state, error, start, stop }
}
```

- [ ] **Step 4: Rodar e ver passar + tsc**

Run: `npx vitest run src/lib/audio/useVoiceDictation.test.ts` → PASS.
Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio/useVoiceDictation.ts src/lib/audio/useVoiceDictation.test.ts
git commit -m "feat(audio): hook useVoiceDictation (MediaRecorder, toggle, auto-stop, erros)"
```

---

## Task 4: `<MicButton>` + integração no `ClinicalReasoningField`

**Files:**
- Create: `src/app/(dashboard)/consultations/[id]/MicButton.tsx`
- Modify: `src/app/(dashboard)/consultations/[id]/ClinicalReasoningField.tsx`
- Test: `src/app/(dashboard)/consultations/[id]/ClinicalReasoningField.test.tsx`

**Interfaces:**
- Consumes: `useVoiceDictation`, `isDictationSupported` de `@/lib/audio/useVoiceDictation`; `appendTranscript` de `@/lib/audio/transcribe-client`.
- Produces: `<MicButton onTranscript={(t) => void} />` — oculto quando não suportado.

- [ ] **Step 1: Escrever o teste de integração que falha**

Create `src/app/(dashboard)/consultations/[id]/ClinicalReasoningField.test.tsx`:

```tsx
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// MicButton é substituído por um stub que injeta um transcript ao clicar —
// isola a integração do campo (anexar + marcar não salvo) do MediaRecorder real.
vi.mock('./MicButton', () => ({
  MicButton: ({ onTranscript }: { onTranscript: (t: string) => void }) => (
    <button onClick={() => onTranscript('frase ditada')}>mic-stub</button>
  ),
}))
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))

import { ClinicalReasoningField } from './ClinicalReasoningField'

describe('ClinicalReasoningField — ditado', () => {
  beforeEach(() => vi.clearAllMocks())

  it('anexa o texto ditado ao valor via onChange', () => {
    const onChange = vi.fn()
    render(<ClinicalReasoningField consultationId="c-1" value="Hipótese A" onChange={onChange} />)
    fireEvent.click(screen.getByText('mic-stub'))
    expect(onChange).toHaveBeenCalledWith('Hipótese A frase ditada')
  })

  it('mantém o caminho só-teclado funcionando', () => {
    const onChange = vi.fn()
    render(<ClinicalReasoningField consultationId="c-1" value="" onChange={onChange} />)
    fireEvent.change(screen.getByPlaceholderText(/racioc[íi]nio/i), { target: { value: 'digitado' } })
    expect(onChange).toHaveBeenCalledWith('digitado')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run "src/app/(dashboard)/consultations/[id]/ClinicalReasoningField.test.tsx"`
Expected: FAIL — `./MicButton` não existe / campo ainda não usa `onTranscript`.

- [ ] **Step 3: Implementar o `<MicButton>`**

Create `src/app/(dashboard)/consultations/[id]/MicButton.tsx`:

```tsx
'use client'
import { useVoiceDictation, isDictationSupported } from '@/lib/audio/useVoiceDictation'

type Props = { onTranscript: (text: string) => void; disabled?: boolean }

export function MicButton({ onTranscript, disabled }: Props) {
  const { state, error, start, stop } = useVoiceDictation(onTranscript)
  if (!isDictationSupported()) return null

  const recording = state === 'recording'
  const transcribing = state === 'transcribing'
  const label = transcribing ? 'transcrevendo…' : recording ? 'gravando…' : 'ditar'

  return (
    <button
      type="button"
      onClick={() => (recording ? stop() : start())}
      disabled={disabled || transcribing}
      title={error ?? label}
      aria-label={label}
      className={`text-xs flex items-center gap-1 px-1.5 py-0.5 rounded-md ${
        recording ? 'bg-red-100 text-red-600 animate-pulse'
        : transcribing ? 'bg-gray-100 text-gray-400'
        : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      <span aria-hidden>🎤</span>
      <span>{label}</span>
    </button>
  )
}
```

- [ ] **Step 4: Integrar no `ClinicalReasoningField`**

Modify `src/app/(dashboard)/consultations/[id]/ClinicalReasoningField.tsx`:

(a) Imports no topo (após a linha `import { useState, useEffect, useRef } from 'react'`):

```tsx
import { MicButton } from './MicButton'
import { appendTranscript } from '@/lib/audio/transcribe-client'
```

(b) No header (o `<div className="flex justify-end px-0 mb-1">`), incluir o botão à esquerda do indicador. Substituir esse `<div>` inteiro por:

```tsx
      <div className="flex items-center justify-between px-0 mb-1">
        <MicButton onTranscript={(t) => { onChange(appendTranscript(value, t)); setSaved(false) }} />
        <span className="text-xs text-gray-400">{saved ? 'Salvo' : 'Não salvo'}</span>
      </div>
```

- [ ] **Step 5: Rodar e ver passar + tsc**

Run: `npx vitest run "src/app/(dashboard)/consultations/[id]/ClinicalReasoningField.test.tsx"` → PASS.
Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio.

- [ ] **Step 6: Suíte completa + commit**

Run: `npx vitest run` → tudo verde.

```bash
git add "src/app/(dashboard)/consultations/[id]/MicButton.tsx" "src/app/(dashboard)/consultations/[id]/ClinicalReasoningField.tsx" "src/app/(dashboard)/consultations/[id]/ClinicalReasoningField.test.tsx"
git commit -m "feat(audio): MicButton e ditado por voz no pensamento clínico"
```

---

## Task 5: Verificação final e validação manual

- [ ] **Step 1: Verificação completa**

Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio.
Run: `npx vitest run` → todos verdes.

- [ ] **Step 2: Validação manual (pós-deploy, manual no Easypanel)**

Sem migration nem env nova — só redeploy manual.
1. Abrir uma consulta, clicar em "🎤 ditar" no Pensamento Clínico → conceder microfone → falar uma frase clínica em PT → clicar de novo → o texto transcrito aparece anexado; o indicador vai a "Não salvo" e depois "Salvo".
2. Negar a permissão de microfone → mensagem no botão, campo segue digitável.
3. Testar num navegador sem suporte (ou simular) → botão não aparece, campo normal.
4. Confirmar que digitar continua funcionando exatamente como antes.

> Acurácia da transcrição é probabilística (gpt-4o-transcribe) — os testes garantem o fluxo/contrato, não as palavras. Se `gpt-4o-transcribe` retornar 404 na chave, trocar `MODELS.transcription` para `'whisper-1'`.

---

## Self-Review (do autor do plano)

- **Cobertura do spec:** rota `/api/transcribe` + modelo → Task 1. `transcribeBlob` + `appendTranscript` → Task 2. Hook `useVoiceDictation` + `isDictationSupported` (toggle, auto-stop, cap, erros, unsupported) → Task 3. `<MicButton>` + integração no campo (anexar, opcional/aditivo) → Task 4. Guardas 120 s/5 MB → Task 3 (MAX_MS) e Task 1 (MAX_BYTES). Erros (permissão/rede/vazio/tamanho) → Tasks 1 e 3. Verificação → Task 5. ✅
- **Princípio voz-opcional:** o textarea é intocado (Task 4 só adiciona botão no header); `isDictationSupported()` oculta o botão; permissão só no clique (`start()`), nunca no render. Teste "mantém o caminho só-teclado". ✅
- **Consistência de tipos:** `useVoiceDictation(onTranscript)` retorna `{state,error,start,stop}` (Task 3) e é consumido igual no MicButton (Task 4); `transcribeBlob`/`appendTranscript` (Task 2) consumidos no hook e no campo. `MODELS.transcription` (Task 1) usado na rota. ✅
- **Placeholders:** nenhum — todo passo com código tem o código completo. ✅
- **Nota de teste:** o teste do campo (Task 4) faz mock de `./MicButton` para isolar a lógica de anexar do MediaRecorder real — decisão consciente; a UI do botão é coberta pela validação manual (padrão do projeto para componentes presentacionais).
