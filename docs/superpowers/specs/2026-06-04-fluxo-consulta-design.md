# Med Mind — Módulo Consultório
# Sub-projeto 2: Fluxo de Consulta
# Design Spec

Data: 2026-06-04

---

## 1. Objetivo

Implementar o fluxo de consulta — a sala de atendimento onde o aluno interage com
o paciente simulado via chat, constrói a anamnese, registra seu pensamento clínico
e finaliza a consulta com um diagnóstico.

Este sub-projeto substitui a página stub `/consultations/stub` por uma consulta
funcional completa.

---

## 2. Decisões de produto registradas

### Incluído neste sub-projeto
- Chat livre entre aluno e paciente simulado (IA)
- Anamnese auto-populada via botão "Atualizar ↺" (não em tempo real)
- Campo de pensamento clínico — texto livre, auto-save a cada 30s
- Finalização com diagnóstico livre + atualização de `clinical_status` pela IA
- Guard: paciente só pode ter uma consulta `ongoing` por vez
- Histórico de consultas em `/patients/[id]`
- Consulta interrompida recuperável: botão "Continuar consulta" em `/patients/[id]`

### Fora deste sub-projeto (SPs futuros)
- **Score AB4** — avaliação do pensamento clínico pelo método proprietário AB4 (SP3)
- **Solicitação de exames** — com validação de coerência e justificativa (SP3)
- **Prescrição + Bulário ANVISA** — (SP4)
- **Entrada por áudio** — Web Speech API para chat e pensamento clínico (SP3)

---

## 3. Schema do banco

### Nova tabela `consultations`

```sql
CREATE TABLE consultations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at       TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'ongoing'
                      CHECK (status IN ('ongoing', 'finished')),
  chat_history      JSONB NOT NULL DEFAULT '[]',
  anamnesis         JSONB NOT NULL DEFAULT '{}',
  clinical_reasoning TEXT NOT NULL DEFAULT '',
  diagnosis         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX consultations_patient_id_idx ON consultations(patient_id);
CREATE INDEX consultations_user_id_idx ON consultations(user_id);

-- Garante que um paciente só pode ter uma consulta ongoing por vez
CREATE UNIQUE INDEX consultations_patient_ongoing_idx
  ON consultations(patient_id)
  WHERE status = 'ongoing';

ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON consultations TO authenticated;

CREATE POLICY "Aluno lê próprias consultas"
  ON consultations FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Aluno insere próprias consultas"
  ON consultations FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Aluno atualiza próprias consultas"
  ON consultations FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
```

### Modificações em `patients`

`last_consulted_at` e `clinical_status` já existem — serão atualizados ao finalizar.
`diagnosis` já existe como coluna nullable — será preenchido ao finalizar.

Nenhuma migration de coluna adicional necessária em `patients`.

### Estrutura do JSONB `anamnesis`

```ts
type Anamnesis = {
  hda: string        // História da Doença Atual
  hpp: string        // História Patológica Pregressa
  ad: string         // Antecedentes e Doenças
  social: string     // História Social
  familiar: string   // História Familiar
}
```

### Estrutura do JSONB `chat_history`

```ts
type ChatMessage = {
  role: 'student' | 'patient'
  content: string
  timestamp: string  // ISO 8601
}
```

---

## 4. Rotas

```
/consultations/[id]               ← sala de consulta (substitui /consultations/stub)
/api/consultations                ← POST: criar nova consulta
/api/consultations/[id]           ← PATCH: auto-save pensamento clínico
/api/consultations/[id]/chat      ← POST: enviar mensagem
/api/consultations/[id]/anamnesis ← POST: atualizar anamnese
/api/consultations/[id]/finish    ← POST: finalizar consulta
```

A rota `/consultations/stub` continua existindo até que `/patients/[id]` seja
atualizado para usar `/consultations/[id]` — a migração do link ocorre neste SP.

---

## 5. Arquitetura da página de consulta

### Layout — duas colunas

