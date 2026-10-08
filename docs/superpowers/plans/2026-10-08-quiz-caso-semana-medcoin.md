# Quiz + Caso da Semana + MedCoin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desafio diário (caso semanal de Clínica Médica em 5 dias, 1 quiz/dia, conclusão na sexta) com aposta de MedCoin + streak; MedCoin como moeda única; quiz do usuário; Post-Dúvida com recompensa de resposta rápida; Resenha de artigo.

**Architecture:** Next.js 16 App Router + Supabase. Lógica de economia/streak/aposta e gating de dia em funções PURAS testáveis. Geração do caso num job semanal protegido (cron do GitHub Actions) idempotente. XP unificado num ledger `medcoin_events`; o ranking soma `consultations.points + medcoin_events.points` (a função pura `computeLeaderboard` não muda — a página passa as duas fontes como linhas `{user_id, points}`). Rotas tocando tabelas novas usam o user client castado `as unknown as SupabaseClient` (tabelas fora dos tipos gerados); gabarito nunca vai ao cliente antes de responder.

**Tech Stack:** Next.js 16, Supabase JS (@supabase/supabase-js, @supabase/ssr), OpenAI SDK (infra de geração existente, `MODELS`), Tailwind v4, vitest (node env + `vi.hoisted`), GitHub Actions (cron).

**Spec:** `docs/superpowers/specs/2026-10-08-quiz-e-caso-da-semana-design.md` (+ adendo MedCoin/Dúvida/Resenha).

## Global Constraints

- pt-BR em toda UI/cópia. Moeda = **MedCoin** (relabel de todo "XP"/"pontos" existente). Ícone sugerido 🪙/"MC".
- Casos simulados; nenhum dado real de paciente.
- Tabelas/colunas novas fora dos tipos gerados: user client `as unknown as SupabaseClient`; admin client (`createAdminClient`) é untyped; updates com `as never` quando pelo client tipado.
- Cliente NUNCA escreve MedCoin; toda resolução de aposta/recompensa é no servidor com service role.
- Gabarito/explicação do desafio NUNCA vão ao cliente antes de responder ou do dia fechar (seleção de colunas por estado na API).
- Saldo de MedCoin nunca fica negativo.
- Migration aplicada no SQL editor do Supabase (ver `reference-supabase-sql-editor-automation`: fechar outras abas; modal "Run query"; bucket fora da migration; verificar por REST). Buckets via Storage API.
- Nova env `CRON_SECRET` (Easypanel + .env.local + secret do GitHub Actions).
- Deploy por webhook; builtAt confirma (ver project-medmind-status).
- Tokens de rota em `src/lib/routes.ts`.

## Constantes da economia (uma fonte)
`src/lib/economy.ts`: `STAKES = [10,25,50]`, `HOUSE_MIN = 10`, `DOUBT_REWARD = 15`, `DOUBT_WINDOW_MIN = 30`, `STREAK_CAP = 2.0`, `dayFactor(stage)`.

---

## File Structure

**Criar:**
- `supabase/migrations/20261008120000_quiz_medcoin.sql`
- `src/lib/economy.ts` (+ `.test.ts`) — constantes + `resolveBet`, `allowedStake`, `nextStreak`, `isDayOpen`, `dayFactor`.
- `src/lib/challenge/prompts.ts` (+ `.test.ts`) — builder do prompt de geração semanal.
- `src/lib/challenge/generate.ts` — orquestra a geração (chama OpenAI, monta objetos) [testado via rota].
- `src/app/api/cron/generate-weekly-case/route.ts` (+ `.test.ts`)
- `src/app/api/challenge/today/route.ts` (+ `.test.ts`)
- `src/app/api/challenge/[quizId]/answer/route.ts` (+ `.test.ts`)
- `src/app/api/quizzes/route.ts` (+ `.test.ts`) — cria quiz de usuário + post.
- `src/app/api/quizzes/[quizId]/answer/route.ts` (+ `.test.ts`)
- `src/app/api/posts/image/route.ts` (+ `.test.ts`) — URL assinada p/ capa de resenha.
- `src/lib/social/balance.ts` (+ `.test.ts`) — `rowsForLeaderboard` helper (merge fontes) — opcional; ver Task 7.
- `src/app/(dashboard)/desafio/page.tsx` + `ChallengeQuiz.tsx` + `ChallengeBanner.tsx`
- `src/app/(dashboard)/feed/QuizCard.tsx` — render/responde quiz post.
- `.github/workflows/weekly-case.yml`

**Modificar:**
- `src/app/api/posts/route.ts` — aceitar kind `quiz`/`duvida`/`resenha` + `image_url`/`meta`/`quiz_id`.
- `src/app/api/posts/[id]/comments/route.ts` — recompensa de dúvida (30 min, 1º, ≠ autor).
- `src/app/(dashboard)/feed/NewPostComposer.tsx` — multi-modo (Texto/Dúvida/Quiz/Resenha).
- `src/app/(dashboard)/feed/page.tsx` + `PostCard.tsx` — banner do desafio; render de duvida/resenha/quiz.
- `src/app/(dashboard)/ranking/page.tsx` — somar `medcoin_events`; relabel MedCoin.
- `src/app/(dashboard)/consultations/[id]/FinishModal.tsx` + `src/app/api/share/[consultationId]/route.tsx` — relabel "XP" → "MedCoin".
- `src/components/layout/MobileNav.tsx` + `Shell.tsx` — aba "Desafio".
- `src/app/(dashboard)/admin/page.tsx` — botão "Gerar caso da próxima semana".
- `src/lib/routes.ts` — `CHALLENGE_ROUTE='/desafio'`.

---

## Task 1: Migration — economia + quiz + tipos de post

**Files:** Create `supabase/migrations/20261008120000_quiz_medcoin.sql`

**Interfaces:** Produces tabelas `weekly_cases`, `quizzes`, `challenge_days`, `quiz_answers`, `medcoin_events`; colunas `profiles.challenge_streak/challenge_last_date`; `posts.kind` (+quiz/duvida/resenha), `posts.quiz_id/image_url/meta`.

- [ ] **Step 1: Escrever a migration**

