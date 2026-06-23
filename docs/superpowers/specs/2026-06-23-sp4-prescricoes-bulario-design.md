# SP4 — Prescrições + Bulário (design)

Data: 2026-06-23
Status: aprovado (brainstorming) — pronto para writing-plans

## Contexto

O arco diagnóstico do simulador está completo e em produção (SP1 carteira, SP2
fluxo de consulta, SP3a exames, SP3b score AB4, + memória do caso,
personalidades, abertura progressiva e modo seguimento). O aluno hoje:
cria paciente → conversa → examina → pede exames → raciocina (AB4) → fecha o
diagnóstico → volta em consulta de acompanhamento.

O modo seguimento foi recém-criado (commit 236901a) mas está **vazio**: depois de
fechar o diagnóstico, não há o que fazer no acompanhamento — não existe
**tratamento**. O arco terapêutico não existe no build atual (confirmado: nenhuma
referência a prescrição/medicação/bulário em `src/`).

SP4 fecha o ciclo clínico: **diagnosticar → tratar → acompanhar a resposta ao
tratamento**. É a "consequência clínica" da hipótese central do MVP (carteira
viva com evolução, vínculo e consequências).

## Objetivos

- O aluno prescreve medicações numa consulta (entrada híbrida: catálogo curado +
  texto livre).
- A IA avalia a adequação da prescrição ao diagnóstico verdadeiro, com feedback
  pedagógico.
- A prescrição **muda a evolução do paciente** no próximo retorno, cruzando
  adequação × adesão (adesão derivada de vínculo + personalidade já existentes).
- Disponível em toda consulta (permite tratamento empírico antes do diagnóstico e
  dirigido depois).

## Não-objetivos (fora do escopo do SP4)

- Integração completa com a ANVISA (importar `DADOS_ABERTOS_MEDICAMENTOS.csv`,
  linkar bula do Bulário Eletrônico). Fica como fase futura.
- Preço CMED / custo em MedCoin da prescrição (pertence à sprint de gestão/MedCoin).
- Interações medicamentosas, ajuste por função renal/hepática, alergias como
  regra dura. A IA pode comentar qualitativamente no feedback, mas não há motor
  de regras.
- Alterar o cálculo do AB4. Prescrição é competência separada (técnica/tratamento),
  candidata à futura Fase 8 (Performance em Teia).

## Decisões (do brainstorming)

1. **Papel:** ciclo completo — prescrever + IA avalia + muda a evolução.
2. **Entrada:** híbrida — catálogo curado pequeno (autocomplete, com posologia
   padrão) + texto livre validado por IA.
3. **Mecânica da evolução:** adequação × adesão, graduada.
4. **Disponibilidade:** em toda consulta (não bloqueada por diagnóstico).
5. **Arquitetura:** tabela `prescriptions` espelhando `exam_requests` + passo de
   efeito best-effort no encerramento.

## Seção 1 — Modelo de dados

Nova tabela `prescriptions` (mesmas políticas RLS de `exam_requests`:
`user_id = auth.uid()` em select/insert/update/delete).

| Coluna | Tipo | Papel |
|---|---|---|
| `id` | uuid PK default gen_random_uuid() | |
| `consultation_id` | uuid FK → consultations | consulta em que foi prescrita |
| `patient_id` | uuid FK → patients | |
| `user_id` | uuid FK → auth.users | dono (RLS) |
| `drug_name` | text not null | princípio ativo / nome |
| `posology` | text not null | dose, via, frequência, duração |
| `source` | text not null | `'catalog'` ou `'free'` |
| `justification` | text null | por que prescreveu (opcional) |
| `adequacy` | text null | `'adequada' / 'parcial' / 'inadequada'` (veredito da IA) |
| `ai_feedback` | text null | explicação pedagógica da IA |
| `status` | text not null default `'active'` | `'active'` / `'suspended'` |
| `created_at` | timestamptz default now() | |

