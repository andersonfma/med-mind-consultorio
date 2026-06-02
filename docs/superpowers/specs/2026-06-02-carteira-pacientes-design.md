# Med Mind — Módulo Consultório
# Sub-projeto 1: Carteira de Pacientes
# Design Spec

Data: 2026-06-02
Revisado após code review: 2026-06-02

---

## 1. Objetivo

Implementar a Carteira de Pacientes — a tela central do simulador onde o aluno
gerencia seus pacientes simulados, adiciona novos casos e acompanha a evolução
clínica de cada um.

Este sub-projeto não inclui o fluxo de consulta (sub-projeto 2), avaliação AB4
(sub-projeto 3) nem MedCoin (sub-projeto 5). Os gráficos de desempenho no
dashboard são placeholders com dados mockados.

---

## 2. Decisões de produto registradas

### Incluído neste sub-projeto
- Listagem de pacientes com vínculo médico-paciente (5 barras coloridas)
- Adição de paciente por escolha de especialidade + dificuldade
- Geração síncrona via OpenAI (Opção A escolhida)
- Controle de slots: 5 iniciais, desbloqueio futuro por reputação
- Detalhe do paciente com condições, estado clínico e histórico de consultas
- Dashboard em duas colunas com gráficos placeholder

### Fora deste sub-projeto (registrado para specs futuros)
- **Agendamento de retorno**: entra no sub-projeto 4 (Longitudinalidade)
- **Paciente social**: atendimento sem cobrança que rende 2 slots — sub-projeto futuro
- **Ranking público/grupo de reputação**: feature de comunidade, sub-projeto futuro.
  O aluno poderá tornar sua reputação pública e aparecer como anônimo no ranking.
- **Fórmula completa de Reputação**: combina AB4 + soft skills + volume +
  atendimentos sociais + avaliações. Definida no spec de Reputação (sub-projeto futuro).
  No MVP aparece como número simples ao lado do nome no header.

---

## 3. Schema do banco

### Migration — criação via CLI

**Nunca criar o arquivo manualmente.** Usar o Supabase CLI para gerar o arquivo
com prefixo de timestamp correto (necessário para ordenação e histórico):

```bash
supabase migration new add_patients
```

O CLI cria um arquivo como `supabase/migrations/20260602XXXXXX_add_patients.sql`.
Editar esse arquivo com o SQL desta seção. Aplicar com `supabase db push` ou
`supabase migration up`.

Esta migration faz três coisas:
1. Adiciona `total_slots` à tabela `profiles` existente
2. Cria a tabela `patients`
3. Atualiza permissões de coluna em `profiles`

**Regra de ordenação de tipos**: rodar `supabase gen types typescript --linked`
ANTES de escrever qualquer código que importe `Patient` de `domain.ts`. Os tipos
só existem após a migration ser aplicada e os tipos regenerados.

---

### Alteração em `profiles` — adicionar `total_slots`

```sql
ALTER TABLE profiles
  ADD COLUMN total_slots INTEGER NOT NULL DEFAULT 5
    CHECK (total_slots > 0);
```

#### Permissões de coluna em `profiles`

O `total_slots` é controlado pelo sistema — nunca pelo usuário diretamente.
Para evitar que o role `authenticated` altere esse campo via Supabase client,
substituímos o GRANT genérico por grants por coluna:

```sql
-- Remove permissão genérica de UPDATE (criada na foundation)
REVOKE UPDATE ON profiles FROM authenticated;

-- Concede UPDATE apenas nas colunas editáveis pelo usuário
-- IMPORTANTE: 'role' intencionalmente excluído — nenhum fluxo de UI
-- permite que o aluno mude seu próprio role
GRANT UPDATE (full_name, crm) ON profiles TO authenticated;

-- total_slots e role só podem ser alterados via service_role (API interna)
```

O trigger `handle_new_user()` (foundation) já cria o perfil com `total_slots = 5`
por default — nenhum trigger adicional necessário.

---

### Tabela `patients`