```sql
-- Quiz + Caso da Semana + MedCoin. RLS em tudo. Casos simulados.

-- posts: novos tipos + campos (quiz, duvida, resenha)
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_kind_check;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS quiz_id UUID;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS meta JSONB;
-- (constraint de kind recriada ao final, depois de quizzes existir p/ o FK)

-- Caso da semana
CREATE TABLE IF NOT EXISTS weekly_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL UNIQUE,
  specialty TEXT NOT NULL DEFAULT 'Clínica Médica',
  title TEXT NOT NULL,
  true_diagnosis TEXT NOT NULL,
  overview TEXT NOT NULL,
  review TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quizzes (desafio e usuário)
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- null = sistema
  prompt TEXT NOT NULL,
  options JSONB NOT NULL,          -- [{key,text}] 2..5
  correct_key TEXT NOT NULL,
  explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (jsonb_array_length(options) BETWEEN 2 AND 5)
);

-- posts.quiz_id FK agora que quizzes existe
ALTER TABLE posts ADD CONSTRAINT posts_quiz_fk FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE SET NULL;
ALTER TABLE posts ADD CONSTRAINT posts_kind_check CHECK (
  (kind = 'card' AND (consultation_id IS NOT NULL OR ranking_snapshot IS NOT NULL)) OR
  (kind = 'text' AND body IS NOT NULL AND length(btrim(body)) > 0) OR
  (kind = 'duvida' AND body IS NOT NULL AND length(btrim(body)) > 0) OR
  (kind = 'resenha' AND body IS NOT NULL AND length(btrim(body)) > 0) OR
  (kind = 'quiz' AND quiz_id IS NOT NULL)
);

-- Dias do caso
CREATE TABLE IF NOT EXISTS challenge_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_case_id UUID NOT NULL REFERENCES weekly_cases(id) ON DELETE CASCADE,
  day_index INT NOT NULL CHECK (day_index BETWEEN 1 AND 5),
  reveal_date DATE NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('anamnese','exame','complementares','conduta','conclusao')),
  narrative TEXT NOT NULL,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  UNIQUE (weekly_case_id, day_index)
);
CREATE INDEX IF NOT EXISTS challenge_days_reveal_idx ON challenge_days (reveal_date);

-- Respostas (1 tentativa)
CREATE TABLE IF NOT EXISTS quiz_answers (
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chosen_key TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  stake INT NOT NULL DEFAULT 0,
  delta INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (quiz_id, user_id)
);

-- Ledger de MedCoin
CREATE TABLE IF NOT EXISTS medcoin_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points INT NOT NULL,                 -- pode ser negativo
  source TEXT NOT NULL CHECK (source IN ('challenge','doubt_answer')),
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS medcoin_events_user_idx ON medcoin_events (user_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS medcoin_doubt_once ON medcoin_events (ref_id) WHERE source = 'doubt_answer';

-- Streak de desafio
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS challenge_streak INT NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS challenge_last_date DATE;

-- RLS
ALTER TABLE weekly_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE medcoin_events ENABLE ROW LEVEL SECURITY;

-- helper: o quiz é de um dia de desafio já revelado?
CREATE OR REPLACE FUNCTION challenge_quiz_open(q UUID) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM challenge_days d WHERE d.quiz_id = q AND d.reveal_date <= current_date);
$$;

-- weekly_cases / challenge_days: só dias já revelados
DROP POLICY IF EXISTS weekly_cases_sel ON weekly_cases;
CREATE POLICY weekly_cases_sel ON weekly_cases FOR SELECT
  USING (EXISTS (SELECT 1 FROM challenge_days d WHERE d.weekly_case_id = weekly_cases.id AND d.reveal_date <= current_date));
DROP POLICY IF EXISTS challenge_days_sel ON challenge_days;
CREATE POLICY challenge_days_sel ON challenge_days FOR SELECT
  USING (reveal_date <= current_date);

-- quizzes: desafio só se revelado; quiz de usuário sempre legível a autenticado
-- (o anti-cola de NÃO enviar correct_key antes de responder é feito na API, não na RLS)
DROP POLICY IF EXISTS quizzes_sel ON quizzes;
CREATE POLICY quizzes_sel ON quizzes FOR SELECT
  USING (
    author_id IS NOT NULL                                  -- quiz de usuário
    OR challenge_quiz_open(id)                             -- desafio já revelado
  );
DROP POLICY IF EXISTS quizzes_ins ON quizzes;
CREATE POLICY quizzes_ins ON quizzes FOR INSERT
  WITH CHECK (auth.uid() = author_id);                     -- usuário só cria os seus; sistema usa service role

-- quiz_answers: cada um as suas
DROP POLICY IF EXISTS quiz_answers_all ON quiz_answers;
CREATE POLICY quiz_answers_sel ON quiz_answers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY quiz_answers_ins ON quiz_answers FOR INSERT WITH CHECK (auth.uid() = user_id);

-- medcoin_events: sem acesso a authenticated (só service role lê/escreve)
-- (nenhuma policy => negado; service role bypassa)
```

- [ ] **Step 2: Aplicar no SQL editor + confirmar modal "Run query"** (ver reference). Esperado "Success. No rows returned".

- [ ] **Step 3: Criar bucket `post-media` via Storage API**

Run:
```bash
cd "C:/Users/ander/OneDrive/Documentos/Simulador"
SUPA_URL=$(grep -oE "https://[a-z0-9]+\.supabase\.co" .env.local | head -1)
SRK=$(grep -E "^SUPABASE_SERVICE_ROLE_KEY=" .env.local | head -1 | cut -d= -f2-); SRK=$(printf '%s' "$SRK" | tr -d '"' | tr -d "'" | tr -d '\r')
curl -s -X POST "$SUPA_URL/storage/v1/bucket" -H "apikey: $SRK" -H "Authorization: Bearer $SRK" -H "Content-Type: application/json" -d '{"id":"post-media","name":"post-media","public":true}'
```

- [ ] **Step 4: Verificar por REST**

```bash
for t in weekly_cases quizzes challenge_days quiz_answers medcoin_events; do echo -n "$t: "; curl -s -o /dev/null -w "%{http_code}\n" "$SUPA_URL/rest/v1/$t?select=*&limit=1" -H "apikey: $SRK" -H "Authorization: Bearer $SRK"; done
echo -n "posts cols: "; curl -s -o /dev/null -w "%{http_code}\n" "$SUPA_URL/rest/v1/posts?select=quiz_id,image_url,meta&limit=1" -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
echo -n "profiles streak: "; curl -s -o /dev/null -w "%{http_code}\n" "$SUPA_URL/rest/v1/profiles?select=challenge_streak,challenge_last_date&limit=1" -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
```
Esperado: tudo 200.

- [ ] **Step 5: Commit**
```bash
git add supabase/migrations/20261008120000_quiz_medcoin.sql
git commit -m "feat(quiz): migration — weekly_cases, quizzes, challenge_days, quiz_answers, medcoin_events, posts kinds"
```

---

## Task 2: Lib pura `economy.ts` (aposta, streak, gating)

**Files:** Create `src/lib/economy.ts`, `src/lib/economy.test.ts`

