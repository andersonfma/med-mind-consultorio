# Modelagem dos Simulados ENARE / ENAMED

Data: 2026-10-30
Status: levantamento para revisão — define o PADRÃO antes de reconstruir o gerador.
Objetivo: gerar questões por IA que de fato pareçam ENARE/ENAMED (não "cara de IA"),
com estrutura, estilo e distribuição de temas calibrados pelas provas reais.

## 1. Estrutura das provas (fato, do edital)

| | **ENARE** (residência) | **ENAMED** (formação, novo) |
|---|---|---|
| Nº de questões | 100 | 100 |
| **Alternativas** | **5 (A–E)** | **4 (A–D)** |
| Resposta | 1 correta (single best) | 1 correta (single best) |
| Composição | 20 competências gerais + 80 específicas | peso igual entre as áreas |
| Base | DCNs das profissões de saúde | Matriz de Referência do ENAMED (INEP) + DCNs |
| Tempo | — | 5 horas |
| Aprovação | ≥ 50% de acertos | — |
| Áreas | 5 grandes áreas | 5 grandes áreas (medicina) |

**Implicação nº 1 pro gerador:** o nº de alternativas **depende do exame** — ENARE = 5, ENAMED = 4.
O gerador atual usa 5 fixo (errado para ENAMED).

As 5 grandes áreas: **Clínica Médica, Cirurgia Geral, Pediatria, Ginecologia e Obstetrícia,
Medicina Preventiva e Saúde Coletiva.**

## 2. Estilo / padrão das questões (como são de verdade)

- **Vinheta clínica** como regra: idade/sexo, queixa + HDA, antecedentes relevantes, achados de
  exame físico e, com frequência, **exames complementares com valores**. Não é pergunta "seca" de
  decoreba — é um caso que exige raciocínio. (Cirurgia tende a enunciados um pouco mais complexos.)
- **Comprimento:** vinheta de porte médio a longo (≈ 4–10 linhas); pergunta objetiva ao final
  ("qual a conduta?", "qual o diagnóstico mais provável?", "qual o próximo exame?").
- **Questões independentes** (standalone) — **não** há cadeia de questões interligadas na objetiva
  do ENARE/ENAMED. (Confirmado o padrão; manter standalone no MVP.)
- **Alternativas** homogêneas em tamanho e plausíveis; a correta não se destaca por ser a mais
  longa/completa. **≥ 2 distratores fortes** (diferencial clássico, conduta "quase certa" que falha
  num detalhe, armadilha frequente). A diferença decisiva está num **detalhe fino** do caso.
- **Dificuldade:** nível residência — o problema atual é que a IA está gerando casos fáceis/óbvios.

**Implicação nº 2:** o prompt precisa exigir **vinheta completa com dados objetivos** (incl. valores
de exames) + pergunta ao final, e calibrar a dificuldade pra cima (nível residência real).

## 3. Estatística de temas (incidência — base para os pesos)

### 3.1 Distribuição por área (ENARE, 2017–2024, aprox.)
- Clínica Médica ≈ **25%**
- Cirurgia ≈ **21%**
- Ginecologia e Obstetrícia ≈ **19%** (mín. ~20 questões/prova)
- Medicina Preventiva ≈ **19%**
- Pediatria ≈ **15%**

(ENAMED distribui em **peso igual** entre as áreas — ~20% cada.)

### 3.2 Temas mais cobrados por área (alto rendimento)
- **Clínica Médica:** Cardiologia (IC, **arritmias**), Endocrinologia (DM, tireoide), Gastroenterologia,
  Neurologia, Reumatologia, Terapia intensiva/emergências.
- **Cirurgia Geral:** **Trauma (~23%)**, **Abdome agudo (~18%)**, cirurgia do aparelho digestivo,
  pós-operatório, urologia, princípios oncológicos.
- **Pediatria:** **Vacinação/puericultura**, pneumologia pediátrica (IVAI), infectologia, neonatologia,
  cardiologia pediátrica, oncohematologia.
- **Ginecologia e Obstetrícia:** doenças clínicas na gestação, **infecções genitais/DST**, oncologia
  ginecológica, ginecologia endócrina, trabalho de parto, uroginecologia.
- **Medicina Preventiva:** **SUS** (princípios/redes/financiamento), epidemiologia e **testes
  diagnósticos** (sens/espec, VPP/VPN), vigilância, atenção primária/MFC, ética médica.

**Implicação nº 3:** num "simulado por área", a escolha dos temas deve ser **ponderada pela
incidência** (ex.: em Cirurgia, Trauma e Abdome agudo pesam mais). Hoje os temas são uniformes.

## 4. Padrão-alvo do gerador (o que muda)

1. **Parâmetro `exam`** (enare | enamed) → define nº de alternativas (5 vs 4) e o tom (residência vs
   competências/DCN).
2. **Vinheta obrigatória** com idade/sexo, HDA, antecedentes, exame físico e, quando couber, exames
   com valores; pergunta objetiva ao final.
3. **Dificuldade residência** + regra de distratores (≥2 fortes; diferença num detalhe fino).
4. **Temas ponderados por incidência** dentro da área; sem repetir tema no mesmo simulado.
5. **Standalone** (sem questões interligadas) no MVP.
6. Guardar `topic`/área de cada questão (sem mostrar durante a resposta) → alimenta o **relatório de
   tendências** (fatia futura).

## 5. Em aberto / a refinar com mais dados
- Pesos finos por **subtema** (ex.: dentro de Cardiologia, quanto é arritmia vs IC) — exigiria análise
  granular de muitas provas; começar com os pesos macro acima.
- **Matriz de Referência do ENAMED** (INEP) quando publicada/estável — para alinhar o ENAMED fino.
- Proporção **competências gerais (20%)** no ENARE — se valerá a pena gerar questões de "competências
  gerais" (ética, comunicação, gestão) além das clínicas.

## 6. Fontes
- Estrutura ENARE — Edital EBSERH / Medway, Gran Cursos.
- Estrutura ENAMED 2025 — Edital INEP nº 81/2025 / Sanar, Medcel, CNN.
- Incidência de temas — Estratégia MED, Medway, Clevermed, Grupo Medcof.

## 7. Próximo passo
Revisar este padrão. Com o OK, reconstruo o gerador (seção 4) e recalibro o blueprint
(`src/lib/exam/blueprint.ts`) com os pesos por incidência e o parâmetro de exame.
