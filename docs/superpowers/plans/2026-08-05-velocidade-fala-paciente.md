# Velocidade da fala do paciente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir acelerar a fala do paciente via `audio.playbackRate`, com um seletor de velocidade no chat (default 1.25×).

**Architecture:** `useSpeech.play` ganha um 3º parâmetro `rate` e aplica `audio.playbackRate = rate`. `ConsultationChat` guarda um estado `speed` (default 1.25), renderiza um seletor e passa `speed` ao `play` no auto-play e no botão por bolha.

**Tech Stack:** React (client hook + componente), Vitest + @testing-library/react (jsdom), TypeScript.

## Global Constraints

- Acelerar NO PLAYER (`audio.playbackRate`), NÃO re-gerar o TTS na OpenAI.
- `play(text, voice, rate = 1)`: o default `1` mantém compatibilidade com chamadas sem `rate`.
- Velocidade padrão do chat = **1.25**; valores do seletor: **1, 1.25, 1.5, 2**.
- Uma escolha só, aplicada a TODA a fala do paciente (auto-play + botão da bolha).
- Não altera o caminho só-texto nem o microfone.
- tsc limpo exceto validator.ts: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio.
- Sem migration, sem env nova.

---

## File Structure

- `src/lib/audio/useSpeech.ts` — **Modify**: 3º param `rate` em `play`, aplica `playbackRate`. + `useSpeech.test.ts`.
- `src/app/(dashboard)/consultations/[id]/ConsultationChat.tsx` — **Modify**: estado `speed` + seletor + passar `speed` ao `play`. + `ConsultationChat.test.tsx`.

---

## Task 1: `rate` em `useSpeech.play` (playbackRate)

**Files:**
- Modify: `src/lib/audio/useSpeech.ts`
- Test: `src/lib/audio/useSpeech.test.ts`

**Interfaces:**
- Produces: `play(text: string, voice: string, rate?: number): Promise<void>` — o `Audio` criado recebe `playbackRate = rate` (default 1).

**Contexto do arquivo atual:** `play` é um `useCallback(async (text, voice) => {...})`. Depois de passar pelos guardas de token, faz `const audio = new Audio(url)`, define `audio.onended`, e chama `await audio.play()`. O `playbackRate` deve ser setado no `audio` ANTES do `await audio.play()`.

- [ ] **Step 1: Escrever o teste que falha**

No `src/lib/audio/useSpeech.test.ts`: (a) adicionar o campo `playbackRate` ao mock `MockAudio` (junto dos outros campos, ex. após `paused = true`):

```ts
  playbackRate = 1
```

(b) adicionar um novo teste dentro do `describe('useSpeech', ...)`:

```ts
  it('aplica o playbackRate recebido no áudio', async () => {
    const { result } = renderHook(() => useSpeech())
    await act(async () => { await result.current.play('olá', 'onyx', 1.5) })
    await waitFor(() => expect(result.current.state).toBe('playing'))
    expect(MockAudio.instances[0].playbackRate).toBe(1.5)
  })

  it('sem rate, playbackRate fica 1 (default)', async () => {
    const { result } = renderHook(() => useSpeech())
    await act(async () => { await result.current.play('olá', 'onyx') })
    await waitFor(() => expect(result.current.state).toBe('playing'))
    expect(MockAudio.instances[0].playbackRate).toBe(1)
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/audio/useSpeech.test.ts`
Expected: o teste de `1.5` FALHA (playbackRate continua 1, pois o hook ainda não seta).

- [ ] **Step 3: Implementar**

Em `src/lib/audio/useSpeech.ts`:

(a) assinatura do `play` — adicionar o 3º parâmetro:

```ts
  const play = useCallback(async (text: string, voice: string, rate = 1) => {
```

(b) após `const audio = new Audio(url)` e antes de `audio.onended = ...`, setar o rate:

```ts
    audio.playbackRate = rate
```

- [ ] **Step 4: Rodar e ver passar + tsc**

