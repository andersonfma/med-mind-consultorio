# Quiz + Caso da Semana — design

Data: 2026-10-08
Status: aprovado no brainstorming; aguardando revisão da spec antes do plano de implementação.
Contexto: fatia da rede social Med Mind (ver `2026-10-06-rede-social-medmind-design.md`).
Decidida como a PRÓXIMA fatia, à frente de stories/compartilhamento/premium.

## Objetivo

Criar o maior gancho de **hábito diário** do produto: um **caso clínico por semana**
(Clínica Médica), revelado ao longo de 5 dias úteis, com **um quiz por dia** e **conclusão +
revisão na sexta**, igual para toda a rede. Mais um **quiz do usuário** (qualquer aluno monta
um quiz e posta no feed). O desafio oficial alimenta o XP/ranking com uma mecânica de **aposta
de XP (quiz bet)** e **streak**.

Métrica de sucesso: % da rede que responde o desafio a cada dia; dias de streak; retorno D1.

## Decisões travadas (brainstorming)

1. **Arco de 5 dias (seg→sex)**: Seg = apresentação/anamnese, Ter = exame físico + hipóteses,
   Qua = exames complementares, Qui = conduta, Sex = conclusão + revisão. Um caso por semana,
   Clínica Médica.
2. **Geração da semana inteira num job** (domingo ~22h): o caso + os 5 quizzes são gerados de
   uma vez, coerentes, e guardados; os dias só "abrem" por data (`reveal_date <= hoje`). Sem
   geração em horário de pico, 1 ponto de falha.
3. **Gatilho** = cron externo apontando pra uma rota protegida (`CRON_SECRET`); botão no `/admin`
   como semente/fallback. (Confirmado: cron externo + botão no admin.)
4. **Resposta**: 1 tentativa por quiz; ao responder revela gabarito + explicação + % da rede;
   o quiz fecha no fim do dia (`reveal_date`).
5. **Pontuação = aposta de XP (quiz bet), OPCIONAL**: antes de responder, o aluno pode apostar
   10/25/50 XP (limitado ao saldo) ou responder sem apostar. Acerto → `+aposta × fator`; erro →
   `−aposta` (saldo nunca fica negativo). Fator do dia: ×1 (dias 1–4), ×2 (sexta/conclusão).
6. **Streak** amplifica só o ganho: `fatorStreak = min(1 + 0,1×(streak−1), 2,0)`.
7. **XP unificado** num ledger `xp_events`; o ranking passa a somar `consultations.points +
   xp_events.points` (mesmo placar). (Confirmado.)
8. **Quiz do usuário**: tipo de post, respondível no feed, **sem aposta e sem XP** (anti-farm).
9. **Presença**: banner "Desafio de hoje" no topo do feed + aba "Desafio" na barra inferior.
10. **Aluno novo (0 XP)**: pode apostar a faixa mínima "da casa" (10) — acerta ganha, erra fica
    em 0 (não há o que tirar).

## Arquitetura de dados (Supabase, RLS)

### `weekly_cases`
`id` uuid pk · `week_start` date (segunda-feira; **único**) · `specialty` text ('Clínica Médica')
· `title` text · `true_diagnosis` text · `overview` text (narrativa base do caso) · `review` text
(texto de revisão da sexta) · `created_at`.

### `quizzes` (desafio E usuário)
`id` uuid pk · `author_id` uuid null (**null = sistema**) · `prompt` text · `options` jsonb
(`[{key:'A',text:'...'}, ...]`, 2–5) · `correct_key` text · `explanation` text · `created_at`.
CHECK: `options` tem 2–5 itens; `correct_key` existe entre as options (validado na escrita).

### `challenge_days`
`id` uuid pk · `weekly_case_id` uuid fk · `day_index` int (1–5) · `reveal_date` date · `stage`
text ('anamnese'|'exame'|'complementares'|'conduta'|'conclusao') · `narrative` text (o que é
revelado nesse dia) · `quiz_id` uuid fk → quizzes. **Único (weekly_case_id, day_index)** e
**único (reveal_date)** por caso. Dia aberto quando `reveal_date <= hoje`.

### `quiz_answers`
`quiz_id` uuid fk · `user_id` uuid fk · `chosen_key` text · `is_correct` bool · `stake` int
(0 se sem aposta) · `delta` int (XP ganho/perdido já resolvido) · `created_at`. **PK (quiz_id,
user_id)** → 1 tentativa.

