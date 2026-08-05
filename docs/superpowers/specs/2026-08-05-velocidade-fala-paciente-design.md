# Velocidade da fala do paciente — Design

**Data:** 2026-08-05
**Contexto:** Ajuste da fase de áudio (a fala do paciente por TTS está um pouco lenta).
**Status:** aprovado no brainstorming; pronto para plano.

## Objetivo

Permitir acelerar a fala do paciente. O TTS (`gpt-4o-mini-tts`) soa lento; o aluno deve poder escolher a velocidade de reprodução.

## Abordagem

Acelerar **no player**, via `audio.playbackRate` do elemento `Audio` já criado pelo `useSpeech` — NÃO re-gerar o áudio na OpenAI. Vantagens: instantâneo, sem custo extra, sem latência de nova chamada; o navegador preserva o tom (pitch) automaticamente. (O parâmetro `speed` da API de TTS foi descartado: custaria uma chamada nova e espera a cada troca.)

## Mudanças

1. **`src/lib/audio/useSpeech.ts`** — `play(text, voice, rate = 1)` ganha o 3º parâmetro `rate`. Ao criar o `Audio`, setar `audio.playbackRate = rate` antes de `audio.play()`. Default `1` mantém compatibilidade com qualquer chamada sem `rate`.
2. **`src/app/(dashboard)/consultations/[id]/ConsultationChat.tsx`** — seletor de velocidade ao lado do toggle "🔊 ouvir o paciente". Estado `speed: number` (default **1.25**). Passa `speed` ao `play` nas DUAS chamadas: botão ▶ por bolha e auto-play em `sendMessage`.

## Regras

- **Velocidade padrão = 1.25×** (resolve a lentidão de saída, sem obrigar o aluno a mexer).
- Valores do seletor: **1× · 1.25× · 1.5× · 2×**.
- Uma escolha só, aplicada a TODA a fala do paciente (auto-play + botão da bolha).
- Não afeta nada do caminho só-texto nem do microfone.

## Fora de escopo (YAGNI)

- Persistir a preferência de velocidade entre consultas (fica no estado da sessão do chat).
- Velocidades fracionárias arbitrárias / slider contínuo.
- `speed` server-side no TTS.

## Arquivos afetados

- **Modificar** `src/lib/audio/useSpeech.ts` — 3º param `rate` + `playbackRate`. + ajuste em `useSpeech.test.ts`.
- **Modificar** `src/app/(dashboard)/consultations/[id]/ConsultationChat.tsx` — estado `speed` + seletor + passar `speed` ao `play`. + ajuste em `ConsultationChat.test.tsx`.

## Testes

- `useSpeech`: `play(text, voice, 1.5)` → o `Audio` criado recebe `playbackRate === 1.5`; sem `rate` → `playbackRate === 1`. (MockAudio ganha campo `playbackRate`.)
- `ConsultationChat`: o seletor começa em 1.25; ao tocar uma bolha do paciente, `play` é chamado com o `speed` selecionado (ex.: mudar para 1.5 → `play(content, voice, 1.5)`).
- Suíte verde; tsc limpo (exceto validator.ts).

## Verificação

- Validação manual pós-deploy (redeploy manual Easypanel; sem migration/env): ouvir a fala do paciente em 1.25× (padrão), trocar para 1.5×/2×/1× e confirmar a mudança de velocidade; conferir que o auto-play também respeita a velocidade escolhida.
