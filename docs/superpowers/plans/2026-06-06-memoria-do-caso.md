# Memória do Caso — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao paciente uma memória cumulativa do caso (medicações/exames/evolução) que enriquece as respostas em consultas de retorno e permite que o validador aprove exames de monitoramento.

**Architecture:** Uma coluna `case_summary TEXT` em `patients`, gerada de forma não-bloqueante no `finish` (resumo cumulativo em texto com seções rotuladas), injetada no prompt do paciente e no validador de exames. `isFollowUp` é derivado da presença de `case_summary`.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres), OpenAI SDK v6 (`gpt-4o-mini`), Vitest.

Spec: `docs/superpowers/specs/2026-06-06-memoria-do-caso-design.md`

## Estrutura de arquivos

- `supabase/migrations/<ts>_add_case_summary.sql` — coluna nova (criar)
- `src/types/database.ts` — adicionar `case_summary` aos tipos de `patients` (modificar)
- `src/lib/consultations/prompts.ts` — `buildCaseSummaryPrompt` (novo) + param em `buildPatientSystemPrompt` (modificar)
- `src/lib/consultations/prompts.test.ts` — testes dos builders (modificar/criar)
- `src/lib/exams/exam-prompts.ts` — params em `buildExamValidationPrompt` (modificar)
- `src/lib/exams/exam-prompts.test.ts` — testes (modificar/criar)
- `src/app/api/consultations/[id]/finish/route.ts` — gerar/salvar `case_summary` (modificar)
- `src/app/api/consultations/[id]/chat/route.ts` — passar `case_summary` (modificar)
- `src/app/api/consultations/[id]/exams/route.ts` — passar `case_summary`/`isFollowUp` (modificar)

---

### Task 1: Migração + tipos

**Files:**
- Create: `supabase/migrations/<timestamp>_add_case_summary.sql`
- Modify: `src/types/database.ts`

- [ ] **Step 1: Criar a migração**

Criar arquivo `supabase/migrations/20260606130000_add_case_summary.sql` (ajuste o timestamp para o horário atual no formato `YYYYMMDDHHMMSS`):

```sql
ALTER TABLE patients ADD COLUMN case_summary TEXT;
```

- [ ] **Step 2: Adicionar o campo aos tipos**

Em `src/types/database.ts`, na tabela `patients`, adicionar `case_summary` ao lado de cada ocorrência de `true_diagnosis` (há 3 blocos: Row, Insert, Update):

- No bloco **Row** (onde está `true_diagnosis: string | null`): adicionar a linha
```ts
          case_summary: string | null
```
- Nos blocos **Insert** e **Update** (onde está `true_diagnosis?: string | null`): adicionar a linha
```ts
          case_summary?: string | null
```

Verifique a primeira linha do arquivo: se houver lixo tipo `Initialising login role...`, remova (problema recorrente ao regenerar tipos).

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"`
Expected: sem saída (ok).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/ src/types/database.ts
git commit -m "feat: add case_summary column to patients"
```

> NOTA DE DEPLOY (manual, não automatizar): aplicar a migração na produção com `supabase db push` (ref já linkado) ou rodar o ALTER manualmente. Sem a coluna no banco, o save no finish falha silenciosamente (não-bloqueante) e a memória nunca persiste.

---

### Task 2: `buildCaseSummaryPrompt`

**Files:**
- Modify: `src/lib/consultations/prompts.ts`
- Test: `src/lib/consultations/prompts.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar em `src/lib/consultations/prompts.test.ts` (criar o arquivo se não existir, com `import { describe, it, expect } from 'vitest'` e importando de `./prompts`):

```ts
import { buildCaseSummaryPrompt } from './prompts'

const patientStub = {
  name: 'Maria', age: 60, gender: 'F', specialty: 'Cardiologia',
  chief_complaint: 'falta de ar aos esforços', clinical_status: 'estável',
  conditions: ['HAS'], difficulty: 'hard',
} as never

describe('buildCaseSummaryPrompt', () => {
  it('inclui as quatro seções rotuladas', () => {
    const p = buildCaseSummaryPrompt(patientStub, null, [], '', [])
    expect(p).toContain('Medicações em uso:')
    expect(p).toContain('Exames já realizados:')
    expect(p).toContain('Evolução:')
    expect(p).toContain('Plano/pendências:')
  })

  it('incorpora o resumo anterior quando presente', () => {
    const p = buildCaseSummaryPrompt(patientStub, 'RESUMO_ANTERIOR_XYZ', [], '', [])
    expect(p).toContain('RESUMO_ANTERIOR_XYZ')
  })

  it('lista os exames realizados nesta consulta', () => {
    const p = buildCaseSummaryPrompt(patientStub, null, [], 'iniciei furosemida', [
      { exam_name: 'Ecocardiograma', result: 'FE 40%' },
    ])
    expect(p).toContain('Ecocardiograma')
    expect(p).toContain('iniciei furosemida')
  })

  it('proíbe inventar conduta e pede texto simples sem JSON', () => {
    const p = buildCaseSummaryPrompt(patientStub, null, [], '', [])
    expect(p).toContain('NÃO invente')
    expect(p.toLowerCase()).toContain('sem json')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/consultations/prompts.test.ts`
