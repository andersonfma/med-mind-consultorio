# Med Mind — Módulo Consultório
# Sub-projeto 1: Carteira de Pacientes
# Design Spec

Data: 2026-06-02

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

### Tabela `patients`

```sql
CREATE TABLE patients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  age               INTEGER NOT NULL CHECK (age BETWEEN 1 AND 120),
  gender            TEXT NOT NULL CHECK (gender IN ('M', 'F')),
  specialty         TEXT NOT NULL,
  difficulty        TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  chief_complaint   TEXT NOT NULL,
  diagnosis         TEXT,                        -- null até o aluno fechar o diagnóstico
  clinical_status   TEXT NOT NULL,               -- atualizado após cada consulta pela IA
  bond_level        INTEGER NOT NULL DEFAULT 1
                      CHECK (bond_level BETWEEN 1 AND 5),
  conditions        TEXT[] NOT NULL DEFAULT '{}', -- ex: ['HAS', 'DM', 'DLP']
  consultation_count INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_consulted_at TIMESTAMPTZ
);

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

### Tabela `patient_slots`

```sql
CREATE TABLE patient_slots (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_slots  INTEGER NOT NULL DEFAULT 5 CHECK (total_slots >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE patient_slots ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON patient_slots TO authenticated;

CREATE POLICY "Aluno lê próprios slots"
  ON patient_slots FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Aluno insere próprios slots"
  ON patient_slots FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Aluno atualiza próprios slots"
  ON patient_slots FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Trigger updated_at
CREATE TRIGGER patient_slots_updated_at
  BEFORE UPDATE ON patient_slots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### Backfill para usuários existentes

Usuários cadastrados antes desta migration não terão linha em `patient_slots`.
A migration deve incluir um INSERT de backfill:

```sql
INSERT INTO patient_slots (user_id, total_slots)
SELECT id, 5 FROM auth.users
WHERE id NOT IN (SELECT user_id FROM patient_slots);
```

### Nota sobre `used_slots`

`used_slots` não é coluna — é sempre calculado como
`COUNT(*) FROM patients WHERE user_id = X`. Evita dessincronização.
Um slot está disponível quando `COUNT(*) < total_slots`.

### Trigger: cria linha em `patient_slots` ao cadastrar usuário

```sql
CREATE OR REPLACE FUNCTION handle_new_user_slots()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.patient_slots (user_id, total_slots)
  VALUES (NEW.id, 5);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION handle_new_user_slots() SET search_path = public;

CREATE TRIGGER on_auth_user_created_slots
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_slots();
```

---

## 4. Rotas e páginas

```
/dashboard                 ← reformulado: lista de pacientes + gráficos placeholder
/patients/new              ← escolha de especialidade + dificuldade → gera paciente
/patients/[id]             ← detalhe do paciente
```

### `/dashboard`

Layout em duas colunas:

- **Coluna esquerda (40%)**: lista de pacientes + botão "Novo paciente"
- **Coluna direita (60%)**: 3 cards placeholder (Desempenho AB4, Reputação, Volume)
- **Header**: nome do aluno + reputação (número simples, ex: "347 pts"). No MVP
  a reputação começa em 0 e ainda não tem fórmula real — exibe 0 até sub-projeto 3.

O botão "Novo paciente" está desabilitado se `used_slots >= total_slots`, com
tooltip: *"Aumente sua reputação para desbloquear novos pacientes"*.

### `/patients/new`

1. Dropdown de especialidade (lista fixa — ver seção 5)
2. Três botões de dificuldade: Fácil / Médio / Difícil
3. Botão "Confirmar" → spinner com texto *"Seu próximo paciente está chegando..."*
4. Em caso de sucesso: redirect para `/patients/[id]` do paciente criado
5. Em caso de erro: mensagem de erro, slot não consumido, botão reativado

Rota protegida: se `used_slots >= total_slots`, redireciona para `/dashboard`.

### `/patients/[id]`

- Tags de condições no topo: `#HAS` `#DM` `#DLP` (vazio se nenhuma ainda)
- Card de estado clínico atual (texto gerado pela IA)
- Botão **"Iniciar atendimento"** (destacado) — no sub-projeto 1 redireciona para
  uma página placeholder *"Consulta em breve"*; o fluxo real é implementado no sub-projeto 2
- Lista de consultas anteriores com data e resumo (vazia no primeiro acesso)
- Barra de vínculo (5 barras coloridas)

---

## 5. Especialidades disponíveis (lista fixa MVP)

- Clínica Médica
- Cardiologia
- Gastroenterologia
- Pneumologia
- Endocrinologia
- Nefrologia
- Neurologia
- Infectologia

---

## 6. API route: `POST /api/patients`

**Autenticação**: middleware garante sessão válida. A route verifica `user_id`
via `supabase.auth.getUser()`.

**Fluxo:**
1. Recebe `{ specialty, difficulty }` no body
2. Verifica slots disponíveis — se esgotados, retorna `403`
3. Monta prompt e chama OpenAI (ver seção 7)
4. Salva paciente no banco
5. Retorna paciente criado `{ id, name, age, ... }`

**Erros:**
- `400` — body inválido (specialty ou difficulty ausentes/inválidos)
- `403` — sem slots disponíveis
- `500` — falha na OpenAI (slot NÃO é consumido)

---

## 7. Prompt OpenAI para geração de paciente

O prompt é parametrizado por `specialty` e `difficulty`. A resposta deve ser
JSON estruturado para parsing direto (sem prose extra).

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
  "age": número entre 18 e 80,
  "gender": "M" ou "F",
  "chief_complaint": "queixa principal em 1 frase, na voz do paciente",
  "clinical_status": "estado clínico inicial em 1 frase curta, na voz do sistema",
  "conditions": ["lista", "de", "condições", "preexistentes"]
}
```

O campo `conditions` pode ser array vazio para casos fáceis.
`bond_level` começa sempre em 1 (independente da dificuldade).
`diagnosis` começa sempre null.

---

## 8. Listagem de pacientes — componente de vínculo

Cinco barras verticais crescentes em altura, coloridas:

| Nível | Cor      |
|-------|----------|
| 1     | Vermelho |
| 2     | Laranja  |
| 3     | Amarelo  |
| 4     | Verde claro |
| 5     | Verde escuro |

Barras acima do nível atual aparecem acinzentadas.
Implementado como componente `<BondBar level={1..5} />` em SVG ou divs Tailwind.

---

## 9. Gráficos placeholder do dashboard

Três cards na coluna direita com dados mockados em SVG simples:

- **Desempenho AB4**: gráfico de teia (radar) com 4 eixos (A1–A4), valores fixos mockados
- **Reputação**: linha do tempo simples mostrando evolução fictícia
- **Volume de atendimentos**: barras por semana, dados fixos mockados

Os cards devem ter um badge discreto *"Em breve"* ou *"Preview"* para indicar
que os dados são ilustrativos. Os componentes ficam em `src/components/charts/`.

---

## 10. Tratamento de erros e edge cases

| Situação | Comportamento |
|----------|---------------|
| OpenAI falha ou timeout | Erro exibido, slot não consumido, botão reativado |
| Aluno sem slots | Botão desabilitado, tooltip explicativo |
| Paciente sem consultas | Estado clínico inicial gerado, lista de consultas vazia |
| Resposta OpenAI não é JSON válido | Retry automático uma vez; se falhar novamente, erro 500 |
| RLS | Todas as queries filtram por `user_id` automaticamente |

---

## 11. Testes

**Unitários (Vitest):**
- `buildPatientPrompt(specialty, difficulty)` → string de prompt correta
- `hasAvailableSlot(usedSlots, totalSlots)` → boolean correto
- `parsePatientsResponse(json)` → parsing e validação do JSON da OpenAI

**Integração (Vitest + Supabase mockado):**
- `POST /api/patients` com OpenAI mockado → paciente salvo, retorna 201
- `POST /api/patients` com OpenAI falhando → slot não consumido, retorna 500
- `POST /api/patients` sem slots → retorna 403

**E2E (Playwright):**
- Fluxo completo: escolher especialidade + dificuldade → confirmar → paciente aparece na listagem do dashboard

---

## 12. Estrutura de arquivos novos

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   │   └── page.tsx              ← reformulado (2 colunas)
│   │   └── patients/
│   │       ├── new/
│   │       │   └── page.tsx          ← escolha especialidade + dificuldade
│   │       └── [id]/
│   │           └── page.tsx          ← detalhe do paciente
│   └── api/
│       └── patients/
│           └── route.ts              ← POST /api/patients
├── components/
│   ├── charts/
│   │   ├── AbRadarChart.tsx          ← placeholder radar AB4
│   │   ├── ReputationChart.tsx       ← placeholder linha do tempo
│   │   └── VolumeChart.tsx           ← placeholder barras
│   └── ui/
│       └── BondBar.tsx               ← 5 barras de vínculo
├── lib/
│   └── patients/
│       ├── prompt.ts                 ← buildPatientPrompt()
│       ├── prompt.test.ts
│       ├── slots.ts                  ← hasAvailableSlot()
│       └── slots.test.ts
└── types/
    └── domain.ts                     ← adicionar tipos Patient, PatientSlot
```

---

## 13. Critérios de conclusão

- [ ] Migration `0002_create_patients.sql` aplicada via Supabase CLI
- [ ] Tabela `patients` com RLS (SELECT + INSERT + UPDATE) e GRANTs
- [ ] Tabela `patient_slots` com RLS, trigger `updated_at` e trigger de criação automática
- [ ] `POST /api/patients` funcional com OpenAI real
- [ ] Dashboard reformulado em 2 colunas com lista de pacientes e gráficos placeholder
- [ ] Página `/patients/new` com dropdown de especialidade e botões de dificuldade
- [ ] Página `/patients/[id]` com tags, estado clínico, histórico e botão de atendimento
- [ ] Componente `<BondBar />` funcional
- [ ] Controle de slots: botão desabilitado quando esgotados
- [ ] Testes unitários passando (prompt, slots, parsing)
- [ ] Teste E2E: fluxo completo de criação de paciente
- [ ] Deploy no Easypanel funcionando após as mudanças
