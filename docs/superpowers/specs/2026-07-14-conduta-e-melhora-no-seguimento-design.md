# Conduta terapêutica + critério de melhora no seguimento — Design

**Data:** 2026-07-14
**Contexto:** Módulo Consultório do Med Mind Simulador. Fecha uma lacuna do SP4 (Prescrições).
**Status:** aprovado no brainstorming; pronto para plano de implementação.

## Problema (causa raiz, confirmada em produção)

No seguimento, o paciente diz que **não melhorou mesmo quando o aluno acerta a conduta**. Caso disparador: hemorragia varicosa por cirrose (paciente Celina, `39aa2e13`), tratada com terlipressina + ligadura elástica + TIPS — o `clinical_status` gerado foi *"leve piora dos episódios hemorrágicos"*. Ocorre com **todos** os pacientes no seguimento.

Três causas somadas, sendo a primeira um bug:

1. **`bond_level` está travado em 1.** A coluna nasce com `DEFAULT 1` na migration e **nenhum código a atualiza** (grep em `src/app/api` só encontra leitura). Confirmado no banco: os 6 pacientes mais recentes, todos com `bond_level = 1`. Como `estimateAdherence` faz `score = clamp(bond,1..5) + mod_personalidade` e exige score ≥ 5 para `'alta'` e ≥ 3 para `'média'`, com bond = 1 o **melhor caso possível** (personalidade `objetivo`, +1) dá score 2 → `'baixa'`. **Todo paciente, sempre, tem adesão `baixa`.** O ramo "melhora clara" do prompt de encerramento nunca executou. A `BondBar` na UI também está sempre em 1 — mesmo bug, visível.

2. **O simulador só enxerga fármacos.** A tabela `prescriptions` modela só `drug_name` + `posology`. Ligadura elástica e TIPS — a conduta definitiva do caso — não têm onde ser registrados. No banco, a Celina tem uma única linha: terlipressina, adequação `parcial`.

3. **Adequação julgada item a item.** Terlipressina isolada *é* `parcial`. Mas o **conjunto** (terlipressina + ligadura + TIPS) é a conduta correta. O julgamento por item nunca vê o conjunto.

Resultado: terlipressina sozinha (`parcial`) + adesão `baixa` → regra "adesão baixa → recaída/sem melhora" → piora. O prompt está coerente com as regras que recebe; **as regras é que estão erradas**.

## Princípio pedagógico

Acertar a conduta TEM que ser sentido pelo paciente. Um simulador que pune o acerto ensina errado. Adesão só faz sentido para **medicação de uso contínuo** — um procedimento executado pelo médico (ligadura, TIPS) não depende de "aderência" do paciente.

## Escopo

Três mudanças encadeadas. Não toca no AB4 (competência de raciocínio, separada da terapêutica) exceto por **ler** a nota A2 já gravada.

---

### Parte 1 — Modelo de dados: de "Prescrição" para "Conduta"

**Migration:** adicionar coluna `kind TEXT NOT NULL DEFAULT 'medicamento'` em `prescriptions`, com `CHECK (kind IN ('medicamento','procedimento','medida'))`. Linhas existentes migram para `'medicamento'` — compatibilidade total.

- `drug_name` mantém o nome da coluna (renomear não paga o risco) mas passa a significar "nome do item da conduta".
- `posology` passa a ser opcional/livre: para `procedimento`/`medida` vira *detalhamento* (ex.: "ligadura elástica de varizes esofágicas, sessão inicial"), não posologia.
- Selo de adequação por item **continua existindo** (não bloqueia nada — item sempre salvo `active`).
- Regra **"não revelar o diagnóstico verdadeiro" no `ai_feedback`** (subida em 2026-07-14, commit 67b20c5) se aplica igual a procedimentos.

**Tipos** (`src/lib/prescriptions/types.ts`): novo `ConductKind = 'medicamento' | 'procedimento' | 'medida'`; campo `kind` em `Prescription`.

**Catálogo** (`src/lib/prescriptions/catalog.ts`): permanece só de fármacos. `procedimento` e `medida` entram por texto livre (`source: 'free'`, caminho já existente). Catálogo de procedimentos é YAGNI — adicionar só se sentir falta.

**UI** (`PrescriptionPanel.tsx`): título passa a **"Conduta"**; seletor de tipo (medicamento | procedimento | medida). Quando `procedimento`/`medida`, o campo de posologia vira "detalhamento" e o autocomplete de catálogo é ocultado. Modo leitura (`ConsultationReadOnly.tsx`) mostra o tipo junto do item.

**Rota de avaliação por item** (`prescriptions/route.ts` + `buildPrescriptionEvalPrompt`): passa a receber `kind` e adapta o texto (avaliar "conduta/procedimento" e não "posologia" quando não-medicamento). Mantém best-effort e a regra de não revelar diagnóstico.

---

### Parte 2 — Como a melhora acontece

Tudo no encerramento (`finish/route.ts`), best-effort, sem bloquear o finish.

#### (a) Vínculo passa a evoluir

Novo helper puro `nextBondLevel(current, a2Score)` em `src/lib/prescriptions/adherence.ts` (ou arquivo próprio `src/lib/patients/bond.ts` — decisão do plano):

- Base: `+1` por consulta finalizada.
- Modulação pelo A2 (Retórico) do AB4 desta consulta: A2 alto acelera, A2 baixo trava/penaliza. Faixas exatas no plano; ex. de ponto de partida: `a2 >= 7 → +2`, `a2 <= 3 → 0` (não sobe), demais `+1`.
- `clamp(resultado, 1, 5)`.