**Interfaces:** Produces:
- `STAKES: number[]`, `HOUSE_MIN`, `DOUBT_REWARD`, `DOUBT_WINDOW_MIN`
- `type Stage = 'anamnese'|'exame'|'complementares'|'conduta'|'conclusao'`
- `dayFactor(stage: Stage): number`
- `allowedStake(stake: number, balance: number): number`
- `resolveBet(stake, isCorrect, balance, dayFactor, streakFactor): { delta: number; effStake: number }`
- `streakFactor(streak: number): number`
- `nextStreak(lastDate: string|null, today: string): number`
- `isDayOpen(revealDate: string, today: string): boolean`

- [ ] **Step 1: Testes (falhando)**

```ts
// src/lib/economy.test.ts
import { describe, it, expect } from 'vitest'
import { allowedStake, resolveBet, streakFactor, nextStreak, isDayOpen, dayFactor } from './economy'

describe('allowedStake', () => {
  it('0 (sem aposta) sempre', () => { expect(allowedStake(0, 999)).toBe(0) })
  it('10 sempre, mesmo com saldo 0 (faixa da casa)', () => { expect(allowedStake(10, 0)).toBe(10) })
  it('25/50 só com saldo suficiente; senão rebaixa', () => {
    expect(allowedStake(50, 100)).toBe(50)
    expect(allowedStake(50, 30)).toBe(25)
    expect(allowedStake(25, 10)).toBe(10)
    expect(allowedStake(50, 0)).toBe(10)
  })
})

describe('resolveBet', () => {
  it('sem aposta → delta 0', () => { expect(resolveBet(0, true, 100, 1, 1).delta).toBe(0) })
  it('acerto → +effStake × fatores', () => {
    expect(resolveBet(50, true, 100, 1, 1)).toEqual({ delta: 50, effStake: 50 })
    expect(resolveBet(50, true, 100, 2, 1).delta).toBe(100)
    expect(resolveBet(10, true, 100, 1, 1.5).delta).toBe(15)
  })
  it('erro → -effStake, saldo nunca negativo', () => {
    expect(resolveBet(50, false, 100, 1, 1).delta).toBe(-50)
    expect(resolveBet(10, false, 0, 1, 1).delta).toBe(0) // saldo 0, perda 0
    expect(resolveBet(25, false, 10, 1, 1).delta).toBe(-10) // rebaixa p/ 10
  })
})

describe('streakFactor', () => {
  it('1 no streak 1; cresce 0,1/dia; cap 2,0', () => {
    expect(streakFactor(1)).toBeCloseTo(1)
    expect(streakFactor(3)).toBeCloseTo(1.2)
    expect(streakFactor(20)).toBeCloseTo(2.0)
  })
})

describe('nextStreak', () => {
  it('primeiro dia → 1', () => { expect(nextStreak(null, '2026-10-08')).toBe(1) })
  it('dia consecutivo → +1', () => { expect(nextStreak('2026-10-07', '2026-10-08')).toBe(2) })
  it('pulou → reseta 1', () => { expect(nextStreak('2026-10-05', '2026-10-08')).toBe(1) })
  it('mesmo dia → mantém (trata como 1 se vazio)', () => { expect(nextStreak('2026-10-08', '2026-10-08')).toBe(1) })
})

describe('isDayOpen / dayFactor', () => {
  it('abre se revealDate <= hoje', () => {
    expect(isDayOpen('2026-10-08', '2026-10-08')).toBe(true)
    expect(isDayOpen('2026-10-09', '2026-10-08')).toBe(false)
  })
  it('conclusao vale x2', () => { expect(dayFactor('conclusao')).toBe(2); expect(dayFactor('anamnese')).toBe(1) })
})
```

- [ ] **Step 2: Rodar e ver falhar** → `npx vitest run src/lib/economy.test.ts`

- [ ] **Step 3: Implementar**

```ts
// src/lib/economy.ts
export const STAKES = [10, 25, 50] as const
export const HOUSE_MIN = 10
export const DOUBT_REWARD = 15
export const DOUBT_WINDOW_MIN = 30
const STREAK_CAP = 2.0

export type Stage = 'anamnese' | 'exame' | 'complementares' | 'conduta' | 'conclusao'

export function dayFactor(stage: Stage): number {
  return stage === 'conclusao' ? 2 : 1
}

/** Faixa efetiva: 0 sempre; 10 sempre (casa); 25/50 rebaixam até caber (mín 10). */
export function allowedStake(stake: number, balance: number): number {
  if (stake <= 0) return 0
  if (stake <= HOUSE_MIN) return HOUSE_MIN
  const affordable = STAKES.filter(s => s <= stake && (s === HOUSE_MIN || s <= balance))
  return affordable.length ? Math.max(...affordable) : HOUSE_MIN
}

export function streakFactor(streak: number): number {
  return Math.min(1 + 0.1 * (Math.max(1, streak) - 1), STREAK_CAP)
}

export function resolveBet(
  stake: number, isCorrect: boolean, balance: number, dFactor: number, sFactor: number,
): { delta: number; effStake: number } {
  const effStake = allowedStake(stake, balance)
  if (effStake === 0) return { delta: 0, effStake: 0 }
  if (isCorrect) return { delta: Math.round(effStake * dFactor * sFactor), effStake }
  return { delta: -Math.min(effStake, Math.max(0, balance)), effStake }
}

function dayDiff(aISO: string, bISO: string): number {
  const a = Date.parse(aISO + 'T00:00:00Z'); const b = Date.parse(bISO + 'T00:00:00Z')
  return Math.round((b - a) / 86400000)
}

/** Novo streak dado o último dia respondido e hoje (ambos YYYY-MM-DD). */
export function nextStreak(lastDate: string | null, today: string): number {
  if (!lastDate) return 1
  const d = dayDiff(lastDate, today)
  if (d === 1) return -1 // sentinela: "incrementar" — resolvido no servidor (ver nota)
  return 1
}

export function isDayOpen(revealDate: string, today: string): boolean {
  return dayDiff(revealDate, today) <= 0 ? false : true // placeholder — corrigido abaixo
}
```

  > NOTA ao implementar: as duas últimas funções acima estão como ESQUELETO ERRADO de propósito para o TDD guiar. Corrigir para passar nos testes:
  > - `isDayOpen(revealDate, today)` = `dayDiff(revealDate, today) >= 0` (revealDate ≤ hoje).
  > - `nextStreak`: retorno numérico real — precisa do streak atual. Ajustar a ASSINATURA para `nextStreak(lastDate, today, currentStreak)` **ou** manter sem currentStreak devolvendo: `null→1`; `d===1 → (currentStreak+1)`; `d===0 → currentStreak||1`; senão `1`. Como o teste chama `nextStreak('2026-10-07','2026-10-08')` esperando `2`, a implementação deve ler o streak atual. **Decisão:** assinatura final `nextStreak(lastDate: string|null, today: string, currentStreak = 0): number` e o teste passa `currentStreak` onde relevante. Atualizar o teste do Step 1 para `nextStreak('2026-10-07','2026-10-08',1) === 2` e `nextStreak('2026-10-08','2026-10-08',1) === 1`.

