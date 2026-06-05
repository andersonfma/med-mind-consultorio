# Med Mind — SP3a: Solicitação de Exames
# Design Spec

Data: 2026-06-05

---

## 1. Objetivo

Implementar o painel de solicitação de exames dentro da consulta. O aluno solicita exames, justifica cada pedido, e a IA valida a coerência com o quadro clínico. Exames aprovados geram laudos completos armazenados para revelação na próxima consulta.

## 2. Fora deste SP

- Score AB4 (SP3b)
- Exibição do laudo ao aluno na consulta atual
- Histórico de exames em `/patients/[id]`

---

## 3. Schema

### Nova tabela `exam_requests`

```sql
CREATE TABLE exam_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_name       TEXT NOT NULL,
  justification   TEXT NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 1 CHECK (attempts BETWEEN 1 AND 3),
  status          TEXT NOT NULL CHECK (status IN ('approved', 'rejected')),
  ai_feedback     TEXT NOT NULL DEFAULT '',
  result          TEXT,  -- laudo gerado pela IA; NULL se rejeitado
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX exam_requests_consultation_id_idx ON exam_requests(consultation_id);
CREATE INDEX exam_requests_patient_id_idx ON exam_requests(patient_id);

ALTER TABLE exam_requests ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON exam_requests TO authenticated;

CREATE POLICY "Aluno lê próprios exames"
  ON exam_requests FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Aluno insere próprios exames"
  ON exam_requests FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Aluno atualiza próprios exames"
  ON exam_requests FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
```

**Nota:** o status é sempre definido pelo route handler após chamar a IA — nunca inserido como pendente. O INSERT sempre chega com `approved` ou `rejected`.

---

## 4. Lista de exames para autocomplete

Definida em `src/lib/exams/exam-list.ts` (constante `COMMON_EXAMS`):

```ts
export const COMMON_EXAMS = [
  // Laboratoriais
  'Hemograma completo', 'Glicemia em jejum', 'HbA1c', 'Creatinina', 'Ureia',
  'TGO/TGP', 'Bilirrubinas', 'Fosfatase alcalina', 'GGT', 'Albumina',
  'TSH', 'T4 livre', 'Sódio', 'Potássio', 'Magnésio', 'Cálcio', 'Fósforo',
  'PCR', 'VHS', 'Ferritina', 'Ferro sérico', 'Transferrina',
  'Proteína C-reativa ultrassensível', 'Ácido úrico', 'Amilase', 'Lipase',
  'Troponina I', 'CK-MB', 'BNP', 'D-dímero', 'Tempo de protrombina (TP/INR)',
  'TTPA', 'Urina I (EQU)', 'Urocultura', 'Hemocultura',
  'Proteínas totais e frações', 'Colesterol total e frações', 'Triglicerídeos',
  // Imagem
  'Radiografia de tórax', 'Radiografia de abdome', 'Ecografia abdominal',
  'Ecocardiograma', 'ECG (Eletrocardiograma)', 'Tomografia de tórax',
  'Tomografia de abdome e pelve', 'Tomografia de crânio', 'Ressonância magnética',
  'Doppler venoso de membros inferiores', 'Holter 24h', 'MAPA',
  // Outros
  'Espirometria', 'Gasometria arterial', 'Peak flow', 'Endoscopia digestiva alta',
  'Colonoscopia', 'Punção lombar',
] as const
```

O frontend usa esta lista para autocomplete; o campo aceita qualquer texto livre.

---

## 5. Rotas

```
POST /api/consultations/[id]/exams          ← solicitar exame (valida e armazena)
GET  /api/consultations/[id]/exams          ← listar exames da consulta
PUT  /api/consultations/[id]/exams/[examId] ← retentar exame rejeitado (nova justificativa)
```

### POST — Solicitar exame

**Request:** `{ exam_name: string, justification: string }`

**Fluxo:**
1. Auth → 401
2. Buscar consulta (com patient) → 404 se não encontrada ou não `ongoing`
3. Verificar se já existe `exam_requests` para este `exam_name` nesta consulta com `attempts >= 3` → 409 se esgotado
4. Chamar IA com contexto clínico → decide `approved` ou `rejected`, gera `ai_feedback`
5. Se `approved`: IA gera o laudo completo (`result`)
6. Inserir `exam_requests` com status definitivo
7. Retornar `{ id, status, ai_feedback, attempts: 1 }`

### PUT — Retentar exame rejeitado

**Request:** `{ justification: string }`

**Fluxo:**
1. Auth → 401
2. Buscar `exam_requests` pelo `examId` → 404 se não encontrado
3. Verificar `status === 'rejected'` → 400 se já aprovado
4. Verificar `attempts < 3` → 409 se esgotado
5. Chamar IA com nova justificativa
6. Atualizar `exam_requests`: `justification`, `attempts + 1`, `status`, `ai_feedback`, `result`
7. Retornar `{ status, ai_feedback, attempts: attempts + 1 }`

### GET — Listar exames

Retorna todos os `exam_requests` da consulta filtrados por `user_id`.

---

## 6. Prompts de IA

### Validação de exame

```
Você é um supervisor clínico. Avalie se a solicitação de exame é clinicamente justificada.

Paciente: {nome}, {idade} anos, {especialidade}
Queixa: {chief_complaint}
Condições: {conditions}
Exame físico relevante: {physical_exam resumido}
Pensamento clínico até agora: {clinical_reasoning}

Exame solicitado: {exam_name}
Justificativa do aluno: {justification}

Responda APENAS com JSON válido:
{
  "approved": true|false,
  "feedback": "frase curta explicando por que foi aprovado ou rejeitado"
}
```