```sql
CREATE TABLE patients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  age               INTEGER NOT NULL CHECK (age BETWEEN 18 AND 80),
  gender            TEXT NOT NULL CHECK (gender IN ('M', 'F')),
  specialty         TEXT NOT NULL
                      CHECK (specialty IN (
                        'Clínica Médica', 'Cardiologia', 'Gastroenterologia',
                        'Pneumologia', 'Endocrinologia', 'Nefrologia',
                        'Neurologia', 'Infectologia'
                      )),
  difficulty        TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  chief_complaint   TEXT NOT NULL,
  diagnosis         TEXT,                        -- null em SP1; populado pelo aluno em SP2
  clinical_status   TEXT NOT NULL,               -- atualizado após cada consulta pela IA
  bond_level        INTEGER NOT NULL DEFAULT 1
                      CHECK (bond_level BETWEEN 1 AND 5),
  conditions        TEXT[] NOT NULL DEFAULT '{}', -- ex: ['HAS', 'DM', 'DLP']
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_consulted_at TIMESTAMPTZ
);

-- Índice para queries por usuário (slots check, listagem)
CREATE INDEX patients_user_id_idx ON patients(user_id);

-- RLS
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON patients TO authenticated;

CREATE POLICY "Aluno lê próprios pacientes"
  ON patients FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Aluno insere próprios pacientes"
  ON patients FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Aluno atualiza próprios pacientes"
  ON patients FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
```

**Nota sobre `specialty`**: o CHECK constraint no banco espelha a lista da seção 5.
Adicionar uma especialidade futura exige migration + atualizar o dropdown do frontend.
Essa abordagem garante que nenhum valor inválido persista silenciosamente.

**Nota sobre `consultation_count`**: este campo foi intencionalmente omitido do SP1.
Quando o SP2 criar a tabela `consultations`, o count será derivado como
`COUNT(*) FROM consultations WHERE patient_id = X` — sem coluna denormalizada que
pode desincronizar.

---

### `used_slots` — calculado, não armazenado

`used_slots` não é coluna em lugar algum — é sempre calculado como:
```sql
SELECT COUNT(*) FROM patients WHERE user_id = $1
```

Comparado com `profiles.total_slots`. Um slot está disponível quando
`COUNT(*) < total_slots`. O índice `patients_user_id_idx` garante que essa
operação seja eficiente mesmo se o teto de slots crescer.

---

## 4. Rotas e páginas

```
/dashboard                 ← reformulado: lista de pacientes + gráficos placeholder
/patients/new              ← escolha de especialidade + dificuldade → gera paciente
/patients/[id]             ← detalhe do paciente
/consultations/stub        ← placeholder para "Iniciar atendimento" (SP2)
```

### `/dashboard`

Server component. No Next.js App Router, layouts não passam props para pages —
cada page é um Server Component independente. O `page.tsx` deve buscar seus
próprios dados. Para evitar round-trip extra de auth, ler a sessão cacheada
via `supabase.auth.getUser()` (o cookie já foi validado pelo middleware; a
chamada no page usa cache de sessão local, não uma nova requisição de rede).

Buscar em paralelo com `Promise.all` — obrigatório, não sequential awaits:
```ts
const [patientsResult, profileResult] = await Promise.all([
  supabase.from('patients').select('*', { count: 'exact' }).order('created_at', { ascending: false }),
  supabase.from('profiles').select('total_slots, full_name').eq('id', user.id).single(),
])

// Verificar error ANTES de !data: erro de DB e perfil ausente são causas distintas.
// Supabase retorna data=null em ambos os casos; checar error primeiro permite
// distinguir falha de infraestrutura (throw do error real) de integridade de dados.
if (profileResult.error) {
  throw profileResult.error  // erro transiente de banco → error.tsx sem loop de redirect
}
if (!profileResult.data) {
  throw new Error('Profile not found for authenticated user')
}
if (patientsResult.error) {
  // Log do erro; renderizar lista vazia em vez de crashar
  console.error('Failed to load patients:', patientsResult.error)
}

const patients = patientsResult.data ?? []
const { total_slots, full_name } = profileResult.data
// Usar count retornado pela query, não patients.length — evita quebra futura
// se paginação for adicionada. Requer { count: 'exact' } no select de patients.
const used_slots = patientsResult.count ?? patients.length
```

