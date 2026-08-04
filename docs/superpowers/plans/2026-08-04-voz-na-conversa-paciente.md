# Voz na conversa com o paciente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o loop de conversa falada com o paciente: aluno fala no chat (reúso) e o paciente responde falando via TTS, sempre opcional.

**Architecture:** Nova rota `POST /api/speak` (OpenAI TTS → mp3). `voiceForGender` mapeia gênero→voz. Hook `useSpeech` toca o mp3. `ConsultationChat` ganha o `<MicButton>` no input (reúso da fatia anterior), um botão 🔊 por bolha do paciente e um toggle de auto-play (off por padrão).

**Tech Stack:** Next.js 16 (App Router), OpenAI SDK (`gpt-4o-mini-tts`), Web Audio (`new Audio`), Vitest + @testing-library/react (jsdom), TypeScript.

## Global Constraints

- `openai` é NAMED export: `import { openai } from '@/lib/openai/client'`. O client tem `import 'server-only'` → testes de rota precisam de `vi.mock('server-only', () => ({}))`.
- Áudio é sempre OPCIONAL: o chat funciona 100% só com texto; **auto-play do paciente é OFF por padrão** (o paciente nunca fala sozinho sem o aluno pedir); microfone só pede permissão ao clicar; sem suporte → MicButton some.
- TTS via `MODELS.tts` (`gpt-4o-mini-tts`), `response_format: 'mp3'`, timeout 25 s. Fallback trivial `'tts-1'` (mesma API `audio.speech.create`).
- Voz por gênero: `voiceForGender('M') === 'onyx'`, `voiceForGender('F') === 'shimmer'`, desconhecido → `'shimmer'`.
- Cap de texto no TTS: **4000 caracteres** (400 se exceder). Áudio NÃO é persistido.
- Best-effort: qualquer falha (TTS/rede/reprodução) mantém o texto visível e não quebra o chat.
- Reúso da fatia anterior (já em main): `useVoiceDictation`, `isDictationSupported`, `<MicButton>` (`@/app/(dashboard)/consultations/[id]/MicButton`), `appendTranscript` (`@/lib/audio/transcribe-client`), rota `/api/transcribe`.
- tsc deve ficar limpo exceto erros pré-existentes de `validator.ts`: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio.
- Sem migration, sem env nova (usa `OPENAI_API_KEY`).

---

## File Structure

- `src/lib/openai/models.ts` — **Modify**: `MODELS.tts`.
- `src/lib/audio/voices.ts` — **Create**: `voiceForGender`. + `voices.test.ts`.
- `src/app/api/speak/route.ts` — **Create**: rota TTS. + `route.test.ts`.
- `src/lib/audio/useSpeech.ts` — **Create**: hook de reprodução. + `useSpeech.test.ts`.
- `src/app/(dashboard)/consultations/[id]/ConsultationChat.tsx` — **Modify**: MicButton no input, toggle auto-play, 🔊 por bolha, auto-play no recebimento. Nova prop `patientGender`. + `ConsultationChat.test.tsx` (**Create**).
- `src/app/(dashboard)/consultations/[id]/ConsultationClient.tsx` — **Modify**: passar `patientGender={patient.gender}`.

---

## Task 1: `voiceForGender` + `MODELS.tts`

**Files:**
- Modify: `src/lib/openai/models.ts`
- Create: `src/lib/audio/voices.ts`
- Test: `src/lib/audio/voices.test.ts`

**Interfaces:**
- Produces: `voiceForGender(gender: string): string`; `MODELS.tts: 'gpt-4o-mini-tts'`.

- [ ] **Step 1: Adicionar o modelo**

Em `src/lib/openai/models.ts`, dentro do objeto `MODELS` (após a linha `transcription: 'gpt-4o-transcribe',`):

```ts
  /** Síntese de voz (paciente falando). gpt-4o-mini-tts: boa qualidade. Fallback: 'tts-1'. */
  tts: 'gpt-4o-mini-tts',
```

- [ ] **Step 2: Escrever o teste que falha**