- [ ] **Step 4: Ajustar implementação final (correta)**

```ts
export function nextStreak(lastDate: string | null, today: string, currentStreak = 0): number {
  if (!lastDate) return 1
  const d = dayDiff(lastDate, today)
  if (d === 0) return currentStreak || 1   // já respondeu hoje
  if (d === 1) return currentStreak + 1     // dia consecutivo
  return 1                                   // pulou
}

export function isDayOpen(revealDate: string, today: string): boolean {
  return dayDiff(revealDate, today) >= 0
}
```
E ajustar o teste conforme a NOTA. Rodar: `npx vitest run src/lib/economy.test.ts` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/economy.ts src/lib/economy.test.ts
git commit -m "feat(quiz): lib pura de economia (aposta MedCoin, streak, gating de dia)"
```

---

## Task 3: Builder do prompt de geração + lib de geração

**Files:** Create `src/lib/challenge/prompts.ts` (+ `.test.ts`), `src/lib/challenge/generate.ts`

**Interfaces:**
- Produces: `buildWeeklyCasePrompt(): string` (gera o caso + os 5 quizzes num JSON estruturado); `WEEKLY_CASE_SCHEMA` (shape esperado); `parseWeeklyCase(raw: string): GeneratedWeek | null`.
- `GeneratedWeek = { title, true_diagnosis, overview, review, days: { day_index, stage, narrative, quiz: { prompt, options:{key,text}[], correct_key, explanation } }[] }` (5 days).

- [ ] **Step 1: Teste (estrutura do prompt + parse)**

```ts
// src/lib/challenge/prompts.test.ts
import { describe, it, expect } from 'vitest'
import { buildWeeklyCasePrompt, parseWeeklyCase } from './prompts'

describe('buildWeeklyCasePrompt', () => {
  it('pede Clínica Médica, 5 etapas nomeadas e JSON', () => {
    const p = buildWeeklyCasePrompt()
    expect(p).toMatch(/Clínica Médica/)
    for (const s of ['anamnese','exame','complementares','conduta','conclusao']) expect(p).toContain(s)
    expect(p).toMatch(/JSON/i)
  })
})

describe('parseWeeklyCase', () => {
  it('valida 5 dias, options 2-5 e correct_key presente', () => {
    const good = JSON.stringify({
      title: 'x', true_diagnosis: 'y', overview: 'o', review: 'r',
      days: ['anamnese','exame','complementares','conduta','conclusao'].map((stage, i) => ({
        day_index: i + 1, stage, narrative: 'n',
        quiz: { prompt: 'p', options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], correct_key: 'A', explanation: 'e' },
      })),
    })
    expect(parseWeeklyCase(good)?.days.length).toBe(5)
  })
  it('rejeita correct_key ausente das options', () => {
    const bad = JSON.stringify({ title:'x',true_diagnosis:'y',overview:'o',review:'r', days:[{day_index:1,stage:'anamnese',narrative:'n',quiz:{prompt:'p',options:[{key:'A',text:'a'}],correct_key:'Z'}}] })
    expect(parseWeeklyCase(bad)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar `prompts.ts`**

```ts
// src/lib/challenge/prompts.ts
export type GenQuiz = { prompt: string; options: { key: string; text: string }[]; correct_key: string; explanation: string }
export type GenDay = { day_index: number; stage: string; narrative: string; quiz: GenQuiz }
export type GeneratedWeek = { title: string; true_diagnosis: string; overview: string; review: string; days: GenDay[] }

const STAGES = ['anamnese', 'exame', 'complementares', 'conduta', 'conclusao'] as const

export function buildWeeklyCasePrompt(): string {
  return [
    'Você é um professor de Clínica Médica criando um "caso da semana" para estudantes.',
    'Crie UM caso clínico realista de Clínica Médica, com um diagnóstico verdadeiro ÚNICO e fechado',
    '(doença nomeável, não síndrome vaga), e desdobre-o em 5 dias (seg→sex), um quiz por dia:',
    '- dia 1 anamnese: apresentação/queixa e história; quiz sobre conduzir a anamnese/levantar hipóteses.',
    '- dia 2 exame: achados de exame físico; quiz sobre interpretar o exame/priorizar hipóteses.',
    '- dia 3 complementares: exames pedidos e resultados; quiz sobre interpretar os exames.',
    '- dia 4 conduta: quiz sobre a conduta terapêutica correta.',
    '- dia 5 conclusao: fecha o diagnóstico; quiz confirma o diagnóstico; inclua a revisão do caso.',
    'Cada quiz: enunciado claro, 4 ou 5 alternativas (keys A..E), UMA correta, e uma explicação didática.',
    'A narrativa de cada dia revela só o que é apropriado àquele ponto (sem entregar o diagnóstico antes do dia 5).',
    'Responda SOMENTE um JSON válido com as chaves: title, true_diagnosis, overview, review,',
    'days[] (day_index 1..5, stage em [anamnese,exame,complementares,conduta,conclusao], narrative, ',
    'quiz{prompt, options[{key,text}], correct_key, explanation}).',
  ].join('\n')
}

export function parseWeeklyCase(raw: string): GeneratedWeek | null {
  try {
    const o = JSON.parse(raw) as GeneratedWeek
    if (!o?.title || !o.true_diagnosis || !o.overview || !o.review || !Array.isArray(o.days) || o.days.length !== 5) return null
    for (const d of o.days) {
      if (!STAGES.includes(d.stage as (typeof STAGES)[number])) return null
      const q = d.quiz
      if (!q?.prompt || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 5) return null
      if (!q.options.some(op => op.key === q.correct_key)) return null
    }
    return o
  } catch { return null }
}
```

- [ ] **Step 4: Implementar `generate.ts`** (chama OpenAI; sem teste unitário — exercitado pela rota do cron)

```ts
// src/lib/challenge/generate.ts
import 'server-only'
import { openai } from '@/lib/openai/client'
import { MODELS } from '@/lib/openai/models'
import { buildWeeklyCasePrompt, parseWeeklyCase, type GeneratedWeek } from './prompts'

export async function generateWeeklyCase(): Promise<GeneratedWeek | null> {
  const completion = await openai.chat.completions.create({
    model: MODELS.generation,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: buildWeeklyCasePrompt() }],
  }, { timeout: 60_000 })
  const raw = completion.choices[0]?.message?.content
  return raw ? parseWeeklyCase(raw) : null
}
```

- [ ] **Step 5: Rodar prompts.test → PASS. Commit**
```bash
git add src/lib/challenge/
git commit -m "feat(quiz): prompt + parser + geração do caso da semana"
```

---

## Task 4: Rota do cron `POST /api/cron/generate-weekly-case`

**Files:** Create `src/app/api/cron/generate-weekly-case/route.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: `generateWeeklyCase`, `createAdminClient`, `isDayOpen` n/a.
- Produces: protegida por `x-cron-secret`; idempotente; persiste caso+dias+quizzes p/ a PRÓXIMA semana (segunda seguinte). Retorna `{ created }` ou `{ skipped }`.

- [ ] **Step 1: Teste (secret + idempotência)**

```ts
// src/app/api/cron/generate-weekly-case/route.test.ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGen, mockFrom } = vi.hoisted(() => ({ mockGen: vi.fn(), mockFrom: vi.fn() }))
vi.mock('@/lib/challenge/generate', () => ({ generateWeeklyCase: mockGen }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn().mockReturnValue({ from: mockFrom }) }))
import { NextRequest } from 'next/server'
import { POST } from './route'
const req = (secret?: string) => new NextRequest('http://localhost/api/cron/generate-weekly-case', { method: 'POST', headers: secret ? { 'x-cron-secret': secret } : {} })
beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 's3cr3t'
  // weekly_cases select → none existing
  mockFrom.mockImplementation((t: string) => {
    if (t === 'weekly_cases') return {
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }),
      insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'wc1' }, error: null }) }) }),
    }
    return { insert: vi.fn().mockResolvedValue({ error: null }) }
  })
  mockGen.mockResolvedValue({ title:'t', true_diagnosis:'d', overview:'o', review:'r', days: Array.from({length:5}, (_,i)=>({ day_index:i+1, stage:['anamnese','exame','complementares','conduta','conclusao'][i], narrative:'n', quiz:{ prompt:'p', options:[{key:'A',text:'a'},{key:'B',text:'b'}], correct_key:'A', explanation:'e' } })) })
})
describe('POST /api/cron/generate-weekly-case', () => {
  it('401 sem/errado secret', async () => {
    expect((await POST(req())).status).toBe(401)
    expect((await POST(req('nope'))).status).toBe(401)
  })
  it('201 gera quando não existe', async () => {
    const res = await POST(req('s3cr3t')); expect(res.status).toBe(201)
  })
  it('200 skip quando já existe', async () => {
    mockFrom.mockImplementation(() => ({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'exists' } }) }) }) }))
    const res = await POST(req('s3cr3t')); expect(res.status).toBe(200); expect((await res.json()).skipped).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

