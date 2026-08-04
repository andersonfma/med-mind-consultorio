# Áudio — ditado por voz no Pensamento Clínico — Design

**Data:** 2026-08-04
**Contexto:** Módulo Consultório do Med Mind Simulador. Primeira fatia da "fase de áudio".
**Status:** aprovado no brainstorming; pronto para plano de implementação.

## Objetivo

Permitir que o aluno **dite** o pensamento clínico por voz, além de digitar. O texto ditado é transcrito no servidor (OpenAI) e anexado ao campo `clinical_reasoning`. Primeira peça da fase de áudio; as peças são desenhadas para reúso futuro no chat/anamnese.

## Princípio inviolável: voz é OPCIONAL e ADITIVA

- O campo de Pensamento Clínico funciona **100% só com digitação**, exatamente como hoje. O microfone é um extra.
- O microfone **nunca** é obrigatório e **nunca** substitui a digitação.
- A permissão de microfone só é solicitada **quando o aluno clica no botão** — nunca no carregamento da página.
- Sem suporte a microfone/MediaRecorder, ou permissão negada: o campo continua funcionando normalmente; só o recurso de voz fica indisponível (mensagem discreta).

## Arquitetura — três peças reutilizáveis

Desenhadas para o chat/anamnese reusarem depois. Nesta fatia, só o Pensamento Clínico consome.

1. **`useVoiceDictation` (hook)** — `src/lib/audio/useVoiceDictation.ts`
   - Encapsula `MediaRecorder`. API: `{ state, start, stop, error }` onde `state: 'idle' | 'recording' | 'transcribing'`.
   - Grava em `audio/webm;codecs=opus` (mono). No `stop()`: monta o Blob, faz `POST /api/transcribe`, retorna o texto.
   - **Guarda de custo/duração:** cap de **120 s** por clipe — ao atingir, para sozinho (auto-stop) e transcreve o que gravou.
   - Detecta ausência de suporte (`typeof MediaRecorder === 'undefined'` ou `getUserMedia` indisponível) → expõe `unsupported` e nunca pede permissão.
   - Callback `onTranscript(text: string)` disparado com o texto final.
   - Limpa o stream (para as tracks do microfone) ao parar/desmontar.

2. **`<MicButton>`** — `src/app/(dashboard)/consultations/[id]/MicButton.tsx` (client)
   - Botão burro que consome o hook. Estados visuais: ocioso (ícone 🎤), gravando (pulsando + rótulo "gravando…" e, opcionalmente, contador), transcrevendo (spinner "transcrevendo…"), erro (ícone + tooltip da mensagem).
   - Toggle: 1º clique → `start()`; 2º clique → `stop()`.
   - Oculto/desabilitado quando `unsupported`.
   - Props: `{ onTranscript: (t: string) => void; disabled?: boolean }`.

3. **`POST /api/transcribe`** — `src/app/api/transcribe/route.ts`
   - Auth Supabase (401 se não logado).
   - Recebe `multipart/form-data` com o arquivo de áudio (campo `file`).
   - Valida: tipo de conteúdo de áudio; tamanho máximo (**~5 MB** — cobre ~120 s de opus com folga) → 413 se exceder.
   - Chama `openai.audio.transcriptions.create({ model: MODELS.transcription, file, language: 'pt' })`, timeout 25 s.
   - Sucesso → `{ text: string }` (trim). Áudio **não é persistido** — só o texto retorna.
   - Falha/timeout → 4xx/5xx com `{ error }`; best-effort, o cliente trata sem perder o texto digitado.

### Config de modelo

Adicionar em `src/lib/openai/models.ts`:
```ts
/** Transcrição de voz (ditado). gpt-4o-transcribe: melhor que whisper-1 em PT médico. */
transcription: 'gpt-4o-transcribe',
```
Se a chave retornar 404/sem acesso, cair para `'whisper-1'` (mesma API). Preço de referência (ago/2026): transcrição cobrada por minuto de áudio — o cap de 120 s bounded o custo por clipe.