Notas:
- O **efeito na evolução não vira coluna** — é computado no encerramento e
  gravado em `clinical_status` (paciente) + nas seções "Medicações em uso" e
  "Evolução" do `case_summary`. Mantém o schema enxuto e reaproveita os ganchos
  longitudinais existentes.
- `status` sustenta "medicações em uso" entre consultas: uma prescrição ativa é
  carregada para os retornos seguintes até o aluno suspender.
- Migration registrada em `supabase_migrations.schema_migrations` (padrão do repo:
  aplicar via execute_sql + registrar versão exata para manter repo = prod).
- Atualizar `src/types/database.ts` com a nova tabela (Row/Insert/Update +
  relationships).

## Seção 2 — Catálogo (camada híbrida)

Arquivo `src/lib/prescriptions/catalog.ts` (mesmo padrão de
`SPECIALTY_HARD_EXAMPLES`):

```ts
export interface CatalogDrug { name: string; posology: string; indication: string }
export const PRESCRIPTION_CATALOG: Record<Specialty, CatalogDrug[]>
export function searchCatalog(specialty: Specialty, query: string): CatalogDrug[]
```

- ~10–15 princípios ativos comuns por especialidade, com posologia padrão e
  indicação. Curado por nós; nomes reais (conferíveis contra o CSV da ANVISA).
- `searchCatalog` alimenta o autocomplete (filtra por especialidade + substring,
  case-insensitive).
- Selecionar do catálogo preenche `drug_name` + `posology` padrão (editável) e
  marca `source: 'catalog'`. Texto livre → `source: 'free'`.
- Fonte oficial futura: Bulário Eletrônico / Dados Abertos ANVISA
  (`DADOS_ABERTOS_MEDICAMENTOS.csv`). Documentado como evolução.

## Seção 3 — UI

Na Coluna 2 da consulta (`ConsultationClient`, hoje Exame Físico + Exames),
adicionar painel "Prescrições" abaixo de Exames, espelhando `ExamRequestPanel`:

- Entrada híbrida: campo de medicamento com autocomplete do catálogo (filtrado
  por `patient.specialty`) + campo de posologia (preenchido ao escolher do
  catálogo, editável) + justificativa opcional.
- Botão "Prescrever" → `POST /api/consultations/[id]/prescriptions` → IA valida →
  badge de adequação (🟢 adequada / 🟡 parcial / 🔴 inadequada) + feedback.
- Lista das prescrições desta consulta com badge/feedback e ação "Suspender"
  (`PATCH` muda `status` para `'suspended'`).
- "Medicações em uso" (prescrições ativas de consultas anteriores) como contexto
  read-only no topo do painel, análogo a `previousExamResults` (carregado no
  server component `page.tsx` e passado ao client).
- Disponível em toda consulta (sem gate por `diagnosis_status`).
- `ConsultationReadOnly`: prescrições em modo leitura com adequação/feedback.

Novo componente: `PrescriptionPanel.tsx`. Rotas (espelham `exams/route.ts` +
`exams/[examId]/route.ts`):
- `src/app/api/consultations/[id]/prescriptions/route.ts` — `POST` (add +
  validação pela IA).
- `src/app/api/consultations/[id]/prescriptions/[prescriptionId]/route.ts` —
  `PATCH` (suspender: `status = 'suspended'`).

## Seção 4 — Avaliação e efeito na evolução

**(a) Ao prescrever** (`POST .../prescriptions`):
- IA avalia a prescrição contra `true_diagnosis` + contexto do paciente →
  `adequacy` + `ai_feedback`. Espelha a validação de exames; `MODELS.utility`,
  `response_format: json_object`, `timeout: 25_000`.
- Novo prompt `buildPrescriptionEvalPrompt(patient, drug_name, posology,
  justification)` em `src/lib/prescriptions/prescription-prompts.ts`.
- Best-effort na parte de IA: se a validação falhar, a prescrição ainda é salva
  com `adequacy: null` e feedback neutro (não trava o aluno).