```ts
// src/app/api/cron/generate-weekly-case/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateWeeklyCase } from '@/lib/challenge/generate'

export const dynamic = 'force-dynamic'

// Segunda-feira da PRÓXIMA semana (UTC), YYYY-MM-DD
function nextMonday(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dow = d.getUTCDay() // 0..6
  const add = ((8 - dow) % 7) || 7 // dias até a próxima segunda (sempre futura)
  d.setUTCDate(d.getUTCDate() + add)
  return d.toISOString().slice(0, 10)
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10)
}

export async function POST(request: NextRequest) {
  if (request.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 401 })
  }
  const admin = createAdminClient()
  const weekStart = nextMonday(new Date())

  const { data: existing } = await admin.from('weekly_cases').select('id').eq('week_start', weekStart).maybeSingle()
  if (existing) return NextResponse.json({ skipped: true, week_start: weekStart }, { status: 200 })

  const week = await generateWeeklyCase()
  if (!week) return NextResponse.json({ error: 'generation failed' }, { status: 502 })

  const { data: wc, error: wcErr } = await admin.from('weekly_cases')
    .insert({ week_start: weekStart, specialty: 'Clínica Médica', title: week.title, true_diagnosis: week.true_diagnosis, overview: week.overview, review: week.review })
    .select('id').single()
  if (wcErr || !wc) return NextResponse.json({ error: 'persist failed' }, { status: 500 })
  const caseId = (wc as { id: string }).id

  try {
    for (const d of week.days) {
      const { data: q, error: qErr } = await admin.from('quizzes')
        .insert({ author_id: null, prompt: d.quiz.prompt, options: d.quiz.options, correct_key: d.quiz.correct_key, explanation: d.quiz.explanation })
        .select('id').single()
      if (qErr || !q) throw new Error('quiz insert')
      const { error: dErr } = await admin.from('challenge_days').insert({
        weekly_case_id: caseId, day_index: d.day_index, reveal_date: addDays(weekStart, d.day_index - 1),
        stage: d.stage, narrative: d.narrative, quiz_id: (q as { id: string }).id,
      })
      if (dErr) throw new Error('day insert')
    }
  } catch {
    // desfaz a semana pela metade
    await admin.from('weekly_cases').delete().eq('id', caseId)
    return NextResponse.json({ error: 'persist failed' }, { status: 500 })
  }

  return NextResponse.json({ created: true, week_start: weekStart }, { status: 201 })
}
```
  > `Date`/`new Date()` são permitidos aqui (rota, não workflow). `nextMonday` sempre devolve uma segunda futura (geração no domingo → próxima segunda).

- [ ] **Step 4: Rodar → PASS. Commit**
```bash
git add src/app/api/cron/
git commit -m "feat(quiz): rota de cron que gera o caso da próxima semana (secret + idempotente)"
```

---

## Task 5: `GET /api/challenge/today` (sem gabarito)

**Files:** Create `src/app/api/challenge/today/route.ts` (+ `.test.ts`)

**Interfaces:**
- Produces: para o usuário logado, retorna o caso da semana corrente, os dias já abertos (com `narrative`), o quiz do dia **sem `correct_key`/`explanation` se ainda não respondeu**, se já respondeu (e com quê), streak e saldo. Dias anteriores já respondidos vêm com gabarito.
- `getMedcoinBalance(admin, userId)` helper (inline aqui; reutilizado na Task 6).

- [ ] **Step 1: Teste — NÃO vaza correct_key de quiz não respondido**