## Integração no Pensamento Clínico

- `<MicButton>` no header do `ClinicalReasoningField`, ao lado do indicador "Salvo/Não salvo".
- `onTranscript(text)` → **anexa** ao valor atual: `value ? value + ' ' + text : text`, via o `onChange` já existente. Isso dispara o mesmo autosave por debounce (1,2 s) e marca "Não salvo". Digitação e voz se misturam livremente.
- O textarea permanece intocado no comportamento atual (controlado, autosave). Nenhuma regressão no caminho só-teclado.

## Tratamento de erros (todos sem quebrar o campo)

| Situação | Comportamento |
|---|---|
| Navegador sem MediaRecorder/getUserMedia | Botão oculto (`unsupported`); campo segue normal |
| Permissão de microfone negada | Volta a `idle` + mensagem "Permissão de microfone negada" |
| Clipe > 120 s | Auto-stop e transcreve o gravado |
| Áudio > 5 MB | Rota responde 413; botão mostra "Áudio muito longo" |
| Transcrição falha/timeout/vazia | Volta a `idle` + "Não consegui transcrever, tente de novo"; texto digitado preservado |

## Fora de escopo (YAGNI — fases seguintes)

- Voz no chat médico e na anamnese (reúso das mesmas peças; fatia futura).
- Saída por voz (TTS das falas do paciente).
- Transcrição em streaming/tempo real (esta fatia é gravar→transcrever→anexar).
- Persistir o áudio; edição do trecho transcrito antes de inserir; pontuação/comandos de voz.
- Indicador de nível de áudio (waveform) — nice-to-have, não essencial.

## Arquivos afetados (mapa)

- **Criar** `src/lib/audio/useVoiceDictation.ts` (hook) + `src/lib/audio/useVoiceDictation.test.ts`.
- **Criar** `src/app/(dashboard)/consultations/[id]/MicButton.tsx`.
- **Criar** `src/app/api/transcribe/route.ts` + `src/app/api/transcribe/route.test.ts`.
- **Modificar** `src/lib/openai/models.ts` — `MODELS.transcription`.
- **Modificar** `src/app/(dashboard)/consultations/[id]/ClinicalReasoningField.tsx` — header ganha `<MicButton>`; `onTranscript` anexa ao valor.
- Possível ajuste no Dockerfile? Não — a rota usa a `OPENAI_API_KEY` já presente. Sem novas envs.

## Testes

- **Hook** (`useVoiceDictation.test.ts`): máquina de estados idle→recording→transcribing→idle; auto-stop no cap; caminho de permissão negada; `unsupported` quando MediaRecorder ausente. MediaRecorder, getUserMedia e fetch mockados (vi.hoisted p/ mocks).
- **Rota** (`route.test.ts`): 401 sem auth; multipart válido → chama `transcriptions.create` e retorna `{text}`; 413 acima do limite; falha da OpenAI → erro tratado (best-effort). Mock do cliente `openai`.
- **Campo**: `onTranscript` anexa ao valor com espaço e marca "Não salvo"; caminho só-teclado inalterado.
- Acurácia da transcrição é probabilística (modelo) — os testes garantem fluxo e contrato, não as palavras.

## Verificação

- `npx vitest run` verde; `npx tsc --noEmit` limpo (exceto validator.ts pré-existente).
- Validação manual pós-deploy: ditar uma frase clínica em PT no campo → texto plausível anexado; testar permissão negada e navegador sem suporte (campo segue digitável).
- ⚠️ Deploy: sem migration nem env nova. Redeploy manual Easypanel como sempre.

## Riscos / notas

- `gpt-4o-transcribe` precisa estar acessível na chave da OpenAI do projeto — se não, `whisper-1` (fallback trivial, 1 linha).
- Latência gravar→enviar→transcrever é aceitável para ditado reflexivo (não é conversa ao vivo).
- HTTPS é requisito de `getUserMedia` — produção (Easypanel) já é HTTPS; em dev, `localhost` é permitido.