Layout em duas colunas:
- **Coluna esquerda (40%)**: lista de pacientes + botão "Novo paciente"
- **Coluna direita (60%)**: 1 componente `<PlaceholderChart>` renderizado 3 vezes
  com props diferentes (ver seção 9)
- **Header**: nome do aluno + reputação. Em SP1, **hardcode a string `"0 pts"`**
  diretamente no JSX — não existe coluna `reputation` na tabela `profiles`.
  A coluna e a fórmula real chegam no SP3.

O botão "Novo paciente" está desabilitado se `used_slots >= total_slots`, com
tooltip: *"Aumente sua reputação para desbloquear novos pacientes"*.

### `/patients/new`

Server component: verifica `used_slots >= total_slots` no servidor antes de
renderizar. Se sem slots, redireciona para `DASHBOARD_ROUTE` via `redirect()`.
Isso garante que o guard não seja bypassável via navegação direta.

O guard usa queries paralelas de contagem sem retornar dados — mais eficiente que `select('*')`.
Usar `Promise.all` — consistente com o padrão do dashboard:
```ts
const [patientsCount, profileResult] = await Promise.all([
  supabase.from('patients').select('id', { count: 'exact', head: true }),
  supabase.from('profiles').select('total_slots').eq('id', user.id).single(),
])

// Distinguir erro de DB (throw → error.tsx) de "perfil ausente" (não deve ocorrer)
if (profileResult.error) throw profileResult.error
if (!profileResult.data) throw new Error('Profile not found')

// Se a query de contagem falhar, o guard falha "aberto" (mostra o form).
// O create_patient RPC é a barreira real — o guard é apenas UX.
const count = patientsCount.count ?? 0

if (count >= profileResult.data.total_slots) {
  redirect(DASHBOARD_ROUTE)
}
```

1. Dropdown de especialidade (lista fixa — ver seção 5)
2. Três botões de dificuldade: Fácil / Médio / Difícil
3. Botão "Confirmar" → spinner com texto *"Seu próximo paciente está chegando..."*
4. Em caso de sucesso: redirect para `/patients/[id]` do paciente criado
5. Em caso de erro: mensagem de erro, slot não consumido, botão reativado

### `/patients/[id]`

- Tags de condições no topo: `#HAS` `#DM` `#DLP` (omitidas se `conditions` vazio)
- Card de estado clínico atual (texto gerado pela IA)
- Botão **"Iniciar atendimento"** — no SP1 redireciona para `STUB_CONSULTATION_ROUTE`
  (ver seção 5); fluxo real implementado no SP2
- Lista de consultas anteriores: **não fazer query em SP1** — a tabela `consultations`
  não existe ainda. Hardcode um array vazio e exibir sempre a mensagem
  *"Nenhuma consulta realizada ainda"*. A query real vem no SP2.
- Componente `<BondBar level={bond_level} />`

### `/consultations/stub`

Página simples com mensagem *"Consulta em breve — funcionalidade em desenvolvimento"*
e botão "Voltar". Existe para que o botão "Iniciar atendimento" não fique sem destino.

---

## 5. Constantes de rota e especialidades

### Constantes de rota

```ts
// src/lib/routes.ts
export const DASHBOARD_ROUTE         = '/dashboard'
export const STUB_CONSULTATION_ROUTE = '/consultations/stub'
```

`DASHBOARD_ROUTE` cobre todos os hardcodes existentes em `redirect.ts`,
`safe-next.ts` e nas páginas de auth. `STUB_CONSULTATION_ROUTE` é substituído
em SP2 pelo valor real. Um único arquivo para atualizar em ambos os casos.

