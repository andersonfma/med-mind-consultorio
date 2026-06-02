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

### Migration `0002_add_patients.sql`

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
GRANT UPDATE (full_name, crm, role) ON profiles TO authenticated;

-- total_slots só pode ser alterado via service_role (API interna)
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
  diagnosis         TEXT,                        -- null até o aluno fechar o diagnóstico
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

Server component que busca em paralelo:
- `supabase.auth.getUser()` — já validado pelo layout, usar `user` passado via props
  ou reutilizar a sessão; **não fazer novo `getUser()` no page.tsx** (tripla chamada
  desnecessária: middleware → layout → page)
- Lista de pacientes do usuário
- `profiles.total_slots` e `COUNT(patients)` para exibir slots disponíveis

Layout em duas colunas:
- **Coluna esquerda (40%)**: lista de pacientes + botão "Novo paciente"
- **Coluna direita (60%)**: 1 componente `<PlaceholderChart>` renderizado 3 vezes
  com props diferentes (ver seção 9)
- **Header**: nome do aluno + reputação (exibe "0 pts" no MVP; fórmula real no SP3)

O botão "Novo paciente" está desabilitado se `used_slots >= total_slots`, com
tooltip: *"Aumente sua reputação para desbloquear novos pacientes"*.

### `/patients/new`

Server component: verifica `used_slots >= total_slots` no servidor antes de
renderizar. Se sem slots, redireciona para `/dashboard` via `redirect()`.
Isso garante que o guard não seja bypassável via navegação direta.

1. Dropdown de especialidade (lista fixa — ver seção 5)
2. Três botões de dificuldade: Fácil / Médio / Difícil
3. Botão "Confirmar" → spinner com texto *"Seu próximo paciente está chegando..."*
4. Em caso de sucesso: redirect para `/patients/[id]` do paciente criado
5. Em caso de erro: mensagem de erro, slot não consumido, botão reativado

### `/patients/[id]`

- Tags de condições no topo: `#HAS` `#DM` `#DLP` (omitidas se `conditions` vazio)
- Card de estado clínico atual (texto gerado pela IA)
- Botão **"Iniciar atendimento"** — no SP1 redireciona para `/consultations/stub`
  (página placeholder "Em breve"); fluxo real implementado no SP2
- Lista de consultas anteriores com data e resumo (vazia no primeiro acesso,
  exibe mensagem: *"Nenhuma consulta realizada ainda"*)
- Componente `<BondBar level={bond_level} />`

### `/consultations/stub`

Página simples com mensagem *"Consulta em breve — funcionalidade em desenvolvimento"*
e botão "Voltar". Existe para que o botão "Iniciar atendimento" não fique sem destino.

---

## 5. Especialidades disponíveis (lista fixa MVP)

Deve ser definida como constante exportável em `src/lib/patients/specialties.ts`
e reutilizada tanto no frontend (dropdown) quanto no backend (validação da API).
O CHECK constraint no banco usa os mesmos valores.

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

export type Specialty = typeof SPECIALTIES[number]
```

---

## 6. API route: `POST /api/patients`

**Autenticação**: middleware garante sessão válida. A route verifica `user_id`
via `supabase.auth.getUser()` com o client server-side.

**Fluxo — dentro de uma única transação de banco:**

```
BEGIN
  1. SELECT total_slots FROM profiles WHERE id = user_id FOR UPDATE
  2. SELECT COUNT(*) FROM patients WHERE user_id = user_id
  3. Se COUNT >= total_slots → ROLLBACK → retorna 403
  4. Chama OpenAI (fora da transação — ver nota abaixo)
  5. INSERT INTO patients (...)
COMMIT
```

**Nota sobre OpenAI fora da transação**: a chamada OpenAI não pode ficar dentro
do BEGIN/COMMIT porque transações abertas enquanto aguardam I/O externo consomem
conexões do pool. O fluxo correto é:

```
1. SELECT total_slots FOR UPDATE → abre lock pessimista
2. Se sem slots → libera lock → retorna 403
3. Chama OpenAI com timeout de 25 segundos
4. Se OpenAI falhar → libera lock → retorna 500 (slot NÃO consumido)
5. INSERT INTO patients dentro de transação com o lock já adquirido
6. COMMIT
```

Na prática com Supabase, usar `supabase.rpc('create_patient', {...})` com uma
função SECURITY DEFINER que encapsula o lock + insert atomicamente é a forma
mais robusta. Alternativa: usar o service_role client para o insert, que bypassa
RLS e permite transação explícita.

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
| total_slots editado via client | Impossível — GRANT UPDATE cobre apenas full_name, crm, role |

---

## 11. Testes

**Unitários (Vitest):**
- `buildPatientPrompt(specialty, difficulty)` → string de prompt correta
- `hasAvailableSlot(usedSlots, totalSlots)` → boolean correto nos limites (0, igual, acima)
- Constante `SPECIALTIES` — verificar que os valores batem com o CHECK constraint do banco

**Integração (Vitest + Supabase mockado):**
- `POST /api/patients` com OpenAI mockado → paciente salvo, retorna 201
- `POST /api/patients` com OpenAI falhando → slot não consumido, retorna 500
- `POST /api/patients` com timeout simulado → retorna 408, slot não consumido
- `POST /api/patients` sem slots → retorna 403
- Duas requisições simultâneas com 1 slot disponível → apenas 1 paciente criado

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
│   └── patients/
│       ├── specialties.ts                ← constante SPECIALTIES + tipo Specialty
│       ├── prompt.ts                     ← buildPatientPrompt()
│       ├── prompt.test.ts
│       ├── slots.ts                      ← hasAvailableSlot()
│       └── slots.test.ts
└── types/
    └── domain.ts                         ← adicionar tipo Patient
```

**Ordem de implementação obrigatória:**
1. Aplicar migration `0002_add_patients.sql` via Supabase CLI
2. Rodar `supabase gen types typescript --linked > src/types/database.ts`
3. Adicionar tipo `Patient` em `domain.ts`
4. Implementar o restante

---

## 13. Critérios de conclusão

- [ ] Migration `0002_add_patients.sql` aplicada via Supabase CLI
- [ ] `profiles.total_slots` adicionado com CHECK (> 0) e GRANT UPDATE revogado para a coluna
- [ ] Tabela `patients` com CHECK constraint em `specialty` e `age (18-80)`, índice em `user_id`, RLS (SELECT + INSERT + UPDATE)
- [ ] `database.ts` regenerado após migration
- [ ] `POST /api/patients` funcional com OpenAI real (gpt-4o-mini, response_format json_object, timeout 25s)
- [ ] Lock pessimista garantindo atomicidade do slot check + insert
- [ ] Dashboard reformulado em 2 colunas sem `getUser()` redundante
- [ ] Constante `SPECIALTIES` compartilhada entre frontend e backend
- [ ] Página `/patients/new` com guard server-side antes de renderizar
- [ ] Página `/patients/[id]` com tags, estado clínico, histórico e botão de atendimento
- [ ] Página `/consultations/stub` como placeholder
- [ ] Componente `<BondBar />` funcional
- [ ] Componente `<PlaceholderChart />` reutilizado 3x no dashboard
- [ ] Testes unitários e de concorrência passando
- [ ] Teste E2E: fluxo completo de criação de paciente
- [ ] Deploy no Easypanel funcionando após as mudanças
