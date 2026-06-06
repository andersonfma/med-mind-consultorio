# Memória do Caso (Prontuário Longitudinal) — Design

**Data:** 2026-06-06
**Status:** Aprovado (aguardando review do spec)

## Problema

No simulador, consultas de seguimento (retorno) hoje sofrem de três limitações:

1. **O paciente não lembra** das medicações/condutas prescritas nem dos exames já feitos. Em retorno recebe apenas `clinical_status` (uma frase) e os resultados de exames da última consulta — sem narrativa longitudinal. Respostas ficam pobres e pouco realistas.
2. **Pouca diversidade** de respostas do paciente entre consultas.
3. **O validador de exames bloqueia exames de monitoramento.** `buildExamValidationPrompt` avalia cada pedido apenas contra a queixa/hipótese inicial, sem saber que é um retorno com tratamento em curso. Exames de controle (válidos para monitorar tratamento) são rejeitados por "não ter relação com a apresentação clínica". O usuário precisa justificar repetidamente.

Não existe módulo de prescrição (isso é SP4). Portanto a memória extrai medicações/condutas do **texto livre** que já existe: o pensamento clínico do aluno e o chat.

## Objetivo

Um único mecanismo — a **memória do caso** (`case_summary`) — gerado por consulta e cumulativo, injetado em dois pontos: o prompt do paciente e o validador de exames. Resolve os três pontos acima.

## Decisões de design

- **Formato:** resumo narrativo com seções rotuladas (texto), guardado como **um único campo de texto** — NÃO JSON. Minimiza superfície de bug (sem parsing/schema), é estruturado o bastante para o validador entender o que está em monitoramento e natural para o paciente lembrar. Segue o padrão já usado com `pendingResults` (concatenação no prompt).
- **Cumulativo:** cada consulta finalizada gera um novo resumo a partir do resumo anterior + dados da consulta atual. O paciente "lembra" de toda a linha do tempo, não só da última consulta.
- **Quando gera:** no `finish` da consulta (que já faz uma chamada à IA para o `clinical_status`). Geração **não-bloqueante** — se falhar, o resumo anterior permanece (degrada sem quebrar o finish), igual ao padrão da avaliação de diagnóstico existente.
- **Fonte de "follow-up":** `isFollowUp` é derivado da **presença de `case_summary`** (só existe após uma consulta finalizada). Evita query extra e reduz risco.

## Arquitetura

### 1. Schema — migração

Adicionar coluna em `patients`:

```sql
ALTER TABLE patients ADD COLUMN case_summary TEXT;
```

Nullable. Pacientes existentes ficam com `NULL` → comportam-se como hoje até a próxima consulta finalizada.

### 2. Geração da memória — `buildCaseSummaryPrompt` (novo, em `src/lib/consultations/prompts.ts`)

Assinatura:
```
buildCaseSummaryPrompt(
  patient: Patient,
  priorSummary: string | null,
  chatHistory: ChatMessage[],
  clinicalReasoning: string,
  examResults: { exam_name: string; result: string | null }[]
): string
```

O prompt instrui a IA a produzir/atualizar um resumo cumulativo com seções rotuladas em texto simples:

```
Medicações em uso: <lista das condutas/medicações mencionadas pelo aluno até agora>
Exames já realizados: <exames aprovados e seus achados-chave>
Evolução: <linha do tempo curta consulta a consulta>
Plano/pendências: <o que ficou combinado / o que monitorar>
```

Regras-chave do prompt:
- Incorporar o `priorSummary` (não perder histórico) e ADICIONAR o que houve nesta consulta.
- Extrair medicações/condutas do `clinicalReasoning` e do chat (não inventar conduta que o aluno não deu).
- Texto simples, sem markdown, sem JSON.
- Conciso (não deixar crescer indefinidamente — resumir consultas antigas).

### 3. `finish` route — gerar e salvar (`src/app/api/consultations/[id]/finish/route.ts`)