**Atenção nos testes**: `redirect.test.ts` e `safe-next.test.ts` têm assertions
com `'/dashboard'` hardcoded (ex: `.toBe('/dashboard')`). Após a migração para
`DASHBOARD_ROUTE`, substituir essas strings pelo import da constante:
```ts
import { DASHBOARD_ROUTE } from '../routes'
expect(result).toBe(DASHBOARD_ROUTE)
```
Sem isso, os testes continuam verdes mesmo se o valor de `DASHBOARD_ROUTE` mudar.

### Especialidades disponíveis (lista fixa MVP)

Definida em `src/lib/patients/specialties.ts` e reutilizada no frontend
(dropdown) e no backend (validação da API). O CHECK constraint do banco usa
os mesmos valores — qualquer adição futura exige migration + atualização desta
constante.

```ts
export const SPECIALTIES = [
  'Clínica Médica',
  'Cardiologia',
  'Gastroenterologia',
  'Pneumologia',
  'Endocrinologia',
  'Nefrologia',
  'Neurologia',
  'Infectologia',
] as const

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const

export type Specialty   = typeof SPECIALTIES[number]
export type Difficulty  = typeof DIFFICULTIES[number]
```

**Teste de cross-validação obrigatório** (ver seção 11): PostgreSQL normaliza
CHECK constraints — `specialty IN ('A','B')` é armazenado como
`specialty = ANY (ARRAY['A'::text, 'B'::text])`. O teste deve usar
`pg_get_constraintdef(oid)` e extrair os literais do array normalizado com regex,
comparando como Set, não como string literal.

---

## 6. API route: `POST /api/patients`

**Autenticação**: middleware garante sessão válida. A route verifica `user_id`
via `supabase.auth.getUser()` com o client server-side.

**Estratégia de atomicidade**: usar função PostgreSQL `create_patient` via
`supabase.rpc()`. A função encapsula o slot check + insert em uma transação
atômica. O route handler chama a OpenAI ANTES de invocar o RPC — assim a
conexão de banco não fica aberta durante o I/O externo.

**Fluxo do route handler:**
```
1. Valida body (specialty, difficulty) → 400 se inválido:
   // Usar SPECIALTIES e DIFFICULTIES como fonte canônica de validação
   const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
   if (!SPECIALTIES.includes(body.specialty)) return 400
   if (!DIFFICULTIES.includes(body.difficulty)) return 400

2. Chama OpenAI com timeout de 25s → 408 se timeout, 500 se erro

3. Valida e mapeia resposta OpenAI + body:
   // age: LLMs podem retornar float ou string; NaN/undefined também cobertos
   const age = Math.round(Number(openAI.age))
   if (!Number.isInteger(age) || age < 18 || age > 80) {
     // Dado inválido vindo do OpenAI — erro interno (500), não do cliente
     return 500 com mensagem 'OpenAI returned invalid age'
   }

   // gender: normalizar para 'M' ou 'F'; rejeitar qualquer outro valor
   const gender = openAI.gender === 'M' || openAI.gender === 'F'
     ? openAI.gender
     : (() => { throw new Error('OpenAI returned invalid gender') })()
   // Lança → Next.js retorna 500

   // conditions: garantir array de strings
   const conditions = Array.isArray(openAI.conditions)
     ? openAI.conditions.map((c: unknown) => String(c))
     : []

   supabase.rpc('create_patient', {
     p_name:       String(openAI.name),
     p_age:        age,
     p_gender:     gender,
     p_specialty:  body.specialty,       // do request body, não do OpenAI
     p_difficulty: body.difficulty,      // do request body, não do OpenAI
     p_complaint:  String(openAI.chief_complaint),
     p_status:     String(openAI.clinical_status),
     p_conditions: conditions,
   })

4. Se error.code === 'US001' → retorna 403
   Se qualquer outro erro → retorna 500

5. Retorna NextResponse.json(data, { status: 201 })
   ATENÇÃO: NextResponse.json() retorna 200 por default — status 201 é explícito
```

**Função PostgreSQL `create_patient`** (incluir na migration gerada por `supabase migration new add_patients`):