```ts
// src/app/api/challenge/today/route.test.ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGetUser, mockAdminFrom } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockAdminFrom: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn().mockReturnValue({ from: mockAdminFrom }) }))
import { GET } from './route'
beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  // minimal happy-path stubs: no case → graceful empty
  mockAdminFrom.mockImplementation(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), lte: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null }), then: undefined }))
})
describe('GET /api/challenge/today', () => {
  it('401 sem usuário', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await GET()).status).toBe(401)
  })
  it('200 estado vazio quando não há caso', async () => {
    const res = await GET(); expect(res.status).toBe(200)
    const j = await res.json(); expect(j.case).toBeNull()
  })
})
```
  > O teste do anti-cola completo (quiz aberto não-respondido sem correct_key) é coberto no Task 6 (answer) + um teste de integração manual pós-deploy; aqui garantimos o contrato básico.

- [ ] **Step 2–4: Implementar** `GET` (server): lê `weekly_cases` da semana corrente (via `challenge_days.reveal_date`), monta dias abertos; para o dia de hoje, busca `quiz_answers` do usuário — se respondeu, inclui `correct_key`/`explanation`; senão, só `prompt`/`options`. Calcula saldo (`consultations.points` + `medcoin_events.points`) e streak (`profiles`). Retorna `{ case, days, today, balance, streak }`. Rodar testes → PASS.

- [ ] **Step 5: Commit** `feat(quiz): GET /api/challenge/today (contrato anti-cola)`

---

## Task 6: `POST /api/challenge/[quizId]/answer` (resolve aposta)

**Files:** Create `.../answer/route.ts` (+ `.test.ts`)

**Interfaces:** Consumes `economy.ts` (`resolveBet`, `nextStreak`, `streakFactor`, `dayFactor`), admin client. Produces `{ isCorrect, correctKey, explanation, networkPct, delta, newBalance, streak }`. 409 se já respondido; 403 se o dia não está aberto.

- [ ] **Step 1: Testes**