Aplicado no update do paciente no finish, junto de `clinical_status`. Fonte do A2: o `ab4_score` desta consulta (etapa 1) ou herdado. Se não houver A2 (seguimento sem AB4, ou juiz falhou), degrada para `+1` puro.

Efeito colateral desejado: desbloqueia a `BondBar` (hoje presa em 1) e dá consequência real ao eixo A2, que hoje só vira nota.

#### (b) Juiz de conduta global

Novo prompt `buildConductEvalPrompt(patient, activeConduct)` (`src/lib/prescriptions/...` ou `consultations/prompts.ts`) que recebe o **conjunto** da conduta ativa (todos os itens, com `kind`) e o `true_diagnosis`, e devolve uma adequação **global**: `'adequada' | 'parcial' | 'inadequada' | 'ausente'`.

- Roda no finish, `MODELS.utility`, best-effort com timeout 25s. Se falhar → degrada para `'ausente'` (conservador, mesmo espírito dos outros fallbacks do finish).
- **É essa nota global — não a soma dos selos por item — que decide a evolução.** Resolve o caso da Celina: itens isolados podem ser `parcial`, o conjunto é `adequada`.
- Regra de não revelar diagnóstico se aplica (essa nota não é exibida ao aluno diretamente; alimenta o `clinical_status`).

#### (c) Matriz de evolução — nunca punir o acerto

`TreatmentContext` (em `consultations/prompts.ts`) ganha o campo `conductAdequacy` (a nota global) além das prescrições e da adesão. A adesão **só modula fármacos de uso contínuo**; procedimento executado não depende de adesão.

`buildFinishPrompt` e `buildCaseSummaryPrompt` passam a usar esta matriz (substitui a regra atual baseada na adequação por item):

| Conduta (global) | Adesão | Evolução |
|---|---|---|
| adequada | alta / média | **melhora clara** |
| adequada | baixa | **melhora parcial** (fala do paciente traz pista de má adesão) |
| parcial | — | melhora parcial / sintomas residuais |
| inadequada ou ausente | — | persiste ou piora leve |

Regra dura no prompt: **conduta adequada NUNCA gera "sem melhora" ou piora.** Adesão baixa, com conduta adequada, no máximo reduz para melhora parcial.

Caso Celina esperado: conjunto **adequado** → melhora clara → paciente responde "melhorei" no seguimento.

---

## Fora de escopo (YAGNI)

- Catálogo curado de procedimentos (texto livre resolve por ora).
- Renomear a coluna `drug_name` → `item_name` (custo/risco não compensa; comentário no tipo basta).
- Persistir a nota de conduta global no banco (é efêmera, só alimenta o finish; se um dia quiser exibir histórico, vira coluna).
- Adesão parcial por item (ex.: aderiu ao remédio A mas não ao B) — adesão é do paciente, não do item.

## Arquivos afetados (mapa)

- **Migration nova**: `supabase/migrations/<ts>_add_conduct_kind.sql` (coluna `kind`).
- `src/lib/prescriptions/types.ts` — `ConductKind`, campo `kind`.
- `src/lib/prescriptions/adherence.ts` (ou `bond.ts` novo) — `nextBondLevel`.
- `src/lib/prescriptions/catalog.ts` — inalterado (só fármacos); confirmar comportamento com `kind`.
- `src/lib/consultations/prompts.ts` — `TreatmentContext.conductAdequacy`; matriz nova em `buildFinishPrompt` e `buildCaseSummaryPrompt`; possivelmente `buildConductEvalPrompt`.
- `src/lib/prescriptions/prescription-prompts.ts` (ou onde vive `buildPrescriptionEvalPrompt`) — aceitar `kind`.
- `src/app/api/consultations/[id]/finish/route.ts` — chamar juiz de conduta global; atualizar `bond_level`; montar `TreatmentContext` com `conductAdequacy`.
- `src/app/api/consultations/[id]/prescriptions/route.ts` — aceitar/gravar `kind`.
- `src/app/(dashboard)/consultations/[id]/PrescriptionPanel.tsx` — seletor de tipo, título "Conduta".
- `src/app/(dashboard)/consultations/[id]/ConsultationReadOnly.tsx` — exibir `kind`.
- `src/types/database.ts` — regenerar após migration.
- Testes: `adherence.test.ts` (bond), novos para `nextBondLevel`, juiz de conduta (que a instrução está no prompt), matriz.

## Verificação

- Testes unitários TDD (bond, matriz, prompts contêm as instruções).
- `npx tsc --noEmit` limpo (exceto `validator.ts` pré-existente).
- Validação em modelo real com o caso Celina: conjunto adequado → melhora; e um caso de conduta inadequada → persiste/piora (contraprova).
- Eficácia dos prompts é probabilística (gpt-4.1-mini) — teste garante a instrução, não o comportamento do modelo.

## Riscos / notas

- **Pacientes antigos com `bond_level = 1`** começam a subir a partir da próxima consulta finalizada — comportamento correto, sem backfill necessário.
- **Retroatividade**: a nota A2 é lida do `ab4_score`; consultas de seguimento (pós-diagnóstico) não têm AB4 novo → bond usa `+1` puro. Aceitável.
- Migration deve ser aplicada em prod **antes** do deploy do código (padrão do projeto: evitar descompasso schema↔código).