```sql
CREATE OR REPLACE FUNCTION create_patient(
  p_name         TEXT,
  p_age          INTEGER,
  p_gender       TEXT,
  p_specialty    TEXT,
  p_difficulty   TEXT,
  p_complaint    TEXT,
  p_status       TEXT,
  p_conditions   TEXT[]
) RETURNS patients AS $$
DECLARE
  v_user_id      UUID := auth.uid();
  v_total_slots  INTEGER;
  v_used_slots   INTEGER;
  v_patient      patients;
BEGIN
  -- Lock pessimista: impede race condition entre leituras concorrentes
  SELECT total_slots INTO v_total_slots
    FROM profiles
    WHERE id = v_user_id
    FOR UPDATE;

  -- Guard: se o perfil não existir, total_slots é NULL e a comparação
  -- abaixo retornaria NULL (não TRUE), permitindo inserção sem limite.
  IF v_total_slots IS NULL THEN
    -- US002: custom SQLSTATE — não colide com P0001 (raise_exception genérico)
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'US002';
  END IF;

  SELECT COUNT(*) INTO v_used_slots
    FROM patients
    WHERE user_id = v_user_id;

  IF v_used_slots >= v_total_slots THEN
    -- US001: custom SQLSTATE — distinguível de qualquer outro RAISE EXCEPTION
    RAISE EXCEPTION 'no_slots_available' USING ERRCODE = 'US001';
  END IF;

  INSERT INTO patients (
    user_id, name, age, gender, specialty, difficulty,
    chief_complaint, clinical_status, conditions
  ) VALUES (
    v_user_id, p_name, p_age, p_gender, p_specialty, p_difficulty,
    p_complaint, p_status, p_conditions
  ) RETURNING * INTO v_patient;

  RETURN v_patient;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Proteção contra search-path hijacking
ALTER FUNCTION create_patient(TEXT,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[])
  SET search_path = public;

-- Least-privilege: revogar PUBLIC e conceder apenas ao role autenticado.
-- Sem este GRANT, Supabase Postgres 15+ nega EXECUTE para anon/authenticated.
REVOKE EXECUTE ON FUNCTION create_patient(TEXT,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_patient(TEXT,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[]) TO authenticated;
```

O route handler inspeciona `error.code` (não o status HTTP) para distinguir erros.
`P0001` é o código genérico de qualquer `RAISE EXCEPTION` — nunca usar como
discriminador. Usar os custom SQLSTATEs definidos na função:
- `error.code === 'US001'` → retorna `403` (sem slots)
- `error.code === 'US002'` → retorna `500` (perfil não encontrado — não deve ocorrer)
- qualquer outro erro → retorna `500`

O slot nunca é consumido se a OpenAI falhar antes do RPC.

**Status codes:**
- `201` — paciente criado com sucesso, retorna o objeto patient
- `400` — body inválido (specialty ou difficulty ausentes/inválidos)
- `403` — sem slots disponíveis
- `408` — timeout da OpenAI (25s excedidos); slot NÃO consumido
- `500` — erro interno; slot NÃO consumido

---

## 7. Geração de paciente via OpenAI

**Modelo**: `gpt-4o-mini`

**Configuração**: usar `response_format: { type: "json_object" }` para garantir
JSON válido sem necessidade de retry ou parsing defensivo.

**ATENÇÃO**: OpenAI exige que a palavra "json" (case-insensitive) apareça no
prompt quando `response_format: json_object` é usado. O prompt atual contém
"JSON" — qualquer refatoração que remova essa palavra causará `BadRequestError: 400`.
Nunca remover "JSON" do prompt sem verificar essa restrição.

**Timeout**: 25 segundos (deixa margem para o servidor retornar 408 antes de
atingir timeout da plataforma de deploy).

**Prompt:**

