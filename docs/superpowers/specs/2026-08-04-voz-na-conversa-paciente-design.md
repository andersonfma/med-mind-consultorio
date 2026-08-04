# Voz na conversa com o paciente — Design

**Data:** 2026-08-04
**Contexto:** Módulo Consultório do Med Mind Simulador. Segunda fatia da fase de áudio (a 1ª foi o ditado no pensamento clínico).
**Status:** aprovado no brainstorming; pronto para plano de implementação.

## Objetivo

Fechar o **loop de conversa falada** com o paciente: o aluno pode **falar** no chat (entrada de voz, reúso da fatia anterior) e o paciente pode **responder falando** (saída de voz via TTS). Reforça o diferencial imersivo ("fase poética").

## Princípio inviolável (preferência fixa do user): áudio é sempre OPCIONAL

- O chat funciona 100% só com texto, exatamente como hoje.
- **Auto-play do paciente é DESLIGADO por padrão** — o paciente nunca começa a falar sozinho sem o aluno pedir.
- A voz de entrada (microfone) só pede permissão ao clicar; some se o navegador não suportar.
- Nenhuma parte do fluxo textual regride.

## Metade 1 — Aluno fala no chat (entrada, reúso)

Reúso direto das peças da fatia anterior (`useVoiceDictation`, `<MicButton>`, rota `/api/transcribe`, `appendTranscript`).

- `<MicButton>` entra na barra de input do `ConsultationChat`, à esquerda do campo de texto.
- `onTranscript(t)` → `setInput(appendTranscript(input, t))`. O aluno revisa e envia normalmente (Enter / botão). Nada é enviado automaticamente.
- Opcional e aditivo: digitar continua idêntico.

## Metade 2 — Paciente fala (saída, TTS — peça nova)

### Rota `POST /api/speak`
- Auth Supabase (401 se não logado).
- Body JSON `{ text: string, voice: string }`.
- Valida: `text` não vazio; cap de **~4000 caracteres** (400 se exceder — respostas do paciente são curtas, isto é folga).
- `voice` normalizada para uma das vozes permitidas (fallback para a voz feminina padrão se vier valor inválido).
- Chama `openai.audio.speech.create({ model: MODELS.tts, voice, input: text, response_format: 'mp3' })`, timeout 25 s.
- Sucesso → devolve os bytes do mp3 (`Content-Type: audio/mpeg`). Áudio **não é persistido**.
- Falha/timeout → 500 `{ error }`; best-effort, a bolha de texto do paciente continua visível.

### Config de modelo e vozes
Adicionar em `src/lib/openai/models.ts`:
```ts
/** Síntese de voz (paciente falando). gpt-4o-mini-tts: boa qualidade e esteerável. Fallback: 'tts-1'. */
tts: 'gpt-4o-mini-tts',
```
Mapa de voz por gênero do paciente (`src/lib/audio/voices.ts`):
```ts
export function voiceForGender(gender: string): string {
  return gender === 'M' ? 'onyx' : 'shimmer'
}
```
(`onyx` = masculina; `shimmer` = feminina — vozes GA da OpenAI. Escolha fixa nesta fatia; steering de tom por emoção fica YAGNI para depois.)

### Player — hook `useSpeech`
`src/lib/audio/useSpeech.ts`:
- API: `{ state: 'idle' | 'loading' | 'playing'; error: string | null; play: (text: string, voice: string) => Promise<void>; stop: () => void }`.
- `play`: POST em `/api/speak` → recebe o blob mp3 → cria object URL → toca via `new Audio(url)`. Ao terminar (`onended`) ou em `stop()`, volta a `idle` e revoga o object URL.
- Só um áudio por vez: `play` novo interrompe o anterior.
- Erros (rede/tts) → `idle` + `error`, sem quebrar o chat.
- Cleanup: para o áudio e revoga a URL no unmount.