Expected: FAIL — `buildCaseSummaryPrompt is not a function`.

- [ ] **Step 3: Implementar**

Em `src/lib/consultations/prompts.ts`, adicionar a função (usa o tipo `ChatMessage` já existente no arquivo):

```ts
export function buildCaseSummaryPrompt(
  patient: Patient,
  priorSummary: string | null,
  chatHistory: ChatMessage[],
  clinicalReasoning: string,
  examResults: { exam_name: string; result: string | null }[]
): string {
  const conversation = chatHistory
    .map(m => `${m.role === 'student' ? 'Médico' : 'Paciente'}: ${m.content}`)
    .join('\n')

  const exams = examResults.length > 0
    ? examResults.map(e => e.result ? `${e.exam_name}: ${e.result}` : `${e.exam_name} (sem resultado)`).join('\n')
    : '(nenhum exame aprovado nesta consulta)'

  return `Você é um sistema de prontuário médico. Atualize o resumo cumulativo do caso deste paciente após mais uma consulta.

Paciente: ${patient.name}, ${patient.age} anos
Queixa original: ${patient.chief_complaint}

RESUMO ANTERIOR (consultas passadas):
${priorSummary && priorSummary.trim() ? priorSummary : '(nenhum — primeira consulta finalizada)'}

CONSULTA ATUAL — conversa:
${conversation || '(sem conversa)'}

CONSULTA ATUAL — pensamento clínico do aluno:
${clinicalReasoning || '(não registrado)'}

CONSULTA ATUAL — exames realizados:
${exams}

Gere o NOVO resumo cumulativo, INCORPORANDO o resumo anterior e ADICIONANDO o que houve nesta consulta. Use EXATAMENTE estas quatro seções, em texto simples:

Medicações em uso: <medicações/condutas que o aluno prescreveu até agora, extraídas do pensamento clínico e da conversa; se nenhuma, escreva "nenhuma">
Exames já realizados: <exames feitos e seus achados-chave ao longo das consultas>
Evolução: <linha do tempo curta, uma linha por consulta>
Plano/pendências: <o que ficou combinado / o que monitorar na próxima consulta>

REGRAS:
- NÃO invente medicações ou condutas que o aluno não mencionou.
- Seja conciso — resuma consultas antigas, não deixe o texto crescer indefinidamente.
- Texto simples, sem markdown e sem JSON; não adicione rótulos além das quatro seções.`
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/consultations/prompts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/consultations/prompts.ts src/lib/consultations/prompts.test.ts
git commit -m "feat: add buildCaseSummaryPrompt"
```

---

### Task 3: `buildPatientSystemPrompt` lembra a memória

**Files:**
- Modify: `src/lib/consultations/prompts.ts`
- Test: `src/lib/consultations/prompts.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar em `src/lib/consultations/prompts.test.ts`:

```ts
import { buildPatientSystemPrompt } from './prompts'