```
Você é um gerador de pacientes simulados para treinamento médico.
Gere um paciente realista para a especialidade: {specialty}.
Nível de dificuldade: {difficulty}.

Regras por dificuldade:
- easy: queixa clara, quadro típico, sem comorbidades relevantes
- medium: queixa moderadamente vaga, 1-2 comorbidades
- hard: queixa inespecífica, múltiplas comorbidades, quadro atípico

Responda APENAS com JSON válido, sem texto adicional:
{
  "name": "nome fictício brasileiro",
  "age": número inteiro entre 18 e 80,
  "gender": "M" ou "F",
  "chief_complaint": "queixa principal em 1 frase, na voz do paciente",
  "clinical_status": "estado clínico inicial em 1 frase curta, na voz do sistema",
  "conditions": ["lista", "de", "condições", "preexistentes"]
}
```

O campo `conditions` pode ser array vazio para casos fáceis.
`bond_level` começa sempre em 1. `diagnosis` começa sempre null.

O cliente OpenAI já existe em `src/lib/openai/client.ts` (importa `'server-only'`).
**Não instanciar um novo cliente no route handler** — importar o existente.

---

## 8. Listagem de pacientes — componente de vínculo

Componente `<BondBar level={1..5} />` implementado com divs Tailwind.

| Nível | Cor              |
|-------|------------------|
| 1     | Vermelho         |
| 2     | Laranja          |
| 3     | Amarelo          |
| 4     | Verde claro      |
| 5     | Verde escuro     |

Barras acima do nível atual aparecem acinzentadas.

---

## 9. Gráficos placeholder — componente único

Um único componente `<PlaceholderChart title="" description="" />` reutilizado
três vezes no dashboard. Renderiza um SVG mockado simples com título, descrição
e badge *"Em breve"*. Fica em `src/components/charts/PlaceholderChart.tsx`.

Quando SP3 implementar os dados reais, cada uso é substituído por seu componente
específico — sem precisar refatorar três arquivos com contratos divergentes.

Usos no dashboard:
```tsx
<PlaceholderChart title="Desempenho AB4" description="Eixos A1–A4 do método AB4" />
<PlaceholderChart title="Reputação" description="Evolução ao longo do tempo" />
<PlaceholderChart title="Volume de atendimentos" description="Consultas por semana" />
```

---

## 10. Tratamento de erros e edge cases

| Situação | Comportamento |
|----------|---------------|
| OpenAI timeout (>25s) | Retorna 408, slot não consumido, botão reativado |
| OpenAI erro interno | Retorna 500, slot não consumido, botão reativado |
| Aluno sem slots | Guard server-side redireciona antes de renderizar o form |
| Tentativa concorrente de criar paciente | Lock pessimista garante que apenas um passa |
| Paciente sem consultas | Mensagem "Nenhuma consulta realizada ainda" |
| RLS | Queries filtram por `user_id` automaticamente |
| total_slots editado via client | Impossível — GRANT UPDATE cobre apenas full_name, crm |

---

## 11. Testes

**Unitários (Vitest):**
- `buildPatientPrompt(specialty, difficulty)` → string de prompt correta
- `hasAvailableSlot(usedSlots, totalSlots)` → boolean correto nos limites (0, igual, acima)

**Integração — cross-validação de especialidades (Vitest + Supabase real):**
- Usa `pg_get_constraintdef(oid)` para ler a definição normalizada do CHECK constraint
  (PostgreSQL converte `IN ('A','B')` para `= ANY (ARRAY['A'::text, 'B'::text])`).
- Extrai os literais com regex: `/ARRAY\[(.+?)\]/` → split → strip `::text` e aspas.
- Compara como Set contra `SPECIALTIES` — ordem irrelevante.
- Falha em CI se qualquer valor existir em um lado mas não no outro.

**Integração (Vitest + Supabase mockado):**
- `POST /api/patients` com OpenAI mockado → paciente salvo, retorna **201**
- `POST /api/patients` com OpenAI falhando → slot não consumido, retorna 500
- `POST /api/patients` com timeout simulado → retorna 408, slot não consumido
- `POST /api/patients` sem slots → retorna 403
- Duas requisições simultâneas com 1 slot disponível → apenas 1 paciente criado (lock pessimista)