**(b) No encerramento** (passo "efeito do tratamento", best-effort como o AB4):
1. Reúne prescrições ativas (desta consulta + carry de anteriores com
   `status='active'`).
2. `estimateAdherence(bond_level, personality)` → `'alta' | 'média' | 'baixa'`
   (função pura, testável). Heurística: vínculo alto + personalidade cooperativa
   (objetivo/ansioso) → maior adesão; vínculo baixo / minimizador / reticente →
   risco de não adesão.
3. Injeta prescrições + adequação + adesão + `true_diagnosis` na geração do novo
   `clinical_status` (estende `buildFinishPrompt`) e do `case_summary` (estende
   `buildCaseSummaryPrompt` — substitui a extração heurística de "Medicações em
   uso" por prescrição estruturada real). Faixas de evolução:
   - adequado + aderente → melhora;
   - adequado + não aderente → melhora parcial / recaída;
   - inadequado / ausente → persiste / piora / efeito adverso.
4. Próxima consulta: o `case_summary` já alimenta o retorno e o prompt do paciente
   recebe as medicações ativas (o paciente relata a resposta ao tratamento, na
   1ª pessoa). O gancho "você LEMBRA das medicações que toma" já existe em
   `buildPatientSystemPrompt`.

O passo de efeito é best-effort: se a IA falhar, o encerramento conclui
normalmente (mesma disciplina do AB4 e do resumo). Nada disso toca o AB4.

## Seção 5 — Testes

- `catalog.test.ts`: `searchCatalog` filtra por especialidade + substring
  case-insensitive; catálogo tem entradas para toda `Specialty`.
- `adherence.test.ts`: `estimateAdherence` cobre as faixas (vínculo alto +
  cooperativo → alta; vínculo baixo / minimizador / reticente → baixa; casos
  intermediários → média).
- `prescription-prompts.test.ts`: o prompt de avaliação inclui `true_diagnosis`,
  medicamento, posologia; o prompt de efeito inclui adequação + adesão.
- `prescriptions/route.test.ts`: 401 sem auth; 200 com adequação calculada quando
  a IA retorna JSON válido; prescrição salva com `adequacy: null` quando a IA
  falha (best-effort); suspender muda `status`.
- `finish/route.test.ts` (estender): o passo de efeito é chamado com prescrições
  ativas; encerramento conclui mesmo se o efeito falhar; AB4 segue intacto.
- Padrões do repo: `vi.hoisted` para mocks; `// @vitest-environment node` nas
  rotas; mock encadeável do supabase (`makeFrom`).

## Critérios de aceite

- O aluno consegue prescrever via catálogo (autocomplete + posologia padrão) e via
  texto livre, em qualquer consulta.
- Cada prescrição recebe badge de adequação + feedback da IA.
- Prescrições ativas aparecem como "medicações em uso" nas consultas seguintes.
- No retorno, a evolução do paciente reflete adequação × adesão (melhora /
  melhora parcial / piora).
- O paciente relata, na 1ª pessoa, a resposta ao tratamento no retorno.
- O encerramento nunca quebra por falha do passo de prescrição/efeito.
- AB4 inalterado.
- `npx tsc --noEmit` limpo e suíte de testes verde.

## Etapas após implementação

- Rodar `/code-review` (requesting-code-review) sobre o diff do SP4 antes de
  mergear/deployar — code review acontece depois da implementação, não no spec.
- Deploy manual no Easypanel (padrão do projeto) + teste do usuário.

## Evolução futura (registrado, fora do SP4)

- Importar Dados Abertos ANVISA (`DADOS_ABERTOS_MEDICAMENTOS.csv`) + linkar bula
  do Bulário Eletrônico como fonte oficial do catálogo.
- Custo em MedCoin / preço CMED da prescrição.
- Eixo "técnica/tratamento" na Performance em Teia (Fase 8) alimentado pela
  adequação das prescrições.