describe('buildPatientSystemPrompt — memória do caso', () => {
  it('NÃO injeta memória na primeira consulta, mesmo com summary', () => {
    const p = buildPatientSystemPrompt(patientStub, undefined, true, 'MEMORIA_XYZ')
    expect(p).not.toContain('MEMORIA_XYZ')
  })

  it('injeta memória em retorno quando há summary', () => {
    const p = buildPatientSystemPrompt(patientStub, undefined, false, 'MEMORIA_XYZ')
    expect(p).toContain('MEMÓRIA DO CASO')
    expect(p).toContain('MEMORIA_XYZ')
  })

  it('não injeta bloco de memória em retorno sem summary', () => {
    const p = buildPatientSystemPrompt(patientStub, undefined, false, null)
    expect(p).not.toContain('MEMÓRIA DO CASO')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/consultations/prompts.test.ts`
Expected: FAIL — `buildPatientSystemPrompt` ignora o 4º argumento (o caso de retorno com summary não contém 'MEMÓRIA DO CASO').

- [ ] **Step 3: Implementar**

Em `src/lib/consultations/prompts.ts`, alterar a assinatura e o corpo de `buildPatientSystemPrompt`:

Assinatura (adicionar 4º parâmetro):
```ts
export function buildPatientSystemPrompt(patient: Patient, pendingResults?: string[], isFirstConsultation = true, caseSummary?: string | null): string {
```

Logo após a definição de `resultsSection` (e antes do `return`), adicionar:
```ts
  const memorySection = !isFirstConsultation && caseSummary && caseSummary.trim()
    ? `\nMEMÓRIA DO CASO (o que você lembra das consultas anteriores — use para responder de forma coerente e variada, na 1ª pessoa, sem recitar literalmente; você LEMBRA das medicações que toma e dos exames que já fez):\n${caseSummary}`
    : ''
```

Na string de retorno, inserir `${memorySection}` logo após `Dificuldade: ${patient.difficulty}${resultsSection}` (na mesma linha, antes da quebra de linha dupla):
```ts
Dificuldade: ${patient.difficulty}${resultsSection}${memorySection}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/consultations/prompts.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/consultations/prompts.ts src/lib/consultations/prompts.test.ts
git commit -m "feat: patient prompt injects case memory on follow-up"
```

---

### Task 4: `buildExamValidationPrompt` aceita monitoramento

**Files:**
- Modify: `src/lib/exams/exam-prompts.ts`
- Test: `src/lib/exams/exam-prompts.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar em `src/lib/exams/exam-prompts.test.ts` (criar com imports `vitest` se não existir):

```ts
import { buildExamValidationPrompt } from './exam-prompts'

const pStub = {
  name: 'Maria', age: 60, gender: 'F', specialty: 'Cardiologia',
  chief_complaint: 'falta de ar', conditions: ['HAS'], difficulty: 'hard',
} as never

describe('buildExamValidationPrompt — retorno/monitoramento', () => {
  it('injeta memória do caso e regra de monitoramento em retorno', () => {
    const p = buildExamValidationPrompt(pStub, 'Função renal', 'controle do diurético', '', '', 'SUMMARY_XYZ', true)
    expect(p).toContain('SUMMARY_XYZ')
    expect(p.toUpperCase()).toContain('RETORNO')
    expect(p.toLowerCase()).toContain('monitoramento')
  })

  it('não injeta regra de monitoramento quando não é retorno', () => {
    const p = buildExamValidationPrompt(pStub, 'Hemograma', 'investigar anemia', '', '', null, false)
    expect(p).not.toContain('SUMMARY_XYZ')
    expect(p.toLowerCase()).not.toContain('monitoramento/controle/seguimento')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/exams/exam-prompts.test.ts`
Expected: FAIL — `buildExamValidationPrompt` não aceita/usa os 2 novos argumentos.

- [ ] **Step 3: Implementar**

Em `src/lib/exams/exam-prompts.ts`, alterar a assinatura de `buildExamValidationPrompt`:
```ts
export function buildExamValidationPrompt(
  patient: Patient,
  examName: string,
  justification: string,
  clinicalReasoning: string,
  physicalExamSummary: string,
  caseSummary?: string | null,
  isFollowUp = false
): string {
```

No corpo, antes do `return`, adicionar:
```ts
  const memorySection = caseSummary && caseSummary.trim()
    ? `\nMEMÓRIA DO CASO (consultas anteriores):\n${caseSummary}`
    : ''
  const followUpRule = isFollowUp
    ? `\n- CONSULTA DE RETORNO: exames de monitoramento/controle/seguimento de um tratamento já iniciado ou de um diagnóstico em investigação (ver memória do caso) são VÁLIDOS, mesmo sem relação direta com a queixa inicial. Ex: repetir função renal/eletrólitos após iniciar diurético; repetir hemoglobina glicada para acompanhar controle glicêmico; reavaliar imagem para resposta ao tratamento.`
    : ''
```

Na string de retorno: inserir `${memorySection}` logo após a linha `Pensamento clínico: ${clinicalReasoning || '(não registrado)'}` e inserir `${followUpRule}` como último item da lista "Critérios de aprovação" (logo após a linha que começa com `- Rejeitar apenas quando...`).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/exams/exam-prompts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/exams/exam-prompts.ts src/lib/exams/exam-prompts.test.ts
git commit -m "feat: exam validation accepts monitoring exams on follow-up"
```

---

### Task 5: `finish` route gera e salva `case_summary`

**Files:**
- Modify: `src/app/api/consultations/[id]/finish/route.ts`

- [ ] **Step 1: Adicionar imports**

No topo de `src/app/api/consultations/[id]/finish/route.ts`, ampliar o import de prompts e adicionar o tipo `ChatMessage`:
```ts
import { buildFinishPrompt, buildCaseSummaryPrompt, type ChatMessage } from '@/lib/consultations/prompts'
```
(Confirme que `ChatMessage` é exportado em `prompts.ts`; se não for, adicione `export` à sua declaração de tipo lá.)

- [ ] **Step 2: Gerar e salvar (não-bloqueante)**

Em `src/app/api/consultations/[id]/finish/route.ts`, logo após o bloco que atualiza `consultations` para `status: 'finished'` (após o check de `cUpdateError`) e ANTES do bloco de avaliação de diagnóstico, inserir:

```ts
  // Generate cumulative case summary (non-blocking)
  try {
    const { data: examRows } = await supabase
      .from('exam_requests')
      .select('exam_name, result')
      .eq('consultation_id', id)
      .eq('user_id', user.id)
      .eq('status', 'approved')

    const priorSummary = (patient as Record<string, unknown>).case_summary as string | null ?? null
    const chatHistory = (consultation.chat_history ?? []) as ChatMessage[]

    const summaryCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: buildCaseSummaryPrompt(
          patient as never, priorSummary, chatHistory, clinicalReasoning, examRows ?? []
        ),
      }],
    }, { timeout: 25_000 })

    const newSummary = summaryCompletion.choices[0]?.message?.content?.trim()
    if (newSummary) {
      await supabase
        .from('patients')
        .update({ case_summary: newSummary })
        .eq('id', patient.id as string)
        .eq('user_id', user.id)
    }
  } catch {
    // Non-blocking — finish já concluído mesmo se o resumo falhar
  }
```

- [ ] **Step 3: Verificar tipos e testes existentes**

Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"`
Expected: sem saída.

Run: `npx vitest run "src/app/api/consultations/[id]/finish/route.test.ts"`
Expected: PASS. Se algum mock de `from` quebrar por causa da nova chamada `from('exam_requests')`/`from('patients')`, ajuste o `mockFrom` do teste para retornar objetos encadeáveis permissivos (o bloco é não-bloqueante; basta não lançar). Mantenha as asserções existentes passando.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/consultations/[id]/finish/route.ts" "src/app/api/consultations/[id]/finish/route.test.ts"
git commit -m "feat: generate cumulative case_summary on consultation finish"
```

---

### Task 6: `chat` route passa a memória ao paciente

**Files:**
- Modify: `src/app/api/consultations/[id]/chat/route.ts`

- [ ] **Step 1: Passar `case_summary` ao builder**

Em `src/app/api/consultations/[id]/chat/route.ts`, na linha que monta o `systemPrompt` (hoje `const systemPrompt = buildPatientSystemPrompt(patient as never, pendingResults, isFirstConsultation)`), trocar por:
```ts
  const caseSummary = (patient as Record<string, unknown>).case_summary as string | null ?? null
  const systemPrompt = buildPatientSystemPrompt(patient as never, pendingResults, isFirstConsultation, caseSummary)
```

- [ ] **Step 2: Verificar tipos e teste**

Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"`
Expected: sem saída.

Run: `npx vitest run "src/app/api/consultations/[id]/chat/route.test.ts"`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/consultations/[id]/chat/route.ts"
git commit -m "feat: pass case memory to patient prompt in chat route"
```

---

### Task 7: `exams` route passa memória + `isFollowUp`

**Files:**
- Modify: `src/app/api/consultations/[id]/exams/route.ts`

- [ ] **Step 1: Derivar e passar os parâmetros**

Em `src/app/api/consultations/[id]/exams/route.ts`, logo após a definição de `physicalExamSummary` (antes da chamada `buildExamValidationPrompt`), adicionar:
```ts
  const caseSummary = (patient as Record<string, unknown>).case_summary as string | null ?? null
  const isFollowUp = !!(caseSummary && caseSummary.trim())
```

E alterar a chamada `buildExamValidationPrompt(patient, exam_name.trim(), justification.trim(), clinicalReasoning, physicalExamSummary)` para:
```ts
        content: buildExamValidationPrompt(
          patient, exam_name.trim(), justification.trim(),
          clinicalReasoning, physicalExamSummary, caseSummary, isFollowUp
        ),
```

- [ ] **Step 2: Verificar tipos e teste**

Run: `npx tsc --noEmit 2>&1 | grep -v "validator.ts"`
Expected: sem saída.

Run: `npx vitest run "src/app/api/consultations/[id]/exams/route.test.ts"`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/consultations/[id]/exams/route.ts"
git commit -m "feat: pass case memory and isFollowUp to exam validation"
```

---

### Task 8: Verificação empírica (modelo real) e suíte completa

**Files:**
- Create (temporário): `src/_verify_memoria.test.ts`

- [ ] **Step 1: Escrever o script de verificação**

Criar `src/_verify_memoria.test.ts` (modelo real; será removido depois):

```ts
// @vitest-environment node
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import OpenAI from 'openai'
import { buildCaseSummaryPrompt, buildPatientSystemPrompt } from '@/lib/consultations/prompts'
import { buildExamValidationPrompt } from '@/lib/exams/exam-prompts'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)
const client = new OpenAI({ apiKey: env.OPENAI_API_KEY })
const patient = {
  name: 'Maria', age: 64, gender: 'F', specialty: 'Cardiologia',
  chief_complaint: 'falta de ar aos esforços', clinical_status: 'dispneia aos esforços',
  conditions: ['HAS'], difficulty: 'hard', true_diagnosis: 'Insuficiência cardíaca',
}

describe('memória do caso (modelo real)', () => {
  it('gera resumo, paciente lembra remédio, exame de controle aprovado', async () => {
    // 1) gerar resumo da consulta 1
    const chat = [
      { role: 'student', content: 'A senhora está com falta de ar?' },
      { role: 'patient', content: 'Sim, doutor, ao subir escada.' },
    ] as never
    const sumPrompt = buildCaseSummaryPrompt(patient as never, null, chat, 'ICC provável; iniciar enalapril 10mg e furosemida 40mg; pedir ecocardiograma', [{ exam_name: 'Ecocardiograma', result: 'FE 38%' }])
    const sum = (await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: sumPrompt }] })).choices[0].message.content!.trim()
    console.log('\n===== RESUMO =====\n' + sum)
    expect(sum.toLowerCase()).toMatch(/enalapril|furosemida/)

    // 2) paciente lembra o remédio
    const sys = buildPatientSystemPrompt(patient as never, undefined, false, sum)
    const ans = (await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [
      { role: 'system', content: sys },
      { role: 'user', content: 'A senhora está tomando algum remédio que eu passei?' },
    ] })).choices[0].message.content!.trim()
    console.log('\n===== PACIENTE =====\n' + ans)
    expect(ans.toLowerCase()).toMatch(/enalapril|furosemida|sim|tomando/)

    // 3) exame de controle aprovado
    const val = buildExamValidationPrompt(patient as never, 'Função renal e eletrólitos', 'controle após início de diurético', '', '', sum, true)
    const verdict = JSON.parse((await client.chat.completions.create({ model: 'gpt-4o-mini', response_format: { type: 'json_object' }, messages: [{ role: 'user', content: val }] })).choices[0].message.content!)
    console.log('\n===== VALIDAÇÃO =====\n' + JSON.stringify(verdict))
    expect(verdict.approved).toBe(true)
  }, 90_000)
})
```

- [ ] **Step 2: Rodar a verificação**

Run: `npx vitest run src/_verify_memoria.test.ts --disableConsoleIntercept`
Expected: PASS — o resumo cita enalapril/furosemida, o paciente confirma o remédio, e o exame de controle é aprovado (`approved: true`). Observe os logs `===== ... =====` para confirmar o comportamento real.

- [ ] **Step 3: Remover o temporário e rodar a suíte completa**

```bash
rm -f src/_verify_memoria.test.ts
npx tsc --noEmit 2>&1 | grep -v "validator.ts"
npx vitest run
```
Expected: `tsc` sem saída; toda a suíte verde.

- [ ] **Step 4: Commit final (se houver algo pendente)**

```bash
git add -A
git commit -m "test: verificação empírica da memória do caso (removido)" || echo "nada a commitar"
```

---

## Pós-implementação (fora das tasks, com o usuário)

- **Code review** das mudanças (rotas + prompts + migração).
- **Deploy manual**: aplicar a migração na produção (`supabase db push` ou ALTER manual) ANTES do redeploy do app; depois `git push` + redeploy no Easypanel.
- Validar no app: finalizar uma consulta, abrir o retorno e confirmar que o paciente lembra das medicações; pedir um exame de controle e ver aprovado.