### Geração de laudo (apenas se approved)

```
Você é um sistema de laudo médico simulado. Gere um resultado realista para o exame abaixo,
compatível com o quadro clínico do paciente.

Paciente: {nome}, {idade} anos
Queixa: {chief_complaint}
Condições: {conditions}
Dificuldade do caso: {difficulty}

Exame: {exam_name}

Regras:
- Nível easy: resultado claramente compatível com o diagnóstico esperado
- Nível medium: resultado com 1-2 achados que requerem interpretação
- Nível hard: resultado com achados sutis ou atípicos

Gere apenas o texto do laudo, como um laudo real. Sem JSON, sem explicação.
```

---

## 7. UI — ExamRequestPanel

**Posição:** entre PhysicalExamPanel e ClinicalReasoningField na coluna direita.

**Arquivo:** `src/app/(dashboard)/consultations/[id]/ExamRequestPanel.tsx`

**Estado do componente:**
- `exams: ExamRequest[]` — lista atual
- `examName: string` — campo de texto com autocomplete
- `justification: string` — textarea
- `loading: boolean`
- `retryingId: string | null` — id do exame sendo retentado

**Layout:**
```
┌─────────────────────────────────┐
│ EXAMES SOLICITADOS              │
│                                 │
│ [Autocomplete exame...    ]     │
│ [Justificativa...         ]     │
│ [     Solicitar           ]     │
│                                 │
│ • Hemograma ✓ Aprovado          │
│   "Adequado para investigação"  │
│                                 │
│ • ECG ✗ Rejeitado    [2/3]      │
│   "Sem indicação clara"         │
│   [Tentar novamente]            │
│                                 │
└─────────────────────────────────┘
```

**Contador de tentativas:** aparece apenas quando `attempts > 1` ou `status === 'rejected'`. Vermelho quando `attempts >= 2`.

---

## 8. Consulta de seguimento

Ao iniciar uma nova consulta para um paciente com consulta finalizada anterior:

No `buildPatientSystemPrompt`, adicionar verificação de resultados pendentes. A função recebe um parâmetro adicional opcional `pendingResults: string[] | null`.

Se `pendingResults` não for nulo, adicionar ao system prompt:
```
Você recebeu os resultados dos seguintes exames e deve mencioná-los naturalmente
durante a consulta quando o médico perguntar ou quando for clinicamente oportuno:
{pendingResults.join(', ')}
Os resultados completos serão fornecidos quando o médico solicitar.
```

O route handler de chat busca `exam_requests` aprovados da última consulta `finished` do mesmo `patient_id` e `user_id`.

---

## 9. Tipos TypeScript

```ts
// src/lib/exams/types.ts
export type ExamRequest = {
  id: string
  consultation_id: string
  exam_name: string
  justification: string
  attempts: number
  status: 'approved' | 'rejected'
  ai_feedback: string
  result: string | null
  created_at: string
}
```

---

## 10. Tratamento de erros

| Situação | Comportamento |
|----------|---------------|
| IA timeout na validação | 408; exame não inserido; aluno pode tentar novamente |
| 3 tentativas esgotadas | 409; botão "Tentar novamente" desaparece |
| Exame já aprovado, nova tentativa | 400 |
| Consulta não ongoing | 404 |

---

## 11. Testes

**Unitários:**
- `buildExamValidationPrompt(patient, exam, justification, context)` → contém nome do exame e justificativa
- `buildExamResultPrompt(patient, examName)` → contém nome do exame e difficulty

**Integração (mocks):**
- `POST /api/consultations/[id]/exams` → 201 approved
- `POST /api/consultations/[id]/exams` → 201 rejected
- `POST /api/consultations/[id]/exams` → 409 se attempts esgotados
- `PUT /api/consultations/[id]/exams/[examId]` → incrementa attempts, respeita limite 3
- `GET /api/consultations/[id]/exams` → retorna lista filtrada por user_id, status e nome corretos
- `GET /api/consultations/[id]/exams` → retorna 401 se não autenticado

---

## 12. Ordem de implementação

1. Migration `exam_requests` + `supabase migration up --linked`
2. Regenerar tipos + `ExamRequest` type
3. `COMMON_EXAMS` list + `buildExamValidationPrompt` + `buildExamResultPrompt` (TDD)
4. `POST /api/consultations/[id]/exams` + testes
5. `PUT /api/consultations/[id]/exams/[examId]` + testes
6. `GET /api/consultations/[id]/exams` + testes
7. `ExamRequestPanel.tsx`
8. Integrar `ExamRequestPanel` no `ConsultationClient`
9. Atualizar `buildPatientSystemPrompt` para aceitar `pendingResults`
10. Atualizar `POST /api/consultations/[id]/chat` para buscar resultados pendentes
11. E2E + build check

---

## 13. Critérios de conclusão

- [ ] Tabela `exam_requests` com RLS aplicada
- [ ] `COMMON_EXAMS` com autocomplete no frontend
- [ ] POST cria exame com status definitivo após validação IA
- [ ] PUT incrementa attempts, respeita limite de 3
- [ ] Counter visual `X/3` em vermelho quando attempts >= 2
- [ ] Exames aprovados têm laudo armazenado em `result`
- [ ] Consulta seguinte injeta exames aprovados no prompt do paciente
- [ ] Todos os testes passando
