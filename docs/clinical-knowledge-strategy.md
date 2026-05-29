# Estrategia De Conhecimento Clinico E Guidelines

Atualizado em: 2026-05-18

## Objetivo

Transformar o Med Mind - Modulo Consultorio em um simulador clinico
multiespecialidade, com feedback tecnico baseado em fontes confiaveis,
versionadas e auditaveis.

O produto deve cobrir progressivamente:

- clinica medica;
- hepatologia;
- endocrinologia;
- gastroenterologia;
- cardiologia;
- pneumologia;
- neurologia;
- demais especialidades clinicas conforme expansao.

## Principio Central

A IA nao deve ser a fonte primaria da verdade clinica. A IA deve:

- simular paciente;
- organizar dados;
- aplicar rubricas;
- explicar feedback;
- adaptar dificuldade.

A fonte tecnica deve vir de guidelines, consensos e documentos oficiais
curados, com versao, data, sociedade emissora e escopo.

## Fontes De Referencia

Cada tema clinico deve ter um pacote de referencias por prioridade:

1. sociedade brasileira relevante;
2. sociedade americana relevante;
3. sociedade europeia relevante;
4. OMS quando aplicavel;
5. documentos de consenso ou revisoes apenas quando nao houver guideline
   primario adequado.

Exemplos iniciais de fontes oficiais:

- hepatologia: SBH, AASLD, EASL;
- endocrinologia/diabetes: SBEM/SBD, ADA, EASD;
- cardiologia: SBC, ACC/AHA, ESC;
- gastroenterologia: FBG/SOBED quando aplicavel, ACG, AGA, ESGE/UEG;
- pneumologia: SBPT, ATS/ERS, GOLD/GINA quando aplicavel;
- neurologia: ABN, AAN, EAN;
- saude publica/condicoes globais: OMS.

## Arquitetura Recomendada

### 1. Registro De Fontes

Criar um catalogo estruturado de fontes:

```json
{
  "id": "aasld-masld-2023",
  "specialty": "hepatology",
  "topic": "MASLD",
  "publisher": "AASLD",
  "region": "US",
  "year": 2023,
  "url": "...",
  "status": "active",
  "lastCheckedAt": "2026-05-18"
}
```

### 2. Regras Clinicas Curadas

Nao armazenar apenas PDFs. Converter recomendacoes importantes em regras
pedagogicas pequenas:

```json
{
  "topic": "MASLD",
  "clinicalStep": "risk_stratification",
  "recommendation": "avaliar risco de fibrose com escore nao invasivo",
  "expectedStudentAction": "solicitar/calcular FIB-4 quando ha dados disponiveis",
  "severityIfMissed": "moderate",
  "sources": ["aasld-masld-2023", "easl-easd-easo-masld-2024"]
}
```

### 3. Rubrica De Feedback Tecnico

O feedback tecnico deve avaliar:

- coleta de dados essenciais;
- hipoteses e problemas ativos;
- raciocinio AB4;
- conduta alinhada a guideline;
- seguranca e red flags;
- exames solicitados adequadamente;
- prescricao adequada;
- seguimento e orientacoes.

### 4. IA Com Trilhos

Fluxo recomendado:

1. aluno conduz consulta;
2. sistema extrai fatos clinicos estruturados;
3. motor de regras compara fatos/condutas com rubricas;
4. IA redige feedback pedagogico a partir de evidencias e regras;
5. feedback mostra pontos fortes, lacunas e fontes de referencia.

## Cuidados Juridicos E Educacionais

O sistema deve manter linguagem educacional:

- "feedback simulado";
- "para fins de treinamento";
- "nao substitui julgamento clinico";
- "baseado em fontes cadastradas e versoes vigentes no sistema".

Evitar:

- promessa de recomendacao assistencial real;
- prescricao automatica como conduta final;
- ranking publico sem opt-in;
- usar guideline sem versao/data/fonte.

## Roadmap Tecnico

### Etapa 1 - Fonte E Rubrica Piloto

Escolher uma especialidade e uma condicao piloto.

Recomendacao inicial: hepatologia/MASLD, porque ja existe caso demo e relacao
com HepatoMind.

Entregas:

- registro de fontes;
- 10 a 20 regras clinicas curadas;
- rubrica tecnica inicial;
- feedback tecnico separado de comunicacao/vinculo/gestao.

Fontes oficiais iniciais para hepatologia:

- SBH: Sociedade Brasileira de Hepatologia;
- AASLD: https://www.aasld.org/practice-guidelines;
- EASL: https://easl.eu/publication-category/clinical-practice-guidelines/.

Para MASLD/SLD, incluir a nomenclatura e recomendações mais atuais de AASLD e
EASL antes de transformar qualquer regra em feedback tecnico.

### Etapa 2 - Motor De Avaliacao Tecnica

Criar um modulo local:

```text
src/clinicalKnowledge/
```

Com:

- `sourceRegistry`;
- `clinicalRules`;
- `technicalEvaluator`;
- testes por cenario.

### Etapa 3 - Multiespecialidade

Expandir por pacotes:

```text
hepatology/masld
endocrinology/diabetes
cardiology/hypertension
pulmonology/asthma
gastroenterology/gerd
neurology/headache
```

Cada pacote deve ter fontes, regras, cenarios e testes.

### Etapa 4 - Atualizacao E Auditoria

Adicionar rotina de revisao:

- data de ultima checagem;
- guideline substituido;
- regra ativa/inativa;
- divergencias entre sociedades;
- trilha de auditoria do feedback.

## Decisao Atual

Antes de expandir muitas especialidades, implementar uma vertical piloto com
feedback tecnico robusto. Depois replicar o padrao para outras areas.
