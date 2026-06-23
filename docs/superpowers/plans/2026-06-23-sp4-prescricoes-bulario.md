# SP4 — Prescrições + Bulário Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o arco terapêutico do simulador — o aluno prescreve, a IA avalia a adequação, e a prescrição muda a evolução do paciente no próximo retorno (adequação × adesão).

**Architecture:** Tabela `prescriptions` espelhando `exam_requests`; entrada híbrida (catálogo curado + texto livre validado por IA); passo de "efeito do tratamento" best-effort no encerramento que injeta prescrições+adesão na geração de `clinical_status` e `case_summary`; medicações ativas carregadas para o prompt do paciente no retorno. AB4 inalterado.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + RLS, via MCP), OpenAI SDK v6 (`MODELS.utility`), Vitest, TypeScript, Tailwind.

**Spec:** `docs/superpowers/specs/2026-06-23-sp4-prescricoes-bulario-design.md`

---

## File Structure

**Criar:**
- `supabase/migrations/20260623120000_add_prescriptions.sql` — DDL da tabela + RLS
- `src/lib/prescriptions/types.ts` — tipos compartilhados (`Prescription`, `Adequacy`, etc.)
- `src/lib/prescriptions/catalog.ts` — catálogo curado por especialidade + `searchCatalog`
- `src/lib/prescriptions/catalog.test.ts`
- `src/lib/prescriptions/adherence.ts` — `estimateAdherence(bondLevel, personality)`
- `src/lib/prescriptions/adherence.test.ts`
- `src/lib/prescriptions/prescription-prompts.ts` — `buildPrescriptionEvalPrompt`
- `src/lib/prescriptions/prescription-prompts.test.ts`
- `src/app/api/consultations/[id]/prescriptions/route.ts` — POST (add+validação), GET (listar)
- `src/app/api/consultations/[id]/prescriptions/route.test.ts`
- `src/app/api/consultations/[id]/prescriptions/[prescriptionId]/route.ts` — PATCH (suspender)
- `src/app/(dashboard)/consultations/[id]/PrescriptionPanel.tsx` — UI

**Modificar:**
- `src/types/database.ts` — adicionar tabela `prescriptions` (Row/Insert/Update)
- `src/lib/consultations/prompts.ts` — estender `buildFinishPrompt` e `buildCaseSummaryPrompt` + `buildPatientSystemPrompt` (medicações ativas)
- `src/app/api/consultations/[id]/finish/route.ts` — reunir prescrições ativas, calcular adesão, passar aos prompts
- `src/app/(dashboard)/consultations/[id]/ConsultationClient.tsx` — montar `PrescriptionPanel`
- `src/app/(dashboard)/consultations/[id]/page.tsx` — carregar medicações ativas e passar ao client
- `src/app/(dashboard)/consultations/[id]/ConsultationReadOnly.tsx` — prescrições read-only

---

## Task 1: Migration da tabela `prescriptions`

**Files:**
- Create: `supabase/migrations/20260623120000_add_prescriptions.sql`

- [ ] **Step 1: Escrever a migration**

```sql
CREATE TABLE prescriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drug_name       TEXT NOT NULL CHECK (length(drug_name) BETWEEN 1 AND 300),
  posology        TEXT NOT NULL CHECK (length(posology) BETWEEN 1 AND 1000),
  source          TEXT NOT NULL DEFAULT 'free' CHECK (source IN ('catalog', 'free')),
  justification   TEXT,
  adequacy        TEXT CHECK (adequacy IN ('adequada', 'parcial', 'inadequada')),
  ai_feedback     TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX prescriptions_consultation_id_idx ON prescriptions(consultation_id);
CREATE INDEX prescriptions_patient_active_idx ON prescriptions(patient_id, status);

ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON prescriptions TO authenticated;

CREATE POLICY "Aluno lê próprias prescrições"
  ON prescriptions FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Aluno insere próprias prescrições"
  ON prescriptions FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Aluno atualiza próprias prescrições"
  ON prescriptions FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
```

- [ ] **Step 2: Aplicar em produção via MCP**

Usar `mcp__plugin_supabase_supabase__execute_sql` com o DDL acima no projeto `zrgjsgorijqlqhvlrpdh` (org "Simulador Med Mind"). Depois registrar a versão exata:

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260623120000', 'add_prescriptions')
ON CONFLICT (version) DO NOTHING;
```

Expected: tabela `prescriptions` criada; `mcp__plugin_supabase_supabase__list_tables` mostra a tabela com RLS habilitada.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260623120000_add_prescriptions.sql
git commit -m "feat(sp4): migration tabela prescriptions + RLS"
```

---

## Task 2: Tipos (`database.ts` + `types.ts`)

**Files:**
- Modify: `src/types/database.ts` (bloco `Tables`, perto de `exam_requests`)
- Create: `src/lib/prescriptions/types.ts`

- [ ] **Step 1: Adicionar a tabela em `database.ts`**

Dentro de `Database['public']['Tables']`, adicionar (espelhando `exam_requests`):

```ts
      prescriptions: {
        Row: {
          id: string
          consultation_id: string
          patient_id: string
          user_id: string
          drug_name: string
          posology: string
          source: string
          justification: string | null
          adequacy: string | null
          ai_feedback: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          consultation_id: string
          patient_id: string
          user_id: string
          drug_name: string
          posology: string
          source?: string
          justification?: string | null
          adequacy?: string | null
          ai_feedback?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          consultation_id?: string
          patient_id?: string
          user_id?: string
          drug_name?: string
          posology?: string
          source?: string
          justification?: string | null
          adequacy?: string | null
          ai_feedback?: string | null
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
```

- [ ] **Step 2: Criar `types.ts`**

```ts
export type Adequacy = 'adequada' | 'parcial' | 'inadequada'
export type PrescriptionSource = 'catalog' | 'free'
export type PrescriptionStatus = 'active' | 'suspended'
export type Adherence = 'alta' | 'média' | 'baixa'

/** Linha retornada ao cliente (sem user_id/patient_id). */
export interface Prescription {
  id: string
  consultation_id: string
  drug_name: string
  posology: string
  source: PrescriptionSource
  justification: string | null
  adequacy: Adequacy | null
  ai_feedback: string | null
  status: PrescriptionStatus
  created_at: string
}
```

- [ ] **Step 3: Verificar tsc**

Run: `npx tsc --noEmit 2>&1 | grep -v "\.next/types" | grep -v "Cannot find module '\.\./\.\./src/app/api"`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts src/lib/prescriptions/types.ts
git commit -m "feat(sp4): tipos da prescription (database.ts + types.ts)"
```

---

## Task 3: Catálogo de medicamentos

**Files:**
- Create: `src/lib/prescriptions/catalog.ts`
- Test: `src/lib/prescriptions/catalog.test.ts`

- [ ] **Step 1: Escrever o teste**

```ts
import { describe, it, expect } from 'vitest'
import { PRESCRIPTION_CATALOG, searchCatalog } from './catalog'
import { SPECIALTIES } from '@/lib/patients/specialties'