```
┌─────────────────────────────────────────────────────────────────┐
│  João Silva · 45 anos · Cardiologia · Difícil                   │
│                                        [Finalizar consulta]     │
├──────────────────────────────┬──────────────────────────────────┤
│  CHAT (55%)                  │  ANAMNESE (45%)                  │
│                              │  HDA: ...                        │
│  [Paciente]: Doutor, estou   │  HPP: ...                        │
│  com uma dor no peito...     │  AD: ...                         │
│                              │  H. Social: ...                  │
│  [Aluno]: Há quanto tempo?   │  H. Familiar: ...                │
│                              │  [Atualizar ↺]                   │
│  [Paciente]: Há 2 dias...    ├──────────────────────────────────┤
│                              │  PENSAMENTO CLÍNICO              │
│  ┌──────────────────────┐   │  (campo livre — auto-save 30s)   │
│  │ Digite sua mensagem  │   │                                  │
│  │              [Enviar]│   │                                  │
│  └──────────────────────┘   │                                  │
└──────────────────────────────┴──────────────────────────────────┘
```

### Componentes

```
src/app/(dashboard)/consultations/[id]/
  page.tsx                    ← Server Component (carrega dados iniciais)
  ConsultationClient.tsx      ← Client Component raiz ('use client')
  ConsultationChat.tsx        ← chat com estado local
  AnamnesisPanel.tsx          ← exibe anamnese, botão Atualizar
  ClinicalReasoningField.tsx  ← textarea com auto-save
  FinishModal.tsx             ← modal de finalização com campo diagnóstico
```

**Server Component (`page.tsx`):**
- Verifica autenticação → redireciona para LOGIN_ROUTE
- Busca `consultation` + `patient` em paralelo com `Promise.all`
- Verifica que `consultation.user_id === user.id` → `notFound()` se não
- Passa dados via props para `ConsultationClient`

**ConsultationClient** gerencia o estado compartilhado (chat, anamnese, pensamento
clínico) e distribui para os componentes filhos via props/callbacks.

**Auto-save do pensamento clínico:** `ClinicalReasoningField` chama
`PATCH /api/consultations/[id]` com `{ clinical_reasoning: string }` a cada 30s
usando `useEffect` + `setInterval`. O PATCH atualiza apenas a coluna
`clinical_reasoning` — não toca em `chat_history` nem `anamnesis`.

---

## 6. Chamadas de IA

### 6.1 Chat — simular o paciente

**Endpoint:** `POST /api/consultations/[id]/chat`

**System prompt:**
```
Você é um paciente simulado para treinamento médico.

Nome: {patient.name}
Idade: {patient.age} anos
Gênero: {patient.gender === 'M' ? 'Masculino' : 'Feminino'}
Especialidade: {patient.specialty}
Queixa principal: {patient.chief_complaint}
Estado clínico: {patient.clinical_status}
Condições preexistentes: {patient.conditions.join(', ') || 'nenhuma'}
Dificuldade: {patient.difficulty}

Regras:
- Responda APENAS como o paciente, na primeira pessoa
- Nunca quebre o personagem ou mencione que é uma simulação
- Nível easy: fale de forma clara e objetiva
- Nível medium: seja moderadamente vago, forneça informações aos poucos
- Nível hard: seja impreciso, confunda datas, minimize sintomas

Responda de forma concisa (1-3 frases).
```

**Request body:** `{ message: string }`
**Histórico completo** é enviado como `messages` para manter contexto.
**Resposta salva** no `chat_history` da consulta.

### 6.2 Atualizar anamnese

**Endpoint:** `POST /api/consultations/[id]/anamnesis`

**Prompt:**
```
Analise a conversa abaixo entre um médico e um paciente e extraia as informações
para cada seção da anamnese. Se uma seção não tiver informações suficientes,
deixe como string vazia.

Responda APENAS com JSON válido:
{
  "hda": "História da Doença Atual",
  "hpp": "História Patológica Pregressa",
  "ad": "Antecedentes e Doenças",
  "social": "História Social",
  "familiar": "História Familiar"
}

Conversa:
{chatHistory}
```

**response_format: json_object** obrigatório.
**Atualiza** o campo `anamnesis` na tabela `consultations`.

### 6.3 Finalizar — gerar novo clinical_status

**Endpoint:** `POST /api/consultations/[id]/finish`

**Request body:** `{ diagnosis: string }`