**E2E (Playwright):**
- Fluxo completo: escolher especialidade + dificuldade → confirmar → paciente aparece na listagem do dashboard

---

## 12. Estrutura de arquivos novos

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   │   └── page.tsx                  ← reformulado (2 colunas, sem duplo getUser)
│   │   ├── patients/
│   │   │   ├── new/
│   │   │   │   └── page.tsx              ← guard server-side + form
│   │   │   └── [id]/
│   │   │       └── page.tsx              ← detalhe do paciente
│   │   └── consultations/
│   │       └── stub/
│   │           └── page.tsx              ← placeholder "Em breve"
│   └── api/
│       └── patients/
│           └── route.ts                  ← POST /api/patients
├── components/
│   ├── charts/
│   │   └── PlaceholderChart.tsx          ← componente único reutilizado 3x
│   └── ui/
│       └── BondBar.tsx                   ← 5 barras de vínculo
├── lib/
│   ├── routes.ts                         ← STUB_CONSULTATION_ROUTE e futuras rotas
│   └── patients/
│       ├── specialties.ts                ← constante SPECIALTIES + tipo Specialty
│       ├── specialties.test.ts           ← cross-valida TS vs CHECK constraint do banco
│       ├── prompt.ts                     ← buildPatientPrompt()
│       ├── prompt.test.ts
│       ├── slots.ts                      ← hasAvailableSlot()
│       └── slots.test.ts
└── types/
    └── domain.ts                         ← adicionar tipo Patient
```

**Ordem de implementação obrigatória:**
1. Criar e aplicar a migration com `supabase migration new add_patients` + `supabase db push`
2. Rodar `supabase gen types typescript --linked > src/types/database.ts`
3. Adicionar tipo `Patient` em `domain.ts`
4. Implementar o restante

---

## 13. Critérios de conclusão

- [ ] Migration criada com `supabase migration new add_patients` e aplicada via Supabase CLI (inclui `create_patient` RPC)
- [ ] `profiles.total_slots` adicionado com CHECK (> 0); GRANT UPDATE revogado e re-concedido apenas em `(full_name, crm)`
- [ ] Tabela `patients` com CHECK constraints em `specialty`, `age (18-80)`, `difficulty`, `bond_level`; índice em `user_id`; RLS (SELECT + INSERT + UPDATE)
- [ ] Função `create_patient` com SECURITY DEFINER, `search_path = public`, ERRCODEs US001/US002, REVOKE PUBLIC + GRANT TO authenticated
- [ ] `database.ts` regenerado após migration
- [ ] `POST /api/patients` funcional: gpt-4o-mini, response_format json_object, timeout 25s, mapeamento explícito dos parâmetros do RPC, retorna `{ status: 201 }`
- [ ] Constantes `DASHBOARD_ROUTE` e `STUB_CONSULTATION_ROUTE` em `src/lib/routes.ts`
- [ ] `redirect.ts`, `safe-next.ts` e demais hardcodes de `/dashboard` substituídos por `DASHBOARD_ROUTE`; assertions nos testes dessas funções também atualizadas para usar a constante
- [ ] Constante `SPECIALTIES` compartilhada entre frontend e backend
- [ ] Teste de cross-validação: `SPECIALTIES` vs CHECK constraint do banco
- [ ] Dashboard: `Promise.all` com `count: 'exact'`, `used_slots` de `patientsResult.count`, sem `getUser()` redundante
- [ ] Página `/patients/new` com guard server-side usando `Promise.all` + `select('id', { count: 'exact', head: true })`
- [ ] Página `/patients/[id]` com tags, estado clínico, histórico e botão usando `STUB_CONSULTATION_ROUTE`
- [ ] Página `/consultations/stub` como placeholder
- [ ] Componente `<BondBar />` funcional
- [ ] Componente `<PlaceholderChart />` reutilizado 3x no dashboard
- [ ] Testes unitários, de concorrência e cross-validação passando
- [ ] Teste E2E: fluxo completo de criação de paciente
- [ ] Deploy no Easypanel funcionando após as mudanças