Create `src/lib/audio/voices.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { voiceForGender } from './voices'

describe('voiceForGender', () => {
  it('paciente masculino → onyx', () => {
    expect(voiceForGender('M')).toBe('onyx')
  })
  it('paciente feminino → shimmer', () => {
    expect(voiceForGender('F')).toBe('shimmer')
  })
  it('valor desconhecido/vazio → voz feminina padrão (shimmer)', () => {
    expect(voiceForGender('')).toBe('shimmer')
    expect(voiceForGender('X')).toBe('shimmer')
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/audio/voices.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 4: Implementar**

Create `src/lib/audio/voices.ts`:

```ts
/** Mapeia o gênero do paciente para uma voz da OpenAI TTS. Default feminino. */
export function voiceForGender(gender: string): string {
  return gender === 'M' ? 'onyx' : 'shimmer'
}
```

- [ ] **Step 5: Rodar e ver passar + tsc**

Run: `npx vitest run src/lib/audio/voices.test.ts` → PASS.
Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio.

- [ ] **Step 6: Commit**

```bash
git add src/lib/openai/models.ts src/lib/audio/voices.ts src/lib/audio/voices.test.ts
git commit -m "feat(audio): voiceForGender + MODELS.tts"
```

---

## Task 2: Rota `POST /api/speak` (TTS)

**Files:**
- Create: `src/app/api/speak/route.ts`
- Test: `src/app/api/speak/route.test.ts`

**Interfaces:**
- Consumes: `MODELS.tts`.
- Produces: `POST /api/speak` — body JSON `{ text: string, voice: string }` → `200` com `Content-Type: audio/mpeg` (bytes do mp3). Erros: `401` sem auth, `400` body inválido/text vazio/text > 4000 chars, `500` falha da OpenAI.

- [ ] **Step 1: Escrever o teste que falha**

Create `src/app/api/speak/route.test.ts`:

```ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { mockCreate, mockGetUser } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockGetUser: vi.fn(),
}))

vi.mock('@/lib/openai/client', () => ({
  openai: { audio: { speech: { create: mockCreate } } },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
}))

import { NextRequest } from 'next/server'
import { POST } from './route'