Após gerar `clinical_status`, e de forma **não-bloqueante**:
- Buscar os `exam_requests` aprovados **desta** consulta (exam_name, result).
- Chamar a IA com `buildCaseSummaryPrompt(patient, patient.case_summary, chat_history, clinical_reasoning, examResults)`.
- Salvar o resultado em `patients.case_summary` (no mesmo update do `clinical_status` ou em update separado; se a chamada falhar, não atualiza e não quebra o finish).

### 4. Paciente lembra — `buildPatientSystemPrompt` (`src/lib/consultations/prompts.ts`)

- Novo parâmetro opcional `caseSummary?: string | null`.
- Quando `!isFirstConsultation` e `caseSummary` presente, injetar bloco:
  ```
  MEMÓRIA DO CASO (o que você lembra das consultas anteriores — use para responder de forma coerente e variada, na 1ª pessoa, sem recitar literalmente):
  <case_summary>
  ```
- O paciente passa a lembrar espontaneamente das medicações que toma e dos exames que fez.
- `chat/route.ts` já carrega `patients(*)` → `case_summary` disponível; só passar ao builder.

### 5. Validador entende monitoramento — `buildExamValidationPrompt` (`src/lib/exams/exam-prompts.ts`)

- Novos parâmetros: `caseSummary?: string | null` e `isFollowUp: boolean` (derivado de `!!case_summary` na rota de exames, que já carrega `patients(*)`).
- Injetar a memória do caso no prompt de avaliação.
- Nova regra de aprovação:
  > Em consulta de RETORNO com tratamento em curso (ver memória do caso), exames de **monitoramento/controle/seguimento** de um tratamento iniciado OU de um diagnóstico já em investigação são VÁLIDOS, mesmo sem relação direta com a queixa inicial. Ex: repetir função renal/eletrólitos após iniciar diurético; repetir hemoglobina glicada para acompanhar controle glicêmico; reavaliar exame de imagem para resposta ao tratamento.

## Fluxo de dados

1. Aluno finaliza consulta N → `finish` gera `clinical_status` **e** `case_summary` cumulativo (resumo anterior + chat + pensamento clínico + exames de N) → salvos no paciente.
2. Aluno abre consulta N+1 (retorno) → `chat` carrega `case_summary` → paciente lembra de medicações/exames/evolução → respostas mais ricas e variadas.
3. Aluno pede exame de controle → validador recebe `case_summary` + `isFollowUp` → aprova exame de monitoramento.

## Tratamento de erros

- Geração de `case_summary` no finish: **não-bloqueante** (try/catch silencioso). Falha → mantém resumo anterior; consulta finaliza normalmente.
- `case_summary` nulo/ausente (1ª consulta ou pacientes antigos): paciente e validador comportam-se como hoje.

## Testes

- **Unit (prompts):** `buildCaseSummaryPrompt` inclui as seções e o resumo anterior; `buildPatientSystemPrompt` injeta a memória só em retorno com summary presente; `buildExamValidationPrompt` injeta memória + regra de monitoramento quando `isFollowUp`.
- **Rotas (mock OpenAI):** `finish` salva `case_summary`; `chat` passa `case_summary` ao builder; `exams` passa `case_summary`/`isFollowUp`.
- **Empírico (modelo real, script temporário):** simular caso ICC — consulta 1 (iniciar enalapril+furosemida, pedir eco) → finalizar → consulta 2: (a) paciente lembra dos remédios quando perguntado; (b) pedido de "função renal e eletrólitos para controle do diurético" é APROVADO.

## Fora de escopo

- Módulo de prescrição estruturado (SP4) — por ora medicações saem do texto livre.
- UI para exibir/editar a memória do caso ao aluno (a memória é interna ao simulador).
- Limite/truncamento sofisticado do tamanho do resumo (apenas instrução de concisão no prompt).