### `xp_events` (ledger único de XP)
`id` uuid pk · `user_id` uuid fk · `points` int (pode ser negativo) · `source` text
('challenge') · `ref_id` uuid null (quiz_id) · `created_at`. Índice (user_id).

### `posts` (estende a Fatia 1)
`kind` passa a aceitar `'quiz'` (além de 'card'/'text'); nova coluna `quiz_id` uuid null → quizzes.
CHECK atualizado: `kind='quiz'` exige `quiz_id` não nulo.

### `profiles` (estende)
`challenge_streak` int default 0 · `challenge_last_date` date null.

### RLS / anti-cola
- `weekly_cases` e `challenge_days`: SELECT liberado a autenticados **somente para dias já
  revelados** (`reveal_date <= current_date`); dias futuros invisíveis.
- `quizzes`: um quiz de desafio só é legível quando seu `challenge_days.reveal_date <= hoje`;
  mesmo assim, **`correct_key` e `explanation` NUNCA são enviados ao cliente antes de o usuário
  responder OU de o dia fechar** — isso é enforçado na CAMADA DE API (seleção de colunas por
  estado), porque a RLS é por linha, não por coluna condicional. Quizzes de usuário: legíveis
  conforme visibilidade do post que os referencia (regras da Fatia 1), com a mesma regra de não
  vazar gabarito antes de responder.
- `quiz_answers`: cada usuário lê/escreve só as suas (`auth.uid() = user_id`). Contagem de % da
  rede e de acertos é feita via service role (admin) na API, agregada.
- `xp_events`: sem SELECT para authenticated (lido só via service role no cálculo do ranking);
  INSERT só via service role (a API resolve a aposta no servidor — o cliente nunca escreve XP).
- `profiles.challenge_streak/last_date`: escrita via service role (como o opt-in do ranking).

## Geração (job semanal)

- Rota protegida `POST /api/cron/generate-weekly-case` — exige header `x-cron-secret` ==
  `process.env.CRON_SECRET` (401 senão). **Idempotente**: se já existe `weekly_cases` para a
  próxima `week_start`, responde 200 `{ skipped: true }` sem gerar.
- Gera numa sequência de chamadas à IA (reaproveitando a infra de geração com âncora
  `true_diagnosis`, modelos em `MODELS`): primeiro o caso (title, true_diagnosis, overview,
  review), depois os 5 quizzes coerentes (um por `stage`, cada um com enunciado situado naquele
  ponto do arco + 4–5 alternativas + correct_key + explanation + a `narrative` revelada no dia).
  Persiste `weekly_cases` + 5 `challenge_days` (reveal_date seg→sex da próxima semana) + 5
  `quizzes`. Tudo best-effort transacional na aplicação (se um quiz falhar, desfaz o caso da
  semana para não deixar semana pela metade).
- **Gatilho**: agendador externo (cron-job.org / GitHub Action / pg_cron do Supabase via HTTP)
  chamando a rota aos domingos ~22h BRT com o `CRON_SECRET`. O `/admin` tem botão "Gerar caso da
  próxima semana" que chama a MESMA rota (semente inicial + fallback).
- Builder do prompt isolado em `src/lib/challenge/prompts.ts` (testável por estrutura).

## Lógica de pontuação (funções puras, testáveis)

`src/lib/challenge/scoring.ts`:
- `allowedStake(stake, balance): number` — valida a faixa escolhida: `0` (sem aposta) sempre;
  `10` sempre permitido (faixa "da casa", mesmo com saldo < 10); `25`/`50` só se `balance >=
  stake`, senão rebaixa para a maior faixa que cabe (`50→25→10→0`... mas 10 sempre vale). Devolve
  a aposta efetiva.
- `resolveBet(stake, isCorrect, balance, dayFactor, streakFactor): { delta: number; effStake: number }`
  - `effStake = allowedStake(stake, balance)`.
  - sem aposta (`effStake === 0`) → `delta = 0`.
  - acerto → `delta = round(effStake × dayFactor × streakFactor)`.
  - erro → `delta = -min(effStake, balance)` (saldo nunca fica negativo; com saldo 0 a perda é 0).
- `nextStreak(lastDate, today): number` — +1 se `lastDate` é o dia revelado imediatamente
  anterior; reseta para 1 se pulou; mantém se já respondeu hoje.
- `isDayOpen(revealDate, today): boolean` — `revealDate <= today`.
- `dayFactor(stage): number` — 2 para 'conclusao', senão 1.