function req(body: unknown) {
  return new NextRequest('http://localhost/api/speak', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

describe('POST /api/speak', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null })
    // O SDK devolve um objeto com arrayBuffer(); simulamos alguns bytes.
    mockCreate.mockResolvedValue({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer })
  })

  it('401 sem auth', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(req({ text: 'olá', voice: 'onyx' }))
    expect(res.status).toBe(401)
  })

  it('sintetiza e devolve audio/mpeg', async () => {
    const res = await POST(req({ text: 'estou com dor', voice: 'onyx' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('audio/mpeg')
    expect(mockCreate).toHaveBeenCalledOnce()
    const arg = mockCreate.mock.calls[0][0]
    expect(arg.model).toBe('gpt-4o-mini-tts')
    expect(arg.voice).toBe('onyx')
    expect(arg.input).toBe('estou com dor')
  })

  it('400 quando text está vazio', async () => {
    const res = await POST(req({ text: '   ', voice: 'onyx' }))
    expect(res.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('400 quando text excede 4000 caracteres', async () => {
    const res = await POST(req({ text: 'a'.repeat(4001), voice: 'onyx' }))
    expect(res.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('500 quando a OpenAI falha (best-effort)', async () => {
    mockCreate.mockRejectedValue(new Error('boom'))
    const res = await POST(req({ text: 'olá', voice: 'onyx' }))
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/app/api/speak/route.test.ts`
Expected: FAIL — módulo `./route` não existe.

- [ ] **Step 3: Implementar a rota**

Create `src/app/api/speak/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { MODELS } from '@/lib/openai/models'

const MAX_CHARS = 4000
const ALLOWED_VOICES = ['onyx', 'shimmer']

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  if (!body || typeof body !== 'object')
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { text, voice } = body as Record<string, unknown>
  if (typeof text !== 'string' || !text.trim())
    return NextResponse.json({ error: 'text required' }, { status: 400 })
  if (text.length > MAX_CHARS)
    return NextResponse.json({ error: 'text too long' }, { status: 400 })
  const useVoice = typeof voice === 'string' && ALLOWED_VOICES.includes(voice) ? voice : 'shimmer'

  try {
    const speech = await openai.audio.speech.create({
      model: MODELS.tts,
      voice: useVoice,
      input: text,
      response_format: 'mp3',
    }, { timeout: 25_000 })
    const buffer = Buffer.from(await speech.arrayBuffer())
    return new NextResponse(buffer, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } })
  } catch {
    return NextResponse.json({ error: 'Speech synthesis failed' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Rodar e ver passar + tsc**

Run: `npx vitest run src/app/api/speak/route.test.ts` → PASS (5/5).
Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio.

> Nota: `openai.audio.speech.create` no tipo do SDK aceita `voice` como union de strings literais; passamos uma `string`. Se o tsc reclamar do tipo de `voice`, faça o cast `voice: useVoice as 'onyx' | 'shimmer'` na chamada — os dois valores são vozes válidas do SDK.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/speak/route.ts" "src/app/api/speak/route.test.ts"
git commit -m "feat(audio): rota /api/speak (OpenAI TTS → mp3)"
```

---

## Task 3: Hook `useSpeech`

**Files:**
- Create: `src/lib/audio/useSpeech.ts`
- Test: `src/lib/audio/useSpeech.test.ts`

**Interfaces:**
- Produces: `useSpeech(): { state: 'idle'|'loading'|'playing'; error: string | null; play: (text: string, voice: string) => Promise<void>; stop: () => void }`.

- [ ] **Step 1: Escrever os testes que falham**

Create `src/lib/audio/useSpeech.test.ts`:

```ts
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSpeech } from './useSpeech'

// --- Mock de Audio ---
class MockAudio {
  static instances: MockAudio[] = []
  onended: (() => void) | null = null
  paused = true
  src: string
  constructor(src: string) { this.src = src; MockAudio.instances.push(this) }
  play() { this.paused = false; return Promise.resolve() }
  pause() { this.paused = true }
}

beforeEach(() => {
  vi.clearAllMocks()
  MockAudio.instances = []
  vi.stubGlobal('Audio', MockAudio as unknown as typeof Audio)
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' }),
  }))
})
afterEach(() => { vi.unstubAllGlobals() })

describe('useSpeech', () => {
  it('play() busca o áudio e entra em playing', async () => {
    const { result } = renderHook(() => useSpeech())
    await act(async () => { await result.current.play('olá', 'onyx') })
    await waitFor(() => expect(result.current.state).toBe('playing'))
    expect(fetch).toHaveBeenCalledWith('/api/speak', expect.objectContaining({ method: 'POST' }))
    expect(MockAudio.instances).toHaveLength(1)
    expect(MockAudio.instances[0].paused).toBe(false)
  })

  it('ao terminar (onended) volta a idle e revoga a URL', async () => {
    const { result } = renderHook(() => useSpeech())
    await act(async () => { await result.current.play('olá', 'onyx') })
    await act(async () => { MockAudio.instances[0].onended?.() })
    expect(result.current.state).toBe('idle')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })

  it('stop() pausa e volta a idle', async () => {
    const { result } = renderHook(() => useSpeech())
    await act(async () => { await result.current.play('olá', 'onyx') })
    await act(async () => { result.current.stop() })
    expect(result.current.state).toBe('idle')
    expect(MockAudio.instances[0].paused).toBe(true)
  })

  it('um novo play interrompe o áudio anterior', async () => {
    const { result } = renderHook(() => useSpeech())
    await act(async () => { await result.current.play('a', 'onyx') })
    await act(async () => { await result.current.play('b', 'onyx') })
    expect(MockAudio.instances).toHaveLength(2)
    expect(MockAudio.instances[0].paused).toBe(true) // o primeiro foi pausado
  })

  it('falha no fetch → idle + error, sem áudio', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500 })
    const { result } = renderHook(() => useSpeech())
    await act(async () => { await result.current.play('olá', 'onyx') })
    expect(result.current.state).toBe('idle')
    expect(result.current.error).toBeTruthy()
    expect(MockAudio.instances).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/audio/useSpeech.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar o hook**

Create `src/lib/audio/useSpeech.ts`:

```ts
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

export type SpeechState = 'idle' | 'loading' | 'playing'

export function useSpeech() {
  const [state, setState] = useState<SpeechState>('idle')
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)
  const mountedRef = useRef(true)

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null }
  }, [])

  const stop = useCallback(() => {
    cleanupAudio()
    if (mountedRef.current) setState('idle')
  }, [cleanupAudio])

  const play = useCallback(async (text: string, voice: string) => {
    cleanupAudio()                     // interrompe qualquer áudio anterior
    setError(null)
    setState('loading')
    let blob: Blob
    try {
      const res = await fetch('/api/speak', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
      })
      if (!res.ok) throw new Error(`speak failed: ${res.status}`)
      blob = await res.blob()
    } catch {
      if (mountedRef.current) { setError('Não consegui gerar o áudio'); setState('idle') }
      return
    }
    if (!mountedRef.current) return
    const url = URL.createObjectURL(blob)
    urlRef.current = url
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onended = () => { cleanupAudio(); if (mountedRef.current) setState('idle') }
    await audio.play()
    if (mountedRef.current) setState('playing')
  }, [cleanupAudio])

  useEffect(() => () => { mountedRef.current = false; cleanupAudio() }, [cleanupAudio])

  return { state, error, play, stop }
}
```

- [ ] **Step 4: Rodar e ver passar + tsc**

Run: `npx vitest run src/lib/audio/useSpeech.test.ts` → PASS.
Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio/useSpeech.ts src/lib/audio/useSpeech.test.ts
git commit -m "feat(audio): hook useSpeech (toca mp3 do /api/speak, um por vez, cleanup)"
```

---

## Task 4: Integração no `ConsultationChat` (MicButton + 🔊 + toggle auto-play)

**Files:**
- Modify: `src/app/(dashboard)/consultations/[id]/ConsultationChat.tsx`
- Modify: `src/app/(dashboard)/consultations/[id]/ConsultationClient.tsx`
- Test: `src/app/(dashboard)/consultations/[id]/ConsultationChat.test.tsx`

**Interfaces:**
- Consumes: `<MicButton>` de `./MicButton`; `appendTranscript` de `@/lib/audio/transcribe-client`; `useSpeech` de `@/lib/audio/useSpeech`; `voiceForGender` de `@/lib/audio/voices`.
- Produces: `ConsultationChat` ganha a prop `patientGender: string`.

- [ ] **Step 1: Escrever o teste de integração que falha**

Create `src/app/(dashboard)/consultations/[id]/ConsultationChat.test.tsx`:

```tsx
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// MicButton stub: injeta um transcript ao clicar.
vi.mock('./MicButton', () => ({
  MicButton: ({ onTranscript }: { onTranscript: (t: string) => void }) => (
    <button onClick={() => onTranscript('falei isso')}>mic-stub</button>
  ),
}))

// useSpeech stub: expõe play para asserção.
const { mockPlay, mockStop } = vi.hoisted(() => ({ mockPlay: vi.fn(), mockStop: vi.fn() }))
vi.mock('@/lib/audio/useSpeech', () => ({
  useSpeech: () => ({ state: 'idle', error: null, play: mockPlay, stop: mockStop }),
}))

import { ConsultationChat } from './ConsultationChat'

beforeEach(() => vi.clearAllMocks())

describe('ConsultationChat — voz', () => {
  it('MicButton anexa o transcript ao input', () => {
    render(<ConsultationChat consultationId="c-1" initialMessages={[]} onMessagesUpdate={() => {}} patientGender="F" />)
    fireEvent.click(screen.getByText('mic-stub'))
    expect((screen.getByPlaceholderText(/mensagem/i) as HTMLInputElement).value).toContain('falei isso')
  })

  it('botão 🔊 numa bolha do paciente toca com a voz do gênero', () => {
    const msgs = [{ role: 'patient' as const, content: 'estou com dor', timestamp: 't' }]
    render(<ConsultationChat consultationId="c-1" initialMessages={msgs} onMessagesUpdate={() => {}} patientGender="M" />)
    fireEvent.click(screen.getByLabelText(/ouvir/i))
    expect(mockPlay).toHaveBeenCalledWith('estou com dor', 'onyx')
  })

  it('auto-play desligado por padrão: não toca sozinho ao renderizar respostas', () => {
    const msgs = [{ role: 'patient' as const, content: 'oi', timestamp: 't' }]
    render(<ConsultationChat consultationId="c-1" initialMessages={msgs} onMessagesUpdate={() => {}} patientGender="F" />)
    expect(mockPlay).not.toHaveBeenCalled()
  })

  it('o toggle de auto-play existe e começa desligado', () => {
    render(<ConsultationChat consultationId="c-1" initialMessages={[]} onMessagesUpdate={() => {}} patientGender="F" />)
    const toggle = screen.getByLabelText(/ouvir o paciente/i) as HTMLInputElement
    expect(toggle.checked).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run "src/app/(dashboard)/consultations/[id]/ConsultationChat.test.tsx"`
Expected: FAIL — sem prop `patientGender` / sem MicButton / sem botão ouvir / sem toggle.

- [ ] **Step 3: Editar `ConsultationChat`**

Modify `src/app/(dashboard)/consultations/[id]/ConsultationChat.tsx`:

(a) Imports no topo (após `import type { ChatMessage } from '@/lib/consultations/prompts'`):

```tsx
import { MicButton } from './MicButton'
import { appendTranscript } from '@/lib/audio/transcribe-client'
import { useSpeech } from '@/lib/audio/useSpeech'
import { voiceForGender } from '@/lib/audio/voices'
```

(b) Prop `patientGender` no type e na assinatura. Trocar o `type Props` e a linha da função:

```tsx
type Props = {
  consultationId: string
  initialMessages: ChatMessage[]
  onMessagesUpdate: (messages: ChatMessage[]) => void
  patientGender: string
}

export function ConsultationChat({ consultationId, initialMessages, onMessagesUpdate, patientGender }: Props) {
```

(c) Estado novo (após `const [error, setError] = useState<string | null>(null)`):

```tsx
  const [autoSpeak, setAutoSpeak] = useState(false)
  const { play } = useSpeech()
  const voice = voiceForGender(patientGender)
```

(d) Auto-play da nova resposta: no `sendMessage`, logo após `setMessages(updated); onMessagesUpdate(updated)` (a linha que adiciona a `patientMsg`), inserir:

```tsx
      if (autoSpeak) play(data.reply, voice)
```

(e) Toggle no topo da lista de mensagens. Logo antes de `<div className="flex-1 overflow-y-auto p-4 space-y-3">`, adicionar:

```tsx
      <label className="flex items-center gap-2 px-4 py-2 border-b text-xs text-gray-500">
        <input type="checkbox" checked={autoSpeak} onChange={e => setAutoSpeak(e.target.checked)} aria-label="ouvir o paciente" />
        🔊 ouvir o paciente
      </label>
```

(f) Botão 🔊 por bolha do paciente. Dentro do `map`, na bolha, após `{msg.content}` e ainda dentro do `<div className="max-w-[75%] ...">`, adicionar (apenas para o paciente):

```tsx
              {msg.role === 'patient' && (
                <button
                  type="button"
                  aria-label="ouvir resposta"
                  onClick={() => play(msg.content, voice)}
                  className="block mt-1 text-xs text-gray-400 hover:text-gray-600"
                >🔊</button>
              )}
```

(g) MicButton na barra de input. No `<div className="border-t p-4 flex gap-2">`, antes do `<input>`, adicionar:

```tsx
        <MicButton onTranscript={(t) => setInput(prev => appendTranscript(prev, t))} />
```

- [ ] **Step 4: Passar `patientGender` no `ConsultationClient`**

Modify `src/app/(dashboard)/consultations/[id]/ConsultationClient.tsx` — no `<ConsultationChat ... />` (por volta da linha 90), adicionar a prop:

```tsx
            <ConsultationChat
              consultationId={consultation.id}
              initialMessages={messages}
              onMessagesUpdate={setMessages}
              patientGender={patient.gender}
            />
```

- [ ] **Step 5: Rodar e ver passar + tsc**

Run: `npx vitest run "src/app/(dashboard)/consultations/[id]/ConsultationChat.test.tsx"` → PASS (4/4).
Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio.

> Nota sobre `setInput(prev => ...)`: o input do chat é um `useState<string>`; a forma funcional evita capturar `input` velho no closure do MicButton (mesma classe de bug de stale-closure da fatia anterior). Use a forma funcional exatamente como no Step 3(g).

- [ ] **Step 6: Suíte completa + commit**

Run: `npx vitest run` → tudo verde (as 2 falhas de `specialties.test.ts` que dependem de Supabase live podem ocorrer se o projeto estiver pausado; ignore se forem só essas).

```bash
git add "src/app/(dashboard)/consultations/[id]/ConsultationChat.tsx" "src/app/(dashboard)/consultations/[id]/ConsultationClient.tsx" "src/app/(dashboard)/consultations/[id]/ConsultationChat.test.tsx"
git commit -m "feat(audio): voz no chat — MicButton no input, 🔊 por bolha e toggle auto-play do paciente"
```

---

## Task 5: Verificação final e validação manual

- [ ] **Step 1: Verificação completa**

Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio.
Run: `npx vitest run` → todos verdes.

- [ ] **Step 2: Validação manual (pós-deploy, manual no Easypanel)**

Sem migration nem env nova — só redeploy manual.
1. No chat, clicar 🔊 numa bolha do paciente → ouvir a resposta; voz masculina p/ paciente M, feminina p/ F.
2. Ligar o toggle "🔊 ouvir o paciente" → a próxima resposta do paciente toca sozinha; desligar → volta a só texto.
3. Clicar no microfone no chat, ditar uma frase → texto anexado ao input → enviar normalmente.
4. Confirmar que digitar+enviar continua idêntico ao de hoje (sem tocar em nada de áudio).

> Acurácia/qualidade da voz é do modelo. Se `gpt-4o-mini-tts` retornar 404 na chave, trocar `MODELS.tts` para `'tts-1'`.

---

## Self-Review (do autor do plano)

- **Cobertura do spec:** entrada de voz no chat (MicButton + append) → Task 4. Rota `/api/speak` + cap 4000 + voz normalizada → Task 2. `voiceForGender` + `MODELS.tts` → Task 1. `useSpeech` (play/stop/um-por-vez/erro/cleanup) → Task 3. 🔊 por bolha + toggle auto-play OFF por padrão + auto-play no recebimento → Task 4. `patientGender` via ConsultationClient → Task 4 Step 4. Verificação → Task 5. ✅
- **Princípio áudio-opcional:** auto-play default `false` (Task 4 Step 3, testado no Step 1); MicButton some se não suportado (herdado da fatia anterior); caminho só-texto inalterado (teste implícito — enviar mensagem não muda). ✅
- **Anti stale-closure:** `setInput(prev => appendTranscript(prev, t))` na forma funcional (Task 4 Step 3g + nota no Step 5) — lição da fatia anterior aplicada. O auto-play lê `autoSpeak`/`voice` no escopo do `sendMessage` (não em callback congelado de longa duração), então não sofre do mesmo problema. ✅
- **Consistência de tipos:** `voiceForGender(gender): string` (Task 1) usado em Task 4; `useSpeech()` retorna `{state,error,play,stop}` (Task 3) e Task 4 usa `play`; rota consome `MODELS.tts` (Task 1→2). ✅
- **Placeholders:** nenhum — todo passo com código tem o código completo. ✅
- **Nota de teste:** o teste do chat (Task 4) faz mock de `./MicButton` e de `useSpeech` para isolar a lógica de integração (append + disparo de play) da rede/Audio reais — decisão consciente, mesmo padrão da fatia anterior.
