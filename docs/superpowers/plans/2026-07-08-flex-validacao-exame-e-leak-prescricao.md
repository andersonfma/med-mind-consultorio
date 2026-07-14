# Flexibilização da validação de exame + correção de vazamento na prescrição — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afrouxar o gate de validação de exame (passar exame físico completo + baixar a barra de rejeição) e impedir que o feedback de adequação da prescrição nomeie o diagnóstico verdadeiro.

**Architecture:** Três mudanças pontuais e independentes: (1) um helper puro que formata o `physical_exam` completo para texto; (2) a rota de exames passa a usar esse helper em vez de só `sinais_vitais`; (3) dois ajustes de prompt — barra de rejeição do juiz de exames e proibição de citar o diagnóstico no feedback de prescrição. Sem mudança de schema, sem tocar AB4.

**Tech Stack:** Next.js 16 (App Router, route handlers), TypeScript, Vitest, OpenAI SDK (`MODELS.utility` = gpt-4.1-mini), Supabase.

## Global Constraints

- `openai` é NAMED export: `import { openai } from '@/lib/openai/client'`.
- Testes Vitest: usar `vi.hoisted()` para variáveis de mock.
- Idioma do produto: pt-BR (prompts, feedback, testes descritivos em português).
- `npx tsc --noEmit` deve passar (ignorar erros pré-existentes de `validator.ts`).
- Commits frequentes, um por task. Mensagens em pt-BR, terminar com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- NÃO remover o gate de exame nem a avaliação de prescrição. NÃO alterar schema.

---

### Task 1: Helper `formatPhysicalExamSummary`

Formata o objeto `physical_exam` armazenado (todos os campos preenchidos) num resumo de texto para o prompt do juiz. Hoje a rota só usa `sinais_vitais`.