**Prompt:**
```
Você é um sistema de simulação médica. Uma consulta foi realizada.

Paciente: {patient.name}, {patient.age} anos, {patient.specialty}
Queixa inicial: {patient.chief_complaint}
Estado clínico anterior: {patient.clinical_status}
Diagnóstico proposto pelo aluno: {diagnosis}
Pensamento clínico registrado: {clinicalReasoning}

Gere uma frase curta descrevendo o novo estado clínico do paciente após
esta consulta, considerando o diagnóstico proposto. Se o diagnóstico parecer
razoável, melhore o estado. Se parecer inadequado, mantenha ou piore levemente.

Responda APENAS com a frase do estado clínico (sem JSON, sem explicação).
```

**Ações ao finalizar:**
1. IA gera novo `clinical_status`
2. `consultations`: `status = 'finished'`, `finished_at = NOW()`, `diagnosis = ...`
3. `patients`: `clinical_status`, `last_consulted_at`, `diagnosis` atualizados
4. Redirect para `/patients/[patient_id]`

**Atomicidade:** as atualizações em `consultations` e `patients` ocorrem em
sequência no route handler. Não há RPC para este fluxo — as chamadas são simples
UPDATEs separados. Se o UPDATE de `patients` falhar, a consulta já está marcada
como `finished` — o aluno pode ver o erro e o sistema mantém consistência parcial
aceitável para SP2.

---

## 7. Guard de consulta duplicada

Ao clicar "Iniciar atendimento" em `/patients/[id]`:

```
POST /api/consultations
```

1. Verifica se `consultations` tem registro `ongoing` para este `patient_id`
2. **Se sim:** retorna `{ id: existingId }` com status `200` — o frontend redireciona para a consulta existente
3. **Se não:** insere nova consulta, retorna `{ id: newId }` com status `201`

O UNIQUE INDEX `consultations_patient_ongoing_idx` garante atomicidade no banco —
mesmo com requisições concorrentes, apenas uma consulta `ongoing` por paciente é possível.

---

## 8. Atualização de `/patients/[id]`

### Botão "Iniciar atendimento"

Substituir o `<Link href={STUB_CONSULTATION_ROUTE}>` por um botão que chama
`POST /api/consultations` e redireciona para `/consultations/[id]`.

O botão precisa ser um **Client Component** (usa `fetch` e `useRouter`).
Extrair como `StartConsultationButton.tsx`.

### Histórico de consultas

Buscar `consultations` onde `patient_id = patient.id` e `status = 'finished'`,
ordenadas por `finished_at DESC`. Exibir lista simples com:
- Data da consulta
- Diagnóstico registrado
- Status do paciente após a consulta (`clinical_status` snapshot — não armazenado
  ainda; em SP2 exibe apenas a data e o diagnóstico)

### Consulta em andamento

Se existir consulta `ongoing`, mostrar banner:
```
Consulta em andamento — [Continuar consulta]
```
O link aponta para `/consultations/[ongoing_consultation_id]`.

---

## 9. Constantes de rota

Adicionar a `src/lib/routes.ts`:

```ts
export const consultationRoute = (id: string) => `/consultations/${id}`
```

---

## 10. Tratamento de erros

| Situação | Comportamento |
|----------|---------------|
| Chat: timeout OpenAI (>25s) | Mensagem de erro inline, botão "Tentar novamente" visível |
| Chat: erro genérico | Mensagem de erro inline, consulta não perdida |
| Atualizar anamnese: erro | Toast de erro, campos mantêm valores anteriores |
| Finalizar: erro IA | Modal permanece aberto, aluno pode tentar novamente |
| Aluno fecha browser | Consulta fica `ongoing`; "Continuar consulta" em `/patients/[id]` |
| Paciente já tem consulta ongoing | `POST /api/consultations` retorna 200 com `id` existente |
| Usuário tenta acessar consulta de outro paciente | `notFound()` |

---

## 11. Testes

### Unitários (Vitest)

- `buildPatientSystemPrompt(patient)` → verifica que nome, queixa, condições e difficulty estão no prompt
- `buildAnamnesisPrompt(chatHistory)` → verifica campos HDA/HPP/AD/social/familiar no prompt
- `parseAnamnesisResponse(json)` → valida que retorna objeto com os 5 campos, string vazia para ausentes
- `buildFinishPrompt(patient, diagnosis, reasoning)` → verifica dados do paciente e diagnóstico

### Integração (Vitest + mocks OpenAI/Supabase)

