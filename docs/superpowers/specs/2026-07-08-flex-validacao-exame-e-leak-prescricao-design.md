# Flexibilização da validação de exame + correção de vazamento de diagnóstico na prescrição

**Data:** 2026-07-08
**Tipo:** Ajuste fino de comportamento (2 correções independentes)
**Branch:** `fix/exam-validation-flex-e-prescricao-leak`

## Contexto

Testes em produção do SP4 revelaram dois problemas de comportamento da IA:

1. **Validação de exame rígida demais.** A solicitação de um ecocardiograma justificada como
   "avaliar sopro cardíaco e turgência jugular" — uma justificativa clinicamente válida — foi
   **reprovada** pelo juiz de exames.
2. **Feedback da prescrição vaza o diagnóstico.** Ao prescrever furosemida, o feedback de
   adequação respondeu *"…adequado para manejo de edema na amiloidose sistêmica AL…"*,
   **entregando o `true_diagnosis`** e estragando a descoberta do caso.

## Causa-raiz

### Q1 — Exames (`src/lib/exams/exam-prompts.ts` + `src/app/api/consultations/[id]/exams/route.ts`)

- Existe um gate por IA (`buildExamValidationPrompt`, `MODELS.utility`). Reprovado → exame
  fica `rejected` e **nenhum resultado é gerado** (aluno pode reenviar até 3x).
- Contexto pobre: a rota passa ao juiz **apenas os sinais vitais** do exame físico
  (`route.ts` monta `physicalExamSummary` só com `physical_exam.sinais_vitais`). Achados
  como sopro/turgência que o aluno encontrou no exame físico **não chegam ao juiz** — pesam
  só se repetidos no texto da justificativa.
- Barra do prompt, na prática, alta o suficiente para o mini reprovar casos limítrofes válidos.

### Q2 — Prescrições (`src/lib/prescriptions/prescription-prompts.ts`)

- `buildPrescriptionEvalPrompt` injeta `true_diagnosis` no prompt **e não proíbe citá-lo** no
  campo `feedback`. O modelo naturalmente nomeia a doença ao justificar a adequação.
- Nota: prescrição **nunca é bloqueada** — é sempre salva como `active`. O que existe é o
  selo `adequacy` (`adequada` | `parcial` | `inadequada`) + `ai_feedback`. Não há "aprovação"
  a remover; o problema é só o texto do feedback.

## Decisão de desenho (aprovada pelo usuário)

### Q1 → Afrouxar o juiz (mantém o gate, corrige o contexto e baixa a barra)

1. **Passar o exame físico completo ao juiz**, não só sinais vitais. Montar um resumo com
   todos os campos preenchidos de `physical_exam` (ex.: sinais vitais, cardiovascular,
   respiratório, antropometria, sistemas adicionais etc.), não apenas `sinais_vitais`.
2. **Baixar a barra no prompt** (`buildExamValidationPrompt`): a regra de rejeição passa a ser
   explicitamente conservadora — **só reprovar quando o exame não tem NENHUM nexo clínico nem
   preventivo com o caso**; na dúvida, **aprovar**. Reforçar que uma justificativa que aponta
   um achado do exame físico ou uma hipótese plausível é suficiente.

Mantém-se: o limite de 3 tentativas, o fluxo `approved/rejected`, a geração de resultado só
quando aprovado.

### Q2 → Corrigir o vazamento (mantém a avaliação, proíbe nomear o diagnóstico)

1. Em `buildPrescriptionEvalPrompt`, **manter** o uso interno do `true_diagnosis` para
   classificar a adequação, mas adicionar **proibição absoluta** de nomear/revelar o
   diagnóstico verdadeiro (ou sinônimos/entidade específica) no campo `feedback`.
2. O feedback deve ser redigido em termos do **quadro/queixa e da segurança** — orientar sem
   entregar a resposta. Ex. permitido: *"Furosemida é razoável para manejo de congestão/edema,
   mas falta indicação clara e monitorização do balanço hídrico."* Ex. proibido: qualquer
   frase que nomeie a doença de base (ex.: "amiloidose", "insuficiência cardíaca por…").

Mantém-se: selo `adequacy`, avaliação best-effort na adição, efeito do tratamento na evolução
ao encerrar.

## Fora de escopo

- Não mexer no AB4, na geração do paciente, no efeito do tratamento na evolução, nem no fluxo
  de tentativas de exame.
- Não remover o gate de exame nem a avaliação de prescrição (opções descartadas pelo usuário).
- Não alterar schema do banco.

## Arquivos afetados

- `src/lib/exams/exam-prompts.ts` — `buildExamValidationPrompt` (baixar a barra de rejeição).
- `src/app/api/consultations/[id]/exams/route.ts` — montar `physicalExamSummary` com o exame
  físico completo.
- `src/lib/prescriptions/prescription-prompts.ts` — `buildPrescriptionEvalPrompt` (proibir
  citar o diagnóstico no feedback).
- Testes correspondentes em `exam-prompts.test.ts` e `prescription-prompts.test.ts`.

## Critérios de sucesso

1. ECO justificado por "sopro + turgência jugular" é **aprovado**.
2. Exame sem qualquer nexo (ex.: colonoscopia num caso de cefaleia sem menção a rastreio) ainda
   é **reprovado**.
3. Achados do exame físico (além de sinais vitais) chegam ao prompt do juiz.
4. Feedback de prescrição **nunca** contém o nome do `true_diagnosis` — verificável por teste de
   prompt (o prompt instrui a não revelar) e por inspeção manual em prod.
5. `npx tsc --noEmit` limpo (exceto `validator.ts` pré-existente); testes passam.