```ts
// src/app/api/challenge/[quizId]/answer/route.test.ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGetUser, mockAdminFrom } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockAdminFrom: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn().mockReturnValue({ from: mockAdminFrom }) }))
import { NextRequest } from 'next/server'
import { POST } from './route'
const ctx = (id: string) => ({ params: Promise.resolve({ quizId: id }) })
const req = (b: unknown) => new NextRequest('http://localhost/api/challenge/q1/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
// helpers de mock: um dia aberto, quiz com correct_key 'A', sem resposta prévia, saldo 100
function wire({ answered = false, revealPast = true, correct = 'A' } = {}) {
  mockAdminFrom.mockImplementation((t: string) => {
    if (t === 'challenge_days') return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: revealPast ? { reveal_date: '2000-01-01', stage: 'anamnese' } : { reveal_date: '2999-01-01', stage: 'anamnese' } }) }) }) }
    if (t === 'quizzes') return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'q1', correct_key: correct, explanation: 'e' } }) }) }) }
    if (t === 'quiz_answers') return {
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: answered ? { user_id: 'u1' } : null }) }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }
    if (t === 'consultations') return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [{ points: 100 }] }) }) }
    if (t === 'medcoin_events') return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [] }) }), insert: vi.fn().mockResolvedValue({ error: null }) }
    if (t === 'profiles') return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { challenge_streak: 1, challenge_last_date: null } }) }) }), update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
    return {}
  })
}
beforeEach(() => { vi.clearAllMocks(); mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }); wire() })

describe('POST challenge answer', () => {
  it('401 sem usuário', async () => { mockGetUser.mockResolvedValue({ data: { user: null }, error: null }); expect((await POST(req({ chosenKey: 'A', stake: 10 }), ctx('q1'))).status).toBe(401) })
  it('403 dia não aberto', async () => { wire({ revealPast: false }); expect((await POST(req({ chosenKey: 'A', stake: 10 }), ctx('q1'))).status).toBe(403) })
  it('409 já respondeu', async () => { wire({ answered: true }); expect((await POST(req({ chosenKey: 'A', stake: 10 }), ctx('q1'))).status).toBe(409) })
  it('200 acerto devolve gabarito e delta>0', async () => {
    const res = await POST(req({ chosenKey: 'A', stake: 10 }), ctx('q1'))
    expect(res.status).toBe(200); const j = await res.json(); expect(j.isCorrect).toBe(true); expect(j.correctKey).toBe('A'); expect(j.delta).toBeGreaterThan(0)
  })
  it('200 erro devolve delta<=0', async () => {
    const res = await POST(req({ chosenKey: 'B', stake: 10 }), ctx('q1'))
    const j = await res.json(); expect(j.isCorrect).toBe(false); expect(j.delta).toBeLessThanOrEqual(0)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar** — valida dia aberto (`challenge_days` do quiz, `reveal_date <= hoje`), não respondido (quiz_answers), lê quiz (correct_key), calcula isCorrect, saldo (consultations.points soma + medcoin_events soma), `streakFactor(nextStreak(...))`... na verdade: `nStreak = nextStreak(profile.challenge_last_date, today, profile.challenge_streak)`, `sFactor = streakFactor(nStreak)`, `resolveBet(stake, isCorrect, balance, dayFactor(stage), sFactor)`; grava `quiz_answers` (chosen_key, is_correct, stake=effStake, delta) + `medcoin_events` (points=delta, source 'challenge', ref_id=quizId) + atualiza `profiles.challenge_streak/last_date`; calcula `networkPct` (acertos/total em quiz_answers do quiz, via admin). Retorna o payload. (Date.now/new Date OK aqui.)

- [ ] **Step 4: Rodar → PASS. Commit** `feat(quiz): responder desafio com aposta de MedCoin + streak`

---

## Task 7: Ranking soma MedCoin + relabel UI

**Files:** Modify `src/app/(dashboard)/ranking/page.tsx`, `src/app/(dashboard)/consultations/[id]/FinishModal.tsx`, `src/app/api/share/[consultationId]/route.tsx`; (opcional) `src/lib/social/balance.ts`.

**Interfaces:** `computeLeaderboard` NÃO muda (soma linhas `{user_id, points}`). A página passa as linhas de `consultations.points` **+** de `medcoin_events.points` (mesma janela para "semana": consultas por `finished_at>=weekStart`, eventos por `created_at>=weekStart`).

- [ ] **Step 1:** Na `ranking/page.tsx`, buscar (admin) também `medcoin_events` (geral e da semana) e concatenar como linhas `{ user_id, points }` antes de `computeLeaderboard`. Relabel textos "XP"/"xp"/"pontos" → "MedCoin" na página.
- [ ] **Step 2:** FinishModal: trocar o badge "+N XP" → "+N MedCoin" (texto). Share card (`/api/share`): trocar rótulo "Pontos"/"XP" → "MedCoin".
- [ ] **Step 3:** Verificação: `npx tsc --noEmit && npx vitest run src/lib/scoring/` (leaderboard tests seguem passando, função intacta). Build.
- [ ] **Step 4: Commit** `feat(economy): ranking soma ledger MedCoin + relabel XP→MedCoin`

---

## Task 8: Quiz do usuário — criar + responder

**Files:** Create `src/app/api/quizzes/route.ts` (+test), `src/app/api/quizzes/[quizId]/answer/route.ts` (+test)

**Interfaces:**
- `POST /api/quizzes { prompt, options:[{key,text}](2..5), correctKey, explanation }` → cria `quizzes` (author_id=user) + `posts` (kind='quiz', quiz_id). 422 se opções inválidas/correctKey ausente. Retorna `{ postId, quizId }`.
- `POST /api/quizzes/[quizId]/answer { chosenKey }` → `{ isCorrect, correctKey, explanation, networkPct }` (sem XP/aposta). 409 se já respondeu. Só quizzes de usuário (author_id não nulo).

- [ ] **Step 1: Testes** (validação de opções; 422; 201; answer 200 + 409). (Mesmo padrão `vi.hoisted`.)
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** (user client castado `as unknown as SupabaseClient` p/ `quizzes`/`posts`/`quiz_answers`; validar correctKey ∈ options; answer lê correct_key via admin e grava quiz_answers com delta 0).
- [ ] **Step 4: Rodar → PASS. Commit** `feat(quiz): criar e responder quiz de usuário (sem XP)`

---

## Task 9: Upload de capa de resenha

**Files:** Create `src/app/api/posts/image/route.ts` (+test)

**Interfaces:** `POST { contentType }` → `{ uploadUrl, publicUrl }` no bucket `post-media` (mesma mecânica do avatar: valida image/*, `createSignedUploadUrl(path,{upsert:true})`, versiona `?v=`, path `post-<userId>-<rand>.<ext>`). O `<rand>` vem do cliente (ex.: timestamp enviado) para permitir várias imagens — ou usar `crypto.randomUUID()` no servidor (permitido em rota).

- [ ] **Step 1–4:** Testes (401, 415, 200 devolve uploadUrl/publicUrl) → implementar (espelha `api/profile/avatar`, mas NÃO grava em profiles; só devolve as URLs; bucket `post-media`) → PASS → commit `feat(quiz): upload de capa de resenha (bucket post-media)`.

---

## Task 10: Recompensa de dúvida (no comments route)

**Files:** Modify `src/app/api/posts/[id]/comments/route.ts` (+ atualizar teste)

**Interfaces:** Ao comentar: se o post é `kind='duvida'`, o comentador ≠ autor do post, `now - post.created_at <= DOUBT_WINDOW_MIN`, e ainda não há `medcoin_events(source='doubt_answer', ref_id=postId)`, grava (admin) `medcoin_events(+DOUBT_REWARD, 'doubt_answer', ref_id=postId)`. Best-effort (não quebra o comentário). O índice único `medcoin_doubt_once` garante 1×.

- [ ] **Step 1:** Atualizar o teste do comments route: adicionar caso "comentar dúvida em ≤30min por não-autor credita medcoin" e "fora de 30min não credita". Mockar `posts` select (kind, author_id, created_at) e `medcoin_events` (check + insert).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** — após inserir o comentário com sucesso, bloco best-effort com admin client: busca o post (kind, author_id, created_at); se elegível e sem evento prévio, insere o evento (captura violação do índice único silenciosamente). Importa `DOUBT_REWARD`/`DOUBT_WINDOW_MIN` de `@/lib/economy`.
- [ ] **Step 4: Rodar → PASS. Commit** `feat(economy): +MedCoin ao 1º que responde dúvida em ≤30min`

---

## Task 11: Posts route — kinds duvida/resenha/quiz + image/meta

**Files:** Modify `src/app/api/posts/route.ts` (+ atualizar teste)

**Interfaces:** `POST` passa a aceitar `kind ∈ {card,text,duvida,resenha,quiz}`. `duvida`/`text`/`resenha` exigem `body`; `resenha` aceita `imageUrl`+`meta{title,authors,source,link}`; `quiz` exige `quizId` (criado via /api/quizzes — ou este endpoint só cobre não-quiz e o quiz vem pela Task 8; manter quiz fora daqui para simplicidade). Decisão: **/api/posts cobre card/text/duvida/resenha**; quiz-post é criado só pela Task 8.

- [ ] **Step 1:** Atualizar teste: 201 para `duvida` (com body), 201 para `resenha` (com body + imageUrl + meta), 422 `duvida` sem body.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** — estender validação: aceitar os novos kinds; para `resenha` incluir `image_url` e `meta` no insert; `duvida` trata como texto com kind próprio.
- [ ] **Step 4: Rodar → PASS. Commit** `feat(quiz): posts de dúvida e resenha (imagem+meta)`

---

## Task 12: Compositor multi-modo (Texto/Dúvida/Quiz/Resenha)

**Files:** Modify `src/app/(dashboard)/feed/NewPostComposer.tsx`

- [ ] **Step 1:** Transformar o composer num seletor de modo (abas: Texto · Dúvida · Quiz · Resenha).
  - **Texto/Dúvida**: textarea; publica `kind:'text'` ou `kind:'duvida'`.
  - **Quiz**: enunciado + 2–5 linhas de alternativa (add/remove), radio p/ marcar a correta, explicação → `POST /api/quizzes`.
  - **Resenha**: título, autores, fonte/DOI(link), upload de capa (via `/api/posts/image`, PUT com `x-upsert`), e o resumo (body) → `POST /api/posts {kind:'resenha', imageUrl, meta}`. Aviso de direito autoral ("resuma com suas palavras; não cole o artigo").
- [ ] **Step 2:** `npx tsc --noEmit && npx next build`.
- [ ] **Step 3: Commit** `feat(quiz): compositor multi-modo no feed`

---

## Task 13: Render de quiz/dúvida/resenha no feed

**Files:** Create `src/app/(dashboard)/feed/QuizCard.tsx`; Modify `PostCard.tsx` (e `post/[id]/page.tsx` se necessário)

- [ ] **Step 1:** `QuizCard` (client): recebe quizId + enunciado + options (sem gabarito); ao responder chama `/api/quizzes/[id]/answer`, revela correta + explicação + % da rede. Usado quando `post.kind==='quiz'`.
- [ ] **Step 2:** `PostCard`: ramificar por kind — `duvida` (selo "Dúvida" + body + CTA responder=abre /post/[id]), `resenha` (capa `image_url` + meta.title/authors + body), `quiz` (`<QuizCard>`). Precisa expor `kind`, `quizId`, `imageUrl`, `meta` no `FeedPost` (estender `buildFeedPosts` + a query do feed). Card `card` mantém o compartilhamento atual.
- [ ] **Step 3:** Atualizar `src/lib/social/feed.ts` + `feed.test.ts` para carregar os novos campos (`kind` já existe; add `quizId`, `imageUrl`, `meta`).
- [ ] **Step 4:** `tsc`/`vitest`/`build`. **Commit** `feat(quiz): render de dúvida, resenha e quiz no feed`

---

## Task 14: Página `/desafio` + banner + aba

**Files:** Create `src/app/(dashboard)/desafio/page.tsx`, `ChallengeQuiz.tsx`, `ChallengeBanner.tsx`; Modify `MobileNav.tsx`, `Shell.tsx`, `feed/page.tsx`, `routes.ts`.

- [ ] **Step 1:** `routes.ts`: `CHALLENGE_ROUTE='/desafio'`.
- [ ] **Step 2:** `desafio/page.tsx` (server): usa a lógica do `GET /api/challenge/today` (extrair num lib compartilhado `src/lib/challenge/today.ts` consumido pela rota e pela página). Renderiza narrativa acumulada, `ChallengeQuiz` do dia, dias anteriores (gabarito visível), streak+saldo, e sexta com conclusão+revisão.
- [ ] **Step 3:** `ChallengeQuiz.tsx` (client): seletor de aposta (Sem aposta / 10 / 25 / 50, desabilitando faixas acima do saldo) → alternativas → `POST /api/challenge/[quizId]/answer` → revela resultado (acerto, gabarito, explicação, %, Δ MedCoin, novo saldo, streak).
- [ ] **Step 4:** `ChallengeBanner.tsx` no topo do `feed/page.tsx`: "Desafio de hoje — <stage>", estado, streak, link `/desafio`.
- [ ] **Step 5:** `MobileNav`: inserir item "Desafio" (vira 5 itens; ícone alvo/🎯). `Shell` desktop: link "Desafio".
- [ ] **Step 6:** `tsc`/`build`. **Commit** `feat(quiz): página do desafio + banner no feed + aba mobile`

---

## Task 15: Botão admin "Gerar caso da próxima semana"

**Files:** Modify `src/app/(dashboard)/admin/page.tsx`; Create `src/app/(dashboard)/admin/GenerateCaseButton.tsx` + uma server action ou rota interna que chama o cron com o `CRON_SECRET` do servidor.

- [ ] **Step 1:** `GenerateCaseButton` (client) → chama uma rota server-only `POST /api/admin/generate-case` que (confere isAdmin) injeta o `CRON_SECRET` e chama a lógica da Task 4. (Não expor o secret ao cliente.)
- [ ] **Step 2:** Renderizar o botão no `/admin` (só admin). `tsc`/`build`.
- [ ] **Step 3: Commit** `feat(quiz): botão no admin para gerar o caso da semana`

---

## Task 16: GitHub Action (cron semanal)

**Files:** Create `.github/workflows/weekly-case.yml`

- [ ] **Step 1:** Workflow com `schedule: cron '0 1 * * 1'` (01:00 UTC segunda = ~22h BRT domingo) + `workflow_dispatch`. Passo: `curl -s -X POST "$APP_URL/api/cron/generate-weekly-case" -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"`. `APP_URL` e `CRON_SECRET` como secrets do repositório.