- `POST /api/consultations` → cria consulta, retorna 201
- `POST /api/consultations` → duplicata retorna 200 com id existente
- `POST /api/consultations/[id]/chat` → salva mensagem, retorna resposta
- `POST /api/consultations/[id]/chat` → timeout retorna 408, consulta não perdida
- `POST /api/consultations/[id]/anamnesis` → atualiza anamnese, retorna 200
- `POST /api/consultations/[id]/finish` → finaliza consulta, atualiza paciente

### E2E (Playwright)

- Fluxo completo: `/patients/[id]` → "Iniciar atendimento" → enviar mensagem → atualizar anamnese → finalizar → histórico aparece em `/patients/[id]`
- Retomada: fechar browser → reabrir → "Continuar consulta" → mesma consulta

---

## 12. Estrutura de arquivos novos

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── consultations/
│   │   │   ├── stub/             ← mantido até migração completa do link
│   │   │   └── [id]/
│   │   │       ├── page.tsx               ← Server Component
│   │   │       ├── ConsultationClient.tsx ← Client Component raiz
│   │   │       ├── ConsultationChat.tsx
│   │   │       ├── AnamnesisPanel.tsx
│   │   │       ├── ClinicalReasoningField.tsx
│   │   │       └── FinishModal.tsx
│   │   └── patients/
│   │       └── [id]/
│   │           ├── page.tsx               ← atualizado (histórico + botão continuar)
│   │           └── StartConsultationButton.tsx ← novo Client Component
│   └── api/
│       └── consultations/
│           ├── route.ts                   ← POST (criar)
│           └── [id]/
│               ├── chat/
│               │   └── route.ts           ← POST (enviar mensagem)
│               ├── anamnesis/
│               │   └── route.ts           ← POST (atualizar anamnese)
│               └── finish/
│                   └── route.ts           ← POST (finalizar)
└── lib/
    └── consultations/
        ├── prompts.ts                     ← buildPatientSystemPrompt, buildAnamnesisPrompt, buildFinishPrompt
        ├── prompts.test.ts
        ├── parse.ts                       ← parseAnamnesisResponse
    └── parse.test.ts
```

---

## 13. Ordem de implementação obrigatória

1. Migration: criar tabela `consultations`
2. Regenerar tipos TypeScript
3. Adicionar `consultationRoute` em `src/lib/routes.ts`
4. `src/lib/consultations/prompts.ts` + testes (TDD)
5. `src/lib/consultations/parse.ts` + testes (TDD)
6. `POST /api/consultations` + testes
7. `POST /api/consultations/[id]/chat` + testes
8. `POST /api/consultations/[id]/anamnesis` + testes
9. `POST /api/consultations/[id]/finish` + testes
10. Componentes de UI (ConsultationChat, AnamnesisPanel, ClinicalReasoningField, FinishModal)
11. Página `/consultations/[id]` (Server + Client)
12. Atualizar `/patients/[id]` (StartConsultationButton + histórico)
13. E2E tests

---

## 14. Critérios de conclusão

- [ ] Migration `consultations` aplicada com UNIQUE INDEX em `(patient_id) WHERE status = 'ongoing'`
- [ ] `database.ts` regenerado
- [ ] `consultationRoute(id)` em `src/lib/routes.ts`
- [ ] Prompts testados: `buildPatientSystemPrompt`, `buildAnamnesisPrompt`, `buildFinishPrompt`
- [ ] `parseAnamnesisResponse` testado com campos ausentes retornando string vazia
- [ ] `POST /api/consultations`: cria consulta (201) ou retorna existente (200)
- [ ] `POST /api/consultations/[id]/chat`: salva mensagem, retorna resposta do paciente, timeout → 408
- [ ] `POST /api/consultations/[id]/anamnesis`: atualiza JSONB, retorna 200
- [ ] `PATCH /api/consultations/[id]`: atualiza `clinical_reasoning`, retorna 200
- [ ] `POST /api/consultations/[id]/finish`: atualiza consulta + paciente, retorna 200
- [ ] `/consultations/[id]`: layout duas colunas, chat (55%), anamnese + pensamento clínico (45%)
- [ ] Auto-save de pensamento clínico a cada 30s
- [ ] Guard duplicata funcional (UNIQUE INDEX + handler retorna id existente)
- [ ] `/patients/[id]` atualizado: botão "Iniciar atendimento" funcional, histórico, banner "Continuar"
- [ ] Todos os testes passando
- [ ] Deploy funcionando