describe('PRESCRIPTION_CATALOG', () => {
  it('tem entradas para TODA especialidade', () => {
    for (const sp of SPECIALTIES) {
      expect(PRESCRIPTION_CATALOG[sp]?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('toda entrada tem name, posology e indication não vazios', () => {
    for (const sp of SPECIALTIES) {
      for (const drug of PRESCRIPTION_CATALOG[sp]) {
        expect(drug.name.trim()).not.toBe('')
        expect(drug.posology.trim()).not.toBe('')
        expect(drug.indication.trim()).not.toBe('')
      }
    }
  })
})

describe('searchCatalog', () => {
  it('filtra por substring case-insensitive dentro da especialidade', () => {
    const res = searchCatalog('Cardiologia', 'losart')
    expect(res.some(d => d.name.toLowerCase().includes('losart'))).toBe(true)
  })

  it('retorna [] para query curta (< 2 chars)', () => {
    expect(searchCatalog('Cardiologia', 'l')).toEqual([])
  })

  it('não vaza medicamentos de outra especialidade', () => {
    const res = searchCatalog('Cardiologia', 'a')
    const cardioNames = PRESCRIPTION_CATALOG['Cardiologia'].map(d => d.name)
    for (const d of res) expect(cardioNames).toContain(d.name)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/prescriptions/catalog.test.ts`
Expected: FAIL — "Cannot find module './catalog'".

- [ ] **Step 3: Escrever `catalog.ts`**

```ts
import type { Specialty } from '@/lib/patients/specialties'

export interface CatalogDrug {
  name: string
  posology: string
  indication: string
}

/**
 * Catálogo curado de princípios ativos comuns por especialidade, com posologia
 * padrão (editável pelo aluno) e indicação. Curadoria pedagógica — nomes reais,
 * conferíveis contra os Dados Abertos da ANVISA. NÃO é exaustivo: o aluno pode
 * prescrever fora do catálogo via texto livre (validado por IA).
 * Evolução futura: importar DADOS_ABERTOS_MEDICAMENTOS.csv da ANVISA.
 */
export const PRESCRIPTION_CATALOG: Record<Specialty, CatalogDrug[]> = {
  'Clínica Médica': [
    { name: 'Dipirona', posology: '500–1000 mg VO até 6/6h se dor ou febre', indication: 'Analgésico/antitérmico' },
    { name: 'Paracetamol', posology: '500–750 mg VO até 6/6h, máx 4 g/dia', indication: 'Analgésico/antitérmico' },
    { name: 'Omeprazol', posology: '20–40 mg VO 1x/dia em jejum', indication: 'Proteção gástrica / DRGE' },
    { name: 'Amoxicilina', posology: '500 mg VO 8/8h por 7 dias', indication: 'Antibiótico de amplo espectro' },
    { name: 'Prednisona', posology: '20–40 mg VO 1x/dia pela manhã, com desmame', indication: 'Corticoide sistêmico' },
    { name: 'Sintomáticos para IVAS', posology: 'Hidratação, repouso, antitérmico se febre', indication: 'Suporte em virose' },
  ],
  'Cardiologia': [
    { name: 'Losartana', posology: '50 mg VO 1x/dia (até 100 mg/dia)', indication: 'Anti-hipertensivo (BRA)' },
    { name: 'Enalapril', posology: '10 mg VO 12/12h', indication: 'Anti-hipertensivo (IECA)' },
    { name: 'Anlodipino', posology: '5 mg VO 1x/dia (até 10 mg)', indication: 'Anti-hipertensivo (BCC)' },
    { name: 'Hidroclorotiazida', posology: '25 mg VO 1x/dia pela manhã', indication: 'Diurético tiazídico' },
    { name: 'Atenolol', posology: '25–50 mg VO 1x/dia', indication: 'Betabloqueador' },
    { name: 'AAS', posology: '100 mg VO 1x/dia após almoço', indication: 'Antiagregante plaquetário' },
    { name: 'Atorvastatina', posology: '20–40 mg VO 1x/dia à noite', indication: 'Hipolipemiante (estatina)' },
    { name: 'Furosemida', posology: '40 mg VO 1x/dia pela manhã', indication: 'Diurético de alça' },
  ],
  'Gastroenterologia': [
    { name: 'Omeprazol', posology: '40 mg VO 1x/dia em jejum por 4–8 semanas', indication: 'IBP — DRGE/úlcera' },
    { name: 'Domperidona', posology: '10 mg VO 3x/dia antes das refeições', indication: 'Procinético' },
    { name: 'Hioscina (Buscopan)', posology: '10 mg VO até 8/8h se cólica', indication: 'Antiespasmódico' },
    { name: 'Loperamida', posology: '4 mg VO inicial, 2 mg após cada evacuação líquida', indication: 'Antidiarreico' },
    { name: 'Mesalazina', posology: '800 mg VO 8/8h', indication: 'Doença inflamatória intestinal' },
    { name: 'Lactulose', posology: '15–30 mL VO 1–2x/dia', indication: 'Laxativo osmótico' },
  ],
  'Pneumologia': [
    { name: 'Salbutamol', posology: '2 jatos inalatórios até 6/6h se dispneia', indication: 'Broncodilatador β2 de curta ação' },
    { name: 'Budesonida/Formoterol', posology: '1 inalação 12/12h', indication: 'Corticoide inalatório + LABA' },
    { name: 'Prednisona', posology: '40 mg VO 1x/dia por 5 dias', indication: 'Exacerbação de asma/DPOC' },
    { name: 'Brometo de ipratrópio', posology: '2 jatos inalatórios 6/6h', indication: 'Anticolinérgico inalatório' },
    { name: 'Amoxicilina/Clavulanato', posology: '875/125 mg VO 12/12h por 7 dias', indication: 'PAC / exacerbação infecciosa' },
    { name: 'Azitromicina', posology: '500 mg VO 1x/dia por 3–5 dias', indication: 'Antibiótico (atípicos)' },
  ],
  'Endocrinologia': [
    { name: 'Metformina', posology: '500–850 mg VO 12/12h com refeições', indication: 'DM2 — primeira linha' },
    { name: 'Insulina NPH', posology: 'Dose individualizada SC, geralmente 0,2 U/kg/dia', indication: 'DM — controle basal' },
    { name: 'Levotiroxina', posology: '50–100 mcg VO 1x/dia em jejum', indication: 'Hipotireoidismo' },
    { name: 'Glibenclamida', posology: '5 mg VO 1x/dia antes do café', indication: 'DM2 — sulfonilureia' },
    { name: 'Dapagliflozina', posology: '10 mg VO 1x/dia', indication: 'DM2 (iSGLT2)' },
    { name: 'Sinvastatina', posology: '20–40 mg VO 1x/dia à noite', indication: 'Dislipidemia' },
  ],
  'Nefrologia': [
    { name: 'Losartana', posology: '50 mg VO 1x/dia', indication: 'Nefroproteção / anti-HAS (BRA)' },
    { name: 'Furosemida', posology: '40 mg VO 1x/dia (ajustar à volemia)', indication: 'Diurético de alça' },
    { name: 'Carbonato de cálcio', posology: '500 mg VO às refeições', indication: 'Quelante de fósforo' },
    { name: 'Eritropoetina', posology: '50–100 U/kg SC 3x/semana', indication: 'Anemia da DRC' },
    { name: 'Bicarbonato de sódio', posology: '500 mg–1 g VO 8/8h', indication: 'Acidose metabólica da DRC' },
    { name: 'Prednisona', posology: '1 mg/kg/dia VO com desmame', indication: 'Glomerulopatia (imunossupressão)' },
  ],
  'Neurologia': [
    { name: 'Dipirona', posology: '1 g VO/IV até 6/6h se cefaleia', indication: 'Analgesia' },
    { name: 'Sumatriptano', posology: '50 mg VO no início da crise', indication: 'Crise de enxaqueca' },
    { name: 'Amitriptilina', posology: '25 mg VO à noite', indication: 'Profilaxia de enxaqueca / dor neuropática' },
    { name: 'Carbamazepina', posology: '200 mg VO 12/12h', indication: 'Epilepsia / neuralgia do trigêmeo' },
    { name: 'Levetiracetam', posology: '500 mg VO 12/12h', indication: 'Antiepiléptico' },
    { name: 'AAS', posology: '100 mg VO 1x/dia', indication: 'Prevenção secundária de AVC isquêmico' },
  ],
  'Infectologia': [
    { name: 'Amoxicilina', posology: '500 mg VO 8/8h por 7 dias', indication: 'Antibiótico de amplo espectro' },
    { name: 'Ceftriaxona', posology: '1 g IV/IM 12/12h', indication: 'Cefalosporina de 3ª geração' },
    { name: 'Azitromicina', posology: '500 mg VO 1x/dia por 3–5 dias', indication: 'Atípicos / DST' },
    { name: 'Ciprofloxacino', posology: '500 mg VO 12/12h por 7 dias', indication: 'Quinolona (Gram-negativos)' },
    { name: 'Oseltamivir', posology: '75 mg VO 12/12h por 5 dias', indication: 'Influenza' },
    { name: 'Tenofovir/Lamivudina/Dolutegravir', posology: '1 comp VO 1x/dia', indication: 'TARV (HIV)' },
  ],
}

export function searchCatalog(specialty: Specialty, query: string): CatalogDrug[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  return (PRESCRIPTION_CATALOG[specialty] ?? []).filter(
    d => d.name.toLowerCase().includes(q) || d.indication.toLowerCase().includes(q)
  ).slice(0, 6)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/prescriptions/catalog.test.ts`
Expected: PASS (3 describe, todos verdes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/prescriptions/catalog.ts src/lib/prescriptions/catalog.test.ts
git commit -m "feat(sp4): catálogo curado de medicamentos por especialidade"
```

---

## Task 4: `estimateAdherence`

**Files:**
- Create: `src/lib/prescriptions/adherence.ts`
- Test: `src/lib/prescriptions/adherence.test.ts`

- [ ] **Step 1: Escrever o teste**

```ts
import { describe, it, expect } from 'vitest'
import { estimateAdherence } from './adherence'

describe('estimateAdherence', () => {
  it('vínculo alto + cooperativo → alta', () => {
    expect(estimateAdherence(5, 'objetivo')).toBe('alta')
    expect(estimateAdherence(4, 'objetivo')).toBe('alta')
  })

  it('vínculo baixo + minimizador → baixa', () => {
    expect(estimateAdherence(1, 'minimizador')).toBe('baixa')
    expect(estimateAdherence(2, 'reticente')).toBe('baixa')
  })

  it('vínculo intermediário → média', () => {
    expect(estimateAdherence(3, 'ansioso')).toBe('média')
  })

  it('bom vínculo não salva um minimizador (puxa para média)', () => {
    expect(estimateAdherence(5, 'minimizador')).toBe('média')
  })

  it('personalidade desconhecida/null usa só o vínculo', () => {
    expect(estimateAdherence(5, null)).toBe('alta')
    expect(estimateAdherence(1, 'inexistente')).toBe('baixa')
    expect(estimateAdherence(3, null)).toBe('média')
  })

  it('faz clamp de vínculo fora de 1–5', () => {
    expect(estimateAdherence(0, 'objetivo')).toBe('média') // 1 + 1 = 2 -> baixa? ver regra
    expect(estimateAdherence(99, 'objetivo')).toBe('alta')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/prescriptions/adherence.test.ts`
Expected: FAIL — "Cannot find module './adherence'".

- [ ] **Step 3: Escrever `adherence.ts`**

```ts
import type { Adherence } from './types'

/**
 * Estima a adesão do paciente ao tratamento a partir do VÍNCULO (bond_level 1–5)
 * e da PERSONALIDADE (estilo de comunicação). Função pura e determinística — a
 * adesão alimenta o passo de efeito do tratamento no encerramento (não é gravada).
 *
 * Heurística: score = clamp(bond, 1..5) + modificador da personalidade.
 *   score >= 5 → 'alta'; 3–4 → 'média'; <= 2 → 'baixa'.
 */
const PERSONALITY_MOD: Record<string, number> = {
  objetivo: 1,     // cooperativo, segue orientação
  ansioso: 0,      // preocupado mas adere
  prolixo: -1,     // disperso, pode esquecer
  reticente: -1,   // desconfiado, adere menos
  minimizador: -2, // "não é nada", abandona tratamento
}

export function estimateAdherence(bondLevel: number, personality: string | null): Adherence {
  const bond = Math.max(1, Math.min(5, Math.round(bondLevel)))
  const mod = personality ? (PERSONALITY_MOD[personality] ?? 0) : 0
  const score = bond + mod
  if (score >= 5) return 'alta'
  if (score >= 3) return 'média'
  return 'baixa'
}
```

- [ ] **Step 4: Ajustar a expectativa de clamp e rodar**

Revisar o teste de clamp: `estimateAdherence(0, 'objetivo')` → bond clamp = 1, +1 = 2 → 'baixa'. Corrigir essa linha do teste para `.toBe('baixa')`. Então:

Run: `npx vitest run src/lib/prescriptions/adherence.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/prescriptions/adherence.ts src/lib/prescriptions/adherence.test.ts
git commit -m "feat(sp4): estimateAdherence (vínculo × personalidade)"
```

---

## Task 5: Prompt de avaliação da prescrição

**Files:**
- Create: `src/lib/prescriptions/prescription-prompts.ts`
- Test: `src/lib/prescriptions/prescription-prompts.test.ts`

- [ ] **Step 1: Escrever o teste**

```ts
import { describe, it, expect } from 'vitest'
import { buildPrescriptionEvalPrompt } from './prescription-prompts'
import type { Patient } from '@/types/domain'

const patient = {
  name: 'Maria', age: 60, gender: 'F', specialty: 'Cardiologia',
  chief_complaint: 'falta de ar aos esforços', clinical_status: 'estável',
  conditions: ['HAS'], difficulty: 'medium', true_diagnosis: 'Insuficiência cardíaca com fração de ejeção reduzida',
} as unknown as Patient

describe('buildPrescriptionEvalPrompt', () => {
  it('inclui o diagnóstico verdadeiro, o medicamento e a posologia', () => {
    const p = buildPrescriptionEvalPrompt(patient, 'Furosemida', '40 mg VO 1x/dia', 'congestão')
    expect(p).toContain('Insuficiência cardíaca com fração de ejeção reduzida')
    expect(p).toContain('Furosemida')
    expect(p).toContain('40 mg VO 1x/dia')
    expect(p).toContain('congestão')
  })

  it('pede JSON com adequacy nas três faixas', () => {
    const p = buildPrescriptionEvalPrompt(patient, 'X', 'Y', null)
    expect(p).toContain('adequada')
    expect(p).toContain('parcial')
    expect(p).toContain('inadequada')
    expect(p.toLowerCase()).toContain('json')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/prescriptions/prescription-prompts.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Escrever `prescription-prompts.ts`**

```ts
import type { Patient } from '@/types/domain'

export function buildPrescriptionEvalPrompt(
  patient: Patient,
  drugName: string,
  posology: string,
  justification: string | null,
  caseSummary?: string | null,
): string {
  const conditions = Array.isArray(patient.conditions) && patient.conditions.length > 0
    ? (patient.conditions as string[]).join(', ')
    : 'nenhuma'
  const trueDiag = (patient as Record<string, unknown>).true_diagnosis as string | null
  const memory = caseSummary && caseSummary.trim() ? `\nMEMÓRIA DO CASO:\n${caseSummary}` : ''

  return `Você é um supervisor clínico. Avalie a ADEQUAÇÃO de uma prescrição ao caso.

Paciente: ${patient.name}, ${patient.age} anos, ${patient.specialty}
Queixa: ${patient.chief_complaint}
Condições: ${conditions}
Diagnóstico verdadeiro do caso (contexto interno): ${trueDiag ?? '(não definido)'}${memory}

Prescrição do aluno:
- Medicamento: ${drugName}
- Posologia: ${posology}
- Justificativa: ${justification ?? '(não informada)'}

Classifique a adequação em UMA das três faixas:
- "adequada": medicamento apropriado para o diagnóstico/quadro, com posologia plausível.
- "parcial": escolha defensável mas com ressalva (posologia imprecisa, segunda linha, indicação incompleta, falta algo importante).
- "inadequada": medicamento sem indicação para o caso, contraindicado, ou que pode causar dano.

Considere a segurança (contraindicações óbvias para as condições do paciente). O foco é a ESCOLHA do fármaco para o caso, não a casa decimal da dose.

Responda APENAS com JSON válido:
{
  "adequacy": "adequada" | "parcial" | "inadequada",
  "feedback": "1-2 frases pedagógicas explicando a classificação"
}`
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/prescriptions/prescription-prompts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/prescriptions/prescription-prompts.ts src/lib/prescriptions/prescription-prompts.test.ts
git commit -m "feat(sp4): prompt de avaliação de adequação da prescrição"
```

---

## Task 6: Rota POST/GET `/prescriptions`

**Files:**
- Create: `src/app/api/consultations/[id]/prescriptions/route.ts`
- Test: `src/app/api/consultations/[id]/prescriptions/route.test.ts`

- [ ] **Step 1: Escrever o teste** (espelha `finish/route.test.ts` — mock encadeável)

```ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { mockCreate, mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/openai/client', () => ({
  openai: { chat: { completions: { create: mockCreate } } },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser }, from: mockFrom }),
}))

import { NextRequest } from 'next/server'
import { POST } from './route'

function makeRequest(body: unknown, id = 'c-1') {
  return [
    new NextRequest(`http://localhost/api/consultations/${id}/prescriptions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  ] as const
}

const user = { id: 'user-1' }
const consultation = {
  clinical_reasoning: '', patients: {
    id: 'p-1', name: 'João', age: 50, gender: 'M', specialty: 'Cardiologia',
    chief_complaint: 'dor', clinical_status: 'estável', conditions: [], difficulty: 'easy',
    true_diagnosis: 'Hipertensão arterial', case_summary: null,
  },
}

function makeFrom(opts: { consultation?: unknown; inserted?: unknown } = {}) {
  return () => {
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.order = vi.fn(() => Promise.resolve({ data: [], error: null }))
    chain.single = vi.fn().mockResolvedValue({ data: opts.consultation ?? consultation, error: null })
    chain.insert = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: opts.inserted ?? { id: 'rx-1' }, error: null }) })) }))
    return chain
  }
}

describe('POST /api/consultations/[id]/prescriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user }, error: null })
    mockFrom.mockImplementation(makeFrom())
    mockCreate.mockResolvedValue({ choices: [{ message: { content: '{"adequacy":"adequada","feedback":"ok"}' } }] })
  })

  it('401 sem auth', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(...makeRequest({ drug_name: 'Losartana', posology: '50 mg' }))
    expect(res.status).toBe(401)
  })

  it('400 sem drug_name', async () => {
    const res = await POST(...makeRequest({ posology: '50 mg' }))
    expect(res.status).toBe(400)
  })

  it('201 com adequacy calculada pela IA', async () => {
    const res = await POST(...makeRequest({ drug_name: 'Losartana', posology: '50 mg VO 1x/dia', source: 'catalog' }))
    expect(res.status).toBe(201)
  })

  it('salva com adequacy null quando a IA falha (best-effort)', async () => {
    mockCreate.mockRejectedValue(new Error('timeout'))
    const insertSpy = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: 'rx-2', adequacy: null }, error: null }) })) }))
    mockFrom.mockImplementation(() => {
      const chain: Record<string, unknown> = {}
      chain.select = vi.fn(() => chain)
      chain.eq = vi.fn(() => chain)
      chain.order = vi.fn(() => Promise.resolve({ data: [], error: null }))
      chain.single = vi.fn().mockResolvedValue({ data: consultation, error: null })
      chain.insert = insertSpy
      return chain
    })
    const res = await POST(...makeRequest({ drug_name: 'Coisa estranha', posology: 'x' }))
    expect(res.status).toBe(201)
    expect(insertSpy).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run "src/app/api/consultations/[id]/prescriptions/route.test.ts"`
Expected: FAIL — módulo `./route` inexistente.

- [ ] **Step 3: Escrever `route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { MODELS } from '@/lib/openai/models'
import { buildPrescriptionEvalPrompt } from '@/lib/prescriptions/prescription-prompts'
import type { Adequacy } from '@/lib/prescriptions/types'
import type { Patient } from '@/types/domain'

const SELECT = 'id, consultation_id, drug_name, posology, source, justification, adequacy, ai_feedback, status, created_at'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  if (!body || typeof body !== 'object')
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { drug_name, posology, justification, source } = body as Record<string, unknown>
  if (!drug_name || typeof drug_name !== 'string' || !drug_name.trim())
    return NextResponse.json({ error: 'drug_name required' }, { status: 400 })
  if (!posology || typeof posology !== 'string' || !posology.trim())
    return NextResponse.json({ error: 'posology required' }, { status: 400 })
  if (drug_name.trim().length > 300)
    return NextResponse.json({ error: 'drug_name too long' }, { status: 400 })
  if (posology.trim().length > 1000)
    return NextResponse.json({ error: 'posology too long' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: consultation, error: cError } = await supabase
    .from('consultations')
    .select('patients(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'ongoing')
    .single()

  if (cError || !consultation)
    return NextResponse.json({ error: 'Consultation not found' }, { status: 404 })

  const patient = (consultation as Record<string, unknown>).patients as Patient
  const caseSummary = (patient as Record<string, unknown>).case_summary as string | null ?? null
  const just = typeof justification === 'string' ? justification.trim() : null

  // Avaliação pela IA — best-effort: se falhar, salva com adequacy null.
  let adequacy: Adequacy | null = null
  let aiFeedback: string | null = null
  try {
    const completion = await openai.chat.completions.create({
      model: MODELS.utility,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: buildPrescriptionEvalPrompt(patient, drug_name.trim(), posology.trim(), just, caseSummary),
      }],
    }, { timeout: 25_000 })
    const raw = completion.choices[0]?.message?.content
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const a = parsed.adequacy
      if (a === 'adequada' || a === 'parcial' || a === 'inadequada') adequacy = a
      if (typeof parsed.feedback === 'string') aiFeedback = parsed.feedback
    }
  } catch {
    // best-effort — segue com adequacy null
  }

  const { data: inserted, error: insertError } = await supabase
    .from('prescriptions')
    .insert({
      consultation_id: id,
      patient_id: patient.id,
      user_id: user.id,
      drug_name: drug_name.trim(),
      posology: posology.trim(),
      source: source === 'catalog' ? 'catalog' : 'free',
      justification: just,
      adequacy,
      ai_feedback: aiFeedback,
      status: 'active',
    })
    .select(SELECT)
    .single()

  if (insertError)
    return NextResponse.json({ error: 'Failed to save prescription' }, { status: 500 })

  return NextResponse.json(inserted, { status: 201 })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('prescriptions')
    .select(SELECT)
    .eq('consultation_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error)
    return NextResponse.json({ error: 'Failed to fetch prescriptions' }, { status: 500 })

  return NextResponse.json(data ?? [], { status: 200 })
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run "src/app/api/consultations/[id]/prescriptions/route.test.ts"`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/consultations/[id]/prescriptions/route.ts" "src/app/api/consultations/[id]/prescriptions/route.test.ts"
git commit -m "feat(sp4): rota POST/GET de prescrições com avaliação por IA"
```

---

## Task 7: Rota PATCH `/prescriptions/[prescriptionId]` (suspender)

**Files:**
- Create: `src/app/api/consultations/[id]/prescriptions/[prescriptionId]/route.ts`

- [ ] **Step 1: Escrever `route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SELECT = 'id, consultation_id, drug_name, posology, source, justification, adequacy, ai_feedback, status, created_at'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; prescriptionId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { prescriptionId } = await params

  const { data, error } = await supabase
    .from('prescriptions')
    .update({ status: 'suspended' })
    .eq('id', prescriptionId)
    .eq('user_id', user.id)
    .select(SELECT)
    .single()

  if (error || !data)
    return NextResponse.json({ error: 'Failed to suspend prescription' }, { status: 500 })

  return NextResponse.json(data, { status: 200 })
}
```

- [ ] **Step 2: Verificar tsc**

Run: `npx tsc --noEmit 2>&1 | grep -v "\.next/types" | grep -v "Cannot find module '\.\./\.\./src/app/api"`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/consultations/[id]/prescriptions/[prescriptionId]/route.ts"
git commit -m "feat(sp4): rota PATCH para suspender prescrição"
```

---

## Task 8: Estender prompts de encerramento (efeito do tratamento)

**Files:**
- Modify: `src/lib/consultations/prompts.ts` (`buildFinishPrompt`, `buildCaseSummaryPrompt`)
- Test: `src/lib/consultations/prompts.test.ts` (criar se não existir; senão adicionar describe)

- [ ] **Step 1: Definir o tipo de contexto e escrever o teste**

Adicionar ao topo de `prompts.ts` (após imports):

```ts
import type { Adherence } from '@/lib/prescriptions/types'

export interface TreatmentContext {
  prescriptions: { drug_name: string; posology: string; adequacy: string | null }[]
  adherence: Adherence
}
```

Teste (`src/lib/consultations/prompts.test.ts`, criar describe novo):

```ts
import { describe, it, expect } from 'vitest'
import { buildFinishPrompt, buildCaseSummaryPrompt } from './prompts'
import type { Patient } from '@/types/domain'

const patient = {
  name: 'Ana', age: 55, gender: 'F', specialty: 'Cardiologia',
  chief_complaint: 'inchaço nas pernas', clinical_status: 'edema de MMII',
  conditions: ['HAS'], difficulty: 'medium', true_diagnosis: 'Insuficiência cardíaca',
} as unknown as Patient

describe('buildFinishPrompt com tratamento', () => {
  it('injeta prescrições e adesão e instrui a evolução por faixas', () => {
    const p = buildFinishPrompt(patient, 'iniciei furosemida', {
      prescriptions: [{ drug_name: 'Furosemida', posology: '40 mg', adequacy: 'adequada' }],
      adherence: 'alta',
    })
    expect(p).toContain('Furosemida')
    expect(p).toContain('alta')
    expect(p).toContain('adequada')
  })

  it('sem tratamento, mantém comportamento antigo (sem seção de prescrição)', () => {
    const p = buildFinishPrompt(patient, 'observação')
    expect(p).not.toContain('PRESCRIÇÕES ATIVAS')
  })
})

describe('buildCaseSummaryPrompt com tratamento', () => {
  it('lista as prescrições estruturadas e a adesão', () => {
    const p = buildCaseSummaryPrompt(patient, null, [], 'rx', [], {
      prescriptions: [{ drug_name: 'Losartana', posology: '50 mg', adequacy: 'adequada' }],
      adherence: 'baixa',
    })
    expect(p).toContain('Losartana')
    expect(p).toContain('baixa')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/consultations/prompts.test.ts`
Expected: FAIL — `buildFinishPrompt` não aceita 3º argumento / string não contém "Furosemida".

- [ ] **Step 3: Estender `buildFinishPrompt`**

Trocar a assinatura e o corpo:

```ts
export function buildFinishPrompt(
  patient: Patient,
  clinicalReasoning: string,
  treatment?: TreatmentContext
): string {
  const trueDiag = (patient as Record<string, unknown>).true_diagnosis as string | null
  const diagContext = trueDiag
    ? `Diagnóstico verdadeiro do caso: ${trueDiag}`
    : `Especialidade: ${patient.specialty} — infira a evolução clínica provável`

  const treatmentSection = treatment && treatment.prescriptions.length > 0
    ? `\nPRESCRIÇÕES ATIVAS (do aluno):\n${treatment.prescriptions
        .map(p => `- ${p.drug_name} — ${p.posology} [adequação: ${p.adequacy ?? 'não avaliada'}]`)
        .join('\n')}\nAdesão estimada do paciente: ${treatment.adherence}\n\nREGRA DO EFEITO DO TRATAMENTO (priorize sobre a heurística do pensamento clínico):
- Prescrição adequada + adesão alta → melhora clara dos sintomas.
- Prescrição adequada + adesão média/baixa → melhora apenas parcial ou recaída por má adesão.
- Prescrição inadequada, ausente ou não avaliada → sem melhora, persistência ou leve piora (pode haver efeito adverso se claramente inadequada).`
    : ''

  return `Você é um sistema de simulação médica. Uma consulta foi realizada.

Paciente: ${patient.name}, ${patient.age} anos
Queixa original: ${patient.chief_complaint}
Estado clínico anterior: ${patient.clinical_status}
${diagContext}
Pensamento clínico registrado pelo aluno: ${clinicalReasoning || '(não registrado)'}${treatmentSection}

Gere uma frase curta descrevendo o novo estado clínico do paciente após esta consulta.
REGRAS:
- Base a evolução no diagnóstico VERDADEIRO do caso, não no que o aluno escreveu
- NUNCA mencione o nome da doença/diagnóstico explicitamente — descreva apenas os sintomas e evolução
- Se NÃO houver prescrições ativas: tratamento razoável no pensamento clínico → melhora parcial; inadequado/ausente → sem melhora ou piora leve
- Use linguagem de sistema médico (3ª pessoa, concisa)

Responda APENAS com a frase do estado clínico (sem JSON, sem explicação).`
}
```

- [ ] **Step 4: Estender `buildCaseSummaryPrompt`**

Adicionar parâmetro `treatment?: TreatmentContext` ao final da assinatura. Antes do `return`, montar:

```ts
  const prescriptionsBlock = treatment && treatment.prescriptions.length > 0
    ? treatment.prescriptions.map(p => `- ${p.drug_name}: ${p.posology}`).join('\n')
    : null
```

E trocar a seção "CONSULTA ATUAL — exames realizados" para incluir, logo após ela:

```ts
CONSULTA ATUAL — prescrições do aluno:
${prescriptionsBlock ?? '(nenhuma prescrição registrada)'}
Adesão estimada do paciente: ${treatment ? treatment.adherence : '(não avaliada)'}
```

E ajustar a instrução da seção "Medicações em uso" do output para:

```
Medicações em uso: <use as prescrições do aluno listadas acima como fonte primária; se não houver, escreva "nenhuma">
```

E em "Evolução", acrescentar: `considere a adesão estimada (uma adesão baixa explica melhora parcial ou recaída mesmo com prescrição adequada)`.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/consultations/prompts.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/consultations/prompts.ts src/lib/consultations/prompts.test.ts
git commit -m "feat(sp4): efeito do tratamento nos prompts de encerramento/resumo"
```

---

## Task 9: Ligar o efeito no `finish/route.ts`

**Files:**
- Modify: `src/app/api/consultations/[id]/finish/route.ts`
- Test: `src/app/api/consultations/[id]/finish/route.test.ts` (estender mock + 1 teste)

- [ ] **Step 1: Estender o teste**

No `makeFrom` do teste de finish, adicionar suporte a uma query de prescrições ativas. Como o `makeFrom` atual roteia tudo por um único chain, adicionar um teste que garante que o encerramento conclui mesmo com prescrições ativas presentes. Adicionar ao final do describe:

```ts
  it('reúne prescrições ativas e conclui o encerramento (efeito best-effort)', async () => {
    // prescrições ativas vêm de uma query separada; o chain devolve [] por padrão,
    // então este teste garante que a presença do passo não quebra o finish.
    const res = await POST(...makeRequest({ clinical_reasoning: 'iniciei losartana' }))
    expect(res.status).toBe(200)
  })
```

(O teste principal é a não-regressão: todos os testes existentes de finish continuam verdes.)

- [ ] **Step 2: Rodar a suíte de finish (deve continuar verde antes da mudança)**

Run: `npx vitest run "src/app/api/consultations/[id]/finish/route.test.ts"`
Expected: PASS (testes atuais).

- [ ] **Step 3: Implementar a coleta + cálculo + injeção**

No `finish/route.ts`:

1. Imports no topo:
```ts
import { estimateAdherence } from '@/lib/prescriptions/adherence'
import type { TreatmentContext } from '@/lib/consultations/prompts'
```

2. Após obter `patient` e antes da geração do `clinical_status`, reunir prescrições ativas e montar o contexto de tratamento (best-effort):
```ts
  let treatment: TreatmentContext | undefined
  try {
    const { data: rxRows } = await supabase
      .from('prescriptions')
      .select('drug_name, posology, adequacy')
      .eq('patient_id', patient.id as string)
      .eq('user_id', user.id)
      .eq('status', 'active')
    if (rxRows && rxRows.length > 0) {
      const bond = (patient as Record<string, unknown>).bond_level as number ?? 3
      const personality = (patient as Record<string, unknown>).personality as string | null
      treatment = {
        prescriptions: rxRows.map(r => ({
          drug_name: r.drug_name as string,
          posology: r.posology as string,
          adequacy: (r.adequacy as string | null) ?? null,
        })),
        adherence: estimateAdherence(bond, personality),
      }
    }
  } catch {
    // best-effort — segue sem efeito de tratamento
  }
```

3. Passar `treatment` para `buildFinishPrompt(patient as never, clinicalReasoning, treatment)`.

4. Passar `treatment` para `buildCaseSummaryPrompt(... , treatment)` (último argumento) na geração do resumo.

- [ ] **Step 4: Rodar a suíte de finish**

Run: `npx vitest run "src/app/api/consultations/[id]/finish/route.test.ts"`
Expected: PASS (incluindo o novo teste; AB4 e demais intactos).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/consultations/[id]/finish/route.ts" "src/app/api/consultations/[id]/finish/route.test.ts"
git commit -m "feat(sp4): finish reúne prescrições ativas e aplica efeito do tratamento"
```

---

## Task 10: Medicações ativas no prompt do paciente

**Files:**
- Modify: `src/lib/consultations/prompts.ts` (`buildPatientSystemPrompt`)
- Modify: `src/app/(dashboard)/consultations/[id]/page.tsx` (carregar medicações ativas)
- Modify: `src/app/(dashboard)/consultations/[id]/ConsultationChat.tsx` se o prompt for montado lá — VERIFICAR onde `buildPatientSystemPrompt` é chamado.

- [ ] **Step 1: Localizar o uso de `buildPatientSystemPrompt`**

Run: `grep -rn "buildPatientSystemPrompt" src/`
Expected: identificar a rota/efeito que monta o system prompt do chat (provável `src/app/api/consultations/[id]/chat/route.ts`).

- [ ] **Step 2: Estender `buildPatientSystemPrompt`**

Adicionar parâmetro opcional `activeMedications?: string[]` ao final da assinatura. Após `memorySection`, adicionar:

```ts
  const medsSection = activeMedications && activeMedications.length > 0
    ? `\nMEDICAÇÕES EM USO (você está tomando — relate adesão e resposta na 1ª pessoa quando perguntado; se sua personalidade/adesão for baixa, pode admitir que esqueceu doses): ${activeMedications.join(', ')}`
    : ''
```

E incluir `${medsSection}` na string final (junto de `${memorySection}`).

- [ ] **Step 3: Passar medicações ativas na origem do prompt**

Na rota que monta o system prompt (identificada no Step 1), antes de chamar `buildPatientSystemPrompt`, buscar:

```ts
  const { data: activeRx } = await supabase
    .from('prescriptions')
    .select('drug_name')
    .eq('patient_id', patient.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
  const activeMedications = (activeRx ?? []).map(r => r.drug_name as string)
```

E passar `activeMedications` como novo argumento de `buildPatientSystemPrompt(...)`.

- [ ] **Step 4: Verificar tsc + testes existentes do chat**

Run: `npx tsc --noEmit 2>&1 | grep -v "\.next/types" | grep -v "Cannot find module '\.\./\.\./src/app/api"`
Run: `npx vitest run`
Expected: sem erros; suíte verde.

- [ ] **Step 5: Commit**

```bash
git add src/lib/consultations/prompts.ts "src/app/api/consultations/[id]/chat/route.ts"
git commit -m "feat(sp4): paciente conhece e relata as medicações ativas no retorno"
```

---

## Task 11: UI — `PrescriptionPanel`

**Files:**
- Create: `src/app/(dashboard)/consultations/[id]/PrescriptionPanel.tsx`
- Modify: `src/app/(dashboard)/consultations/[id]/ConsultationClient.tsx`
- Modify: `src/app/(dashboard)/consultations/[id]/page.tsx` (passar `specialty` + medicações ativas)

- [ ] **Step 1: Escrever `PrescriptionPanel.tsx`**

```tsx
'use client'
import { useState, useEffect } from 'react'
import { searchCatalog } from '@/lib/prescriptions/catalog'
import type { Specialty } from '@/lib/patients/specialties'
import type { Prescription } from '@/lib/prescriptions/types'

type Props = {
  consultationId: string
  specialty: Specialty
  activeMedications?: Array<{ drug_name: string; posology: string }>
}

const ADEQUACY_STYLE: Record<string, string> = {
  adequada: 'bg-green-100 text-green-700',
  parcial: 'bg-yellow-100 text-yellow-700',
  inadequada: 'bg-red-100 text-red-600',
}

export function PrescriptionPanel({ consultationId, specialty, activeMedications = [] }: Props) {
  const [items, setItems] = useState<Prescription[]>([])
  const [drug, setDrug] = useState('')
  const [posology, setPosology] = useState('')
  const [justification, setJustification] = useState('')
  const [source, setSource] = useState<'catalog' | 'free'>('free')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSug, setShowSug] = useState(false)

  useEffect(() => {
    fetch(`/api/consultations/${consultationId}/prescriptions`)
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [consultationId])

  const suggestions = drug.length > 1 ? searchCatalog(specialty, drug) : []

  async function prescribe() {
    if (!drug.trim() || !posology.trim() || loading) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/consultations/${consultationId}/prescriptions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drug_name: drug.trim(), posology: posology.trim(), justification: justification.trim() || undefined, source }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao prescrever'); return }
      setItems(prev => [...prev, data as Prescription])
      setDrug(''); setPosology(''); setJustification(''); setSource('free')
    } catch { setError('Erro de conexão.') } finally { setLoading(false) }
  }

  async function suspend(id: string) {
    if (loading) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/consultations/${consultationId}/prescriptions/${id}`, { method: 'PATCH' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro'); return }
      setItems(prev => prev.map(p => p.id === id ? { ...p, status: 'suspended' } : p))
    } catch { setError('Erro de conexão.') } finally { setLoading(false) }
  }

  return (
    <div className="p-3 space-y-3">
      {activeMedications.length > 0 && (
        <div className="rounded-lg bg-purple-50 border border-purple-100 p-3 space-y-1">
          <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Medicações em uso</p>
          {activeMedications.map((m, i) => (
            <p key={i} className="text-xs text-gray-600"><span className="font-medium text-gray-800">{m.drug_name}</span> — {m.posology}</p>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="relative">
          <input
            type="text" value={drug}
            onChange={e => { setDrug(e.target.value); setShowSug(true); setSource('free') }}
            onBlur={() => setTimeout(() => setShowSug(false), 150)}
            placeholder="Medicamento..."
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          />
          {showSug && suggestions.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-40 overflow-y-auto">
              {suggestions.map(s => (
                <li key={s.name}
                  onMouseDown={() => { setDrug(s.name); setPosology(s.posology); setSource('catalog'); setShowSug(false) }}
                  className="px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50">
                  <span className="font-medium">{s.name}</span>
                  <span className="block text-xs text-gray-400">{s.indication} · {s.posology}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <input
          type="text" value={posology}
          onChange={e => setPosology(e.target.value)}
          placeholder="Posologia (dose, via, frequência, duração)..."
          maxLength={1000}
          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        />
        <textarea
          value={justification} onChange={e => setJustification(e.target.value)}
          placeholder="Justificativa (opcional)..." rows={2} maxLength={2000}
          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm resize-none"
        />
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <button onClick={prescribe} disabled={loading || !drug.trim() || !posology.trim()}
          className="w-full text-xs bg-gray-100 hover:bg-gray-200 rounded-md py-1.5 text-gray-600 font-medium">
          {loading ? 'Prescrevendo...' : '+ Prescrever'}
        </button>
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map(rx => (
            <div key={rx.id} className={`rounded-md px-3 py-2 text-sm ${rx.status === 'suspended' ? 'bg-gray-100 opacity-60' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-800">
                  {rx.drug_name}{rx.status === 'suspended' && ' (suspenso)'}
                </span>
                {rx.adequacy && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ADEQUACY_STYLE[rx.adequacy] ?? 'bg-gray-100 text-gray-500'}`}>
                    {rx.adequacy}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{rx.posology}</p>
              {rx.ai_feedback && <p className="text-xs text-gray-400 mt-0.5 leading-tight">{rx.ai_feedback}</p>}
              {rx.status === 'active' && (
                <button onClick={() => suspend(rx.id)} className="text-xs text-blue-500 hover:underline mt-1">Suspender</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Montar no `ConsultationClient`**

Em `ConsultationClient.tsx`, na Coluna 2 (após o bloco de `ExamRequestPanel`), adicionar:

```tsx
          <div className="border-t">
            <p className="px-3 pt-3 pb-1 text-xs font-bold text-gray-400 uppercase tracking-wide">Prescrições</p>
            <PrescriptionPanel
              consultationId={consultation.id}
              specialty={patient.specialty as Specialty}
              activeMedications={activeMedications}
            />
          </div>
```

Adicionar import: `import { PrescriptionPanel } from './PrescriptionPanel'` e `import type { Specialty } from '@/lib/patients/specialties'`. Adicionar `activeMedications` às `Props` do `ConsultationClient` (`Array<{ drug_name: string; posology: string }>`) e ao destructuring.

- [ ] **Step 3: Carregar medicações ativas no `page.tsx`**

No server component `page.tsx`, no ramo da consulta ongoing, antes de renderizar `ConsultationClient`:

```ts
  const { data: activeRx } = await supabase
    .from('prescriptions')
    .select('drug_name, posology')
    .eq('patient_id', patient.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
  const activeMedications = (activeRx ?? []).map(r => ({ drug_name: r.drug_name, posology: r.posology }))
```

E passar `activeMedications={activeMedications}` ao `<ConsultationClient />`.

- [ ] **Step 4: Verificar tsc + build de testes**

Run: `npx tsc --noEmit 2>&1 | grep -v "\.next/types" | grep -v "Cannot find module '\.\./\.\./src/app/api"`
Run: `npx vitest run`
Expected: sem erros; suíte verde.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/consultations/[id]/PrescriptionPanel.tsx" "src/app/(dashboard)/consultations/[id]/ConsultationClient.tsx" "src/app/(dashboard)/consultations/[id]/page.tsx"
git commit -m "feat(sp4): painel de prescrições na consulta (híbrido catálogo+texto livre)"
```

---

## Task 12: Prescrições no modo leitura

**Files:**
- Modify: `src/app/(dashboard)/consultations/[id]/ConsultationReadOnly.tsx`
- Modify: `src/app/(dashboard)/consultations/[id]/page.tsx` (carregar prescrições da consulta finalizada e passar)

- [ ] **Step 1: Carregar prescrições no ramo finished do `page.tsx`**

No ramo `if (consultation.status === 'finished')`, adicionar:

```ts
  const { data: finishedRx } = await supabase
    .from('prescriptions')
    .select('id, drug_name, posology, adequacy, ai_feedback, status')
    .eq('consultation_id', consultation.id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
```

E passar `prescriptions={finishedRx ?? []}` ao `<ConsultationReadOnly />`.

- [ ] **Step 2: Renderizar em `ConsultationReadOnly`**

Adicionar à `Props` o campo `prescriptions: Array<{ id: string; drug_name: string; posology: string; adequacy: string | null; ai_feedback: string | null; status: string }>` e, numa seção nova (após exames), renderizar read-only:

```tsx
      {prescriptions.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-2">Prescrições</h2>
          <div className="space-y-1.5">
            {prescriptions.map(rx => (
              <div key={rx.id} className="rounded-md px-3 py-2 bg-gray-50 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800">{rx.drug_name}{rx.status === 'suspended' && ' (suspenso)'}</span>
                  {rx.adequacy && <span className="text-xs text-gray-500">{rx.adequacy}</span>}
                </div>
                <p className="text-xs text-gray-500">{rx.posology}</p>
                {rx.ai_feedback && <p className="text-xs text-gray-400 mt-0.5">{rx.ai_feedback}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
```

- [ ] **Step 3: Verificar tsc + testes**

Run: `npx tsc --noEmit 2>&1 | grep -v "\.next/types" | grep -v "Cannot find module '\.\./\.\./src/app/api"`
Run: `npx vitest run`
Expected: sem erros; suíte verde.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/consultations/[id]/ConsultationReadOnly.tsx" "src/app/(dashboard)/consultations/[id]/page.tsx"
git commit -m "feat(sp4): prescrições no modo leitura da consulta finalizada"
```

---

## Task 13: Verificação final + memória

- [ ] **Step 1: Suíte completa + tsc**

Run: `npx vitest run`
Run: `npx tsc --noEmit 2>&1 | grep -v "\.next/types" | grep -v "Cannot find module '\.\./\.\./src/app/api"`
Expected: todos os testes verdes; tsc sem erros novos.

- [ ] **Step 2: Atualizar memória do projeto**

Adicionar em `C:\Users\ander\.claude\projects\C--Users-ander\memory\project_sp1_complete.md` uma linha sobre o SP4 (tabela `prescriptions`, catálogo híbrido, adesão = vínculo × personalidade, efeito no encerramento, AB4 intacto).

- [ ] **Step 3: Push e handoff de deploy**

```bash
git push
```

Avisar o usuário: redeploy manual no Easypanel + rodar `/code-review` sobre o diff do SP4 antes de validar em produção.

---

## Self-Review (preenchido)

**Cobertura do spec:**
- Modelo de dados → Task 1, 2 ✓
- Catálogo híbrido → Task 3 (catálogo) + Task 11 (autocomplete + texto livre) ✓
- Avaliação por IA ao prescrever → Task 5 (prompt) + Task 6 (rota) ✓
- Adesão (vínculo × personalidade) → Task 4 ✓
- Efeito na evolução (encerramento) → Task 8 (prompts) + Task 9 (finish) ✓
- Paciente relata resposta ao tratamento → Task 10 ✓
- UI em toda consulta + medicações em uso → Task 11 ✓
- Modo leitura → Task 12 ✓
- Suspender → Task 7 + Task 11 ✓
- AB4 intacto → garantido (nenhuma task toca o bloco AB4; Task 9 só adiciona coleta antes) ✓
- Testes → Tasks 3,4,5,6,8,9 ✓
- Code review pós-implementação → Task 13 ✓

**Placeholders:** nenhum — todo passo tem código/comando concreto.

**Consistência de tipos:** `TreatmentContext` definido na Task 8 e usado nas Tasks 8/9; `Adequacy`/`Prescription`/`Adherence` definidos na Task 2 e usados em 5/6/11; `estimateAdherence(bondLevel, personality)` mesma assinatura em 4 e 9; `searchCatalog(specialty, query)` mesma assinatura em 3 e 11.