```yaml
name: Caso da semana
on:
  schedule: [{ cron: '0 1 * * 1' }]
  workflow_dispatch: {}
jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - name: Gerar caso da próxima semana
        run: |
          curl -fsS -X POST "${{ secrets.APP_URL }}/api/cron/generate-weekly-case" \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
```

- [ ] **Step 2:** Documentar no PR/commit que o usuário deve cadastrar os secrets `APP_URL` (= https://app.medmindedu.com.br) e `CRON_SECRET` no GitHub, e `CRON_SECRET` no Easypanel (env do serviço) + `.env.local`.
- [ ] **Step 3: Commit** `ci(quiz): GitHub Action semanal que dispara a geração do caso`

---

## Task 17: Verificação final + deploy + semente

- [ ] **Step 1:** `npx tsc --noEmit && npx eslint <paths novos> && npx vitest run && npx next build` — tudo verde.
- [ ] **Step 2:** Garantir `CRON_SECRET` no `.env.local` e no Easypanel (env do serviço) antes do deploy (senão a rota do cron responde 401).
- [ ] **Step 3:** `git push origin main` + deploy webhook; confirmar `builtAt` novo em `/api/version`.
- [ ] **Step 4:** Semear o primeiro caso: no `/admin`, clicar "Gerar caso da próxima semana" (ou `curl` com o secret). Verificar que `/desafio` abre o dia corrente **sem vazar gabarito** (inspecionar que o GET do quiz não traz `correct_key`).
- [ ] **Step 5:** Smoke: `/desafio` 307 deslogado; responder um quiz loga MedCoin no ranking; postar uma dúvida e responder em <30min credita; postar uma resenha com capa; criar/responder um quiz de usuário.

---

## Self-Review (autor do plano)

**Cobertura da spec:** arco 5 dias + geração semanal (Tasks 3,4,16) ✓; aposta/streak/saldo (Task 2,6) ✓; anti-cola (Tasks 5,6) ✓; MedCoin unificado + relabel (Tasks 1,7) ✓; quiz de usuário (Task 8) ✓; Post-Dúvida + recompensa 30min (Tasks 1,10,11,12,13) ✓; Resenha + capa (Tasks 1,9,11,12,13) ✓; aba/banner (Task 14) ✓; admin + cron GH Action (Tasks 15,16) ✓.

**Placeholders:** o Task 2 contém um ESQUELETO ERRADO proposital (isDayOpen/nextStreak) seguido da correção no Step 4 — é intencional para o TDD, com a implementação final explícita; não é um placeholder vago.

**Consistência de tipos:** `Stage` (economy) = `stage` em challenge_days e parse (prompts); `resolveBet` devolve `{delta, effStake}` usado no answer; `medcoin_events` (não `xp_events`) em todas as tasks; `computeLeaderboard` reutilizado sem mudança (Task 7 só alimenta linhas extras).

**Riscos/decisões p/ o executor:** tabelas novas fora dos tipos gerados → user client castado; gabarito só pela API; `Date`/`new Date()` são permitidos nas rotas (diferente dos scripts de workflow); `CRON_SECRET` precisa existir antes do deploy; a UI não tem teste unitário (padrão do projeto) — garantir por tsc/build/smoke; aplicar migration pelo SQL editor com os cuidados de `reference-supabase-sql-editor-automation`.