**Files:**
- Modify: `src/lib/consultations/parse.ts` (adicionar export ao fim; o tipo `PhysicalExam` já vive aqui)
- Test: `src/lib/consultations/parse.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `formatPhysicalExamSummary(exam: Record<string, unknown> | null | undefined): string` — junta cada campo string não-vazio como `Rótulo: valor` por linha, incluindo as chaves de `sistemas_adicionais`; retorna `''` se nada preenchido.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao fim de `src/lib/consultations/parse.test.ts` (garantir o import no topo do arquivo: `import { ..., formatPhysicalExamSummary } from './parse'`):

```ts
describe('formatPhysicalExamSummary', () => {
  it('inclui todos os campos preenchidos com rótulos legíveis', () => {
    const out = formatPhysicalExamSummary({
      sinais_vitais: 'PA 120/80',
      aparelho_cardiovascular: 'Sopro sistólico em foco aórtico; turgência jugular a 45°',
      aparelho_respiratorio: '',
      abdome: 'Flácido, indolor',
      sistemas_adicionais: { pele: 'Equimoses em MMII' },
    })
    expect(out).toContain('Sinais vitais: PA 120/80')
    expect(out).toContain('Aparelho cardiovascular: Sopro sistólico em foco aórtico; turgência jugular a 45°')
    expect(out).toContain('Abdome: Flácido, indolor')
    expect(out).toContain('pele: Equimoses em MMII')
    expect(out).not.toContain('Aparelho respiratório:') // campo vazio é omitido
  })

  it('retorna string vazia quando nada está preenchido', () => {
    expect(formatPhysicalExamSummary({})).toBe('')
    expect(formatPhysicalExamSummary(null)).toBe('')
    expect(formatPhysicalExamSummary(undefined)).toBe('')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/lib/consultations/parse.test.ts -t "formatPhysicalExamSummary"`
Expected: FAIL — `formatPhysicalExamSummary is not a function` / import não resolve.

- [ ] **Step 3: Implementar o helper**

Adicionar ao fim de `src/lib/consultations/parse.ts`:

```ts
const PHYSICAL_EXAM_LABELS: Record<string, string> = {
  antropometria: 'Antropometria',
  inspecao_geral: 'Inspeção geral',
  sinais_vitais: 'Sinais vitais',
  aparelho_respiratorio: 'Aparelho respiratório',
  aparelho_cardiovascular: 'Aparelho cardiovascular',
  abdome: 'Abdome',
  membros_inferiores: 'Membros inferiores',
}

export function formatPhysicalExamSummary(
  exam: Record<string, unknown> | null | undefined
): string {
  if (!exam || typeof exam !== 'object') return ''
  const lines: string[] = []
  for (const [key, label] of Object.entries(PHYSICAL_EXAM_LABELS)) {
    const v = exam[key]
    if (typeof v === 'string' && v.trim()) lines.push(`${label}: ${v.trim()}`)
  }
  const sistemas = exam.sistemas_adicionais
  if (sistemas && typeof sistemas === 'object' && !Array.isArray(sistemas)) {
    for (const [k, v] of Object.entries(sistemas as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) lines.push(`${k}: ${v.trim()}`)
    }
  }
  return lines.join('\n')
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/lib/consultations/parse.test.ts -t "formatPhysicalExamSummary"`
Expected: PASS (ambos os casos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/consultations/parse.ts src/lib/consultations/parse.test.ts
git commit -m "feat(exames): helper formatPhysicalExamSummary para resumo completo do exame físico" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Rota de exames usa o exame físico completo

Trocar o resumo só-de-sinais-vitais pelo helper da Task 1, para que achados como sopro/turgência cheguem ao juiz.

**Files:**
- Modify: `src/app/api/consultations/[id]/exams/route.ts:66-69` (montagem de `physicalExamSummary`) e o import
- Test: `src/app/api/consultations/[id]/exams/route.test.ts`

**Interfaces:**
- Consumes: `formatPhysicalExamSummary` da Task 1.
- Produces: nada novo (comportamento interno da rota).

- [ ] **Step 1: Escrever o teste que falha**

No `route.test.ts`, ampliar o `mockConsultation` para ter um achado cardiovascular e adicionar um teste que verifica que esse achado chega ao prompt de validação (primeira chamada ao `mockCreate`).

Trocar a constante `mockConsultation` (linha ~31) por:

```ts
const mockConsultation = {
  clinical_reasoning: 'Suspeito de IAM',
  physical_exam: {
    sinais_vitais: 'PA: 140/90 mmHg',
    aparelho_cardiovascular: 'Sopro sistólico 3+/6; turgência jugular presente',
  },
  patients: mockPatient,
}
```

Adicionar dentro do `describe('POST ...')`, após o teste "retorna 201 com exame aprovado":

```ts
it('passa o exame físico completo (além dos sinais vitais) ao juiz', async () => {
  await POST(...makePost({ exam_name: 'Ecocardiograma', justification: 'Avaliar sopro e turgência jugular' }))
  const validationPrompt = mockCreate.mock.calls[0][0].messages[0].content as string
  expect(validationPrompt).toContain('turgência jugular')
  expect(validationPrompt).toContain('Sopro sistólico')
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run "src/app/api/consultations/[id]/exams/route.test.ts" -t "exame físico completo"`
Expected: FAIL — o prompt só contém `sinais_vitais`, não `turgência jugular`.

- [ ] **Step 3: Implementar a mudança na rota**

Em `src/app/api/consultations/[id]/exams/route.ts`, adicionar ao import de exames a função helper. O import atual de `cleanExamResult` fica; adicionar (junto aos imports do topo):

```ts
import { formatPhysicalExamSummary } from '@/lib/consultations/parse'
```

Substituir o bloco atual (linhas ~66-69):

```ts
  const physicalExam = consultation.physical_exam as Record<string, string> ?? {}
  const physicalExamSummary = physicalExam.sinais_vitais
    ? `Sinais vitais: ${physicalExam.sinais_vitais}`
    : ''
```

por:

```ts
  const physicalExam = consultation.physical_exam as Record<string, unknown> ?? {}
  const physicalExamSummary = formatPhysicalExamSummary(physicalExam)
```

- [ ] **Step 4: Rodar os testes da rota e confirmar que passam**

Run: `npx vitest run "src/app/api/consultations/[id]/exams/route.test.ts"`
Expected: PASS — todos os testes (o novo + os 6 existentes).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/consultations/[id]/exams/route.ts" "src/app/api/consultations/[id]/exams/route.test.ts"
git commit -m "fix(exames): juiz de validação recebe o exame físico completo, não só sinais vitais" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Baixar a barra de rejeição do juiz de exames

Reescrever os critérios de aprovação em `buildExamValidationPrompt` para serem explicitamente conservadores: só reprovar sem nenhum nexo clínico/preventivo; na dúvida, aprovar.

**Files:**
- Modify: `src/lib/exams/exam-prompts.ts:35-38` (bloco "Critérios de aprovação")
- Test: `src/lib/exams/exam-prompts.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: nada (mesma assinatura de `buildExamValidationPrompt`).

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao `describe('buildExamValidationPrompt', ...)` em `exam-prompts.test.ts`:

```ts
it('instrui a aprovar na dúvida e só reprovar sem nexo algum', () => {
  const prompt = buildExamValidationPrompt(
    mockPatient as Patient, 'Ecocardiograma', 'avaliar sopro e turgência jugular', '', ''
  )
  const lower = prompt.toLowerCase()
  expect(lower).toContain('na dúvida')
  expect(lower).toContain('aprov')
  expect(lower).toContain('nenhum')
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/lib/exams/exam-prompts.test.ts -t "aprovar na dúvida"`
Expected: FAIL — o prompt atual não contém "na dúvida".

- [ ] **Step 3: Reescrever o bloco de critérios**

Em `src/lib/exams/exam-prompts.ts`, substituir o bloco atual:

```ts
Critérios de aprovação:
- Exames diretamente relacionados à queixa ou hipótese diagnóstica: aprovar se a justificativa for razoável
- Exames de rastreio/prevenção (ex: colonoscopia para rastreio colorretal, mamografia, PSA, densitometria): aprovar se o aluno mencionar rastreio ou prevenção como justificativa — mesmo sem relação com a queixa principal
- Rejeitar apenas quando o exame não tem qualquer relação clínica ou preventiva com o caso E a justificativa for inadequada${followUpRule}
```

por:

```ts
Critérios de aprovação (SEJA PERMISSIVO — a barra é BAIXA):
- Aprove sempre que houver QUALQUER nexo clínico plausível: relação com a queixa, com uma hipótese diagnóstica, com um achado do exame físico (ex: sopro/turgência → ecocardiograma), com as condições do paciente, ou com rastreio/prevenção.
- Uma justificativa que cita um achado, um sintoma ou uma hipótese razoável JÁ é suficiente — não exija justificativa longa nem perfeita.
- NA DÚVIDA, APROVE. O objetivo é treinar o raciocínio do aluno, não puni-lo por imprecisão.
- Reprove APENAS quando o exame não tem NENHUM nexo clínico nem preventivo com o caso (ex: exame de uma área totalmente alheia à queixa, sem menção a rastreio). Só nesse caso, "approved": false.${followUpRule}
```

- [ ] **Step 4: Rodar os testes do arquivo e confirmar que passam**

Run: `npx vitest run src/lib/exams/exam-prompts.test.ts`
Expected: PASS — o novo teste + os existentes (os testes existentes checam presença de nome/justificativa/JSON, não o texto dos critérios).

- [ ] **Step 5: Commit**

```bash
git add src/lib/exams/exam-prompts.ts src/lib/exams/exam-prompts.test.ts
git commit -m "fix(exames): baixar a barra do juiz — aprovar na dúvida, reprovar só sem nexo algum" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Proibir o feedback de prescrição de nomear o diagnóstico

Adicionar proibição explícita em `buildPrescriptionEvalPrompt`: usar o `true_diagnosis` internamente para classificar, mas NUNCA citá-lo no `feedback`.

**Files:**
- Modify: `src/lib/prescriptions/prescription-prompts.ts` (bloco de instrução antes do JSON)
- Test: `src/lib/prescriptions/prescription-prompts.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: nada (mesma assinatura de `buildPrescriptionEvalPrompt`).

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao `describe('buildPrescriptionEvalPrompt', ...)` em `prescription-prompts.test.ts`:

```ts
it('proíbe revelar/nomear o diagnóstico verdadeiro no feedback', () => {
  const p = buildPrescriptionEvalPrompt(patient, 'Furosemida', '40 mg VO 1x/dia', 'congestão')
  const lower = p.toLowerCase()
  expect(lower).toContain('não')
  expect(lower).toContain('feedback')
  // deve conter uma proibição explícita de nomear/revelar o diagnóstico
  expect(/n[ãa]o.*(nome|cit|revel).*(diagn[óo]stico)/s.test(lower)).toBe(true)
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/lib/prescriptions/prescription-prompts.test.ts -t "proíbe revelar"`
Expected: FAIL — o prompt atual não tem a proibição.

- [ ] **Step 3: Inserir a proibição no prompt**

Em `src/lib/prescriptions/prescription-prompts.ts`, inserir um bloco novo entre a linha de "Considere a segurança..." e o "Responda APENAS com JSON válido:". Ou seja, substituir:

```ts
Considere a segurança (contraindicações óbvias para as condições do paciente). O foco é a ESCOLHA do fármaco para o caso, não a casa decimal da dose.

Responda APENAS com JSON válido:
```

por:

```ts
Considere a segurança (contraindicações óbvias para as condições do paciente). O foco é a ESCOLHA do fármaco para o caso, não a casa decimal da dose.

REGRA CRÍTICA — NÃO REVELE O DIAGNÓSTICO: use o diagnóstico verdadeiro APENAS internamente, para decidir a adequação. É PROIBIDO nomear, citar ou insinuar o diagnóstico verdadeiro (ou a entidade/doença específica) no campo "feedback". O aluno ainda está descobrindo o caso — revelar o diagnóstico estraga a simulação. Redija o feedback em termos do QUADRO/QUEIXA e da SEGURANÇA (ex: "adequado para manejo de congestão/edema, mas falta indicação clara e monitorização"), NUNCA em termos da doença de base.

Responda APENAS com JSON válido:
```

- [ ] **Step 4: Rodar os testes do arquivo e confirmar que passam**

Run: `npx vitest run src/lib/prescriptions/prescription-prompts.test.ts`
Expected: PASS — o novo teste + os 2 existentes (que checam presença do diagnóstico no prompt — continua presente como contexto interno — e as faixas de adequacy).

- [ ] **Step 5: Commit**

```bash
git add src/lib/prescriptions/prescription-prompts.ts src/lib/prescriptions/prescription-prompts.test.ts
git commit -m "fix(prescrições): feedback de adequação não pode nomear o diagnóstico verdadeiro" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Verificação final (tsc + suíte completa)

**Files:** nenhum (apenas verificação).

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"`
Expected: sem saída (nenhum erro além do `validator.ts` pré-existente).

- [ ] **Step 2: Suíte completa**

Run: `npx vitest run`
Expected: PASS em todos os arquivos afetados (parse, exams route, exam-prompts, prescription-prompts) e nenhuma regressão.

- [ ] **Step 3: (Manual, pelo usuário) verificação em prod após redeploy**

Após merge + redeploy manual no Easypanel:
1. Solicitar ECO justificado por "sopro + turgência jugular" → deve APROVAR.
2. Prescrever furosemida num caso de amiloidose/IC → feedback NÃO deve conter o nome da doença de base.

---

## Notas de execução

- Tasks 1-2 são sequenciais (2 depende do helper de 1). Tasks 3 e 4 são independentes entre si e das demais.
- Todas as mudanças de prompt são probabilísticas (modelo mini) — o teste garante que a INSTRUÇÃO está no prompt; a eficácia final se confirma na verificação manual em prod (Task 5, Step 3).