A API de resposta (`POST /api/challenge/[quizId]/answer`) faz, no servidor: valida que o quiz é
do dia aberto e ainda não respondido; calcula `is_correct`; lê saldo (soma do ledger +
consultations.points); chama `resolveBet`; grava `quiz_answers` + um `xp_events` com o `delta`;
atualiza streak em `profiles`. Retorna `{ isCorrect, correctKey, explanation, networkPct, delta,
newBalance, streak }`.

## Ranking (ajuste)

`src/lib/scoring/leaderboard.ts` passa a receber também os totais de `xp_events` por usuário e
somá-los ao XP de consultas. A página `/ranking` busca (admin) `consultations.points` agregado +
`xp_events.points` agregado e passa à função pura. Mantém semana/geral e opt-in.

## Telas

- **Barra inferior**: ganha "Desafio" (5 itens: Feed · Desafio · Resultados · Ranking · Perfil).
- **Banner no feed** (`ChallengeBanner`): "Desafio de hoje — <stage>", estado (responder / já
  respondeu ✓), streak; linka `/desafio`. Some/benigno se não há caso na semana.
- **`/desafio`**: narrativa acumulada até hoje; quiz do dia (`ChallengeQuiz`: seletor de aposta
  opcional [sem aposta/10/25/50] limitado ao saldo → alternativas → ao responder revela
  acerto/erro, gabarito, explicação, % da rede, Δ XP, novo saldo e streak); dias anteriores já
  respondidos (gabarito visível); dias futuros bloqueados; sexta mostra conclusão + revisão.
- **Quiz do usuário**: `NewPostComposer` ganha modo "Quiz" (enunciado + 2–5 alternativas, marcar
  correta, explicação) → cria `quizzes` (author_id = user) + `posts` (kind='quiz', quiz_id).
  Renderização no feed/post: `QuizCard` responde inline, mostra % e explicação após responder,
  sem aposta/XP.
- **Admin** (`/admin`): botão "Gerar caso da próxima semana" (chama a rota de cron com o secret
  via server action/route).

## Rotas/APIs

- `POST /api/cron/generate-weekly-case` — gera a semana (protegida por `CRON_SECRET`).
- `GET /api/challenge/today` — caso da semana + dias abertos + quiz do dia (SEM gabarito) + se já
  respondeu + streak + saldo. (ou via server component na página; a rota existe para o banner.)
- `POST /api/challenge/[quizId]/answer` — `{ chosenKey, stake }` → resolve aposta (acima).
- `POST /api/quizzes` — cria quiz de usuário (valida 2–5 opções + correct_key) e o post.
- `POST /api/quizzes/[quizId]/answer` — responde quiz de usuário `{ chosenKey }` → `{ isCorrect,
  correctKey, explanation, networkPct }` (sem XP/aposta).

## Erro / resiliência
- Geração idempotente; falha parcial desfaz a semana. Sem caso → telas mostram estado vazio.
- Resposta idempotente (PK quiz+user); segunda tentativa → 409.
- Saldo nunca negativo (garantido em `resolveBet` + no servidor relendo o saldo).
- Cliente nunca escreve XP; a aposta é resolvida no servidor.

## Testes
- Puros: `resolveBet` (acerto/erro/sem aposta/saldo 0/limite pelo saldo/fatores dia+streak),
  `nextStreak` (consecutivo/pulou/mesmo dia), `isDayOpen`, `dayFactor`, ranking somando ledger.
- Rotas (TDD, padrão do projeto): answer do desafio (1 tentativa/409, não vaza gabarito antes),
  cron (secret, idempotência), criar/responder quiz de usuário.
- Anti-cola: teste garante que o GET do quiz aberto-não-respondido NÃO inclui `correct_key`.

## Fora de escopo (YAGNI)
Aposta em quiz de usuário; dinheiro real; histórico de semanas antigas (só a corrente); outras
especialidades além de Clínica Médica; notificação push (Fatia 2 de stories/notificações);
multiplayer/tempo real.

## Observações herdadas
- Deploy por webhook + builtAt (ver [[project-medmind-status]]). Aplicar migration no SQL editor:
  ver `reference-supabase-sql-editor-automation` (fechar outras abas, modal "Run query", bucket
  fora da migration, verificar por REST).
- Colunas/tabelas novas fora dos tipos gerados: user client castado `as unknown as SupabaseClient`
  nas rotas que tocam tabelas novas; admin client é untyped.
- Nova env: `CRON_SECRET` (no Easypanel + .env.local).