### UI no chat (`ConsultationChat`)
- Nova prop `patientGender: string` (vinda de `patient.gender` no `ConsultationClient`).
- **Botão 🔊 por bolha do paciente**: toca aquela mensagem sob demanda (▶/■ conforme o estado do hook para a mensagem tocando).
- **Toggle "🔊 ouvir o paciente"** no topo do chat (estado `autoSpeak`, default `false`): quando ligado, cada NOVA resposta do paciente é tocada automaticamente ao chegar (dispara `play(reply, voiceForGender(patientGender))`). Desligado → só texto.
- O toggle e o botão por bolha usam a mesma `voiceForGender(patientGender)`.

## Fora de escopo (YAGNI — fatias futuras)

- Steering de tom/emoção do TTS conforme o estado clínico do paciente.
- TTS na anamnese, exame físico, ou nas falas do sistema.
- Streaming de áudio / lip-sync / avatar.
- Persistir áudio; download; velocidade de reprodução.
- Voz de entrada em campos além do chat e do pensamento clínico.
- Detecção de voz por idade (só gênero nesta fatia).

## Arquivos afetados (mapa)

- **Criar** `src/app/api/speak/route.ts` + `route.test.ts`.
- **Criar** `src/lib/audio/voices.ts` (`voiceForGender`) + `voices.test.ts`.
- **Criar** `src/lib/audio/useSpeech.ts` + `useSpeech.test.ts`.
- **Modificar** `src/lib/openai/models.ts` — `MODELS.tts`.
- **Modificar** `src/app/(dashboard)/consultations/[id]/ConsultationChat.tsx` — MicButton no input (append), toggle autoSpeak, botão 🔊 por bolha do paciente, auto-play no recebimento da reply. Nova prop `patientGender`. + `ConsultationChat.test.tsx` (**Criar**).
- **Modificar** `src/app/(dashboard)/consultations/[id]/ConsultationClient.tsx` — passar `patientGender={patient.gender}` ao `ConsultationChat`.

## Testes

- **Rota `/api/speak`**: 401 sem auth; body válido → chama `openai.audio.speech.create` com `model: MODELS.tts`, a `voice` recebida e `input: text`, e responde `audio/mpeg`; texto vazio → 400; texto acima do cap → 400; falha da OpenAI → 500. Mock do cliente `openai`.
- **`voiceForGender`**: 'M' → 'onyx'; 'F' → 'shimmer'; valor desconhecido → voz feminina padrão.
- **`useSpeech`**: `play` faz POST e entra em 'playing' (Audio mockado); `stop` para e volta a idle; play novo interrompe o anterior; falha → idle + error. `fetch`/`Audio`/`URL.createObjectURL` mockados.
- **`ConsultationChat`**: MicButton anexa ao input (mock do MicButton); toggle autoSpeak ligado → ao chegar reply do paciente, `useSpeech.play` é chamado com `voiceForGender(patientGender)` (mock do useSpeech); autoSpeak desligado → não toca; caminho só-texto (enviar mensagem) inalterado.
- Acurácia da voz é probabilística (modelo) — os testes garantem fluxo/contrato.

## Verificação

- `npx vitest run` verde; `npx tsc --noEmit` limpo (exceto validator.ts pré-existente).
- Validação manual pós-deploy (redeploy manual Easypanel; sem migration/env nova):
  1. No chat, clicar 🔊 numa bolha do paciente → ouvir a resposta; voz masculina p/ paciente M, feminina p/ F.
  2. Ligar o toggle "ouvir o paciente" → a próxima resposta toca sozinha; desligar → volta a só texto.
  3. Ditar uma mensagem pelo microfone no chat → texto anexado ao input → enviar.
  4. Confirmar que digitar+enviar continua idêntico ao de hoje.

## Riscos / notas

- `gpt-4o-mini-tts` precisa estar acessível na chave da OpenAI — se der 404, trocar `MODELS.tts` para `'tts-1'` (1 linha; mesma API `audio.speech.create`).
- Latência: o áudio é gerado após a reply chegar (a reply já aparece como texto primeiro) — aceitável.
- Custo: TTS é cobrado por caractere; respostas do paciente são curtas e o auto-play é opt-in, o que bounda o gasto.
- `new Audio()`/autoplay: navegadores permitem autoplay de áudio após interação do usuário na página; como o aluno já interage (envia mensagens), o auto-play do toggle funciona. Se um navegador bloquear, o botão 🔊 por bolha é o fallback manual.