Run: `npx vitest run src/lib/audio/useSpeech.test.ts` → PASS (todos, incl. os 2 novos).
Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio/useSpeech.ts src/lib/audio/useSpeech.test.ts
git commit -m "feat(audio): useSpeech.play aceita rate (playbackRate)"
```

---

## Task 2: Seletor de velocidade no `ConsultationChat`

**Files:**
- Modify: `src/app/(dashboard)/consultations/[id]/ConsultationChat.tsx`
- Test: `src/app/(dashboard)/consultations/[id]/ConsultationChat.test.tsx`

**Interfaces:**
- Consumes: `play(text, voice, rate?)` de `useSpeech` (Task 1).

**Contexto do arquivo atual:** há `const { state, play, stop } = useSpeech()`, um `<label>` com o toggle "ouvir o paciente" no topo, o auto-play em `sendMessage` (`if (autoSpeak) { play(data.reply, voice); setPlayingIdx(...) }`), e o botão por bolha (`onClick={() => { play(msg.content, voice); setPlayingIdx(i) }}`). O teste faz mock de `@/lib/audio/useSpeech` expondo `play` (e `state`/`stop`).

- [ ] **Step 1: Escrever o teste que falha**

No `src/app/(dashboard)/consultations/[id]/ConsultationChat.test.tsx`, adicionar um teste (o mock de `useSpeech` já expõe `mockPlay`):

```tsx
  it('toca a bolha do paciente com a velocidade selecionada', () => {
    const msgs = [{ role: 'patient' as const, content: 'estou com dor', timestamp: 't' }]
    render(<ConsultationChat consultationId="c-1" initialMessages={msgs} onMessagesUpdate={() => {}} patientGender="M" />)
    // troca a velocidade para 1.5×
    fireEvent.change(screen.getByLabelText(/velocidade/i), { target: { value: '1.5' } })
    fireEvent.click(screen.getByLabelText('ouvir resposta'))
    expect(mockPlay).toHaveBeenCalledWith('estou com dor', 'onyx', 1.5)
  })

  it('velocidade padrão é 1.25×', () => {
    render(<ConsultationChat consultationId="c-1" initialMessages={[]} onMessagesUpdate={() => {}} patientGender="F" />)
    expect((screen.getByLabelText(/velocidade/i) as HTMLSelectElement).value).toBe('1.25')
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run "src/app/(dashboard)/consultations/[id]/ConsultationChat.test.tsx"`
Expected: FAIL — sem seletor de velocidade / `play` chamado sem o 3º argumento.

- [ ] **Step 3: Implementar**

Em `src/app/(dashboard)/consultations/[id]/ConsultationChat.tsx`:

(a) estado do speed — após `const [playingIdx, setPlayingIdx] = useState<number | null>(null)`:

```tsx
  const [speed, setSpeed] = useState(1.25)
```

(b) auto-play — trocar a linha `if (autoSpeak) { play(data.reply, voice); setPlayingIdx(updated.length - 1) }` por:

```tsx
      if (autoSpeak) { play(data.reply, voice, speed); setPlayingIdx(updated.length - 1) }
```

(c) botão por bolha — trocar `onClick={() => { play(msg.content, voice); setPlayingIdx(i) }}` por:

```tsx
                    onClick={() => { play(msg.content, voice, speed); setPlayingIdx(i) }}
```

(d) seletor — dentro do `<label>` do topo (o do toggle "ouvir o paciente"), após o texto `🔊 ouvir o paciente`, adicionar o select (ainda dentro do `<label>` de topo ou logo após; para manter a associação do aria-label, colocá-lo como um elemento próprio ao lado). Substituir o bloco `<label>...</label>` do topo (linhas do toggle) por:

```tsx
      <div className="flex items-center gap-3 px-4 py-2 border-b text-xs text-gray-500">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={autoSpeak} onChange={e => setAutoSpeak(e.target.checked)} aria-label="ouvir o paciente" />
          🔊 ouvir o paciente
        </label>
        <label className="flex items-center gap-1">
          velocidade
          <select
            aria-label="velocidade"
            value={speed}
            onChange={e => setSpeed(Number(e.target.value))}
            className="border border-gray-300 rounded px-1 py-0.5"
          >
            <option value="1">1×</option>
            <option value="1.25">1.25×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>
        </label>
      </div>
```

- [ ] **Step 4: Rodar e ver passar + tsc**

Run: `npx vitest run "src/app/(dashboard)/consultations/[id]/ConsultationChat.test.tsx"` → PASS.
Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio.

- [ ] **Step 5: Suíte completa + commit**

Run: `npx vitest run` → tudo verde (as 2 falhas de `specialties.test.ts` que dependem de Supabase live só ocorrem se o projeto estiver pausado; ignore se forem só essas).

```bash
git add "src/app/(dashboard)/consultations/[id]/ConsultationChat.tsx" "src/app/(dashboard)/consultations/[id]/ConsultationChat.test.tsx"
git commit -m "feat(chat): seletor de velocidade da fala do paciente (default 1.25×)"
```

---

## Task 3: Verificação final e validação manual

- [ ] **Step 1: Verificação completa**

Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"` → vazio.
Run: `npx vitest run` → todos verdes.

- [ ] **Step 2: Validação manual (pós-deploy, manual no Easypanel)**

Sem migration/env — só redeploy manual.
1. Ouvir a fala do paciente: por padrão soa em 1.25× (mais ágil que antes).
2. Trocar o seletor para 1.5× / 2× / 1× e confirmar a mudança de velocidade na próxima reprodução.
3. Ligar o toggle "ouvir o paciente" e confirmar que o auto-play também respeita a velocidade escolhida.

---

## Self-Review (do autor do plano)

- **Cobertura do spec:** `rate` em `useSpeech.play` + `playbackRate` → Task 1. Seletor + estado `speed` default 1.25 + valores 1/1.25/1.5/2 + passar a ambas as chamadas de `play` → Task 2. Verificação → Task 3. ✅
- **Consistência de tipos:** `play(text, voice, rate?)` definido na Task 1 e consumido na Task 2 com 3 args (auto-play e bolha). ✅
- **Placeholders:** nenhum — todo passo com código completo. ✅
- **Nota:** o teste do chat depende do mock de `useSpeech` já existente (`mockPlay`); os novos casos só acrescentam o 3º argumento e o seletor. O caminho só-texto e o MicButton não são tocados.
