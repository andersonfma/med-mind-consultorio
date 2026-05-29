# Arquitetura Inicial

## Decisao Principal

O Consultorio Vivo sera um modulo/projeto separado, mas integravel ao ecossistema
Med Mind por contratos de dados.

Ele nao deve depender diretamente do codigo interno do HepatoMind. O HepatoMind
deve apenas exportar um paciente longitudinalizavel em formato conhecido.

## Stack Recomendada Para O MVP

Recomendacao inicial:

- Next.js com TypeScript para frontend e rotas server-side.
- Prisma como camada de schema e migracoes.
- SQLite local durante o prototipo.
- Postgres/Supabase quando o produto precisar de ambiente compartilhado.
- Tailwind ou CSS modules conforme o estilo visual do produto principal Med Mind.

Motivo:

- rapido para prototipar;
- facil de evoluir para produto real;
- boa experiencia para dashboard e fluxos interativos;
- baixo atrito para executar localmente;
- caminho claro para deploy futuro.

## Modulos De Dominio

### `users`

Identidade do aluno, medico, admin ou instituicao. No MVP local pode ser mockado.

### `patients`

Pacientes simulados e seus dados de origem.

### `clinic`

Carteira do aluno, estados clinicos, relacionamento, agenda e historico.

### `finance`

Conta em MedCoin, transacoes, receitas, custos e resumo financeiro.

### `operations`

Aluguel, secretaria, no-show e eficiencia operacional.

### `performance`

Scores de tecnica, comunicacao-vinculo e gestao.

### `integration`

Contratos de entrada e saida entre Consultorio Vivo e outros modulos da Med Mind.

## Fronteiras Importantes

O Consultorio Vivo pode conhecer:

- `sourceProduct`;
- `sourceCaseId`;
- especialidade;
- resumo clinico;
- hipoteses iniciais;
- labs estruturados;
- desempenho inicial do aluno;
- elegibilidade longitudinal.

O Consultorio Vivo nao deve depender de:

- tabelas internas do HepatoMind;
- componentes de UI do HepatoMind, exceto design system compartilhado futuro;
- prompts internos do motor clinico do HepatoMind;
- regras privadas de avaliacao nao exportadas em contrato.

## Persistencia

No prototipo, os dados podem comecar em seed local e SQLite.

No MVP real, usar banco relacional com tabelas para:

- usuarios;
- pacientes simulados;
- estados de pacientes por usuario;
- eventos longitudinais;
- mensagens de consulta;
- contas;
- transacoes;
- perfis de secretaria;
- performance.

## IA No MVP

Diretriz tecnica:

- manter estado estruturado como fonte da verdade;
- gerar linguagem a partir do estado, nao o contrario;
- salvar resumo apos cada interacao;
- impedir que a IA invente trajetorias clinicas sem trilhos;
- separar avaliacao tecnica, avaliacao de comunicacao e atualizacao de vinculo.

## Compliance Educacional

O produto deve declarar e reforcar que:

- pacientes sao simulados;
- o ambiente e educacional;
- nao ha decisao clinica real;
- scores nao representam qualidade assistencial real;
- ranking publico e diretorio medico ficam fora do MVP.

